import {
  Logger,
  Controller,
  Delete,
  Get,
  Post,
  Req,
  Res,
  Query,
  Param,
} from '@nestjs/common';
import { GetUserFromRequest } from '@gitroom/nestjs-libraries/user/user.from.request';
import { User } from '@prisma/client';
import {
  CopilotRuntime,
  OpenAIAdapter,
  copilotRuntimeNodeHttpEndpoint,
  copilotRuntimeNextJSAppRouterEndpoint,
} from '@copilotkit/runtime';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { Organization } from '@prisma/client';
import { SubscriptionService } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/subscription.service';
import { PostsService } from '@gitroom/nestjs-libraries/database/prisma/posts/posts.service';
import { MastraAgent } from '@ag-ui/mastra';
import { MastraService } from '@gitroom/nestjs-libraries/chat/mastra.service';
import { Request, Response } from 'express';
import { RequestContext } from '@mastra/core/di';
import { CheckPolicies } from '@gitroom/backend/services/auth/permissions/permissions.ability';
import { AuthorizationActions, Sections } from '@gitroom/backend/services/auth/permissions/permission.exception.class';

export type ChannelsContext = {
  integrations: string;
  organization: string;
  ui: string;
};

/**
 * How many of a week's posts are looked up in Postiz for their real state.
 * A week is 40-60 posts, so this is slack rather than a limit; it exists so a
 * hand-written or a runaway record can never turn one page view into an
 * unbounded fan-out of queries. Anything past it is reported as not looked up,
 * never as not found.
 */
const RUN_POSTIZ_LOOKUP_CAP = 200;

@Controller('/copilot')
export class CopilotController {
  constructor(
    private _subscriptionService: SubscriptionService,
    private _mastraService: MastraService,
    private _postsService: PostsService
  ) {}

  // Headers for every call to the content bridge: the trusted caller identity
  // plus the optional shared secret. The owner is the Postiz user id, chosen
  // over the org id because a chat session belongs to the person who typed it:
  // this instance is multi-org capable, and a user who moves org must keep
  // their own history rather than inherit their new colleagues'. The org id
  // rides along for provenance only; the bridge records it, never matches on it.
  private bridgeHeaders(user: User, organization?: Organization) {
    return {
      'x-bridge-owner': user.id,
      ...(organization?.id ? { 'x-bridge-org': organization.id } : {}),
      ...(process.env.CONTENT_BRIDGE_TOKEN
        ? { 'x-bridge-token': process.env.CONTENT_BRIDGE_TOKEN }
        : {}),
    };
  }

  // Claude Code content bridge (user-approved web surface): pipes the SSE
  // stream from the loopback bridge on the host, see design-system
  // postiz/bridge/README.md.
  //
  // ACCESS: every signed-in, activated user, of any org. The admin gate was
  // dropped deliberately (commit 1d9010c4, owner's decision: this is an
  // internal tool), so entry to the surface is guarded only by the
  // AuthMiddleware this controller is registered under in api.module.ts. There
  // is no role check and no @CheckPolicies, unlike /agent and /list. Do not add
  // one back, and note that @CheckPolicies([Create, AI]) is not the neutral
  // consistency fix it looks like: PermissionsService.check() grants every
  // requested policy outright while STRIPE_PUBLISHABLE_KEY is unset, which it is
  // on this instance, so the sibling routes' decorators enforce nothing here
  // either. The day billing is switched on, that same decorator starts denying
  // this route to every org on the FREE tier (pricing.FREE.ai === false), i.e.
  // exactly the users the owner decided to admit. It can only ever be a no-op or
  // a reversal of that decision, and the bridge does not spend Postiz AI credits
  // anyway: it runs on the host's own Claude Code subscription.
  //
  // WHAT THAT MIDDLEWARE DOES NOT DO IS SCOPE THE DATA (a comment on the
  // sessions route below used to claim it did, and that claim was the whole
  // defect). It resolves who the caller is; it says nothing about whose chat
  // sessions they may see, and the bridge index is shared by every user of the
  // instance. So the three bridge routes here send the caller's identity to the
  // bridge as x-bridge-owner and the bridge scopes list, delete AND resume to
  // it. The identity comes from req.user, re-resolved from the database by the
  // middleware on every request; it is NEVER taken from the body or the query,
  // because those are the browser's to write and the scoping would be
  // bypassable by anyone who read the network tab. No owner, no request.
  //
  // The spawned sessions are NOT read-only: the bridge's profiles allow
  // Write/Edit inside the design-system repo plus an allowlist of pipeline
  // scripts. What a session may touch is fenced in the bridge, not here.
  @Post('/content-chat')
  async contentChat(
    @Req() req: Request,
    @Res() res: Response,
    @GetUserFromRequest() user: User,
    @GetOrgFromRequest() organization: Organization
  ) {
    const bridgeUrl =
      process.env.CONTENT_BRIDGE_URL || 'http://host.docker.internal:6299';
    // BEFORE a single header goes out, like the bridge's own validation and for
    // the same reason: once the SSE headers are sent, a failure reaches the
    // browser as a truncated stream instead of an error. The middleware makes
    // this unreachable, so it is a fail-closed floor rather than a live path:
    // if it ever does fire, the request must not reach the bridge without an
    // owner, or the turn would create a session belonging to nobody.
    if (!user?.id) {
      return res.status(403).json({ error: 'Not signed in' });
    }
    res.setHeader('content-type', 'text/event-stream');
    res.setHeader('cache-control', 'no-cache');
    // the container's nginx must pass stream bytes through as they arrive:
    // buffered SSE idles past proxy timeouts on long tool-using turns
    res.setHeader('x-accel-buffering', 'no');
    (res as any).flushHeaders?.();
    // `code` is the machine-readable half of the frame, and the field clients
    // must branch on. The HTTP status is not available to them: flushHeaders()
    // above already ran, so even a refusal reaches the browser as a 200 with
    // the real answer carried in this frame. Without a code the client has to
    // pattern-match the English `message`, which silently breaks the moment
    // the wording is edited.
    const emitError = (message: string, code = 'bridge_offline') => {
      try {
        res.write(
          `data: ${JSON.stringify({ type: 'error', code, message })}\n\n`
        );
      } catch {}
    };
    const controller = new AbortController();
    req.on('close', () => controller.abort());
    try {
      const upstream = await fetch(`${bridgeUrl}/chat`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...this.bridgeHeaders(user, organization),
        },
        // built field by field on purpose: nothing from req.body is spread, so
        // an `owner` the browser invents cannot ride along beside the header
        body: JSON.stringify({
          message: String((req.body as any)?.message || '').slice(0, 8000),
          sessionId:
            typeof (req.body as any)?.sessionId === 'string'
              ? (req.body as any).sessionId
              : undefined,
          // one bridge profile per chat surface (assistant/content tabs +
          // the composer's 'post'); anything unexpected falls back to the
          // content default rather than erroring
          profile: ['assistant', 'post'].includes((req.body as any)?.profile)
            ? (req.body as any).profile
            : 'content',
        }),
        signal: controller.signal,
      });
      if (!upstream.ok || !upstream.body) {
        // 403 is the bridge refusing to resume a session this caller does not
        // own, which is a real answer and not an outage, so do not report it
        // as one
        if (upstream.status === 403) {
          emitError(
            'That conversation belongs to another user',
            'session_refused'
          );
        } else {
          emitError('Content bridge is offline');
        }
        return res.end();
      }
      const reader = (upstream.body as any).getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(Buffer.from(value));
      }
    } catch {
      emitError('Content bridge is offline');
    }
    return res.end();
  }

  // Bridge session index, open to every org user by the owner's decision (this
  // is an internal tool): the sessions rail lists and prunes the session
  // entries the bridge keeps in postiz/bridge/sessions.json. Plain JSON
  // passthrough; any failure collapses to the same offline error shape the chat
  // uses.
  //
  // `profile` is which chat surface is asking, NOT a fence. The caller's
  // identity is the fence, and it travels in x-bridge-owner, so the bridge
  // returns only this user's sessions. Filtering by profile alone is what leaked
  // every user's session titles to every other user, and a title is the first 60
  // characters of a first message.
  @Get('/content-sessions')
  async contentSessions(
    @GetUserFromRequest() user: User,
    @GetOrgFromRequest() organization: Organization,
    @Query('profile') profile?: string
  ) {
    const bridgeUrl =
      process.env.CONTENT_BRIDGE_URL || 'http://host.docker.internal:6299';
    if (!user?.id) {
      return { error: 'Not signed in' };
    }
    const query = ['assistant', 'content', 'post'].includes(profile || '')
      ? `?profile=${profile}`
      : '';
    try {
      const upstream = await fetch(`${bridgeUrl}/sessions${query}`, {
        headers: this.bridgeHeaders(user, organization),
      });
      if (!upstream.ok) {
        return { error: 'Content bridge is offline' };
      }
      return await upstream.json();
    } catch {
      return { error: 'Content bridge is offline' };
    }
  }

  // One page of a bridge session's past messages, so reopening a conversation
  // shows it instead of a notice saying it exists. Same auth and same header
  // treatment as its two siblings above, which is the whole security story here:
  // the caller's identity comes from req.user and travels in x-bridge-owner, the
  // id in the path is only ever an id, and the bridge answers nothing for a
  // session this user does not own. Nothing about the payload is filtered here —
  // it cannot be, since this route never knows whose session it is; that
  // judgement belongs to the bridge, which holds the ownership record.
  //
  // The bridge returns 404 for "not yours", "no such session" and a legacy
  // ownerless record alike, on purpose, so this route cannot be walked to learn
  // which session ids exist. Reported with the same product-language wording and
  // the same `code` the DELETE proxy uses for that answer.
  @Get('/content-sessions/:id/history')
  async contentSessionHistory(
    @GetUserFromRequest() user: User,
    @GetOrgFromRequest() organization: Organization,
    @Param('id') id: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string
  ) {
    const bridgeUrl =
      process.env.CONTENT_BRIDGE_URL || 'http://host.docker.internal:6299';
    if (!user?.id) {
      return { error: 'Not signed in' };
    }
    // Rebuilt param by param rather than forwarded, exactly like the chat body:
    // only these two ever reach the bridge, so nothing a browser appends to the
    // query string can ride along beside the owner header.
    const params = new URLSearchParams();
    const n = Number(limit);
    if (Number.isFinite(n) && n > 0) params.set('limit', String(Math.floor(n)));
    if (typeof cursor === 'string' && cursor) params.set('cursor', cursor);
    const query = params.toString();
    try {
      const upstream = await fetch(
        `${bridgeUrl}/sessions/${encodeURIComponent(id)}/history${
          query ? `?${query}` : ''
        }`,
        { headers: this.bridgeHeaders(user, organization) }
      );
      if (!upstream.ok) {
        if (upstream.status === 404) {
          return {
            error: 'That conversation is no longer available',
            code: 'session_not_found',
          };
        }
        // 400 is the bridge refusing a cursor it cannot resolve — the session
        // forked, or a transcript went, since the page that handed it out. Not an
        // outage, and the recovery is to keep what is on screen and stop offering
        // earlier pages, so it must not be reported as the bridge being down.
        if (upstream.status === 400) {
          return {
            error: 'Earlier messages could not be loaded',
            code: 'history_unavailable',
          };
        }
        return { error: 'Content bridge is offline', code: 'bridge_offline' };
      }
      return await upstream.json();
    } catch {
      return { error: 'Content bridge is offline', code: 'bridge_offline' };
    }
  }

  // Prune one rail entry. The bridge deletes it only if this caller owns it, and
  // answers "not found" identically whether the session is somebody else's or
  // does not exist, so the route cannot be walked to discover session ids. Both
  // of those come back here as a non-2xx and collapse into the one error shape
  // below, which the rail treats the same way in either case: it refetches.
  @Delete('/content-sessions/:id')
  async deleteContentSession(
    @GetUserFromRequest() user: User,
    @GetOrgFromRequest() organization: Organization,
    @Param('id') id: string
  ) {
    const bridgeUrl =
      process.env.CONTENT_BRIDGE_URL || 'http://host.docker.internal:6299';
    if (!user?.id) {
      return { error: 'Not signed in' };
    }
    try {
      const upstream = await fetch(
        `${bridgeUrl}/sessions/${encodeURIComponent(id)}`,
        {
          method: 'DELETE',
          headers: this.bridgeHeaders(user, organization),
        }
      );
      if (!upstream.ok) {
        // the bridge answers 404 for a session that is not this caller's, does
        // not exist, or is a legacy ownerless record. All three mean the id is
        // unusable from here, which is a real answer and not an outage, so it
        // must not be reported as one
        if (upstream.status === 404) {
          return {
            error: 'That conversation is no longer available',
            code: 'session_not_found',
          };
        }
        return { error: 'Content bridge is offline', code: 'bridge_offline' };
      }
      try {
        return await upstream.json();
      } catch {
        return {};
      }
    } catch {
      return { error: 'Content bridge is offline', code: 'bridge_offline' };
    }
  }

  // ---------------------------------------------------------------------------
  // THE WEEK RUN. A weekly agent run is served as a reviewable OBJECT rather
  // than read back out of a chat transcript: the bridge holds
  // exports/week-<N>/run.json, validates it against its schema on read, and
  // joins it against schedule.json / content.json / schedule.state.json as they
  // are now. See the WEEK RUN block in design-system postiz/bridge/server.mjs.
  //
  // SCOPING IS DELIBERATELY NOT THE SESSIONS SCOPING. The three routes above
  // send x-bridge-owner and the bridge matches sessions against it, because a
  // chat session belongs to whoever typed it. A week run does not belong to
  // anybody: Ace built it inside somebody's session, the posts went to the
  // company's channels, and whoever reviews the week on Friday is routinely not
  // the login that ran it on Monday. So these two routes are ORG-WIDE — the
  // owner header still travels (the bridge refuses a request without one, which
  // is what proves the call came through this proxy from a signed-in user) but
  // the org is the fence, and the bridge requires it here rather than merely
  // recording it. An org must therefore be resolvable, hence the check below,
  // which is stricter than the siblings' `user?.id` floor.
  @Get('/content-runs')
  async contentRuns(
    @GetUserFromRequest() user: User,
    @GetOrgFromRequest() organization: Organization
  ) {
    const bridgeUrl =
      process.env.CONTENT_BRIDGE_URL || 'http://host.docker.internal:6299';
    if (!user?.id || !organization?.id) {
      return { error: 'Not signed in', code: 'not_signed_in' };
    }
    try {
      const upstream = await fetch(`${bridgeUrl}/runs`, {
        headers: this.bridgeHeaders(user, organization),
      });
      if (!upstream.ok) {
        // A refused org is a real answer, not an outage, and must not be
        // reported as one — the page would tell the reader to go and restart a
        // bridge that is running perfectly well.
        if (upstream.status === 403) {
          return {
            error:
              'This organization does not have access to the content pipeline',
            code: 'run_forbidden',
          };
        }
        return { error: 'Content bridge is offline', code: 'bridge_offline' };
      }
      return await upstream.json();
    } catch {
      return { error: 'Content bridge is offline', code: 'bridge_offline' };
    }
  }

  /**
   * The one thing this proxy adds that the bridge cannot know: what Postiz
   * actually holds for the posts the record claims, and whether they are still
   * waiting for approval.
   *
   * This matters because the rest of the record is the pipeline describing
   * itself. `schedule.state.json` says the pusher believed it created a post;
   * only the database can say the post exists, at what minute, in what state,
   * and whether the org's approvals gate is still holding it. That is what the
   * owner is reviewing towards, so it is the half worth fetching live.
   *
   * The join key is `postizId`, captured by push-postiz.mjs. It is null for
   * every post of a week pushed before 12 Aug 2026 (the capture landed that
   * morning), so a null is reported as NOT LINKED and never as missing — an old
   * week must read as unverifiable, not as broken.
   *
   * Every lookup is scoped to this organization, so an id belonging to another
   * org resolves to `found: false` exactly like an id that never existed. That
   * is the org fence doing real work rather than being asserted.
   */
  private async attachPostizState(run: any, organization: Organization) {
    const orgId = organization.id;
    const posts: any[] = Array.isArray(run?.posts) ? run.posts : [];
    const ids = [
      ...new Set(
        posts
          .map((p) => p?.push?.postizId)
          .filter((id): id is string => typeof id === 'string' && !!id)
      ),
    ];
    const looked = ids.slice(0, RUN_POSTIZ_LOOKUP_CAP);
    const found = new Map<string, any>();
    await Promise.all(
      looked.map(async (id) => {
        try {
          const post = await this._postsService.getPostById(id, orgId);
          if (post) found.set(id, post);
        } catch {
          // A lookup that throws must not cost the reader the whole page. The id
          // simply stays out of the map and reports as not found, which is the
          // truthful answer: this route could not confirm the post.
        }
      })
    );
    const lookedSet = new Set(looked);

    const summary = {
      // Whether the org's approvals gate is on at all. Without it, "0 awaiting
      // approval" would read as "the week is approved" when it can equally mean
      // nothing was ever gated. Organization.requireApproval forces DRAFT plus
      // needsApproval server-side, so this is the rule the counts happen under.
      // Read off the request org, which AuthMiddleware loads as a whole row
      // (getOrgsByUserId selects no columns, so every scalar is there); the cast
      // is because the decorator hands back `request.org` untyped.
      gateOn: !!(organization as any).requireApproval,
      linked: 0,
      lookedUp: looked.length,
      notLookedUp: ids.length - looked.length,
      found: 0,
      missing: 0,
      awaitingApproval: 0,
      draft: 0,
      queued: 0,
      published: 0,
      errored: 0,
      deleted: 0,
      undated: 0,
      dateMismatch: 0,
    };

    const withState = posts.map((p) => {
      const postizId: string | null = p?.push?.postizId || null;
      if (!postizId) return { ...p, postiz: null };
      summary.linked++;
      if (!lookedSet.has(postizId)) {
        return { ...p, postiz: { lookedUp: false } };
      }
      const rec = found.get(postizId);
      if (!rec) {
        summary.missing++;
        return { ...p, postiz: { lookedUp: true, found: false } };
      }
      summary.found++;
      // Post.publishDate is nullable now and undated drafts are real, so "no
      // date" is a value here and not a missing field.
      const publishDate: Date | null = rec.publishDate || null;
      const claimed = typeof p.datetime === 'string' ? Date.parse(p.datetime) : NaN;
      // Compared to the minute: the pusher converts a +01:00 wall-clock time to
      // UTC on the way in, so an exact equality would flag every post over a
      // rounding difference that means nothing.
      const dateMatches =
        publishDate && Number.isFinite(claimed)
          ? Math.abs(publishDate.getTime() - claimed) < 60_000
          : null;
      if (!publishDate) summary.undated++;
      if (dateMatches === false) summary.dateMismatch++;
      if (rec.deletedAt) summary.deleted++;
      if (rec.needsApproval) summary.awaitingApproval++;
      if (rec.state === 'DRAFT') summary.draft++;
      if (rec.state === 'QUEUE') summary.queued++;
      if (rec.state === 'PUBLISHED') summary.published++;
      if (rec.state === 'ERROR') summary.errored++;
      return {
        ...p,
        postiz: {
          lookedUp: true,
          found: true,
          state: rec.state,
          needsApproval: !!rec.needsApproval,
          publishDate: publishDate ? publishDate.toISOString() : null,
          dateMatches,
          deleted: !!rec.deletedAt,
          releaseURL: rec.releaseURL || null,
        },
      };
    });

    return { ...run, posts: withState, postiz: summary };
  }

  /**
   * One week's raw record from the bridge, or the refusal to report instead of
   * it. Exactly one of the two is ever non-null.
   *
   * Shared by the read route and the approve route so the two can never drift
   * apart on what a 404, a 422 or an offline bridge means. That matters most
   * for the 422: a record that fails its schema is refused here, so the approve
   * route cannot act on a record the page would refuse to render. Approving
   * from a record nobody is allowed to look at is the one way this feature
   * could be worse than no feature.
   */
  private async fetchRunRecord(
    week: number,
    user: User,
    organization: Organization
  ): Promise<{ record: any; refusal: any }> {
    const bridgeUrl =
      process.env.CONTENT_BRIDGE_URL || 'http://host.docker.internal:6299';
    try {
      const upstream = await fetch(`${bridgeUrl}/runs/${week}`, {
        headers: this.bridgeHeaders(user, organization),
      });
      const body = await upstream.json().catch(() => null);
      if (!upstream.ok) {
        if (upstream.status === 404) {
          return {
            record: null,
            refusal: {
              error: `No run record for week ${week}`,
              code: 'no_run_record',
            },
          };
        }
        if (upstream.status === 422) {
          return {
            record: null,
            refusal: {
              error: (body as any)?.error || 'That run record is not valid',
              code: 'invalid_run_record',
              violations: (body as any)?.violations || [],
            },
          };
        }
        if (upstream.status === 403) {
          return {
            record: null,
            refusal: {
              error:
                'This organization does not have access to the content pipeline',
              code: 'run_forbidden',
            },
          };
        }
        return {
          record: null,
          refusal: { error: 'Content bridge is offline', code: 'bridge_offline' },
        };
      }
      return { record: body, refusal: null };
    } catch {
      return {
        record: null,
        refusal: { error: 'Content bridge is offline', code: 'bridge_offline' },
      };
    }
  }

  // One week's record. The bridge answers 422 with a list of violations for a
  // record that does not match its schema, and that is passed through as a
  // refusal rather than smoothed into an offline error: a malformed record is a
  // fact about the run, and the page must say so instead of rendering half of
  // it. 404 means no record was ever written for that week.
  @Get('/content-runs/:week')
  async contentRun(
    @GetUserFromRequest() user: User,
    @GetOrgFromRequest() organization: Organization,
    @Param('week') week: string
  ) {
    if (!user?.id || !organization?.id) {
      return { error: 'Not signed in', code: 'not_signed_in' };
    }
    // Rebuilt from a parsed number rather than forwarded as text, so nothing a
    // browser puts in the path can reach the bridge's filesystem lookup. The
    // bridge validates the range again on its side; this is the outer of two.
    const n = Number(week);
    if (!Number.isInteger(n) || n < 1 || n > 53) {
      return { error: 'That is not a week number', code: 'invalid_week' };
    }
    const { record, refusal } = await this.fetchRunRecord(n, user, organization);
    if (refusal) {
      return refusal;
    }
    try {
      return await this.attachPostizState(record, organization);
    } catch {
      return { error: 'Content bridge is offline', code: 'bridge_offline' };
    }
  }

  /**
   * APPROVE THE WEEK. This is the route that turns the Week Run page from a
   * report into a decision.
   *
   * The objection it answers is that a read-only review surface you have to
   * remember to open does not survive contact with a busy week: the approval
   * still happens one calendar card at a time somewhere else, and eventually it
   * stops happening at all. So the page that shows what a week is also releases
   * it, in one act, from the same screen that just showed you the evidence.
   *
   * WHAT IT ACTUALLY DOES is a loop over PostsService.changePostStatus, which
   * already carries the whole rule set: the approver-role check, the
   * has-a-publish-date check, clearing needsApproval and re-arming the publish
   * workflow. Nothing about approval is redefined here. This route's own job is
   * only to answer WHICH posts a week means, and to report every one of them.
   *
   * SCOPING, deliberately, is the sibling read routes' scoping PLUS the acting
   * user. The org is the fence on which week may be read, because a week run
   * belongs to the company and not to whoever's session built it — Friday's
   * reviewer is routinely not Monday's operator. But approving is a WRITE, and
   * the question "may you release these posts" is about a person, not an org.
   * So user.id is passed down to changePostStatus for the role check, and it
   * comes from req.user (re-resolved from the database by AuthMiddleware on
   * every request), never from the body or the query. An org-scoped read gate
   * must not become an unauthenticated write.
   *
   * IDEMPOTENT: the service skips anything already in QUEUE before any write,
   * so pressing this twice approves nothing the second time and reports every
   * post as already queued. Nothing here needs to guard against a double click
   * beyond saying so.
   */
  @Post('/content-runs/:week/approve')
  async approveContentRun(
    @GetUserFromRequest() user: User,
    @GetOrgFromRequest() organization: Organization,
    @Param('week') week: string
  ) {
    if (!user?.id || !organization?.id) {
      return { error: 'Not signed in', code: 'not_signed_in' };
    }
    const n = Number(week);
    if (!Number.isInteger(n) || n < 1 || n > 53) {
      return { error: 'That is not a week number', code: 'invalid_week' };
    }

    const { record, refusal } = await this.fetchRunRecord(n, user, organization);
    if (refusal) {
      return refusal;
    }

    const posts: any[] = Array.isArray(record?.posts) ? record.posts : [];
    // Deduplicated because the same Postiz id appearing twice in a record is a
    // record bug, not an instruction to approve the post twice; both rows still
    // get the outcome back on the way out, via the id map below.
    const ids = [
      ...new Set(
        posts
          .map((p) => p?.push?.postizId)
          .filter((id): id is string => typeof id === 'string' && !!id)
      ),
    ];
    // The same cap the read route uses, for the same reason and now with teeth:
    // a hand-written or runaway record must not turn one click into an
    // unbounded fan-out of WRITES. Anything past it is reported as not
    // attempted, which is the truthful answer, and is never silent.
    const attempted = ids.slice(0, RUN_POSTIZ_LOOKUP_CAP);
    const attemptedSet = new Set(attempted);

    const { gateOn, mayApprove, results } =
      await this._postsService.approvePosts(
        organization.id,
        attempted,
        user.id
      );

    // Reported as a refusal body rather than thrown as a 403, matching every
    // other route on this controller — the page reads `code` and says something
    // useful, where a Nest exception filter would hand it {statusCode, error:
    // 'Forbidden'} and the reader would learn nothing. It is safe to answer 200
    // here because the service returns before its loop when this is false:
    // nothing was written, and the enforcing copy of the check still sits
    // inside changePostStatus regardless.
    if (!mayApprove) {
      return {
        error:
          'Only an organization admin can approve posts. Ask an admin to release this week.',
        code: 'not_an_approver',
        gateOn,
      };
    }

    const byPostizId = new Map(results.map((r) => [r.id, r]));

    const summary = {
      posts: posts.length,
      attempted: attempted.length,
      approved: 0,
      alreadyQueued: 0,
      notAwaiting: 0,
      refused: 0,
      notFound: 0,
      deleted: 0,
      notLinked: 0,
      notAttempted: 0,
    };
    const counter: Record<string, keyof typeof summary> = {
      approved: 'approved',
      already_queued: 'alreadyQueued',
      not_awaiting: 'notAwaiting',
      refused: 'refused',
      not_found: 'notFound',
      deleted: 'deleted',
      not_linked: 'notLinked',
      not_attempted: 'notAttempted',
    };

    // Kept in record order, so the list reads against the week table on the
    // page rather than having to be searched.
    const outcomes = posts.map((p) => {
      const postizId: string | null = p?.push?.postizId || null;
      // Undefined for an id past the cap, and — unreachably, while the service
      // answers every id it is handed — for a result it failed to return. Both
      // become `not_attempted` rather than being dropped, so a gap in that
      // contract would surface as an unapproved post instead of a missing row.
      const result =
        postizId && attemptedSet.has(postizId)
          ? byPostizId.get(postizId)
          : null;
      // `not_linked` is not `not_found`: the first means this week never
      // recorded an id to act on (every week pushed before 12 Aug 2026), the
      // second means an id was recorded and this org has no such post. Blurring
      // them would accuse the database of losing a post it was never given.
      const outcome = !postizId
        ? 'not_linked'
        : result
        ? result.outcome
        : 'not_attempted';
      summary[counter[outcome]]++;
      return {
        // The RECORD's post id, which is what the week table above shows. Not
        // the Postiz id, which the reviewer has never seen.
        id: p?.id,
        platform: p?.platform || null,
        datetime: p?.datetime || null,
        postizId,
        outcome,
        state: result?.state || null,
        ...(result?.reason ? { reason: result.reason } : {}),
      };
    });

    return {
      week: n,
      // Whether the org's approvals gate is on at all. With it off there is
      // normally nothing to approve, and the page says exactly that instead of
      // treating a week of zero approvals as a failure. Posts still carrying
      // the flag from before the gate was switched off are approved anyway,
      // because they are genuinely still held.
      gateOn,
      summary,
      posts: outcomes,
      // Scheduled posts this record does not contain. They were NOT approved —
      // this route can only act on what the record links — and they are handed
      // back so the page can name them. A week that is half-approved because
      // the record is stale must not read as an approved week.
      unmatched: Array.isArray(record?.unmatched) ? record.unmatched : [],
    };
  }

  @Post('/chat')
  chatAgent(@Req() req: Request, @Res() res: Response) {
    if (
      process.env.OPENAI_API_KEY === undefined ||
      process.env.OPENAI_API_KEY === ''
    ) {
      Logger.warn('OpenAI API key not set, chat functionality will not work');
      return;
    }

    const copilotRuntimeHandler = copilotRuntimeNodeHttpEndpoint({
      endpoint: '/copilot/chat',
      runtime: new CopilotRuntime(),
      serviceAdapter: new OpenAIAdapter({
        model: 'gpt-4.1',
      }),
    });

    return copilotRuntimeHandler(req, res);
  }

  @Post('/agent')
  @CheckPolicies([AuthorizationActions.Create, Sections.AI])
  async agent(
    @Req() req: Request,
    @Res() res: Response,
    @GetOrgFromRequest() organization: Organization
  ) {
    if (
      process.env.OPENAI_API_KEY === undefined ||
      process.env.OPENAI_API_KEY === ''
    ) {
      Logger.warn('OpenAI API key not set, chat functionality will not work');
      return;
    }
    const mastra = await this._mastraService.mastra();
    const requestContext = new RequestContext<ChannelsContext>();
    requestContext.set(
      'integrations',
      req?.body?.variables?.properties?.integrations || []
    );

    requestContext.set('organization', JSON.stringify(organization));
    requestContext.set('ui', 'true');

    const agents = MastraAgent.getLocalAgents({
      resourceId: organization.id,
      mastra,
      requestContext: requestContext as any,
    });

    const runtime = new CopilotRuntime({
      agents,
    });

    const copilotRuntimeHandler = copilotRuntimeNextJSAppRouterEndpoint({
      endpoint: '/copilot/agent',
      runtime,
      // properties: req.body.variables.properties,
      serviceAdapter: new OpenAIAdapter({
        model: 'gpt-4.1',
      }),
    });

    return copilotRuntimeHandler.handleRequest(req, res);
  }

  @Get('/credits')
  calculateCredits(
    @GetOrgFromRequest() organization: Organization,
    @Query('type') type: 'ai_images' | 'ai_videos'
  ) {
    return this._subscriptionService.checkCredits(
      organization,
      type || 'ai_images'
    );
  }

  @Get('/:thread/list')
  @CheckPolicies([AuthorizationActions.Create, Sections.AI])
  async getMessagesList(
    @GetOrgFromRequest() organization: Organization,
    @Param('thread') threadId: string
  ): Promise<any> {
    const mastra = await this._mastraService.mastra();
    const memory = await mastra.getAgent('postiz').getMemory();
    try {
      return await memory.recall({
        resourceId: organization.id,
        threadId,
      });
    } catch (err) {
      Logger.warn(`Could not recall messages for thread ${threadId}: ${err}`);
      return { messages: [] };
    }
  }

  @Get('/list')
  @CheckPolicies([AuthorizationActions.Create, Sections.AI])
  async getList(@GetOrgFromRequest() organization: Organization) {
    const mastra = await this._mastraService.mastra();
    const memory = await mastra.getAgent('postiz').getMemory();
    const list = await memory.listThreads({
      filter: { resourceId: organization.id },
      perPage: 100000,
      page: 0,
      orderBy: { field: 'createdAt', direction: 'DESC' },
    });

    return {
      threads: list.threads.map((p) => ({
        id: p.id,
        title: p.title,
      })),
    };
  }
}
