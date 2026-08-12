import { makeId } from '@gitroom/nestjs-libraries/services/make.is';
import { SocialAbstract, BadBody } from '../social.abstract';
import {
  AuthTokenDetails,
  PostDetails,
  PostResponse,
  SocialProvider,
} from './social.integrations.interface';
import dayjs from 'dayjs';
import { Integration } from '@prisma/client';
import { AuthService } from '@gitroom/helpers/auth/auth.service';

/**
 * Buffer relay providers.
 *
 * Cuesoft cannot post to LinkedIn or TikTok with its own apps: the TikTok
 * developer app was rejected outright (TikTok for Developers does not support
 * internal company use) and self-hosted Postiz requires your own app, so that
 * door is permanently closed. Buffer is an approved partner for both.
 *
 * These providers make LinkedIn and TikTok behave like any other channel —
 * connectable, schedulable, visible on the calendar — while `post()` hands the
 * finished post to Buffer at publish time instead of calling the platform.
 * Postiz's own timer decides WHEN; Buffer only delivers.
 *
 * The point is not convenience. A standalone Buffer push posts live with no
 * approvals gate, which is why it is banned from every agent path. Behind a
 * provider, a post must clear the Postiz drafts/approvals gate before Buffer
 * ever sees it.
 *
 * Media is passed through by URL. Buffer has no upload endpoint and fetches
 * assets itself, and Postiz media already lives on public R2, so nothing is
 * copied or re-hosted — but the URL must stay reachable until Buffer fetches.
 */

const BUFFER_API = 'https://api.buffer.com';

// Buffer's queue is not instant. `post()` runs at the scheduled minute, so the
// post is already due; this small lead just keeps dueAt from landing in the
// past between building the payload and Buffer receiving it.
const DUE_LEAD_SECONDS = 60;

const CREATE_POST = `mutation($input: CreatePostInput!) {
  createPost(input: $input) {
    __typename
    ... on PostActionSuccess { post { id dueAt } }
    ... on MutationError { message }
  }
}`;

const CHANNELS = `query($orgId: OrganizationId!) {
  channels(input: { organizationId: $orgId }) { id service name avatar }
}`;

const ORGANIZATIONS = `{ account { organizations { id name } } }`;

type BufferAsset =
  | { image: { url: string; metadata?: { altText: string } } }
  | { video: { url: string; metadata: { thumbnailOffset: number } } }
  | { document: { url: string; title: string; thumbnailUrl: string } };

const isVideo = (path: string) => /\.mp4($|\?)/i.test(path);
const isPdf = (path: string) => /\.pdf($|\?)/i.test(path);

export abstract class BufferRelayProvider
  extends SocialAbstract
  implements SocialProvider
{
  abstract override identifier: string;
  abstract name: string;
  /** the Buffer `service` this channel must be, e.g. 'linkedin' | 'tiktok' */
  abstract bufferService: string;

  isBetweenSteps = false;
  scopes = [] as string[];
  editor = 'normal' as const;
  // Buffer refreshes nothing: the API key is server-side and long-lived.
  refreshCron = false;

  maxLength() {
    // LinkedIn is the tighter of the two; TikTok overrides.
    return 3000;
  }

  /**
   * The API key is a server secret shared by every Buffer channel, so it is
   * NOT a per-integration field — only the channel id is asked for. Read at
   * call time rather than construction so a missing key is a clear publish
   * error rather than a silent boot failure.
   */
  private apiKey(): string {
    const key = process.env.BUFFER_API_KEY;
    if (!key) {
      throw new BadBody(
        this.identifier,
        '{}',
        '',
        'BUFFER_API_KEY is not set on the server, so nothing can be sent to Buffer.'
      );
    }
    return key;
  }

  private async graphql<T = any>(query: string, variables?: any): Promise<T> {
    const res = await fetch(BUFFER_API, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, ...(variables ? { variables } : {}) }),
    });

    // Buffer answers 200 with an `errors` array for most failures, but a 429 or
    // a 5xx arrives as a status with an HTML body — parsing that as JSON throws
    // something unreadable, so check the status first.
    if (!res.ok) {
      const text = (await res.text()).slice(0, 300);
      throw new BadBody(
        this.identifier,
        text,
        JSON.stringify(variables || {}),
        res.status === 429
          ? 'Buffer rate limited the request (429). Retry shortly.'
          : `Buffer returned HTTP ${res.status}: ${text}`
      );
    }

    const json = await res.json();
    if (json?.errors?.length) {
      const message = json.errors.map((e: any) => e.message).join(', ');
      throw new BadBody(
        this.identifier,
        JSON.stringify(json.errors).slice(0, 300),
        JSON.stringify(variables || {}),
        `Buffer: ${message}`
      );
    }
    return json.data as T;
  }

  private async findChannel(channelId: string) {
    const orgs = await this.graphql<{
      account: { organizations: { id: string; name: string }[] };
    }>(ORGANIZATIONS);

    // A channel id is globally unique, so look across every organisation the
    // key can see rather than assuming the first one (the standalone script's
    // organizations[0] heuristic silently picks the wrong account otherwise).
    for (const org of orgs?.account?.organizations || []) {
      const { channels } = await this.graphql<{
        channels: { id: string; service: string; name: string; avatar?: string }[];
      }>(CHANNELS, { orgId: org.id });
      const found = (channels || []).find((c) => c.id === channelId);
      if (found) return found;
    }
    return null;
  }

  async generateAuthUrl() {
    const state = makeId(6);
    return { url: state, codeVerifier: makeId(10), state };
  }

  async refreshToken(): Promise<AuthTokenDetails> {
    return {
      refreshToken: '',
      expiresIn: 0,
      accessToken: '',
      id: '',
      name: '',
      picture: '',
      username: '',
    };
  }

  async customFields() {
    return [
      {
        key: 'channelId',
        label: `Buffer channel id (${this.bufferService})`,
        defaultValue: '',
        // Buffer channel ids are 24-character hex, like Mongo object ids.
        validation: `/^[a-f0-9]{24}$/`,
        type: 'text' as const,
        hint: 'Buffer, open the channel, and copy the id from the URL. The Buffer API key itself lives on the server.',
      },
    ];
  }

  async authenticate(params: { code: string; codeVerifier: string }) {
    let channelId = '';
    try {
      ({ channelId } = JSON.parse(
        Buffer.from(params.code, 'base64').toString()
      ));
    } catch {
      return 'Could not read the channel id';
    }

    try {
      const channel = await this.findChannel(channelId);
      if (!channel) {
        return 'That channel id is not in this Buffer account';
      }
      if (channel.service !== this.bufferService) {
        return `That Buffer channel is ${channel.service}, not ${this.bufferService}`;
      }

      return {
        // no OAuth token exists; the channel id IS the addressing information
        refreshToken: channelId,
        expiresIn: dayjs().add(100, 'years').unix() - dayjs().unix(),
        accessToken: channelId,
        id: channelId,
        name: channel.name,
        picture: channel.avatar || '',
        username: channel.name,
      };
    } catch (err: any) {
      return err?.message?.includes('BUFFER_API_KEY')
        ? 'The server has no Buffer API key configured'
        : 'Could not reach Buffer with the server API key';
    }
  }

  private buildAssets(
    post: PostDetails,
    caption: string
  ): BufferAsset[] {
    const media = post.media || [];
    if (!media.length) return [];

    const video = media.find((m) => isVideo(m.path));
    if (video) {
      // One asset only. Buffer rejects a custom thumbnailUrl on video and picks
      // the cover by offset, so our renders hold the designed cover on the
      // first frames and offset 0 selects it. Any cover PNG sitting alongside
      // the mp4 is deliberately not attached.
      return [{ video: { url: video.path, metadata: { thumbnailOffset: 0 } } }];
    }

    const pdf = media.find((m) => isPdf(m.path));
    if (pdf) {
      const thumb = media.find((m) => !isPdf(m.path));
      if (!thumb) {
        throw new BadBody(
          this.identifier,
          '{}',
          '',
          'A document post needs a cover image alongside the PDF for Buffer to use as its thumbnail.'
        );
      }
      return [
        {
          document: {
            url: pdf.path,
            title: (caption || 'Document').split('\n')[0].slice(0, 80),
            thumbnailUrl: thumb.path,
          },
        },
      ];
    }

    return media.map((m) => ({
      image: {
        url: m.path,
        ...(m.alt ? { metadata: { altText: m.alt } } : {}),
      },
    }));
  }

  async post(
    id: string,
    accessToken: string,
    postDetails: PostDetails[],
    integration: Integration
  ): Promise<PostResponse[]> {
    // The channel id is stored with the connect fields; fall back to the token,
    // which authenticate() also set to the channel id.
    let channelId = accessToken;
    try {
      if (integration.customInstanceDetails) {
        const fields = JSON.parse(
          AuthService.fixedDecryption(integration.customInstanceDetails)
        );
        if (fields?.channelId) channelId = fields.channelId;
      }
    } catch {
      /* fall back to the token */
    }

    // Test/hold mode: park posts this many days out in Buffer instead of
    // sending them. Unset or 0 = publish normally.
    const holdDays = Number(process.env.BUFFER_RELAY_HOLD_DAYS || 0) || 0;

    const out: PostResponse[] = [];

    // Sequential on purpose: Buffer rate limits, and a thread here is a series
    // of separate Buffer posts rather than a native thread.
    for (const post of postDetails) {
      const assets = this.buildAssets(post, post.message);
      const firstComment = (post.settings as any)?.subreddit
        ? undefined
        : (post.settings as any)?.firstComment;

      const input: any = {
        channelId,
        text: post.message || '',
        assets,
        dueAt: holdDays
          ? dayjs().add(holdDays, 'day').toISOString()
          : dayjs().add(DUE_LEAD_SECONDS, 'second').toISOString(),
        mode: 'customScheduled',
        schedulingType: 'automatic',
        // Buffer rejects needsApproval outright unless the channel's own
        // posting policy requires approval ("needsApproval is only valid when
        // your posting policy on this channel requires approval", 2026-08-12),
        // so it cannot be used as a safety switch. BUFFER_RELAY_HOLD_DAYS is
        // the one that works: park the post far in Buffer's future queue,
        // where it is visible and deletable and nothing publishes. Use it to
        // exercise this path against live channels without posting.
        needsApproval: false,
        source: 'postiz-relay',
      };

      if (this.bufferService === 'linkedin' && firstComment) {
        input.metadata = { linkedin: { firstComment } };
      }

      let data;
      try {
        data = await this.graphql(CREATE_POST, { input });
      } catch (err: any) {
        // Buffer's free plan rejects first comments. Losing the comment is far
        // better than losing the post, so retry without it and say so.
        if (
          input.metadata &&
          /first comment requires a paid plan/i.test(err?.message || '')
        ) {
          delete input.metadata;
          data = await this.graphql(CREATE_POST, { input });
        } else {
          throw err;
        }
      }

      const result = data?.createPost;
      if (result?.__typename !== 'PostActionSuccess') {
        throw new BadBody(
          this.identifier,
          JSON.stringify(result || {}).slice(0, 300),
          JSON.stringify(input).slice(0, 300),
          `Buffer refused the post: ${result?.message || 'unknown reason'}`
        );
      }

      out.push({
        id: post.id,
        postId: result.post.id,
        // Buffer returns no permalink and never reports back what the platform
        // did with the post, so there is no release URL to give.
        releaseURL: '',
        status: 'completed',
      });
    }

    return out;
  }
}

export class BufferLinkedinProvider
  extends BufferRelayProvider
  implements SocialProvider
{
  identifier = 'linkedinbuffer';
  name = 'LinkedIn (via Buffer)';
  bufferService = 'linkedin';

  override maxLength() {
    return 3000;
  }
}

export class BufferTiktokProvider
  extends BufferRelayProvider
  implements SocialProvider
{
  identifier = 'tiktokbuffer';
  name = 'TikTok (via Buffer)';
  bufferService = 'tiktok';

  override maxLength() {
    return 2200;
  }

  override async checkValidity(
    posts: Array<{ path: string; thumbnail?: string }[]>
  ): Promise<string | true> {
    const flat = posts.flat();
    if (!flat.length) {
      return 'TikTok needs a video.';
    }
    if (!flat.some((p) => isVideo(p.path))) {
      return 'TikTok through Buffer takes an mp4 video; images are not accepted.';
    }
    return true;
  }
}
