'use client';

import { useCalendar, ListStateFilter } from '@gitroom/frontend/components/launches/calendar.context';
import clsx from 'clsx';
import { useSearchParams } from 'next/navigation';
import { ChannelAvatar } from '@gitroom/frontend/components/new-layout/channel-avatar';
import { DropdownPanel } from '@gitroom/frontend/components/cuesoft/dropdown/dropdown-panel';
import { useClickAway } from '@uidotdev/usehooks';
import dayjs from 'dayjs';
import { useCallback , useState, FC, useMemo } from 'react';
import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { SelectCustomer } from '@gitroom/frontend/components/launches/select.customer';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import i18next from 'i18next';
import { newDayjs } from '@gitroom/frontend/components/layout/set.timezone';

// Helper function to get start and end dates based on display type
function getDateRange(
  display: 'day' | 'week' | 'month' | 'list',
  referenceDate?: string
) {
  const date = referenceDate ? newDayjs(referenceDate) : newDayjs();

  switch (display) {
    case 'day':
      return {
        startDate: date.format('YYYY-MM-DD'),
        endDate: date.format('YYYY-MM-DD'),
      };
    case 'week':
      return {
        startDate: date.startOf('isoWeek').format('YYYY-MM-DD'),
        endDate: date.endOf('isoWeek').format('YYYY-MM-DD'),
      };
    case 'month':
      return {
        startDate: date.startOf('month').format('YYYY-MM-DD'),
        endDate: date.endOf('month').format('YYYY-MM-DD'),
      };
    case 'list':
      return {
        startDate: date.format('YYYY-MM-DD'),
        endDate: date.format('YYYY-MM-DD'),
      };
  }
}


/** Buffer's "Channels" toolbar filter: search, Select all, checkbox rows.
 *  Drives the existing ?integration= URL param (comma-list) — the calendar
 *  context and both repository queries already consume it. */
const ChannelsFilter: FC = () => {
  const t = useT();
  const calendar = useCalendar();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useClickAway<HTMLDivElement>(() => setOpen(false));

  const selected = useMemo(
    () =>
      new Set<string>(
        (searchParams.get('integration') || '')
          .split(',')
          .filter(Boolean)
      ),
    [searchParams]
  );

  const writeSelection = useCallback((ids: string[]) => {
    const url = new URL(window.location.href);
    if (ids.length) url.searchParams.set('integration', ids.join(','));
    else url.searchParams.delete('integration');
    window.history.replaceState(null, '', url.pathname + url.search);
  }, []);

  const toggleChannel = useCallback(
    (id: string) => {
      const next = new Set<string>(selected);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      writeSelection([...next]);
    },
    [selected, writeSelection]
  );

  const list = useMemo(
    () =>
      (calendar.integrations || []).filter((i: any) =>
        i.name.toLowerCase().includes(q.toLowerCase())
      ),
    [calendar.integrations, q]
  );

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-[6px] h-[36px] px-[10px] rounded-[6px] text-[14px] text-newTextColor/70 hover:text-newTextColor hover:bg-boxHover transition-colors"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect width="7" height="7" x="3" y="3" rx="1" />
          <rect width="7" height="7" x="14" y="3" rx="1" />
          <rect width="7" height="7" x="14" y="14" rx="1" />
          <rect width="7" height="7" x="3" y="14" rx="1" />
        </svg>
        {t('channels', 'Channels')}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <DropdownPanel
          surface="panel"
          anchor="end"
          className="mt-[6px] w-[300px] p-[10px] flex flex-col gap-[8px]"
        >
          <div className="flex items-center gap-[8px] h-[36px] px-[10px] rounded-[6px] border border-newTableBorder focus-within:border-forth">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-newTextColor/60">
              <path d="m21 21-4.34-4.34" />
              <circle cx="11" cy="11" r="8" />
            </svg>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t('search_channels', 'Search channels')}
              className="flex-1 bg-transparent outline-none text-[14px] text-newTextColor placeholder:text-newTextColor/50"
            />
          </div>
          <div className="flex items-center justify-between px-[6px]">
            <span className="text-[13px] font-[600]">
              {t('channels', 'Channels')}
            </span>
            <button
              type="button"
              onClick={() =>
                writeSelection(
                  selected.size === (calendar.integrations || []).length
                    ? []
                    : (calendar.integrations || []).map((i: any) => i.id)
                )
              }
              className="text-[13px] text-newTextColor/70 hover:text-newTextColor"
            >
              {t('select_all', 'Select all')}
            </button>
          </div>
          <div className="flex flex-col max-h-[280px] overflow-y-auto">
            {list.map((integration: any) => (
              <label
                key={integration.id}
                className="flex items-center gap-[10px] px-[6px] py-[6px] rounded-[6px] hover:bg-boxHover cursor-pointer"
              >
                <ChannelAvatar
                  picture={integration.picture}
                  identifier={integration.identifier}
                  name={integration.name}
                  size={28}
                  badgeSize={12}
                  fallback="placeholder"
                />
                <span className="flex-1 truncate text-[14px]">
                  {integration.name}
                </span>
                <input
                  type="checkbox"
                  checked={selected.has(integration.id)}
                  onChange={() => toggleChannel(integration.id)}
                  className="accent-btnPrimary w-[16px] h-[16px]"
                />
              </label>
            ))}
          </div>
        </DropdownPanel>
      )}
    </div>
  );
};

/** Buffer's "All Posts" state filter for the CALENDAR views (the list view
 *  keeps its own tabs — no doubling up). Drives ?state= (absent = all) via
 *  history.replaceState; the calendar context syncs it into the /posts query. */
const StateFilter: FC = () => {
  const t = useT();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const ref = useClickAway<HTMLDivElement>(() => setOpen(false));

  const options: { value: ListStateFilter; label: string }[] = [
    { value: 'all', label: t('all_posts', 'All Posts') },
    { value: 'scheduled', label: t('scheduled', 'Queue') },
    { value: 'draft', label: t('drafts', 'Drafts') },
    { value: 'published', label: t('published', 'Sent') },
  ];

  const urlState = searchParams.get('state');
  const current =
    options.find((o) => o.value === urlState)?.value || ('all' as const);

  const select = useCallback((value: ListStateFilter) => {
    const url = new URL(window.location.href);
    if (value === 'all') url.searchParams.delete('state');
    else url.searchParams.set('state', value);
    window.history.replaceState(null, '', url.pathname + url.search);
    setOpen(false);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-[6px] h-[36px] px-[10px] rounded-[6px] text-[14px] text-newTextColor/70 hover:text-newTextColor hover:bg-boxHover transition-colors"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 12h.01" />
          <path d="M3 18h.01" />
          <path d="M3 6h.01" />
          <path d="M8 12h13" />
          <path d="M8 18h13" />
          <path d="M8 6h13" />
        </svg>
        {options.find((o) => o.value === current)?.label}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <DropdownPanel
          surface="panel"
          anchor="end"
          className="mt-[6px] min-w-[180px] p-[6px] flex flex-col gap-[2px]"
        >
          {options.map((option) => (
            <div
              key={option.value}
              onClick={() => select(option.value)}
              className={clsx(
                'px-[10px] py-[8px] rounded-[6px] text-[14px] cursor-pointer hover:bg-boxHover transition-colors duration-150',
                current === option.value
                  ? 'text-newTextColor font-[600]'
                  : 'text-newTextColor/70'
              )}
            >
              {option.label}
            </div>
          ))}
        </DropdownPanel>
      )}
    </div>
  );
};

/** Buffer's "Tags" filter: checkbox rows of the org's tags with their colour
 *  dots. Drives ?tags= (comma-list of tag ids) — the context feeds it to both
 *  the calendar and list queries. Same endpoint + SWR key as TagsComponent. */
const TagsFilter: FC = () => {
  const t = useT();
  const fetch = useFetch();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const ref = useClickAway<HTMLDivElement>(() => setOpen(false));

  const loadTags = useCallback(async () => {
    return (await fetch('/posts/tags')).json();
  }, []);
  const { data } = useSWR('load-tags', loadTags);
  const tags: { id: string; name: string; color: string }[] = data?.tags || [];

  const selected = useMemo(
    () =>
      new Set<string>(
        (searchParams.get('tags') || '').split(',').filter(Boolean)
      ),
    [searchParams]
  );

  const toggleTag = useCallback(
    (id: string) => {
      const next = new Set<string>(selected);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      const url = new URL(window.location.href);
      if (next.size) url.searchParams.set('tags', [...next].join(','));
      else url.searchParams.delete('tags');
      window.history.replaceState(null, '', url.pathname + url.search);
    },
    [selected]
  );

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-[6px] h-[36px] px-[10px] rounded-[6px] text-[14px] text-newTextColor/70 hover:text-newTextColor hover:bg-boxHover transition-colors"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z" />
          <circle cx="7.5" cy="7.5" r=".5" fill="currentColor" />
        </svg>
        {t('tags', 'Tags')}
        {selected.size > 0 && (
          <span className="text-[12px] text-newTextColor/60">
            {selected.size}
          </span>
        )}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <DropdownPanel
          surface="panel"
          anchor="end"
          className="mt-[6px] w-[240px] p-[10px] flex flex-col gap-[2px]"
        >
          {tags.length === 0 && (
            <div className="px-[6px] py-[8px] text-[13px] text-newTextColor/60">
              {t('no_tags_yet', 'No tags yet')}
            </div>
          )}
          <div className="flex flex-col max-h-[280px] overflow-y-auto">
            {tags.map((tag) => (
              <label
                key={tag.id}
                className="flex items-center gap-[10px] px-[6px] py-[6px] rounded-[6px] hover:bg-boxHover cursor-pointer"
              >
                <span
                  className="w-[10px] h-[10px] rounded-full shrink-0"
                  style={{ backgroundColor: tag.color }}
                />
                <span className="flex-1 truncate text-[14px]">{tag.name}</span>
                <input
                  type="checkbox"
                  checked={selected.has(tag.id)}
                  onChange={() => toggleTag(tag.id)}
                  className="accent-btnPrimary w-[16px] h-[16px]"
                />
              </label>
            ))}
          </div>
        </DropdownPanel>
      )}
    </div>
  );
};

/** Buffer's display-timezone selector ("<City>"). Cookie-persisted through
 *  the calendar context (displayTimezone) — the render layer consumes it.
 *  Presentation only; scheduling stays in the org/user timezone. */
const TimezoneFilter: FC = () => {
  const t = useT();
  const calendar = useCalendar();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useClickAway<HTMLDivElement>(() => setOpen(false));

  // es2020 lib — supportedValuesOf (es2022) is feature-detected at runtime.
  const timezones = useMemo<string[]>(() => {
    const supported = (Intl as any).supportedValuesOf;
    return typeof supported === 'function' ? supported('timeZone') : [];
  }, []);

  const city = useCallback(
    (tz: string) => (tz.split('/').pop() || tz).replace(/_/g, ' '),
    []
  );

  const list = useMemo(
    () =>
      timezones.filter((tz) =>
        tz.toLowerCase().replace(/_/g, ' ').includes(q.toLowerCase())
      ),
    [timezones, q]
  );

  const select = useCallback(
    (tz: string) => {
      calendar.setDisplayTimezone(tz);
      setOpen(false);
      setQ('');
    },
    [calendar]
  );

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-[6px] h-[36px] px-[10px] rounded-[6px] text-[14px] text-newTextColor/70 hover:text-newTextColor hover:bg-boxHover transition-colors"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
          <path d="M2 12h20" />
        </svg>
        {city(calendar.displayTimezone)}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <DropdownPanel
          surface="panel"
          anchor="end"
          className="mt-[6px] w-[280px] p-[10px] flex flex-col gap-[8px]"
        >
          <div className="flex items-center gap-[8px] h-[36px] px-[10px] rounded-[6px] border border-newTableBorder focus-within:border-forth">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-newTextColor/60">
              <path d="m21 21-4.34-4.34" />
              <circle cx="11" cy="11" r="8" />
            </svg>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t('search_timezone', 'Search timezone')}
              className="flex-1 bg-transparent outline-none text-[14px] text-newTextColor placeholder:text-newTextColor/50"
            />
          </div>
          <div className="flex flex-col max-h-[280px] overflow-y-auto">
            {list.map((tz) => (
              <div
                key={tz}
                onClick={() => select(tz)}
                className={clsx(
                  'flex items-center gap-[8px] px-[6px] py-[6px] rounded-[6px] text-[14px] cursor-pointer hover:bg-boxHover transition-colors duration-150',
                  tz === calendar.displayTimezone
                    ? 'text-newTextColor font-[600]'
                    : 'text-newTextColor/70'
                )}
              >
                <span className="truncate">{city(tz)}</span>
                <span className="ms-auto text-[12px] text-newTextColor/50 truncate">
                  {tz.split('/').slice(0, -1).join('/')}
                </span>
              </div>
            ))}
          </div>
        </DropdownPanel>
      )}
    </div>
  );
};

export const Filters = () => {
  const calendar = useCalendar();
  const t = useT();

  // Set dayjs locale based on current language
  const currentLanguage = i18next.resolvedLanguage || 'en';
  dayjs.locale();

  // Calculate display date range text
  const getDisplayText = () => {
    const startDate = newDayjs(calendar.startDate);
    const endDate = newDayjs(calendar.endDate);

    switch (calendar.display) {
      case 'day':
        return startDate.format('dddd (L)');
      case 'week':
        return `${startDate.format('L')} - ${endDate.format('L')}`;
      case 'month':
        return startDate.format('MMMM YYYY');
      default:
        return '';
    }
  };

  const setToday = useCallback(() => {
    const today = newDayjs();
    const currentRange = getDateRange(
      calendar.display as 'day' | 'week' | 'month'
    );

    // Check if we're already showing today's range
    if (
      calendar.startDate === currentRange.startDate &&
      calendar.endDate === currentRange.endDate
    ) {
      return; // No need to set the same range
    }

    calendar.setFilters({
      startDate: currentRange.startDate,
      endDate: currentRange.endDate,
      display: calendar.display as 'day' | 'week' | 'month',
      customer: calendar.customer,
    });
  }, [calendar]);

  const setDay = useCallback(() => {
    // If already in day view and showing today, don't change
    if (calendar.display === 'day') {
      const todayRange = getDateRange('day');
      if (calendar.startDate === todayRange.startDate) {
        return;
      }
    }

    const range = getDateRange('day');
    calendar.setFilters({
      startDate: range.startDate,
      endDate: range.endDate,
      display: 'day',
      customer: calendar.customer,
    });
  }, [calendar]);

  const setWeek = useCallback(() => {
    // If already in week view and showing current week, don't change
    if (calendar.display === 'week') {
      const currentWeekRange = getDateRange('week');
      if (calendar.startDate === currentWeekRange.startDate) {
        return;
      }
    }

    const range = getDateRange('week');
    calendar.setFilters({
      startDate: range.startDate,
      endDate: range.endDate,
      display: 'week',
      customer: calendar.customer,
    });
  }, [calendar]);

  const setMonth = useCallback(() => {
    // If already in month view and showing current month, don't change
    if (calendar.display === 'month') {
      const currentMonthRange = getDateRange('month');
      if (calendar.startDate === currentMonthRange.startDate) {
        return;
      }
    }

    const range = getDateRange('month');
    calendar.setFilters({
      startDate: range.startDate,
      endDate: range.endDate,
      display: 'month',
      customer: calendar.customer,
    });
  }, [calendar]);

  const setList = useCallback(() => {
    if (calendar.display === 'list') {
      return;
    }

    const range = getDateRange('list');
    calendar.setFilters({
      startDate: range.startDate,
      endDate: range.endDate,
      display: 'list',
      customer: calendar.customer,
    });
  }, [calendar]);

  const setCalendarView = useCallback(() => {
    if (calendar.display !== 'list') {
      return;
    }

    const range = getDateRange('week');
    calendar.setFilters({
      startDate: range.startDate,
      endDate: range.endDate,
      display: 'week',
      customer: calendar.customer,
    });
  }, [calendar]);

  const setCustomer = useCallback(
    (customer: string) => {
      if (calendar.customer === customer) {
        return; // No need to set the same customer
      }
      calendar.setFilters({
        startDate: calendar.startDate,
        endDate: calendar.endDate,
        display: calendar.display as 'day' | 'week' | 'month',
        customer: customer,
      });
    },
    [calendar]
  );

  const next = useCallback(() => {
    const currentStart = newDayjs(calendar.startDate);
    let nextStart: dayjs.Dayjs;

    switch (calendar.display) {
      case 'day':
        nextStart = currentStart.add(1, 'day');
        break;
      case 'week':
        nextStart = currentStart.add(1, 'week');
        break;
      case 'month':
        nextStart = currentStart.add(1, 'month');
        break;
      default:
        nextStart = currentStart.add(1, 'week');
    }

    const range = getDateRange(
      calendar.display as 'day' | 'week' | 'month',
      nextStart.format('YYYY-MM-DD')
    );
    calendar.setFilters({
      startDate: range.startDate,
      endDate: range.endDate,
      display: calendar.display as 'day' | 'week' | 'month',
      customer: calendar.customer,
    });
  }, [calendar]);

  const previous = useCallback(() => {
    const currentStart = newDayjs(calendar.startDate);
    let prevStart: dayjs.Dayjs;

    switch (calendar.display) {
      case 'day':
        prevStart = currentStart.subtract(1, 'day');
        break;
      case 'week':
        prevStart = currentStart.subtract(1, 'week');
        break;
      case 'month':
        prevStart = currentStart.subtract(1, 'month');
        break;
      default:
        prevStart = currentStart.subtract(1, 'week');
    }

    const range = getDateRange(
      calendar.display as 'day' | 'week' | 'month',
      prevStart.format('YYYY-MM-DD')
    );
    calendar.setFilters({
      startDate: range.startDate,
      endDate: range.endDate,
      display: calendar.display as 'day' | 'week' | 'month',
      customer: calendar.customer,
    });
  }, [calendar]);

  const setCurrent = useCallback(
    (type: 'day' | 'week' | 'month') => () => {
      if (type === 'day') {
        setDay();
      } else if (type === 'week') {
        setWeek();
      } else if (type === 'month') {
        setMonth();
      }
    },
    [setDay, setWeek, setMonth]
  );

  const isListView = calendar.display === 'list';

  // Buffer segmented control (spec §Page header): active = deep-green fill +
  // light-green text. The fill is the lime var washed to 15% so it mirrors per
  // theme (deep green over dark, pale green over white); the ink token is
  // #bfff72 in dark / #3f6c0e in light. Presentation only.
  const segActive =
    'bg-[color:color-mix(in_srgb,var(--new-btn-primary)_15%,transparent)] text-newTableTextFocused';
  const segInactive = 'text-newTextColor/60 hover:text-newTextColor';

  const [stateDdOpen, setStateDdOpen] = useState(false);
  const stateDdRef = useClickAway<HTMLDivElement>(() => setStateDdOpen(false));

  const setListStateFilter = useCallback(
    (next: ListStateFilter) => () => {
      if (calendar.listState === next) return;
      calendar.setListState(next);
    },
    [calendar]
  );

  const listStateOptions: { value: ListStateFilter; label: string }[] = [
    { value: 'all', label: t('all', 'All') },
    { value: 'scheduled', label: t('scheduled', 'Queue') },
    { value: 'draft', label: t('drafts', 'Drafts') },
    { value: 'published', label: t('published', 'Sent') },
  ];

  const previousPage = useCallback(() => {
    if (calendar.listPage > 0) {
      calendar.setListPage(calendar.listPage - 1);
    }
  }, [calendar]);

  const nextPage = useCallback(() => {
    if (calendar.listPage < calendar.listTotalPages - 1) {
      calendar.setListPage(calendar.listPage + 1);
    }
  }, [calendar]);

  return (
    <div className="text-textColor flex flex-col !flex-row flex-wrap phone:!flex-col gap-[8px] items-center select-none">
      {!isListView && (
        <div className="flex flex-grow flex-row items-center gap-[10px]">
          <div className="h-[36px] gap-[2px] flex items-center">
            <div
              onClick={previous}
              className="cursor-pointer text-newTextColor/70 rtl:rotate-180 w-[28px] h-[28px] rounded-[6px] flex items-center justify-center hover:bg-newTextColor/10 hover:text-newTextColor transition-colors duration-150"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m15 18-6-6 6-6" />
              </svg>
            </div>
            <div className="min-w-[200px] text-center h-full flex items-center justify-center">
              <div className="px-[9px] text-[16px] font-[500]">
                {getDisplayText()}
              </div>
            </div>
            <div
              onClick={next}
              className="cursor-pointer text-newTextColor/70 rtl:rotate-180 w-[28px] h-[28px] rounded-[6px] flex items-center justify-center hover:bg-newTextColor/10 hover:text-newTextColor transition-colors duration-150"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m9 18 6-6-6-6" />
              </svg>
            </div>
          </div>
          <div className="flex-1 text-[13px] font-[500]">
            <div className="text-center flex items-center h-[36px]">
              <div
                onClick={setToday}
                className="hover:bg-newTextColor/10 h-[24px] px-[10px] flex justify-center items-center rounded-[6px] transition-all cursor-pointer text-[13px] bg-newTextColor/5 border border-newTextColor/10"
              >
                {t('today', 'Today')}
              </div>
            </div>
          </div>
        </div>
      )}
      {isListView && (
        <div className="flex flex-grow flex-row items-center gap-[10px]">
          <div className="h-[36px] gap-[2px] flex items-center">
            <div
              onClick={previousPage}
              className={clsx(
                'rtl:rotate-180 w-[28px] h-[28px] rounded-[6px] flex items-center justify-center transition-colors duration-150',
                calendar.listPage > 0
                  ? 'text-newTextColor/70 cursor-pointer hover:bg-newTextColor/10 hover:text-newTextColor'
                  : 'text-newTextColor/30 cursor-not-allowed'
              )}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m15 18-6-6 6-6" />
              </svg>
            </div>
            <div className="min-w-[200px] text-center h-full flex items-center justify-center">
              <div className="px-[9px] text-[14px]">
                {t('page', 'Page')} {calendar.listPage + 1} {t('of', 'of')} {Math.max(1, calendar.listTotalPages)}
              </div>
            </div>
            <div
              onClick={nextPage}
              className={clsx(
                'rtl:rotate-180 w-[28px] h-[28px] rounded-[6px] flex items-center justify-center transition-colors duration-150',
                calendar.listPage < calendar.listTotalPages - 1
                  ? 'text-newTextColor/70 cursor-pointer hover:bg-newTextColor/10 hover:text-newTextColor'
                  : 'text-newTextColor/30 cursor-not-allowed'
              )}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m9 18 6-6-6-6" />
              </svg>
            </div>
          </div>
          <div className="flex flex-row h-[36px] gap-[4px] text-[15px] font-[500] phone:hidden">
            {listStateOptions.map((option) => (
              <div
                key={option.value}
                onClick={setListStateFilter(option.value)}
                className={clsx(
                  'cursor-pointer min-w-[80px] px-[12px] text-center flex items-center justify-center border-b-[2px] transition-colors',
                  calendar.listState === option.value
                    ? 'text-newTextColor border-btnPrimary'
                    : 'text-newTextColor/60 border-transparent hover:text-newTextColor'
                )}
              >
                {option.label}
              </div>
            ))}
          </div>
          {/* Buffer mobile compresses the state tabs into a "Queue 12 ▾"
              dropdown — same setter, same options */}
          <div className="hidden phone:block relative" ref={stateDdRef}>
            <button
              type="button"
              onClick={() => setStateDdOpen((v) => !v)}
              className="flex items-center gap-[6px] h-[36px] px-[10px] text-[16px] font-[600] text-newTextColor"
            >
              {listStateOptions.find((o) => o.value === calendar.listState)
                ?.label || ''}
              <span className="text-[13px] font-[400] text-newTextColor/60">
                {calendar.listTotal}
              </span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
            {stateDdOpen && (
              <DropdownPanel
                surface="panel"
                anchor="start"
                className="mt-[4px] min-w-[160px] p-[6px] flex flex-col gap-[2px]"
              >
                {listStateOptions.map((option) => (
                  <div
                    key={option.value}
                    onClick={() => {
                      setStateDdOpen(false);
                      setListStateFilter(option.value)();
                    }}
                    className={clsx(
                      'px-[10px] py-[8px] rounded-[6px] text-[14px] cursor-pointer hover:bg-boxHover transition-colors duration-150',
                      calendar.listState === option.value
                        ? 'text-newTextColor font-[600]'
                        : 'text-newTextColor/70'
                    )}
                  >
                    {option.label}
                  </div>
                ))}
              </DropdownPanel>
            )}
          </div>
          <div className="flex-1" />
        </div>
      )}
      {/* Buffer's toolbar filter row: All Posts (calendar only — the list view
          has its own state tabs), Tags, Channels, customer, timezone. */}
      {!isListView && <StateFilter />}
      <TagsFilter />
      <ChannelsFilter />
      <SelectCustomer
        customer={calendar.customer as string}
        onChange={(customer: string) => setCustomer(customer)}
        integrations={calendar.integrations}
      />
      <TimezoneFilter />
      {!isListView && (
        <div className="flex flex-row h-[36px] p-[2px] border border-newTextColor/10 bg-newTextColor/5 rounded-[8px] text-[14px] font-[500]">
          <div
            className={clsx(
              'cursor-pointer w-[74px] text-center flex items-center justify-center rounded-[6px] transition-colors',
              calendar.display === 'day' ? segActive : segInactive
            )}
            onClick={setDay}
          >
            {t('day', 'Day')}
          </div>
          <div
            className={clsx(
              'cursor-pointer w-[74px] text-center flex items-center justify-center rounded-[6px] transition-colors',
              calendar.display === 'week' ? segActive : segInactive
            )}
            onClick={setWeek}
          >
            {t('week', 'Week')}
          </div>
          <div
            className={clsx(
              'cursor-pointer w-[74px] text-center flex items-center justify-center rounded-[6px] transition-colors',
              calendar.display === 'month' ? segActive : segInactive
            )}
            onClick={setMonth}
          >
            {t('month', 'Month')}
          </div>
        </div>
      )}
      <div className="flex flex-row h-[36px] p-[2px] border border-newTextColor/10 bg-newTextColor/5 rounded-[8px] text-[14px] font-[500]">
        <div
          onClick={setCalendarView}
          className={clsx(
            'cursor-pointer flex justify-center items-center w-[34px] text-center rounded-[6px] transition-colors',
            !isListView ? segActive : segInactive
          )}
        >
          {/*calendar*/}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M8 2v4" />
            <path d="M16 2v4" />
            <rect width="18" height="18" x="3" y="4" rx="2" />
            <path d="M3 10h18" />
          </svg>
        </div>
        <div
          onClick={setList}
          className={clsx(
            'flex justify-center items-center cursor-pointer w-[34px] text-center rounded-[6px] transition-colors',
            isListView ? segActive : segInactive
          )}
        >
          {/*list*/}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 12h.01" />
            <path d="M3 18h.01" />
            <path d="M3 6h.01" />
            <path d="M8 12h13" />
            <path d="M8 18h13" />
            <path d="M8 6h13" />
          </svg>
        </div>
      </div>
    </div>
  );
};
