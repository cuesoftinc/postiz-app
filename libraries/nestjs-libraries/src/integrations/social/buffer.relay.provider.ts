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
import { mayRetryBufferGraphql } from './buffer.relay.retry';

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

// Buffer's own app. `createPost` answers with nothing but `{ id, dueAt }`, and
// Buffer never reports back what LinkedIn or TikTok did with the post, so there
// is no per-network permalink to hand out. Linking to Buffer is the honest
// alternative to inventing a platform URL: it is where the post's real outcome
// can actually be read, and the Buffer post id travels alongside as `postId`.
const BUFFER_APP_URL = 'https://publish.buffer.com';

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

/**
 * The per-day shape, built from the posts themselves.
 *
 * Buffer has no time-series query: introspected 2026-08-13, the whole root
 * Query is account / dailyPostingLimits / channel / channels /
 * aggregatedPostMetrics / post / posts / postTemplate(s) / ideaGroups / ideas,
 * and `AggregatedPostMetricsInput` takes only organizationId, channelIds,
 * startDateTime, endDateTime and tags. There is no interval, granularity or
 * group-by argument anywhere in it, so a rollup is all it will ever return.
 *
 * But every SENT post carries its own `metrics` and its own `sentAt`, and that
 * is a series once bucketed by day. One paginated request rebuilds the whole
 * window, where iterating day-sized aggregate windows would cost one request
 * per day of history.
 *
 * Filtered on `dueAt` because that is the only date this filter accepts
 * (`sentAt` is readable but not filterable), widened by a day at each end, and
 * then bucketed on the real `sentAt` in code: a post scheduled at 23:55 lands
 * on the next day, and a relay post's dueAt and sentAt are seconds apart.
 */
const CHANNEL_POSTS = `query($orgId: OrganizationId!, $channelId: ChannelId!, $start: DateTime!, $end: DateTime!, $after: String) {
  posts(
    first: 100
    after: $after
    input: {
      organizationId: $orgId
      filter: {
        channelIds: [$channelId]
        status: [sent]
        dueAt: { start: $start, end: $end }
      }
      sort: [{ field: dueAt, direction: desc }]
    }
  ) {
    pageInfo { hasNextPage endCursor }
    edges { node { sentAt dueAt metrics { name type unit value } } }
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

type BufferMetrics = {
  metricsUpdatedAt?: string;
  metrics?: BufferMetric[];
};

type BufferAggregateMetricsResponse = {
  aggregatedPostMetrics?: BufferMetrics | null;
};

type BufferPostMetricsResponse = { post?: BufferMetrics | null };

type BufferPostNode = {
  sentAt?: string | null;
  dueAt?: string | null;
  metrics?: BufferMetric[] | null;
};

type BufferChannelPostsResponse = {
  posts?: {
    pageInfo?: { hasNextPage?: boolean; endCursor?: string | null } | null;
    edges?: { node: BufferPostNode }[] | null;
  } | null;
};

type BufferOrganizationsResponse = {
  account?: { organizations?: { id: string; name?: string }[] } | null;
};

type BufferChannel = {
  id: string;
  service: string;
  name: string;
  avatar?: string;
};

type BufferChannelsResponse = { channels?: BufferChannel[] | null };

/**
 * The per-post settings a relay channel can be handed.
 *
 * Buffer has a real field for exactly two: `firstComment` on LinkedIn, and
 * `video_made_with_ai` on TikTok (as `metadata.tiktok.isAiGenerated`).
 * `brand_organic_toggle` has no field and is carried in the caption instead.
 * The rest are here because `tiktokbuffer` reuses TikTok's own settings panel
 * in the composer, so they arrive whether or not anything can be done with them.
 */
type BufferRelaySettings = {
  firstComment?: string;
  title?: string;
  privacy_level?: string;
  content_posting_method?: 'DIRECT_POST' | 'UPLOAD';
  duet?: boolean;
  stitch?: boolean;
  comment?: boolean;
  autoAddMusic?: 'yes' | 'no';
  brand_organic_toggle?: boolean;
  brand_content_toggle?: boolean;
  video_made_with_ai?: boolean;
};

/**
 * Everything Buffer's `CreatePostInput` is given for a relayed post.
 *
 * `metadata` is the per-network sub-object, and the two keys below are the only
 * ones these channels can use. Introspected 2026-08-13:
 * `LinkedInPostMetadataInput` is { annotations, firstComment, linkAttachment }
 * and `TikTokPostMetadataInput` is { isAiGenerated, title } — nothing more.
 */
type BufferCreatePostInput = {
  channelId: string;
  text: string;
  assets: BufferAsset[];
  mode: 'shareNow';
  schedulingType: 'automatic';
  source: string;
  metadata?: {
    linkedin?: { firstComment: string };
    tiktok?: { isAiGenerated: boolean };
  };
};

type BufferCreatePostResponse = {
  createPost?:
    | { __typename: 'PostActionSuccess'; post: { id: string; dueAt: string } }
    | { __typename: 'MutationError'; message: string }
    | null;
};

/**
 * Buffer reports one total per metric for a window, so a "change" is the move
 * between two windows. For a count that is a percentage of the earlier count;
 * for a rate it is the difference in percentage POINTS, which is both the only
 * correct unit for a change in a percentage and what the tile actually prints
 * (`average` renders the delta with a "pp" suffix). Expressing a rate's change
 * as a ratio put 2% on a tile labelled 2pp for a move from 59.9% to 61.2%.
 */
const metricChange = (
  value: number,
  prior: number | undefined,
  isRate: boolean
) => {
  // no comparison window: out of Buffer's plan range, or a metric it only
  // started reporting this window
  if (prior === undefined) return 0;
  if (isRate) return Math.round((value - prior) * 10) / 10;
  if (prior === 0) return 0;
  return Math.round(((value - prior) / prior) * 100);
};

// How far back Buffer will serve Insights on the current plan. Free plans stop
// at 31 days and reject longer windows outright; the frontend's range gates are
// set to match (7 and 30 only for the relay channels).
//
// The ceiling is EXCLUSIVE: a window starting exactly 31.0 days ago comes back
// as "Free-plan Insights are limited to the last 31 days of history" (probed
// read-only 2026-08-13). Every window built below is midnight-aligned, which
// keeps the deepest possible start at 30 days plus a fraction, so it always
// clears. Worth knowing before anyone widens a range.
const BUFFER_HISTORY_DAYS = 31;

/**
 * Buffer's free plan has a request budget, and its metrics only move once a day
 * ("Metrics are refreshed daily, so values can be up to ~24h behind the source
 * network" — Buffer's own field docs). So the same window is not fetched twice
 * in a row: the Insights page renders tiles, a chart and a Performance row per
 * channel, and a tab flip or a re-render must not re-buy the same numbers.
 *
 * In-process and small on purpose. This is a cache, not a store: losing it on
 * restart costs one refetch.
 */
const CACHE_TTL_MS = 5 * 60 * 1000;
const responseCache = new Map<string, { at: number; value: unknown }>();

const cached = async <T>(key: string, load: () => Promise<T>): Promise<T> => {
  const hit = responseCache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return hit.value as T;
  }
  const value = await load();
  responseCache.set(key, { at: Date.now(), value });
  // Keys carry a window, so they turn over as the day does. Sweeping the
  // expired ones on the way past keeps an unbounded map from being a slow leak.
  if (responseCache.size > 200) {
    for (const [k, v] of responseCache) {
      if (Date.now() - v.at >= CACHE_TTL_MS) {
        responseCache.delete(k);
      }
    }
  }
  return value;
};

/**
 * What a rate is a rate OF, so two posts on the same day can be combined.
 *
 * Buffer does not expose the numerator behind its engagement rate, and it is
 * NOT the metrics it returns: a LinkedIn post reporting 3 reactions, 0 comments
 * and 0 shares against 23 impressions came back as 21.739%, which is 5/23, not
 * 3/23 (probed 2026-08-13). So a day's rate cannot be recomputed from parts and
 * has to be a weighted mean of the posts' own rates, weighted by how many
 * people saw each post. First match wins: LinkedIn reports impressions, TikTok
 * reports views.
 */
const RATE_WEIGHT_TYPES = ['impressions', 'views', 'reach'];

/**
 * TikTok's "your brand" disclosure, as a caption line.
 *
 * Buffer's API cannot carry it. Introspected 2026-08-13:
 * `TikTokPostMetadataInput` has exactly two fields, `isAiGenerated` and
 * `title`, and searching EVERY type in the schema for
 * brand/disclosure/commercial/organic/partnership/sponsor/paid/promo returns
 * only the four networks' `isAiGenerated`. There is no branded-content field,
 * no brand-organic field and no commercial-content field to send.
 *
 * Silently dropping it was the old behaviour and is not acceptable: the weekly
 * pipeline sets `brand_organic_toggle: true` on every TikTok post, so it is a
 * disclosure the owner intends to make on every post. Blocking the post is not
 * acceptable either, for the same reason: it would close the channel outright.
 *
 * So the disclosure goes where TikTok and its viewers will actually read it,
 * appended on its own line and ONLY when the flag is set. The wording tracks
 * what the toggle actually asserts: TikTok labels this "Promotional content",
 * and it means the creator promoting their own brand, NOT a paid partnership
 * (that is `brand_content_toggle`, which still blocks).
 */
const BRAND_ORGANIC_DISCLOSURE = 'Promotional content for our own brand.';

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

  // Per platform, with no sensible shared default: TikTok is the tighter of the
  // two and a wrong ceiling here shows green in the composer and is rejected by
  // the server. Abstract so a new relay cannot inherit the wrong number.
  abstract maxLength(): number;

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

  /**
   * Transport classification for `this.fetch`'s retry layer. Queries may retry
   * 429/5xx responses. `createPost(mode: shareNow)` explicitly disables this
   * layer because any response after dispatch can be ambiguous: Buffer may have
   * committed the post before a proxy returned 5xx.
   */
  public override handleErrors(body: string, status: number) {
    if (status === 429) {
      return {
        type: 'retry' as const,
        value: 'Buffer rate limited the request (429). Retrying shortly.',
      };
    }

    if (status >= 500) {
      return {
        type: 'retry' as const,
        value: `Buffer is unavailable (HTTP ${status}). Retrying shortly.`,
      };
    }

    return {
      type: 'bad-body' as const,
      value: `Buffer returned HTTP ${status}: ${body.slice(0, 300)}`,
    };
  }

  private async graphql<T>(
    query: string,
    variables?: any,
    operation: 'query' | 'mutation' = 'query'
  ): Promise<T> {
    // this.fetch, not the global one: it is the layer that waits and retries a
    // 429 or a 5xx (see handleErrors). It also keeps every non-2xx away from
    // res.json(): a rate limit arrives as an HTML body and parsing it as JSON
    // throws something unreadable.
    const res = await this.fetch(
      BUFFER_API,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, ...(variables ? { variables } : {}) }),
      },
      this.identifier,
      0,
      false,
      '',
      mayRetryBufferGraphql(operation)
    );

    // Buffer answers 200 with an `errors` array for most failures.
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
   * The one channel lookup: the channel itself and the organization that
   * actually owns it, which the aggregate metrics query demands.
   *
   * A channel id is globally unique, so every organisation the key can see is
   * searched for that exact id rather than assuming the first one (the
   * standalone script's organizations[0] heuristic silently picks the wrong
   * account otherwise). Even a lone organization is verified: taking its id
   * unchecked reports numbers for a channel that may not be in it at all.
   */
  private async findChannel(
    channelId: string
  ): Promise<{ organizationId: string; channel: BufferChannel } | null> {
    // Two requests every time, and the answer changes only when a channel is
    // added or moved, so a hit here is what keeps the Insights page's real cost
    // down to the metric queries. Only a FOUND channel is cached: caching the
    // miss would keep telling someone their freshly pasted channel id is wrong.
    const key = `channel:${channelId}`;
    const hit = responseCache.get(key);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
      return hit.value as { organizationId: string; channel: BufferChannel };
    }

    const orgs = await this.graphql<BufferOrganizationsResponse>(ORGANIZATIONS);

    for (const org of orgs?.account?.organizations || []) {
      const { channels } = await this.graphql<BufferChannelsResponse>(CHANNELS, {
        orgId: org.id,
      });
      const channel = (channels || []).find((c) => c.id === channelId);
      if (channel) {
        const found = { organizationId: org.id, channel };
        responseCache.set(key, { at: Date.now(), value: found });
        return found;
      }
    }
    return null;
  }

  /**
   * Every sent post in the window, with its own metrics, following Buffer's
   * cursor to the end. Capped: the page needs a month of one channel's posts,
   * and an unbounded follow would let a busy channel walk the whole account.
   */
  private async fetchWindowPosts(
    orgId: string,
    channelId: string,
    start: dayjs.Dayjs,
    end: dayjs.Dayjs
  ): Promise<BufferPostNode[]> {
    const nodes: BufferPostNode[] = [];
    let after: string | undefined;

    for (let page = 0; page < 5; page++) {
      const data = await this.graphql<BufferChannelPostsResponse>(
        CHANNEL_POSTS,
        {
          orgId,
          channelId,
          // widened a day at each end because the filter is on dueAt while the
          // bucketing below is on sentAt
          start: start.subtract(1, 'day').toISOString(),
          end: end.add(1, 'day').toISOString(),
          ...(after ? { after } : {}),
        }
      );

      for (const edge of data?.posts?.edges || []) {
        if (edge?.node) nodes.push(edge.node);
      }

      const info = data?.posts?.pageInfo;
      if (!info?.hasNextPage || !info.endCursor) break;
      after = info.endCursor;
    }

    return nodes;
  }

  async generateAuthUrl() {
    const state = makeId(6);
    return { url: state, codeVerifier: makeId(10), state };
  }

  /**
   * Channel insights: Buffer's authoritative window totals PLUS a real per-day
   * series underneath them.
   *
   * `aggregatedPostMetrics` is a rollup with no group-by (see CHANNEL_POSTS), so
   * the series is built by bucketing each sent post's own metrics on its own
   * `sentAt`. Both are kept because neither is sufficient alone: the rollup is
   * the number the tile must show, and the buckets are the shape the chart must
   * draw. Sending only the buckets would change the headline rate, because a
   * rate's window value is weighted by each day's audience and a plain mean of
   * daily rates is a different number.
   *
   * Request cost per channel per range: 2 for the channel lookup (cached, so
   * ~0 in practice), 1 for the window rollup, 1 for the comparison rollup when
   * it fits inside the plan's history, and 1 for the posts page. Five cold,
   * three warm, and all of it behind a 5-minute cache. Iterating day-sized
   * aggregate windows instead would have cost up to 31.
   *
   * The comparison window is also what makes `percentageChange` and
   * `previousTotal` real rather than the placeholder several providers ship.
   */
  async analytics(
    id: string,
    accessToken: string,
    date: number
  ): Promise<AnalyticsData[]> {
    const found = await this.findChannel(id);
    if (!found) return [];
    const orgId = found.organizationId;

    /* Calendar days, aligned to midnight, INCLUSIVE of both ends.

       `date` is a count of days, and the window is that many calendar days
       ending today, which is exactly what the page already prints under the
       heading ("Jul 15 - Aug 13" for 30). Buffer's own input documents this
       shape: "Consumers typically pass UTC midnight of the first calendar day".

       This is what makes Month to date EXACT. The range picker sends the day of
       the month, so on the 13th it sends 13 and the window starts at the 1st at
       00:00. The old `now.subtract(date, 'day')` started it at the 1st at
       whatever time of day it happened to be, which silently dropped the
       morning of the 1st and then moved as the day went on. No start/end
       parameter is needed on the endpoint for this: the day count already
       identifies the boundary, it just has to be snapped to it. */
    const end = dayjs().endOf('day');
    const start = dayjs()
      .subtract(date - 1, 'day')
      .startOf('day');

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
    const priorStart = start.subtract(date, 'day');
    const priorEnd = start.subtract(1, 'day').endOf('day');

    const cacheKey = `analytics:${id}:${start.format('YYYY-MM-DD')}:${end.format(
      'YYYY-MM-DD'
    )}`;

    return cached(cacheKey, async () => {
      const [current, previous, posts] = await Promise.all([
        this.graphql<BufferAggregateMetricsResponse>(AGGREGATE_METRICS, {
          input: window(start, end),
        }).catch((e) => {
          // Out of plan range: report nothing rather than throwing, which the
          // page would otherwise render as "this channel needs a refresh" —
          // blaming the connection for a billing limit.
          if (/limited to the last/i.test(e?.message || '')) return null;
          throw e;
        }),
        comparable
          ? this.graphql<BufferAggregateMetricsResponse>(AGGREGATE_METRICS, {
              input: window(priorStart, priorEnd),
            }).catch(() => null)
          : Promise.resolve(null),
        // The series is an enhancement, never a reason to lose the tiles: if
        // this page fails, every metric falls back to its single window point.
        this.fetchWindowPosts(orgId, id, start, end).catch(() => []),
      ]);

      const metrics: BufferMetric[] =
        current?.aggregatedPostMetrics?.metrics || [];
      const before: BufferMetric[] =
        previous?.aggregatedPostMetrics?.metrics || [];

      const series = this.bucketByDay(posts, start, end);

      return metrics.map((m) => {
        // Matched on `name`, the identity the tile is labelled with. `type` is a
        // category two metrics can share, so joining on it compared one metric
        // against a different one's earlier value.
        const prior = before.find((p) => p.name === m.name)?.value;
        const isRate = m.unit === 'percentage';
        return {
          label: m.name,
          percentageChange: metricChange(m.value, prior, isRate),
          // The real unit, so the frontend stops inferring it from the label.
          unit: isRate ? ('percentage' as const) : ('count' as const),
          // `average` stays alongside it for anything still reading the old
          // flag; `unit` is what the page now goes by.
          ...(isRate ? { average: true } : {}),
          // Buffer's own rollup, so the tile keeps Buffer's exact number no
          // matter what shape the daily series has to take to stay honest.
          total: m.value,
          ...(prior !== undefined ? { previousTotal: prior } : {}),
          data: series(m),
        };
      });
    });
  }

  /**
   * Turn per-post metrics into one per-day series per metric.
   *
   * Counts add up, so their days are summed and every day in the window is
   * present, zero-filled: a count of 0 on a day with no posts is true, and the
   * gaps are the shape.
   *
   * Rates do NOT add up. Their days are a mean weighted by that day's audience
   * (see RATE_WEIGHT_TYPES), and days with no posts are LEFT OUT rather than
   * zero-filled, because a rate on a day with nothing published is undefined,
   * not zero, and a row of phantom 0% bars would both misdraw the chart and
   * drag any mean computed from it.
   */
  private bucketByDay(
    posts: BufferPostNode[],
    start: dayjs.Dayjs,
    end: dayjs.Dayjs
  ): (metric: BufferMetric) => { total: string; date: string }[] {
    // metric name -> day -> weighted accumulator
    const byMetric = new Map<
      string,
      Map<string, { sum: number; weight: number }>
    >();
    const postsPerDay = new Map<string, number>();
    let counted = 0;

    for (const node of posts) {
      const when = node.sentAt || node.dueAt;
      if (!when) continue;
      const at = dayjs(when);
      // the dueAt filter was widened by a day at each end, so the real window
      // is enforced here, on the date the post actually went out
      if (at.isBefore(start) || at.isAfter(end)) continue;

      const day = at.format('YYYY-MM-DD');
      const metrics = node.metrics || [];
      postsPerDay.set(day, (postsPerDay.get(day) || 0) + 1);
      counted++;

      const weight =
        RATE_WEIGHT_TYPES.map(
          (type) => metrics.find((m) => m.type === type)?.value
        ).find((value) => typeof value === 'number' && value > 0) || 0;

      for (const m of metrics) {
        // aggregate-only metric: Buffer never emits it per post, and its series
        // is the post count, handled separately below
        if (m.type === 'postCount') continue;

        let days = byMetric.get(m.name);
        if (!days) {
          days = new Map();
          byMetric.set(m.name, days);
        }

        const acc = days.get(day) || { sum: 0, weight: 0 };
        const isRate = m.unit === 'percentage';
        // a rate whose denominator Buffer did not report still counts, at
        // weight 1, so a day is never silently dropped for lacking one
        const w = isRate ? weight || 1 : 1;
        acc.sum += isRate ? m.value * w : m.value;
        acc.weight += w;
        days.set(day, acc);
      }
    }

    const allDays: string[] = [];
    for (let d = start; !d.isAfter(end, 'day'); d = d.add(1, 'day')) {
      allDays.push(d.format('YYYY-MM-DD'));
    }

    return (metric: BufferMetric) => {
      // Nothing was published in the window, so there is no daily shape to
      // draw. Buffer's rollup is still the truth, so it stays one point.
      if (!counted) {
        return [
          { total: String(metric.value), date: end.format('YYYY-MM-DD') },
        ];
      }

      if (metric.type === 'postCount') {
        return allDays.map((day) => ({
          total: String(postsPerDay.get(day) || 0),
          date: day,
        }));
      }

      const days = byMetric.get(metric.name);
      if (!days || !days.size) {
        return [
          { total: String(metric.value), date: end.format('YYYY-MM-DD') },
        ];
      }

      if (metric.unit === 'percentage') {
        return allDays
          .filter((day) => days.has(day))
          .map((day) => {
            const acc = days.get(day)!;
            return {
              total: String(acc.sum / (acc.weight || 1)),
              date: day,
            };
          });
      }

      return allDays.map((day) => ({
        total: String(days.get(day)?.sum || 0),
        date: day,
      }));
    };
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
    const data = await this.graphql<BufferPostMetricsResponse>(POST_METRICS, {
      id: postId,
    });
    const metrics: BufferMetric[] = data?.post?.metrics || [];
    const asOf = data?.post?.metricsUpdatedAt
      ? dayjs(data.post.metricsUpdatedAt)
      : dayjs();

    return metrics.map((m) => ({
      label: m.name,
      // Buffer gives a single current figure per post, with nothing to compare
      // it against, so claiming a change would be inventing one.
      percentageChange: 0,
      // Same unit as the channel tiles, from the same source: without it the
      // identical rate prints 59.87% in a tile and a bare 60 in Recent posts,
      // on the same page.
      unit: m.unit === 'percentage' ? ('percentage' as const) : ('count' as const),
      ...(m.unit === 'percentage' ? { average: true } : {}),
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
      const channel = (await this.findChannel(channelId))?.channel;
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

  /**
   * Buffer has no comment or thread API: a relayed post is one post. Reject the
   * extra segments here, at create time, while nothing has been published. The
   * post workflow's own handling is far worse, because by the time a segment
   * fails there the main post is already live.
   */
  override async checkValidity(
    posts: Array<{ path: string; thumbnail?: string }[]>,
    settings?: any
  ): Promise<string | true> {
    if (posts.length > 1) {
      return `${this.name} goes through Buffer, which cannot post a thread or a follow-up comment as a separate segment. Keep this to a single post.`;
    }

    const blocking = this.undeliverableOptions(
      (settings || {}) as BufferRelaySettings
    ).blocking;
    return blocking || true;
  }

  /**
   * Per-post settings that reach this channel but have nowhere to go in Buffer's
   * API, split by what losing them costs.
   *
   * `blocking` stops the post: the setting changes WHAT gets published, so
   * publishing without it means publishing something the author did not ask
   * for. `dropped` is recorded instead of enforced: those settings do not
   * change the post itself, and failing on them would block a channel that
   * otherwise works.
   *
   * The per-network metadata Buffer accepts is now known rather than guessed at,
   * from a schema introspection on 2026-08-13: `LinkedInPostMetadataInput` is
   * { annotations, firstComment, linkAttachment } and `TikTokPostMetadataInput`
   * is { isAiGenerated, title }. Nothing outside those lists is ever sent: an
   * unknown metadata key is a hard input error that would break the only
   * publish path both platforms have.
   */
  protected undeliverableOptions(settings: BufferRelaySettings): {
    blocking: string | null;
    dropped: string[];
  } {
    const dropped: string[] = [];
    if (settings.firstComment && this.bufferService !== 'linkedin') {
      dropped.push('firstComment');
    }
    return { blocking: null, dropped };
  }

  /**
   * The text actually handed to Buffer. The base relay sends the caption
   * unchanged; TikTok overrides this to carry a disclosure Buffer's API has no
   * field for (see BRAND_ORGANIC_DISCLOSURE).
   */
  protected relayText(message: string, settings: BufferRelaySettings): string {
    return message;
  }

  /**
   * Per-network `metadata` for the create mutation, by service. Only the keys
   * Buffer actually defines are ever sent: an unknown key is a hard input error
   * that would break the only publish path either platform has.
   */
  protected relayMetadata(
    settings: BufferRelaySettings
  ): BufferCreatePostInput['metadata'] | undefined {
    if (this.bufferService === 'linkedin' && settings.firstComment) {
      return { linkedin: { firstComment: settings.firstComment } };
    }
    // TikTok's AI-generated disclosure IS carriable: `TikTokPostMetadataInput`
    // defines `isAiGenerated` ("Whether the post discloses AI-generated
    // content (TikTok video only)"), and this relay only ever sends video.
    // Sent only when the flag is actually set, so a normal post carries no
    // claim either way.
    if (this.bufferService === 'tiktok' && settings.video_made_with_ai === true) {
      return { tiktok: { isAiGenerated: true } };
    }
    return undefined;
  }

  /**
   * Nothing to deliver: Buffer has no comment or thread API. This exists anyway
   * because `comment` is the whole signal the post workflow reads for "this
   * provider takes more than one segment". Without it the workflow trims the
   * list to the first entry and every later segment vanishes with no error, no
   * notification, the parent marked PUBLISHED and the orphan child left in QUEUE
   * where the recovery sweep's `parentPostId: null` filter cannot see it.
   * Throwing turns that silent mutilation into a visible failure.
   */
  async comment(): Promise<PostResponse[]> {
    throw new BadBody(
      this.identifier,
      '{}',
      '',
      'The main post was published, but Buffer cannot post the follow-up segment: it has no comment or thread API. Add it by hand in Buffer, and do NOT retry this post: retrying would publish it a second time.'
    );
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
      const settings = (post.settings || {}) as BufferRelaySettings;

      // Settings this channel collects but Buffer cannot carry. The blocking
      // ones stop here, before anything is sent, so the post fails with the
      // reason rather than publishing without them.
      const undeliverable = this.undeliverableOptions(settings);
      if (undeliverable.blocking) {
        throw new BadBody(
          this.identifier,
          JSON.stringify(settings).slice(0, 300),
          '',
          undeliverable.blocking
        );
      }
      if (undeliverable.dropped.length) {
        console.warn(
          `[${this.identifier}] Buffer has no field for these settings, they were NOT applied to the post: ${undeliverable.dropped.join(', ')}`
        );
      }

      const input: BufferCreatePostInput = {
        channelId,
        // may carry an appended disclosure Buffer has no field for
        text: this.relayText(post.message || '', settings),
        assets,
        // Send it now. No dueAt: `shareNow` means exactly this, and Buffer
        // accepts the shape with or without one (probed 2026-08-12).
        mode: 'shareNow',
        schedulingType: 'automatic',
        source: 'postiz-relay',
      };

      const metadata = this.relayMetadata(settings);
      if (metadata) {
        input.metadata = metadata;
      }

      let data: BufferCreatePostResponse | undefined;
      try {
        data = await this.graphql<BufferCreatePostResponse>(
          CREATE_POST,
          { input },
          'mutation'
        );
      } catch (err: any) {
        // Buffer's free plan rejects first comments. Losing the comment is far
        // better than losing the post, so retry without it and say so.
        if (
          input.metadata?.linkedin?.firstComment &&
          /first comment requires a paid plan/i.test(err?.message || '')
        ) {
          delete input.metadata.linkedin;
          data = await this.graphql<BufferCreatePostResponse>(
            CREATE_POST,
            { input },
            'mutation'
          );
          console.warn(
            `[${this.identifier}] Buffer's plan rejected the first comment, so the post was published WITHOUT it. Add it by hand.`
          );
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
          `Buffer refused the post: ${
            result?.__typename === 'MutationError'
              ? result.message
              : 'unknown reason'
          }`
        );
      }

      out.push({
        id: post.id,
        postId: result.post.id,
        // Buffer exposes no per-network permalink and never reports back what
        // the platform did with the post, so this points at Buffer rather than
        // at LinkedIn or TikTok. It is the only link that is true.
        releaseURL: BUFFER_APP_URL,
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
    posts: Array<{ path: string; thumbnail?: string }[]>,
    settings?: any
  ): Promise<string | true> {
    const flat = posts.flat();
    if (!flat.length) {
      return 'TikTok needs a video.';
    }
    if (!flat.some((p) => isVideo(p.path))) {
      return 'TikTok through Buffer takes an mp4 video; images are not accepted.';
    }
    // then the shared relay rules (one segment, deliverable settings)
    return super.checkValidity(posts, settings);
  }

  /**
   * This channel reuses TikTok's own settings panel in the composer, so it
   * collects every TikTok option, and Buffer's API defines almost none of them.
   * Introspected 2026-08-13: `TikTokPostMetadataInput` is exactly
   * { isAiGenerated, title }, and no type in the whole schema carries a
   * branded-content, commercial-content, privacy-level or posting-method field.
   *
   * The three below still have to stop the post, because publishing anyway
   * inverts what was asked: UPLOAD means "put it in my TikTok inbox, do not
   * publish"; a non-public privacy level means "do not show this to everyone";
   * and `brand_content_toggle` is a paid-partnership disclosure TikTok
   * requires, where publishing without the label is the violation. Better a
   * post that fails with a reason than a post published against its settings.
   *
   * Two settings that used to be lost are now genuinely delivered:
   *
   * - `video_made_with_ai` goes through as `metadata.tiktok.isAiGenerated`.
   *   It used to block, on the belief that Buffer could not set the label. That
   *   belief was wrong, and Buffer documents the field as "TikTok video only",
   *   which is the only thing this relay sends. Failing a post we can publish
   *   correctly, with its disclosure intact, would be the worse outcome.
   * - `brand_organic_toggle` goes into the CAPTION, because there is no field
   *   for it (see BRAND_ORGANIC_DISCLOSURE). It is neither blocked nor dropped.
   */
  protected override undeliverableOptions(settings: BufferRelaySettings) {
    const base = super.undeliverableOptions(settings);
    if (base.blocking) return base;

    const blocking =
      settings.content_posting_method === 'UPLOAD'
        ? 'This post is set to UPLOAD (send to the TikTok inbox without publishing), and Buffer can only publish. Switch it to DIRECT_POST or post it through TikTok directly.'
        : settings.privacy_level &&
          settings.privacy_level !== 'PUBLIC_TO_EVERYONE'
        ? `Buffer cannot set TikTok's privacy level, so this would publish to everyone rather than "${settings.privacy_level}". Post it through TikTok directly.`
        : settings.brand_content_toggle === true
        ? 'Buffer cannot set TikTok\'s branded-content disclosure, and a paid partnership must not be published without it. Post it through TikTok directly.'
        : null;

    // Recorded, not enforced: none of these change what the post says.
    // `title` is here rather than passed through because Buffer defines it as
    // the title "for photo posts", and this relay requires an mp4, so sending
    // it on a video would be sending it where it does not apply.
    const dropped = [
      ...base.dropped,
      ...(
        ['title', 'duet', 'stitch', 'comment', 'autoAddMusic'] as const
        // `false` and 'no' are choices and count as set; an empty title is not
      ).filter((key) => settings[key] !== undefined && settings[key] !== ''),
    ];

    return { blocking, dropped };
  }

  /**
   * The "your brand" disclosure, appended to the caption because Buffer has no
   * field for it. Only when the flag is actually set, never twice, and never
   * silently: if it cannot fit, the post fails and says how much room it needs,
   * rather than publishing an undisclosed promotional video.
   */
  protected override relayText(
    message: string,
    settings: BufferRelaySettings
  ): string {
    if (settings.brand_organic_toggle !== true) {
      return message;
    }
    // already disclosed by hand in the caption: do not say it twice
    if (message.includes(BRAND_ORGANIC_DISCLOSURE)) {
      return message;
    }

    const text = message
      ? `${message}\n\n${BRAND_ORGANIC_DISCLOSURE}`
      : BRAND_ORGANIC_DISCLOSURE;

    if (text.length > this.maxLength()) {
      throw new BadBody(
        this.identifier,
        '{}',
        '',
        `This post is marked as promoting your own brand. Buffer's API has no field for that disclosure, so it is added to the caption instead, and that needs ${
          text.length - this.maxLength()
        } more characters than TikTok allows. Shorten the caption by that much and try again.`
      );
    }

    return text;
  }
}
