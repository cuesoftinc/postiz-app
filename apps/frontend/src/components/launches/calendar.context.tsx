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

export type ListStateFilter =
  | 'all'
  | 'scheduled'
  | 'draft'
  | 'published'
  | 'approvals';

const STATE_FILTER_VALUES: readonly string[] = [
  'all',
  'scheduled',
  'draft',
  'published',
  'approvals',
];

/** Approvals v1: a draft carrying this tag is "awaiting approval". The tag is
 *  a plain org tag (created via the existing tags UI) — no new write surface. */
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
  /** The org tag named 'needs-approval' when it exists (Approvals v1). */
  approvalTag: null as { id: string; name: string } | null,
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

// Helper function to get start and end dates based on display type
function getDateRange(display: string, referenceDate?: string) {
  const date = referenceDate ? newDayjs(referenceDate) : newDayjs();

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
      const gridStart = date.startOf('month').startOf('week');
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
      : getDateRange(display);

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
  const loadData = useCallback(async () => {
    const search = new URLSearchParams({
      display: filters.display,
      customer: filters?.customer?.toString() || '',
      integration: filters?.integration?.toString() || '',
      startDate: newDayjs(filters.startDate).startOf('day').utc().format(),
      endDate: newDayjs(filters.endDate).endOf('day').utc().format(),
    });
    if (filters.state !== 'all') search.set('state', filters.state);
    if (filters.tags) search.set('tags', filters.tags);
    const modifiedParams = search.toString();

    const data = await (await fetch(`/posts?${modifiedParams}`)).json();
    return expandPosts(data);
  }, [filters, params]);

  // Approvals v1: resolve the org's 'needs-approval' tag (read-path; the tag
  // itself is created through the existing tags UI)
  const { data: approvalTagData } = useSWR(
    // resolved for the whole list view — the tab count pills need it too
    filters.display === 'list' ? '/posts/tags?approvals' : null,
    async () => {
      const data = await (await fetch('/posts/tags')).json();
      const tags = Array.isArray(data?.tags) ? data.tags : [];
      return (
        tags.find(
          (tag: any) =>
            (tag.name || '').toLowerCase().trim().replace(/\s+/g, '-') ===
            APPROVAL_TAG_NAME
        ) || null
      );
    }
  );
  const approvalTag = approvalTagData || null;

  // List view data fetcher
  const listParams = useMemo(() => {
    const search = new URLSearchParams({
      page: listPage.toString(),
      limit: '100',
      customer: filters?.customer?.toString() || '',
      integration: filters?.integration?.toString() || '',
      // Approvals = drafts carrying the needs-approval tag
      state: listState === 'approvals' ? 'draft' : listState,
    });
    if (listState === 'approvals') {
      // unknown id yields an empty (not unfiltered) feed when the tag is absent
      search.set('tags', approvalTag?.id || '__no-approval-tag__');
    } else if (filters.tags) {
      search.set('tags', filters.tags);
    }
    return search.toString();
  }, [
    listPage,
    filters.customer,
    filters.integration,
    filters.tags,
    listState,
    approvalTag?.id,
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
    filters.display !== 'list' ? `/posts-${params}` : null,
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
        newFilters.integration ? `integration=${newFilters.integration}` : ``,
        carriedState !== 'all' ? `state=${carriedState}` : ``,
        carriedTags ? `tags=${encodeURIComponent(carriedTags)}` : ``,
        keptTab ? `tab=${keptTab}` : ``,
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
        approvalTag,
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
