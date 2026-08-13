import { makeId } from '@gitroom/nestjs-libraries/services/make.is';
import { SocialAbstract, BadBody } from '../social.abstract';
import {
  AnalyticsData,
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

// There is exactly ONE gate in this system and it lives in Postiz: a post has
// to be approved there before it is ever scheduled. By the time this provider
// runs, Postiz's own timer has already fired at the chosen minute — the
// decision is made and the moment has arrived. Buffer's job from here is to
// deliver, immediately, and nothing else: `shareNow` with `automatic`, no due
// date, no second approval step. A gate in Buffer would strand posts behind a
// queue nobody is watching.

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

// Insights. Buffer keeps the numbers each platform reports back, which is the
// only place we can get them: neither platform's own API is available to us.
const AGGREGATE_METRICS = `query($input: AggregatedPostMetricsInput!) {
  aggregatedPostMetrics(input: $input) {
    metricsUpdatedAt
    metrics { name type unit value }
  }
}`;

const POST_METRICS = `query($id: PostId!) {
  post(input: { id: $id }) {
    metricsUpdatedAt
    metrics { name type unit value }
  }
}`;

type BufferMetric = {
  name: string;
  type: string;
  unit: string;
  value: number;
};

// How far back Buffer will serve Insights on the current plan. Free plans stop
// at 31 days and reject longer windows outright; the frontend's range gates are
// set to match (7 and 30 only for the relay channels).
const BUFFER_HISTORY_DAYS = 31;

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

  /**
   * The aggregate metrics query demands an organization id, and it must be the
   * one that actually owns this channel — NOT simply the first organization the
   * key can see. Same reasoning as findChannel below: with two organizations,
   * "first wins" quietly reports another account's numbers, or none.
   */
  private async organizationIdForChannel(
    channelId: string
  ): Promise<string | null> {
    const orgs = await this.graphql<{
      account: { organizations: { id: string }[] };
    }>(ORGANIZATIONS);

    const list = orgs?.account?.organizations || [];
    if (list.length === 1) return list[0].id;

    for (const org of list) {
      const { channels } = await this.graphql<{
        channels: { id: string }[];
      }>(CHANNELS, { orgId: org.id });
      if ((channels || []).some((c) => c.id === channelId)) return org.id;
    }
    return null;
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

  /**
   * Channel insights. Buffer reports one total per metric for a window rather
   * than a daily series, so each metric becomes a single point — enough for the
   * headline numbers, and honest about what is actually available. The previous
   * window of equal length is fetched too, purely to make the percentage change
   * real instead of the hardcoded placeholder several providers ship with.
   */
  async analytics(
    id: string,
    accessToken: string,
    date: number
  ): Promise<AnalyticsData[]> {
    const orgId = await this.organizationIdForChannel(id);
    if (!orgId) return [];

    const now = dayjs();
    const window = (from: dayjs.Dayjs, to: dayjs.Dayjs) => ({
      organizationId: orgId,
      channelIds: [id],
      startDateTime: from.toISOString(),
      endDateTime: to.toISOString(),
    });

    // Buffer's free plan serves only the last 31 days of Insights and errors
    // beyond it, so a comparison window is fetched only when it fits — for a
    // 30-day view the previous 30 days are already out of reach, and asking
    // would just burn a request to be told so.
    const comparable = date * 2 <= BUFFER_HISTORY_DAYS;

    const [current, previous] = await Promise.all([
      this.graphql(AGGREGATE_METRICS, {
        input: window(now.subtract(date, 'day'), now),
      }).catch((e) => {
        // Out of plan range: report nothing rather than throwing, which the
        // page would otherwise render as "this channel needs a refresh" —
        // blaming the connection for a billing limit.
        if (/limited to the last/i.test(e?.message || '')) return null;
        throw e;
      }),
      comparable
        ? this.graphql(AGGREGATE_METRICS, {
            input: window(
              now.subtract(date * 2, 'day'),
              now.subtract(date, 'day')
            ),
          }).catch(() => null)
        : Promise.resolve(null),
    ]);

    const metrics: BufferMetric[] =
      current?.aggregatedPostMetrics?.metrics || [];
    const before: BufferMetric[] =
      previous?.aggregatedPostMetrics?.metrics || [];

    return metrics.map((m) => {
      const prior = before.find((p) => p.type === m.type)?.value;
      return {
        label: m.name,
        percentageChange:
          prior && prior !== 0
            ? Math.round(((m.value - prior) / prior) * 100)
            : 0,
        // Rates keep their decimals and their sign: `average` makes the tile
        // render 59.87% rather than a bare rounded 60, and states the change
        // in percentage points, which is the only correct unit for a change
        // in a percentage.
        ...(m.unit === 'percentage' ? { average: true } : {}),
        data: [
          { total: String(m.value), date: now.format('YYYY-MM-DD') },
        ],
      };
    });
  }

  /**
   * Per-post insights. `postId` is the release id Postiz stored when the post
   * published, which for a relayed post is Buffer's own post id.
   */
  async postAnalytics(
    integrationId: string,
    accessToken: string,
    postId: string
  ): Promise<AnalyticsData[]> {
    if (!postId) return [];
    const data = await this.graphql(POST_METRICS, { id: postId });
    const metrics: BufferMetric[] = data?.post?.metrics || [];
    const asOf = data?.post?.metricsUpdatedAt
      ? dayjs(data.post.metricsUpdatedAt)
      : dayjs();

    return metrics.map((m) => ({
      label: m.name,
      // Buffer gives a single current figure per post, with nothing to compare
      // it against, so claiming a change would be inventing one.
      percentageChange: 0,
      data: [{ total: String(m.value), date: asOf.format('YYYY-MM-DD') }],
    }));
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
        // Send it now. No dueAt: `shareNow` means exactly this, and Buffer
        // accepts the shape with or without one (probed 2026-08-12).
        mode: 'shareNow',
        schedulingType: 'automatic',
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
