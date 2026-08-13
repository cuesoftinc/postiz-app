'use client';

import 'reflect-metadata';
import {
  createContext,
  FC,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import dayjs from 'dayjs';
import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { Post, Integration, Tags } from '@prisma/client';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  displayFromPathname,
  scheduleViewPath,
} from '@gitroom/frontend/components/launches/schedule.routes';
import isoWeek from 'dayjs/plugin/isoWeek';
import weekOfYear from 'dayjs/plugin/weekOfYear';
import { extend } from 'dayjs';
import useCookie from 'react-use-cookie';
import { newDayjs } from '@gitroom/frontend/components/layout/set.timezone';
import { timer } from '@gitroom/helpers/utils/timer';
import { expandPostsList, expandPosts } from '@gitroom/helpers/utils/posts.list.minify';
extend(isoWeek);
extend(weekOfYear);

// ---------------------------------------------------------------------------
// THE DISPLAY CLOCK
//
// One clock runs the whole calendar render layer: the display timezone
// (Buffer's "<City>" toolbar dropdown, persisted in the `displayTimezone`
// cookie below, falling back to the app's timezone setting and then the
// machine zone). It decides which day/hour cell a post is drawn in, which
// column reads as "today", and which days are washed as past. The grid, the
// phone sheet and the list view all derive those from the helpers here so they
// cannot disagree.
//
// SCHEDULING IS NOT ON THIS CLOCK. What gets stored is always an INSTANT, and
// the display zone never changes it. The helpers live here (not in
// calendar.tsx) because filters.tsx needs the same "today" the grid uses:
// resolveAnchorDate/setToday and the grid's today column must be the same day
// or a view switch near midnight lands on the wrong week.
// ---------------------------------------------------------------------------

/** The value is cookie/localStorage-backed, so validate it (cached) before it
 *  reaches any zone conversion: a corrupt identifier must never crash a view. */
const timezoneValidity = new Map<string, boolean>();
export const toValidTimezone = (
  tz: string | null | undefined
): string | undefined => {
  if (!tz) {
    return undefined;
  }
  let valid = timezoneValidity.get(tz);
  if (valid === undefined) {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: tz });
      valid = true;
    } catch {
      valid = false;
    }
    timezoneValidity.set(tz, valid);
  }
  return valid ? tz : undefined;
};

/** The display clock, always a usable IANA zone. The machine-zone fallback is
 *  what the pre-timezone code effectively rendered in, so an unset preference
 *  renders exactly as it always did. */
export const resolveDisplayTimezone = (preferred?: string | null): string =>
  toValidTimezone(preferred) ||
  (typeof window === 'undefined'
    ? undefined
    : toValidTimezone(localStorage.getItem('timezone'))) ||
  dayjs.tz.guess();

// Both conversions below go through Intl rather than dayjs's `.tz()`, and that
// is deliberate. dayjs 1.11.19's timezone plugin computes a zone's offset by
// round-tripping a `toLocaleString` value back through the JS Date parser, i.e.
// through the MACHINE zone. When the intermediate wall clock lands in the
// machine zone's own nonexistent hour, that parse normalises forward and the
// computed offset is an hour out. Measured against Intl over 11,232 instants x
// 12 display zones: 0 mismatches under TZ=Europe/London, Asia/Tokyo, UTC and
// others, but 60 under TZ=America/New_York and 78 under America/Los_Angeles,
// all on those machines' own spring-forward date. Rendering that is bad; but
// BUCKETING on it would put a post in the wrong hour cell, so the conversion
// core cannot be built on it. Intl reads the tz database directly and has no
// machine-zone step, which makes both helpers machine-zone independent
// (verified: identical results across 7 machine zones).

/** Intl formatters are costly to construct and free to reuse. */
const zoneFormatters = new Map<string, Intl.DateTimeFormat>();
const zoneFormatter = (displayTimezone: string) => {
  let formatter = zoneFormatters.get(displayTimezone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: displayTimezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    zoneFormatters.set(displayTimezone, formatter);
  }
  return formatter;
};

type CivilTime = {
  y: number;
  m: number;
  d: number;
  h: number;
  mi: number;
  s: number;
};

/** The calendar fields an instant shows as, in the display zone. */
const civilInZone = (ms: number, displayTimezone: string): CivilTime => {
  const parts: Record<string, string> = {};
  for (const part of zoneFormatter(displayTimezone).formatToParts(
    new Date(ms)
  )) {
    parts[part.type] = part.value;
  }
  return {
    y: +parts.year,
    m: +parts.month,
    d: +parts.day,
    // hourCycle h23 still reports midnight as '24' in some environments
    h: parts.hour === '24' ? 0 : +parts.hour,
    mi: +parts.minute,
    s: +parts.second,
  };
};

/** READ PATH. An instant, expressed on the display clock as a wall-clock
 *  CARRIER: a UTC-mode dayjs whose own fields ARE the display zone's wall clock,
 *  so `.format()` (including locale formats like 'h:mm A' and 'dddd') renders
 *  exactly what the viewer should read, and a formatted key is the cell
 *  identity to bucket against.
 *
 *  Its timestamp is deliberately NOT the original instant, so never compare one
 *  of these to a real instant. Formatting and key building only. UTC mode is
 *  what keeps it honest: building a machine-local Date from these fields would
 *  reintroduce exactly the normalisation bug described above, this time in the
 *  machine zone.
 *
 *  REQUIRES A REAL VALUE. Post.publishDate is nullable now, and this does not
 *  tolerate a null: it becomes NaN milliseconds, and civilInZone hands Intl a
 *  `new Date(NaN)`, which THROWS RangeError rather than formatting to anything.
 *  Every post-date caller goes through calendar.tsx's formatPostTime, which
 *  short-circuits on a missing date before reaching here; a new caller has to do
 *  the same. */
export const displayWall = (
  value: string | number | Date,
  displayTimezone: string
): dayjs.Dayjs => {
  const ms =
    value instanceof Date
      ? value.getTime()
      : typeof value === 'number'
      ? value
      : dayjs.utc(value).valueOf();
  const c = civilInZone(ms, displayTimezone);
  return dayjs.utc(Date.UTC(c.y, c.m - 1, c.d, c.h, c.mi, c.s));
};

/** Today's date on the display clock. */
export const displayTodayKey = (displayTimezone: string): string =>
  displayWall(Date.now(), displayTimezone).format('YYYY-MM-DD');

/** A zone's offset in minutes east of UTC at a given instant. Exported for the
 *  timezone picker's "GMT+1:00" labels, which must not disagree with the clock
 *  the calendar actually renders on. */
export const zoneOffsetMinutes = (
  ms: number,
  displayTimezone: string
): number => {
  const c = civilInZone(ms, displayTimezone);
  return Math.round(
    (Date.UTC(c.y, c.m - 1, c.d, c.h, c.mi, c.s) - ms) / 60000
  );
};

/** WRITE PATH. A display-zone wall clock ('YYYY-MM-DD', 'YYYY-MM-DD HH:mm', …)
 *  back to the real INSTANT it names, as a plain dayjs. This is the only value
 *  scheduling sees, so it has to be exact.
 *
 *  Two-pass offset resolution (Luxon's fixOffset): guess the offset at the wall
 *  clock read as UTC, correct, and confirm. It never throws.
 *  - A wall clock that does not exist (02:00 on a spring-forward day) steps
 *    FORWARD past the gap, because the smaller offset is the one subtracted.
 *  - One that occurs twice resolves to ONE of its two occurrences, picked
 *    deterministically by which side of the transition the first guess lands on.
 *    That is the earlier occurrence for a northern fall-back (New York
 *    2026-11-01 01:30 gives 05:30Z) and the later one for a southern one
 *    (Sydney 2026-04-05 02:30 gives 2026-04-04T16:30Z). Either is a true
 *    reading of that wall clock, both round-trip back to it, and the choice is
 *    stable, which is all the grid needs.
 *  Verified over every hour cell of 2026 in 13 zones (113,880 cells) under 7
 *  machine zones: every existing wall clock round-trips to itself, every
 *  nonexistent one resolves strictly forward, and the results are byte-identical
 *  whatever the machine zone is.
 *
 *  Cell bucketing never depends on this resolution (it compares wall clocks),
 *  so a nonexistent hour cell simply holds no posts and an ambiguous one holds
 *  BOTH occurrences, which is what that wall clock actually means: nothing is
 *  hidden by the choice above, it only decides where a drop lands. */
export const displayInstant = (
  wallClock: string,
  displayTimezone: string
): dayjs.Dayjs => {
  // parsed in UTC mode so the string's fields are taken literally, with no
  // machine-zone interpretation, then shifted onto the real timeline below
  const wallMs = dayjs.utc(wallClock).valueOf();
  const guess = zoneOffsetMinutes(wallMs, displayTimezone);
  const first = wallMs - guess * 60000;
  const confirmed = zoneOffsetMinutes(first, displayTimezone);
  if (guess === confirmed) {
    return dayjs(first);
  }
  const second = wallMs - confirmed * 60000;
  const settled = zoneOffsetMinutes(second, displayTimezone);
  if (confirmed === settled) {
    return dayjs(second);
  }
  return dayjs(wallMs - Math.min(confirmed, settled) * 60000);
};

/** The LIST view's tab vocabulary. 'approvals' is a frontend-only
 *  pseudo-state: it never reaches the backend as a state, it is sent as
 *  state=draft + needsApproval=only (see listParams below). */
export type ListStateFilter =
  | 'all'
  | 'scheduled'
  | 'draft'
  | 'published'
  | 'approvals';

/** Legal ?state= values. Narrower than ListStateFilter on purpose: ?state=
 *  is forwarded verbatim to /posts, whose GetPostsDto only accepts
 *  'all' | 'scheduled' | 'draft' | 'published'. 'approvals' would fail that
 *  validation and 400 the whole calendar fetch, so it collapses to 'all'. */
const STATE_FILTER_VALUES: readonly string[] = [
  'all',
  'scheduled',
  'draft',
  'published',
];

/** The org tag the server keeps in step with the approvals gate, so a gated post
 *  carries a visible label in the tags UI. It is ONLY a label: the gate itself is
 *  `Post.needsApproval`, and that is what the Approvals tab and its count now
 *  query (needsApproval=only).
 *
 *  This used to be the resolution mechanism: the tab looked the tag up by name
 *  and filtered on its id, which made the whole approvals view disarmable by any
 *  user with access to the tags UI: rename the tag and every pending post
 *  vanishes from the feed while still being blocked from publishing, i.e. an
 *  approvals queue nobody can see. Kept as a named constant because it is the
 *  contract with the server's own APPROVAL_TAG_NAME (posts.service.ts), which
 *  creates and attaches it. */
export const APPROVAL_TAG_NAME = 'needs-approval';

/** ?state= is user-editable — anything outside the enum collapses to 'all'
 *  (absent), so the backend never sees an invalid value. */
function readStateParam(value: string | null): ListStateFilter {
  return value && STATE_FILTER_VALUES.includes(value)
    ? (value as ListStateFilter)
    : 'all';
}

/** ?anchor= is user-editable AND re-serialized into the rewritten URL, so
 *  anything that is not a plain YYYY-MM-DD collapses to null (absent). */
function readAnchorParam(value: string | null): string | null {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

/** Buffer's list-tab URLs: /schedule/list?tab=<queue|drafts|approvals|sent>.
 *  Mapped onto our list states; 'all' (the transient pre-coercion default)
 *  carries no ?tab. Unknown values fall back to the existing default. */
const LIST_TAB_TO_STATE: Record<string, ListStateFilter> = {
  queue: 'scheduled',
  drafts: 'draft',
  approvals: 'approvals',
  sent: 'published',
};
const LIST_STATE_TO_TAB: Partial<Record<ListStateFilter, string>> = {
  scheduled: 'queue',
  draft: 'drafts',
  approvals: 'approvals',
  published: 'sent',
};

export const CalendarContext = createContext({
  // Buffer is Sunday-first — locale 'week', not 'isoWeek'
  startDate: newDayjs().startOf('week').format('YYYY-MM-DD'),
  endDate: newDayjs().endOf('week').format('YYYY-MM-DD'),
  /** The explicitly picked day (phone sheet mini picker) the range is
   *  anchored on, YYYY-MM-DD. null = nothing picked; anchor resolution
   *  falls back to today-in-range / the range's owning day (filters.tsx).
   *  Display switches re-derive their range from this date so month-to-week
   *  never snaps back to the month's first week. */
  anchor: null as string | null,
  customer: null as string | null,
  /** Channel filter (?integration=, comma-list of integration ids). Provided
   *  at runtime by the `...filters` spread below; declared here so consumers
   *  (the list view's tab counts) can read it without casting the context. */
  integration: null as string | null,
  loading: true,
  sets: [] as { name: string; id: string; content: string[] }[],
  signature: undefined as any,
  comments: [] as Array<{
    date: string;
    total: number;
  }>,
  integrations: [] as (Integrations & {
    refreshNeeded?: boolean;
  })[],
  trendings: [] as string[],
  posts: [] as Array<
    Post & {
      integration: Integration;
      tags: {
        tag: Tags;
      }[];
    }
  >,
  reloadCalendarView: () => {
    /** empty **/
  },
  display: 'month',
  lastCalendarDisplay: 'month' as string,
  setFilters: (filters: {
    startDate: string;
    endDate: string;
    display: 'week' | 'month' | 'day' | 'list';
    customer: string | null;
    /** omitted = keep the current anchor; null = clear it (re-anchor today) */
    anchor?: string | null;
  }) => {
    /** empty **/
  },
  changeDate: (id: string, date: dayjs.Dayjs) => {
    /** empty **/
  },
  // List view specific
  listPosts: [] as Array<
    Post & {
      integration: Integration;
      tags: {
        tag: Tags;
      }[];
    }
  >,
  listPage: 0,
  listTotal: 0,
  listTotalPages: 0,
  setListPage: (page: number) => {
    /** empty **/
  },
  listState: 'all' as ListStateFilter,
  setListState: (state: ListStateFilter) => {
    /** empty **/
  },
  /** Calendar-view state filter (?state=). 'all' = absent = no extra clause. */
  state: 'all' as ListStateFilter,
  /** Comma-separated tag-id filter (?tags=), applied to both views. */
  tags: null as string | null,
  /** Presentation-only timezone the calendar renders times in
   *  (cookie-persisted; scheduling stays in the org timezone). */
  displayTimezone: '' as string,
  setDisplayTimezone: (tz: string) => {
    /** empty **/
  },
});

export interface Integrations {
  name: string;
  id: string;
  disabled?: boolean;
  inBetweenSteps: boolean;
  editor: 'none' | 'normal' | 'markdown' | 'html';
  stripLinks?: boolean;
  display: string;
  identifier: string;
  type: string;
  picture: string;
  changeProfilePicture: boolean;
  additionalSettings: string;
  changeNickName: boolean;
  time: {
    time: number;
  }[];
  customer?: {
    name?: string;
    id?: string;
  };
}

// Helper function to get start and end dates based on display type.
// `displayTimezone` only matters when there is no referenceDate: "the range
// around today" has to mean today on the DISPLAY clock, or a first load a few
// minutes either side of midnight opens on the wrong week/month.
function getDateRange(
  display: string,
  referenceDate?: string,
  displayTimezone?: string
) {
  const date = newDayjs(
    referenceDate ||
      displayTodayKey(resolveDisplayTimezone(displayTimezone))
  );

  switch (display) {
    case 'day':
      return {
        startDate: date.format('YYYY-MM-DD'),
        endDate: date.format('YYYY-MM-DD'),
      };
    case 'week':
      // Buffer is Sunday-first — locale 'week', not 'isoWeek'
      return {
        startDate: date.startOf('week').format('YYYY-MM-DD'),
        endDate: date.endOf('week').format('YYYY-MM-DD'),
      };
    case 'month': {
      // Buffer renders pills on the leading/trailing other-month cells too, so
      // the month query covers the whole visible 6-week grid (Sunday of the
      // first week through Saturday of the sixth). Consumers derive the
      // display month from the middle of the range, which resolves to the
      // same month for both the exact-month and the grid-extended shapes.
      // Sunday is subtracted EXPLICITLY (.day() is Sunday-based whatever the
      // locale) instead of via startOf('week'), which follows dayjs's ACTIVE
      // locale: under a Monday-first locale (fr/de/ru…) the fetched window
      // started a day after MonthView's Sunday-first first cell, so that cell
      // held no data and rendered empty.
      const firstOfMonth = date.startOf('month');
      const gridStart = firstOfMonth.subtract(firstOfMonth.day(), 'day');
      return {
        startDate: gridStart.format('YYYY-MM-DD'),
        endDate: gridStart.add(41, 'day').format('YYYY-MM-DD'),
      };
    }
    default:
      return {
        startDate: date.startOf('week').format('YYYY-MM-DD'),
        endDate: date.endOf('week').format('YYYY-MM-DD'),
      };
  }
}

export const CalendarWeekProvider: FC<{
  children: ReactNode;
  integrations: Integrations[];
}> = ({ children, integrations }) => {
  const fetch = useFetch();
  const [internalData, setInternalData] = useState([] as any[]);
  const [trendings] = useState<string[]>([]);
  const searchParams = useSearchParams();
  const pathname = usePathname();
  // Buffer defaults to the month calendar; the cookie tracks the last view so
  // a refresh never resets it. The native /schedule routes encode the view in
  // the PATH (/schedule/list, /schedule/calendar/month|week|day —
  // schedule.routes.ts); ?display= stays as a legacy deep-link override, and
  // the cookie backs any mount that carries neither.
  const [displaySaved, setDisplaySaved] = useCookie('calendar-display', 'month');
  const display =
    searchParams.get('display') ||
    displayFromPathname(pathname) ||
    displaySaved ||
    'month';
  // The last non-list calendar view — what the List|Calendar segmented
  // restores when switching back to Calendar (Buffer behavior).
  const [lastCalendarDisplay, setLastCalendarDisplay] = useCookie(
    'calendar-display-last-cal',
    'month'
  );

  // Presentation-only timezone for the calendar render layer (Buffer's
  // "<City>" toolbar dropdown). Scheduling/publishing stay untouched.
  const [displayTimezone, setDisplayTimezone] = useCookie(
    'displayTimezone',
    dayjs.tz.guess()
  );

  // List view state
  const [listPage, setListPage] = useState(0);
  // ?tab= seeds the list tab on mount (Buffer deep-link parity); absent or
  // invalid keeps the existing 'all' default (filters.tsx coerces it to
  // 'scheduled' once the list view mounts).
  const [listState, setListStateRaw] = useState<ListStateFilter>(
    () => LIST_TAB_TO_STATE[searchParams.get('tab') || ''] || 'all'
  );
  const setListState = useCallback((next: ListStateFilter) => {
    setListStateRaw(next);
    setListPage(0);
    // Mirror the active tab into ?tab= (Buffer writes ?tab=sent on
    // /schedule/list) — replaceState like the toolbar dropdowns, so tab
    // clicks never spam back/forward history.
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      const tab = LIST_STATE_TO_TAB[next];
      if (tab) {
        url.searchParams.set('tab', tab);
      } else {
        url.searchParams.delete('tab');
      }
      window.history.replaceState(null, '', url.toString());
    }
  }, []);

  // Initialize with current date range based on URL params or defaults
  const initStartDate = searchParams.get('startDate');
  const initEndDate = searchParams.get('endDate');
  const initCustomer = searchParams.get('customer');
  const initIntegration = searchParams.get('integration');
  const initState = readStateParam(searchParams.get('state'));
  const initTags = searchParams.get('tags');
  // The picked-day anchor survives the force-dynamic remounts the same way
  // the range does: through the URL (?anchor=YYYY-MM-DD).
  const initAnchor = readAnchorParam(searchParams.get('anchor'));

  const initialRange =
    initStartDate && initEndDate
      ? { startDate: initStartDate, endDate: initEndDate }
      : getDateRange(display, undefined, displayTimezone);

  const [filters, setFilters] = useState({
    startDate: initialRange.startDate,
    endDate: initialRange.endDate,
    anchor: initAnchor,
    customer: initCustomer || null,
    integration: initIntegration || null,
    state: initState,
    tags: initTags || null,
    display,
  });
  // Mirror of the live filters for the stable ([]-dep) setFiltersWrapper:
  // it must know whether an incoming update actually moves the fetch key
  // before it decides to wipe internalData (see below).
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  // The sidebar's channel rows navigate to /schedule?integration=<id>, and the
  // toolbar dropdowns (state/tags) write their params with history.replaceState.
  // When we are ALREADY on a /schedule route only searchParams changes — filters
  // state was initialized once — so keep the URL-driven filters in sync with
  // the URL.
  useEffect(() => {
    const urlIntegration = searchParams.get('integration') || null;
    const urlState = readStateParam(searchParams.get('state'));
    const urlTags = searchParams.get('tags') || null;
    setFilters((prev) =>
      prev.integration === urlIntegration &&
      prev.state === urlState &&
      prev.tags === urlTags
        ? prev
        : { ...prev, integration: urlIntegration, state: urlState, tags: urlTags }
    );
  }, [searchParams]);

  const params = useMemo(() => {
    const search = new URLSearchParams({
      display: filters.display,
      startDate: filters.startDate,
      endDate: filters.endDate,
      customer: filters?.customer?.toString() || '',
      integration: filters?.integration?.toString() || '',
    });
    // Additive read-path filters: omitted entirely at their defaults so the
    // default request (and SWR key) stays byte-identical to pre-filter days.
    if (filters.state !== 'all') search.set('state', filters.state);
    if (filters.tags) search.set('tags', filters.tags);
    return search.toString();
  }, [filters]);

  // Calendar view data fetcher
  // The return is annotated because the `posts` override below narrows the
  // literal to just that key: `expanded` is `any`, so spreading it contributes
  // no known properties and `comments` (read at the memo further down, and part
  // of this payload since long before the display-clock work) fell off the type.
  const loadData = useCallback(async (): Promise<{
    posts: any[];
    comments?: any[];
  }> => {
    // The grid buckets posts on the DISPLAY clock, so the fetch window has to
    // be the display zone's day boundaries. Machine-zone boundaries left the
    // first and last visible column partly unfetched whenever the two zones
    // differed, and those two columns are exactly where the near-midnight
    // posts live. The extra day on each side is pure slack: it absorbs the
    // backend's inclusive gte/lte edges and keeps the edge columns populated
    // while a zone change is still revalidating. The backend does no bucketing
    // of its own (it filters publishDate between two UTC instants), so a wider
    // window only ever adds rows the render layer then places correctly.
    const zone = resolveDisplayTimezone(displayTimezone);
    // pad as DATES first (plain calendar arithmetic on a date string, immune to
    // any zone), then resolve each padded date's display-zone edge to an instant
    const paddedStart = newDayjs(filters.startDate)
      .subtract(1, 'day')
      .format('YYYY-MM-DD');
    const paddedEnd = newDayjs(filters.endDate)
      .add(1, 'day')
      .format('YYYY-MM-DD');
    const windowStart = displayInstant(`${paddedStart} 00:00:00`, zone);
    const windowEnd = displayInstant(`${paddedEnd} 23:59:59`, zone);
    const search = new URLSearchParams({
      display: filters.display,
      customer: filters?.customer?.toString() || '',
      integration: filters?.integration?.toString() || '',
      startDate: windowStart.utc().format(),
      endDate: windowEnd.utc().format(),
    });
    if (filters.state !== 'all') search.set('state', filters.state);
    if (filters.tags) search.set('tags', filters.tags);
    const modifiedParams = search.toString();

    const data = await (await fetch(`/posts?${modifiedParams}`)).json();
    const expanded = expandPosts(data);
    // The calendar is a view of positions in time, so a post with no date has no
    // place in it; it is reached through the Undated Drafts panel instead. The
    // repository already excludes them (an explicit `publishDate: { not: null }`
    // clause, because the repeating-posts OR branch does not drop nulls the way
    // the range comparison does), and this is the second layer, here rather than
    // in each view because ONE filter covers all four of them (month, week, day,
    // phone sheet) plus the empty-state notices that count off the same array.
    // Cheap insurance against the day someone relaxes that clause: a null reaching
    // the grid is not a visible error, it is a card that quietly appears nowhere.
    return {
      ...expanded,
      posts: (expanded.posts || []).filter((post: any) => !!post.publishDate),
    };
  }, [filters, params, displayTimezone]);

  // List view data fetcher.
  //
  // APPROVALS resolves off the FIELD. It used to resolve by looking the
  // 'needs-approval' tag up by name and filtering on its id, which meant the feed
  // depended on a row any user can rename or delete from the tags UI: do that and
  // every pending post silently leaves the Approvals tab while the server goes on
  // refusing to publish it. `needsApproval=only` reads Post.needsApproval, which
  // is the same value the server enforces the gate with, so the tab shows exactly
  // what is gated and nothing in the UI can disarm it.
  //
  // It also composes, where the tag filter could not: `tags` was SPENT on the
  // approval tag before, so the user's own tag filter was silently dropped on this
  // one tab. The two are independent clauses now and both apply.
  const listParams = useMemo(() => {
    const search = new URLSearchParams({
      page: listPage.toString(),
      limit: '100',
      customer: filters?.customer?.toString() || '',
      integration: filters?.integration?.toString() || '',
      // Approvals are drafts, so the state clause still narrows to DRAFT; the
      // pseudo-state itself never goes over the wire.
      state: listState === 'approvals' ? 'draft' : listState,
    });
    if (listState === 'approvals') {
      search.set('needsApproval', 'only');
    }
    if (filters.tags) {
      search.set('tags', filters.tags);
    }
    return search.toString();
  }, [
    listPage,
    filters.customer,
    filters.integration,
    filters.tags,
    listState,
  ]);

  const loadListData = useCallback(async () => {
    const response = await fetch(`/posts/list?${listParams}`);
    return expandPostsList(await response.json());
  }, [listParams]);

  // SWR for calendar view
  const {
    data: calendarData,
    isLoading: calendarIsLoading,
    mutate: mutateCalendar,
  } = useSWR(
    // the display timezone belongs in the key: it moves the fetch WINDOW
    // (loadData derives the day boundaries from it), so a zone switch has to
    // revalidate or the newly-visible edge day stays unfetched
    filters.display !== 'list' ? `/posts-${params}-${displayTimezone}` : null,
    loadData,
    {
      refreshInterval: 3600000,
      refreshWhenOffline: false,
      refreshWhenHidden: false,
      revalidateOnFocus: false,
    }
  );

  // SWR for list view
  const {
    data: listData,
    isLoading: listIsLoading,
    mutate: mutateList,
  } = useSWR(
    filters.display === 'list' ? `/posts-list-${listParams}` : null,
    loadListData,
    {
      refreshInterval: 3600000,
      refreshWhenOffline: false,
      refreshWhenHidden: false,
      revalidateOnFocus: false,
    }
  );

  const defaultSign = useCallback(async () => {
    return await (await fetch('/signatures/default')).json();
  }, []);

  const setList = useCallback(async () => {
    return (await fetch('/sets')).json();
  }, []);

  const { data: sets, mutate } = useSWR('sets', setList, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
    revalidateOnMount: true,
    refreshWhenHidden: false,
    refreshWhenOffline: false,
  });
  const { data: sign } = useSWR('default-sign', defaultSign, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
    revalidateOnMount: true,
    refreshWhenHidden: false,
    refreshWhenOffline: false,
  });

  const setFiltersWrapper = useCallback(
    (newFilters: {
      startDate: string;
      endDate: string;
      display: 'week' | 'month' | 'day' | 'list';
      customer: string | null;
      /** omitted = keep the current channel filter */
      integration?: string | null;
      /** omitted = keep the current picked-day anchor; null = clear it */
      anchor?: string | null;
    }) => {
      setDisplaySaved(newFilters.display);
      if (newFilters.display !== 'list') {
        setLastCalendarDisplay(newFilters.display);
      }
      setFilters((prev) => ({
        ...newFilters,
        integration:
          newFilters.integration !== undefined
            ? newFilters.integration
            : prev.integration,
        anchor:
          newFilters.anchor !== undefined ? newFilters.anchor : prev.anchor,
        // The toolbar dropdowns own these (URL-driven) — never clobbered by
        // date/view navigation.
        state: prev.state,
        tags: prev.tags,
      }));
      // Drop the mirrored posts ONLY when the update actually moves the
      // fetch key (params: display/dates/customer/integration; anchor and
      // the phone 3-vs-7 span are presentation-only and never feed it).
      // A key-identical update (the phone sheet's 3-Days tap re-submitting
      // the already-visible week, or pickDay inside the current range) gives
      // SWR nothing to do: calendarData keeps its reference, the mirror
      // effect ([posts]) never re-fires, and an unconditional wipe here
      // would leave internalData empty forever, rendering the "Nothing
      // scheduled" overlay over zero chips until the key changes.
      const current = filtersRef.current;
      const nextIntegration =
        newFilters.integration !== undefined
          ? newFilters.integration
          : current.integration;
      const fetchKeyChanged =
        current.display !== newFilters.display ||
        current.startDate !== newFilters.startDate ||
        current.endDate !== newFilters.endDate ||
        (current.customer || null) !== (newFilters.customer || null) ||
        (current.integration || null) !== (nextIntegration || null);
      if (fetchKeyChanged) {
        setInternalData([]);
      }

      // Reset page when switching to list view
      if (newFilters.display === 'list') {
        setListPage(0);
      }

      // Carry the dropdown-owned params through the URL rewrite so the
      // searchParams sync effect doesn't read their absence as a reset.
      const carried = new URLSearchParams(window.location.search);
      const carriedState = readStateParam(carried.get('state'));
      const carriedTags = carried.get('tags');
      // ?anchor= mirrors the picked-day anchor (omitted = keep current)
      const carriedAnchor = readAnchorParam(
        newFilters.anchor !== undefined
          ? newFilters.anchor
          : carried.get('anchor')
      );
      // ?tab= is list-view-only (Buffer: /schedule/list?tab=sent) — carried
      // while the target view is the list, dropped on the calendar paths.
      const carriedTab = carried.get('tab');
      // ?undated=1 opens the Undated Drafts panel (filters.tsx). It has to be
      // carried for the same reason ?integration= does: this rewrite replaces the
      // whole query string, so any param not named here is DELETED, and a param
      // whose absence means "closed" would make the panel shut itself the first
      // time the user changed week or switched view. The panel is not tied to a
      // range or a display (undated drafts have no position in time), so it
      // survives every navigation until it is closed.
      const carriedUndated = carried.get('undated') === '1';
      const keptTab =
        newFilters.display === 'list' &&
        carriedTab &&
        LIST_TAB_TO_STATE[carriedTab]
          ? carriedTab
          : null;

      // Native Buffer-shaped URL: the view is encoded in the PATH
      // (/schedule/list, /schedule/calendar/month|week|day) and the dates
      // stay as query — startDate/endDate ≈ Buffer's ?date= handling. Next
      // syncs usePathname/useSearchParams from native replaceState.
      const query = [
        `startDate=${newFilters.startDate}`,
        `endDate=${newFilters.endDate}`,
        carriedAnchor ? `anchor=${carriedAnchor}` : ``,
        newFilters.customer ? `customer=${newFilters.customer}` : ``,
        // nextIntegration, NOT newFilters.integration: every caller omits
        // integration ("keep the current channel filter"), so writing the
        // incoming value dropped ?integration= from the URL, and the
        // searchParams sync effect above reads its absence as a reset, so a
        // view or date change silently cleared the channel filter and the
        // calendar went back to showing every channel. Writing the value the
        // fetch is about to use keeps the URL and the query in step.
        nextIntegration ? `integration=${nextIntegration}` : ``,
        carriedState !== 'all' ? `state=${carriedState}` : ``,
        carriedTags ? `tags=${encodeURIComponent(carriedTags)}` : ``,
        keptTab ? `tab=${keptTab}` : ``,
        carriedUndated ? `undated=1` : ``,
      ].filter((f) => f);
      window.history.replaceState(
        null,
        '',
        `${scheduleViewPath(newFilters.display)}?${query.join('&')}`
      );
    },
    []
  );

  const posts = useMemo(() => calendarData?.posts || [], [calendarData?.posts]);
  const comments = useMemo(() => calendarData?.comments || [], [calendarData?.comments]);

  // List view data
  const listPosts = useMemo(() => listData?.posts || [], [listData?.posts]);
  const listTotal = listData?.total || 0;
  const listTotalPages = Math.ceil(listTotal / 100);

  const changeDate = useCallback(
    (id: string, date: dayjs.Dayjs) => {
      // An unusable date must not be written into the mirror. `.utc().format()`
      // on an Invalid Date yields the literal STRING 'Invalid Date', which is
      // truthy, so it would sail past every `!post.publishDate` guard downstream
      // and only fail later, inside the render layer: displayWall would hand
      // Intl a `new Date(NaN)` and throw. Skipping the optimistic update instead
      // costs only the brief hop until the accompanying PUT's reload arrives,
      // and the server rejects an invalid date on that route anyway.
      if (!date?.isValid()) {
        return;
      }
      setInternalData((d) =>
        d.map((post: Post) => {
          if (post.id === id) {
            return {
              ...post,
              publishDate: date.utc().format('YYYY-MM-DDTHH:mm:ss'),
            };
          }
          return post;
        })
      );
    },
    [posts, internalData]
  );

  useEffect(() => {
    if (posts) {
      setInternalData(posts);
    }
  }, [posts]);

  // Combined reload function that handles both calendar and list views
  const reloadCalendarView = useCallback(() => {
    mutateCalendar();
    mutateList();
  }, [mutateCalendar, mutateList]);

  // Determine loading state based on current view
  const loading = filters.display === 'list' ? listIsLoading : calendarIsLoading;

  return (
    <CalendarContext.Provider
      value={{
        trendings,
        reloadCalendarView,
        ...filters,
        posts: calendarIsLoading ? [] : internalData,
        loading,
        integrations,
        setFilters: setFiltersWrapper,
        changeDate,
        comments,
        sets: sets || [],
        signature: sign,
        // List view specific
        listPosts,
        listPage,
        listTotal,
        listTotalPages,
        setListPage,
        listState,
        setListState,
        displayTimezone,
        setDisplayTimezone,
        lastCalendarDisplay,
      }}
    >
      {children}
    </CalendarContext.Provider>
  );
};

export const useCalendar = () => useContext(CalendarContext);
