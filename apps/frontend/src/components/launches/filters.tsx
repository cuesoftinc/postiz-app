'use client';

import { useCalendar, ListStateFilter } from '@gitroom/frontend/components/launches/calendar.context';
import clsx from 'clsx';
import { useSearchParams } from 'next/navigation';
import { ChannelAvatar } from '@gitroom/frontend/components/new-layout/channel-avatar';
import { DropdownPanel } from '@gitroom/frontend/components/cuesoft/dropdown/dropdown-panel';
import { useClickAway } from '@uidotdev/usehooks';
import dayjs from 'dayjs';
import { useCallback , useState, FC, useMemo, ReactNode, useEffect, Fragment } from 'react';
import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { SelectCustomer } from '@gitroom/frontend/components/launches/select.customer';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import i18next from 'i18next';
import { newDayjs } from '@gitroom/frontend/components/layout/set.timezone';
import { expandPostsList } from '@gitroom/helpers/utils/posts.list.minify';

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
      // Buffer is Sunday-first — 'week' (locale) not 'isoWeek'
      return {
        startDate: date.startOf('week').format('YYYY-MM-DD'),
        endDate: date.endOf('week').format('YYYY-MM-DD'),
      };
    case 'month': {
      // Mirrors calendar.context getDateRange exactly: the whole visible
      // 6-week grid (Sunday of week one through Saturday of week six), so
      // Today/prev/next produce the same range shape as initial load.
      const gridStart = date.startOf('month').startOf('week');
      return {
        startDate: gridStart.format('YYYY-MM-DD'),
        endDate: gridStart.add(41, 'day').format('YYYY-MM-DD'),
      };
    }
    case 'list':
      return {
        startDate: date.format('YYYY-MM-DD'),
        endDate: date.format('YYYY-MM-DD'),
      };
  }
}


/* Buffer toolbar geometry (measured live): filter triggers are 32px tall r8,
 * transparent, 14/500, [16px icon][label][16px chevron]; Today and the view
 * combobox are 24px tall r6. Select menus are 200px, r6, p8, 32px rows with a
 * 16px check reserved at the left of the selected row. */
const ddTriggerCls =
  'flex items-center gap-[6px] h-[32px] px-[10px] rounded-[8px] text-[14px] font-[500] text-newTextColor/70 hover:text-newTextColor hover:bg-boxHover transition-colors duration-150';

const ChevronDown: FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m6 9 6 6 6-6" />
  </svg>
);

/** Buffer's single-select menu row: [16px check slot][label], 32px, r6. */
const SelectRow: FC<{
  selected: boolean;
  label: string;
  onClick: () => void;
}> = ({ selected, label, onClick }) => (
  <div
    onClick={onClick}
    className={clsx(
      'flex items-center gap-[8px] h-[32px] px-[8px] rounded-[6px] text-[14px] font-[500] cursor-pointer hover:bg-boxHover transition-colors duration-150',
      selected ? 'bg-boxHover text-newTextColor' : 'text-newTextColor/80'
    )}
  >
    <span className="w-[16px] shrink-0 flex items-center justify-center">
      {selected && (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      )}
    </span>
    {label}
  </div>
);

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
        className={ddTriggerCls}
      >
        {/* Buffer's channels glyph is four circles, not squares */}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 6.5C10 8.433 8.433 10 6.5 10C4.567 10 3 8.433 3 6.5C3 4.567 4.567 3 6.5 3C8.433 3 10 4.567 10 6.5Z" />
          <path d="M21 6.5C21 8.433 19.433 10 17.5 10C15.567 10 14 8.433 14 6.5C14 4.567 15.567 3 17.5 3C19.433 3 21 4.567 21 6.5Z" />
          <path d="M10 17.5C10 19.433 8.433 21 6.5 21C4.567 21 3 19.433 3 17.5C3 15.567 4.567 14 6.5 14C8.433 14 10 15.567 10 17.5Z" />
          <path d="M21 17.5C21 19.433 19.433 21 17.5 21C15.567 21 14 19.433 14 17.5C14 15.567 15.567 14 17.5 14C19.433 14 21 15.567 21 17.5Z" />
        </svg>
        {t('channels', 'Channels')}
        <ChevronDown />
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

  // Buffer's order and terms exactly: the calendar dropdown says "Scheduled"
  // (the list tabs are the surface that says "Queue")
  const options: { value: ListStateFilter; label: string }[] = [
    { value: 'all', label: t('all_posts', 'All Posts') },
    { value: 'draft', label: t('drafts', 'Drafts') },
    { value: 'scheduled', label: t('scheduled', 'Scheduled') },
    { value: 'published', label: t('sent', 'Sent') },
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
        className={ddTriggerCls}
      >
        {/* Buffer's "All Posts" glyph: two overlapping squares */}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none">
          <path d="M3 5C3 3.89543 3.89543 3 5 3H16C17.1046 3 18 3.89543 18 5V16C18 17.1046 17.1046 18 16 18H5C3.89543 18 3 17.1046 3 16V5ZM5 5H16V16H5L5 5Z" />
          <path d="M20 9.60001C20 9.04772 20.4477 8.60001 21 8.60001C21.5523 8.60001 22 9.04772 22 9.60001V19.4C22 20.0896 21.7261 20.7509 21.2385 21.2385C20.7509 21.7261 20.0896 22 19.4 22H9.6C9.04771 22 8.6 21.5523 8.6 21C8.6 20.4477 9.04771 20 9.6 20H19.4C19.5591 20 19.7117 19.9368 19.8243 19.8243C19.9368 19.7117 20 19.5591 20 19.4V9.60001Z" />
        </svg>
        {options.find((o) => o.value === current)?.label}
        <ChevronDown />
      </button>
      {open && (
        <DropdownPanel
          surface="panel"
          anchor="end"
          className="mt-[4px] w-[200px] !rounded-[6px] p-[8px] flex flex-col"
        >
          {options.map((option) => (
            <SelectRow
              key={option.value}
              selected={current === option.value}
              label={option.label}
              onClick={() => select(option.value)}
            />
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
        className={ddTriggerCls}
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
        <ChevronDown />
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

  // Buffer renders "City (GMT+1:00)" — offset without a leading zero on the
  // hour, minutes always shown.
  const gmt = useCallback((tz: string) => {
    try {
      const minutes = newDayjs().tz(tz).utcOffset();
      const sign = minutes < 0 ? '-' : '+';
      const abs = Math.abs(minutes);
      return `GMT${sign}${Math.floor(abs / 60)}:${String(abs % 60).padStart(2, '0')}`;
    } catch {
      return '';
    }
  }, []);

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
        className={ddTriggerCls}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
          <path d="M2 12h20" />
        </svg>
        {city(calendar.displayTimezone)}
        <ChevronDown />
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
              placeholder={t('search_cities_or_timezones', 'Search cities or timezones')}
              className="flex-1 bg-transparent outline-none text-[14px] text-newTextColor placeholder:text-newTextColor/50"
            />
          </div>
          <div className="flex flex-col max-h-[280px] overflow-y-auto">
            {list.map((tz) => (
              <div
                key={tz}
                onClick={() => select(tz)}
                className={clsx(
                  'flex items-center gap-[8px] px-[6px] py-[7px] rounded-[6px] text-[14px] cursor-pointer hover:bg-boxHover transition-colors duration-150',
                  tz === calendar.displayTimezone
                    ? 'text-newTextColor font-[600]'
                    : 'text-newTextColor/80'
                )}
              >
                <span className="truncate">
                  {city(tz)} ({gmt(tz)})
                </span>
              </div>
            ))}
          </div>
        </DropdownPanel>
      )}
    </div>
  );
};

// Buffer segmented control (spec §Page header): active = green-tint fill.
// The fill is the lime var washed to 15% so it mirrors per theme; the ink
// token is #bfff72 in dark / #3f6c0e in light. Presentation only.
const segActive =
  'bg-[color:color-mix(in_srgb,var(--new-btn-primary)_32%,transparent)] text-newTableTextFocused';
const segInactive = 'text-newTextColor/60 hover:text-newTextColor';

/** Buffer's phone filter surface: the funnel button opens a BOTTOM SHEET
 *  (white, rounded top, drag handle, scrim) listing the filters as drill-in
 *  rows — Filter by channel / All Posts / Filter by tag / timezone. Same URL
 *  and context wiring as the desktop dropdowns. */
const PhoneFilterSheet: FC<{ open: boolean; onClose: () => void }> = ({
  open,
  onClose,
}) => {
  const t = useT();
  const calendar = useCalendar();
  const fetch = useFetch();
  const searchParams = useSearchParams();
  const [stage, setStage] = useState<
    'root' | 'channels' | 'state' | 'tags' | 'tz'
  >('root');
  const [q, setQ] = useState('');

  const loadTags = useCallback(async () => {
    return (await fetch('/posts/tags')).json();
  }, []);
  const { data: tagsData } = useSWR('load-tags', loadTags);
  const tags: { id: string; name: string; color: string }[] =
    tagsData?.tags || [];

  const writeListParam = useCallback((key: string, ids: string[]) => {
    const url = new URL(window.location.href);
    if (ids.length) url.searchParams.set(key, ids.join(','));
    else url.searchParams.delete(key);
    window.history.replaceState(null, '', url.pathname + url.search);
  }, []);

  const selectedChannels = new Set<string>(
    (searchParams.get('integration') || '').split(',').filter(Boolean)
  );
  const selectedTags = new Set<string>(
    (searchParams.get('tags') || '').split(',').filter(Boolean)
  );
  const urlState = searchParams.get('state') || 'all';

  const stateOptions: { value: ListStateFilter; label: string }[] = [
    { value: 'all', label: t('all_posts', 'All Posts') },
    { value: 'draft', label: t('drafts', 'Drafts') },
    { value: 'scheduled', label: t('scheduled', 'Scheduled') },
    { value: 'published', label: t('sent', 'Sent') },
  ];

  const timezones = useMemo<string[]>(() => {
    const supported = (Intl as any).supportedValuesOf;
    return typeof supported === 'function' ? supported('timeZone') : [];
  }, []);
  const city = (tz: string) => (tz.split('/').pop() || tz).replace(/_/g, ' ');

  if (!open) return null;

  const rootRow = (
    icon: ReactNode,
    label: string,
    onClick: () => void
  ) => (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-[12px] w-full h-[44px] px-[12px] rounded-[8px] text-[15px] text-newTextColor hover:bg-boxHover text-start"
    >
      {icon}
      <span className="flex-1">{label}</span>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-newTextColor/50">
        <path d="m9 18 6-6-6-6" />
      </svg>
    </button>
  );

  const backRow = (title: string) => (
    <button
      type="button"
      onClick={() => setStage('root')}
      className="flex items-center gap-[8px] w-full h-[40px] px-[8px] text-[15px] font-[500] text-newTextColor"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m15 18-6-6 6-6" />
      </svg>
      {title}
    </button>
  );

  return (
    <div
      // h-[100dvh]: in this stack a fixed inset-0 box refuses to stretch
      // between insets (verified live) — explicit viewport height is what
      // actually pins the scrim over the whole page
      className="hidden phone:flex fixed inset-0 h-[100dvh] w-full z-[650] bg-black/50 items-end"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full bg-newBgColorInner rounded-t-[16px] px-[8px] pb-[20px] max-h-[70vh] overflow-y-auto">
        <div className="w-[36px] h-[4px] rounded-full bg-newTextColor/20 mx-auto my-[10px]" />
        {stage === 'root' && (
          <div className="flex flex-col gap-[2px]">
            {rootRow(
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 6.5C10 8.433 8.433 10 6.5 10C4.567 10 3 8.433 3 6.5C3 4.567 4.567 3 6.5 3C8.433 3 10 4.567 10 6.5Z" />
                <path d="M21 6.5C21 8.433 19.433 10 17.5 10C15.567 10 14 8.433 14 6.5C14 4.567 15.567 3 17.5 3C19.433 3 21 4.567 21 6.5Z" />
                <path d="M10 17.5C10 19.433 8.433 21 6.5 21C4.567 21 3 19.433 3 17.5C3 15.567 4.567 14 6.5 14C8.433 14 10 15.567 10 17.5Z" />
                <path d="M21 17.5C21 19.433 19.433 21 17.5 21C15.567 21 14 19.433 14 17.5C14 15.567 15.567 14 17.5 14C19.433 14 21 15.567 21 17.5Z" />
              </svg>,
              t('filter_by_channel', 'Filter by channel'),
              () => setStage('channels')
            )}
            {calendar.display !== 'list' &&
              rootRow(
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                  <path d="M3 5C3 3.89543 3.89543 3 5 3H16C17.1046 3 18 3.89543 18 5V16C18 17.1046 17.1046 18 16 18H5C3.89543 18 3 17.1046 3 16V5ZM5 5H16V16H5L5 5Z" />
                  <path d="M20 9.60001C20 9.04772 20.4477 8.60001 21 8.60001C21.5523 8.60001 22 9.04772 22 9.60001V19.4C22 20.0896 21.7261 20.7509 21.2385 21.2385C20.7509 21.7261 20.0896 22 19.4 22H9.6C9.04771 22 8.6 21.5523 8.6 21C8.6 20.4477 9.04771 20 9.6 20H19.4C19.5591 20 19.7117 19.9368 19.8243 19.8243C19.9368 19.7117 20 19.5591 20 19.4V9.60001Z" />
                </svg>,
                stateOptions.find((o) => o.value === urlState)?.label ||
                  t('all_posts', 'All Posts'),
                () => setStage('state')
              )}
            {rootRow(
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z" />
                <circle cx="7.5" cy="7.5" r=".5" fill="currentColor" />
              </svg>,
              t('filter_by_tag', 'Filter by tag'),
              () => setStage('tags')
            )}
            <div className="h-[1px] bg-newTableBorder my-[6px]" />
            {rootRow(
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
                <path d="M2 12h20" />
              </svg>,
              city(calendar.displayTimezone),
              () => setStage('tz')
            )}
          </div>
        )}
        {stage === 'channels' && (
          <div className="flex flex-col gap-[2px]">
            {backRow(t('filter_by_channel', 'Filter by channel'))}
            {(calendar.integrations || []).map((integration: any) => (
              <label
                key={integration.id}
                className="flex items-center gap-[10px] px-[12px] py-[8px] rounded-[8px] hover:bg-boxHover cursor-pointer"
              >
                <ChannelAvatar
                  picture={integration.picture}
                  identifier={integration.identifier}
                  name={integration.name}
                  size={28}
                  badgeSize={12}
                  fallback="placeholder"
                />
                <span className="flex-1 truncate text-[15px]">
                  {integration.name}
                </span>
                <input
                  type="checkbox"
                  checked={selectedChannels.has(integration.id)}
                  onChange={() => {
                    const next = new Set(selectedChannels);
                    if (next.has(integration.id)) next.delete(integration.id);
                    else next.add(integration.id);
                    writeListParam('integration', [...next]);
                  }}
                  className="accent-btnPrimary w-[16px] h-[16px]"
                />
              </label>
            ))}
          </div>
        )}
        {stage === 'state' && (
          <div className="flex flex-col gap-[2px]">
            {backRow(t('all_posts', 'All Posts'))}
            {stateOptions.map((option) => (
              <SelectRow
                key={option.value}
                selected={urlState === option.value}
                label={option.label}
                onClick={() => {
                  const url = new URL(window.location.href);
                  if (option.value === 'all') url.searchParams.delete('state');
                  else url.searchParams.set('state', option.value);
                  window.history.replaceState(
                    null,
                    '',
                    url.pathname + url.search
                  );
                  setStage('root');
                }}
              />
            ))}
          </div>
        )}
        {stage === 'tags' && (
          <div className="flex flex-col gap-[2px]">
            {backRow(t('filter_by_tag', 'Filter by tag'))}
            {tags.length === 0 && (
              <div className="px-[12px] py-[8px] text-[14px] text-newTextColor/60">
                {t('no_tags_yet', 'No tags yet')}
              </div>
            )}
            {tags.map((tag) => (
              <label
                key={tag.id}
                className="flex items-center gap-[10px] px-[12px] py-[10px] rounded-[8px] hover:bg-boxHover cursor-pointer"
              >
                <span
                  className="w-[10px] h-[10px] rounded-full shrink-0"
                  style={{ backgroundColor: tag.color }}
                />
                <span className="flex-1 truncate text-[15px]">{tag.name}</span>
                <input
                  type="checkbox"
                  checked={selectedTags.has(tag.id)}
                  onChange={() => {
                    const next = new Set(selectedTags);
                    if (next.has(tag.id)) next.delete(tag.id);
                    else next.add(tag.id);
                    writeListParam('tags', [...next]);
                  }}
                  className="accent-btnPrimary w-[16px] h-[16px]"
                />
              </label>
            ))}
          </div>
        )}
        {stage === 'tz' && (
          <div className="flex flex-col gap-[2px]">
            {backRow(city(calendar.displayTimezone))}
            <div className="flex items-center gap-[8px] h-[36px] px-[10px] mx-[4px] rounded-[8px] border border-newTableBorder">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-newTextColor/60">
                <path d="m21 21-4.34-4.34" />
                <circle cx="11" cy="11" r="8" />
              </svg>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t('search_cities_or_timezones', 'Search cities or timezones')}
                className="flex-1 bg-transparent outline-none text-[15px] text-newTextColor placeholder:text-newTextColor/50"
              />
            </div>
            <div className="flex flex-col max-h-[40vh] overflow-y-auto">
              {timezones
                .filter((tz) =>
                  tz.toLowerCase().replace(/_/g, ' ').includes(q.toLowerCase())
                )
                .map((tz) => (
                  <div
                    key={tz}
                    onClick={() => {
                      calendar.setDisplayTimezone(tz);
                      setStage('root');
                      setQ('');
                    }}
                    className={clsx(
                      'px-[12px] py-[9px] rounded-[8px] text-[15px] cursor-pointer hover:bg-boxHover',
                      tz === calendar.displayTimezone
                        ? 'text-newTextColor font-[600]'
                        : 'text-newTextColor/80'
                    )}
                  >
                    {city(tz)}
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/** Buffer's view combobox: 24px borderless trigger, no leading icon, and only
 *  Week/Month options — Buffer offers no Day view at desktop (phones get the
 *  rolling three-day grid instead). display=day stays URL-reachable. */
const ViewFilter: FC = () => {
  const t = useT();
  const calendar = useCalendar();
  const [open, setOpen] = useState(false);
  const ref = useClickAway<HTMLDivElement>(() => setOpen(false));

  const setView = useCallback(
    (display: 'week' | 'month') => {
      setOpen(false);
      if (calendar.display === display) return;
      const range = getDateRange(display);
      calendar.setFilters({
        startDate: range.startDate,
        endDate: range.endDate,
        display,
        customer: calendar.customer,
      });
    },
    [calendar]
  );

  const label =
    calendar.display === 'month'
      ? t('month', 'Month')
      : calendar.display === 'day'
      ? t('day', 'Day')
      : t('week', 'Week');

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-[6px] h-[24px] px-[8px] rounded-[6px] text-[14px] font-[500] text-newTextColor hover:bg-boxHover transition-colors duration-150"
      >
        {label}
        <ChevronDown />
      </button>
      {open && (
        <DropdownPanel
          surface="panel"
          anchor="start"
          className="mt-[4px] w-[200px] !rounded-[6px] p-[8px] flex flex-col"
        >
          <SelectRow
            selected={calendar.display === 'week'}
            label={t('week', 'Week')}
            onClick={() => setView('week')}
          />
          <SelectRow
            selected={calendar.display === 'month'}
            label={t('month', 'Month')}
            onClick={() => setView('month')}
          />
        </DropdownPanel>
      )}
    </div>
  );
};

/** Buffer's month-view "No Date" toggle — opens the Undated-drafts side panel
 *  (URL-derived state so the force-dynamic remount can't close it). */
const NoDateToggle: FC = () => {
  const t = useT();
  const searchParams = useSearchParams();
  const on = !!searchParams.get('noDate');

  const toggle = useCallback(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get('noDate')) url.searchParams.delete('noDate');
    else url.searchParams.set('noDate', '1');
    window.history.replaceState(null, '', url.pathname + url.search);
  }, []);

  return (
    <button
      type="button"
      aria-label={t('show_no_date_drafts', 'Show No Date drafts')}
      onClick={toggle}
      className={clsx(ddTriggerCls, on && 'bg-boxHover text-newTextColor')}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="18" height="18" x="3" y="3" rx="2" />
        <path d="M15 3v18" />
        <path d="m10 15-3-3 3-3" />
      </svg>
      {t('no_date', 'No Date')}
    </button>
  );
};

/** Buffer's Undated-drafts panel: in-content right sibling of the calendar
 *  grid (the grid shrinks beside it). Postiz drafts always carry a date, so
 *  the Buffer empty state is the steady state. */
export const UndatedDraftsPanel: FC = () => {
  const t = useT();
  const searchParams = useSearchParams();
  if (!searchParams.get('noDate')) return null;

  const close = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('noDate');
    window.history.replaceState(null, '', url.pathname + url.search);
  };

  return (
    <div className="w-[300px] shrink-0 ms-[16px] flex flex-col gap-[6px] phone:hidden select-none">
      <div className="flex items-center justify-between">
        <div className="text-[16px] font-[600] text-newTextColor" data-cs>
          {t('undated_drafts', 'Undated drafts')}
        </div>
        <button
          type="button"
          aria-label={t('close', 'Close')}
          onClick={close}
          className="w-[28px] h-[28px] rounded-[6px] flex items-center justify-center hover:bg-boxHover text-newTextColor/70"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      </div>
      <div className="text-[13px] text-newTextColor/60">
        {t(
          'undated_drafts_sub',
          'Drafts and approvals without a scheduled date.'
        )}
      </div>
      <div className="flex flex-col items-center gap-[10px] mt-[56px] px-[16px] text-center">
        <div className="w-[64px] h-[64px] rounded-full bg-newTextColor/5 flex items-center justify-center text-newTextColor/60">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
            <path d="M14 2v4a2 2 0 0 0 2 2h4" />
            <path d="M10 9H8" />
            <path d="M16 13H8" />
            <path d="M16 17H8" />
          </svg>
        </div>
        <div className="text-[16px] font-[600] text-newTextColor" data-cs>
          {t('no_undated_drafts', 'No Undated Drafts')}
        </div>
        <div className="text-[13px] text-newTextColor/60">
          {t('undated_drafts_empty', 'Drafts without a date will appear here.')}
        </div>
      </div>
    </div>
  );
};

/** Buffer's page header row: [icon chip] All Channels … [List|Calendar
 *  segmented] [+ New Post]. Rendered by the launches page above the toolbar,
 *  inside the CalendarWeekProvider. */
export const PageHeader: FC = () => {
  const t = useT();
  const calendar = useCalendar();
  const searchParams = useSearchParams();

  // A single ?integration= selection titles the page with that channel, like
  // Buffer's per-channel view; anything else reads "All Channels".
  const selectedIds = (searchParams.get('integration') || '')
    .split(',')
    .filter(Boolean);
  const single =
    selectedIds.length === 1
      ? (calendar.integrations || []).find((i: any) => i.id === selectedIds[0])
      : undefined;

  const isListView = calendar.display === 'list';

  const toView = useCallback(
    (target: 'calendar' | 'list') => {
      if ((target === 'list') === isListView) return;
      const display = target === 'list' ? 'list' : 'week';
      const range = getDateRange(display);
      calendar.setFilters({
        startDate: range.startDate,
        endDate: range.endDate,
        display,
        customer: calendar.customer,
      });
    },
    [calendar, isListView]
  );

  const newPost = useCallback(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('newPost', '1');
    window.history.replaceState(null, '', url.pathname + url.search);
  }, []);

  return (
    <div className="flex items-center gap-[10px] select-none">
      <div className="w-[40px] h-[40px] rounded-[10px] border border-newTableBorder flex items-center justify-center text-newTextColor shrink-0">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 6.5C10 8.433 8.433 10 6.5 10C4.567 10 3 8.433 3 6.5C3 4.567 4.567 3 6.5 3C8.433 3 10 4.567 10 6.5Z" />
          <path d="M21 6.5C21 8.433 19.433 10 17.5 10C15.567 10 14 8.433 14 6.5C14 4.567 15.567 3 17.5 3C19.433 3 21 4.567 21 6.5Z" />
          <path d="M10 17.5C10 19.433 8.433 21 6.5 21C4.567 21 3 19.433 3 17.5C3 15.567 4.567 14 6.5 14C8.433 14 10 15.567 10 17.5Z" />
          <path d="M21 17.5C21 19.433 19.433 21 17.5 21C15.567 21 14 19.433 14 17.5C14 15.567 15.567 14 17.5 14C19.433 14 21 15.567 21 17.5Z" />
        </svg>
      </div>
      <h1 className="font-display text-[20px] font-[400] text-newTextColor truncate" data-cs>
        {single ? single.name : t('all_channels', 'All Channels')}
      </h1>
      {/* Buffer's bookmark sits right of the title (saved-views live there);
          anatomy only until saved views exist here */}
      <button
        type="button"
        title={t('save_current_view', 'Save current view')}
        className="w-[24px] h-[24px] rounded-[6px] flex items-center justify-center text-newTextColor/60 hover:text-newTextColor hover:bg-boxHover transition-colors duration-150"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 3a2 2 0 0 1 2 2v15a1 1 0 0 1-1.496.868l-4.512-2.578a2 2 0 0 0-1.984 0l-4.512 2.578A1 1 0 0 1 5 20V5a2 2 0 0 1 2-2z" />
        </svg>
      </button>
      <div className="flex-1" />
      {/* phone puts the segmented in the toolbar row (Buffer) — hidden here */}
      <div className="phone:hidden flex h-[32px] p-[4px] border border-newTableBorder rounded-[8px] text-[14px] font-[500]" data-cs>
        <button
          type="button"
          onClick={() => toView('list')}
          className={clsx(
            'flex items-center gap-[6px] px-[8px] rounded-[6px] transition-colors duration-150',
            isListView ? segActive : segInactive
          )}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 5h.01" />
            <path d="M3 12h.01" />
            <path d="M3 19h.01" />
            <path d="M8 5h13" />
            <path d="M8 12h13" />
            <path d="M8 19h13" />
          </svg>
          {t('list', 'List')}
        </button>
        <button
          type="button"
          onClick={() => toView('calendar')}
          className={clsx(
            'flex items-center gap-[6px] px-[8px] rounded-[6px] transition-colors duration-150',
            !isListView ? segActive : segInactive
          )}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 2v4" />
            <path d="M16 2v4" />
            <rect width="18" height="18" x="3" y="4" rx="2" />
            <path d="M3 10h18" />
          </svg>
          {/* own key — the 'calendar' key is locale-mapped to the nav label */}
          {t('calendar_view', 'Calendar')}
        </button>
      </div>
      <button
        type="button"
        onClick={newPost}
        className="phone:hidden flex items-center gap-[6px] h-[32px] px-[12px] rounded-[8px] border border-newTableBorder text-[14px] font-[500] text-newTextColor hover:bg-boxHover transition-colors duration-150"
        data-cs
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14" />
          <path d="M12 5v14" />
        </svg>
        {t('new_post', 'New Post')}
      </button>
      {/* Buffer phone: New Post is an icon-only primary square (lime here —
          the bg-btnPrimary global rule paints black ink) */}
      <button
        type="button"
        aria-label={t('new_post', 'New Post')}
        onClick={newPost}
        className="hidden phone:flex w-[40px] h-[40px] rounded-[8px] bg-btnPrimary items-center justify-center"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14" />
          <path d="M12 5v14" />
        </svg>
      </button>
    </div>
  );
};

export const Filters = () => {
  const calendar = useCalendar();
  const t = useT();
  const fetch = useFetch();

  // Set dayjs locale based on current language
  const currentLanguage = i18next.resolvedLanguage || 'en';
  dayjs.locale();

  // Buffer titles every calendar view "August 2026". The month range is the
  // grid-extended 6-week window (starts in the previous month), so the owning
  // month is derived from the range middle; weeks use the mid-week day.
  const monthTitle = useMemo(() => {
    const start = newDayjs(calendar.startDate);
    const mid =
      calendar.display === 'week'
        ? start.add(3, 'day')
        : calendar.display === 'month'
        ? start.add(15, 'day')
        : start;
    return mid.format('MMMM YYYY');
  }, [calendar.startDate, calendar.display]);

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
        // the range starts in the PREVIOUS month (grid-extended) — anchor on
        // the owning month before stepping
        nextStart = currentStart.add(15, 'day').startOf('month').add(1, 'month');
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
        prevStart = currentStart
          .add(15, 'day')
          .startOf('month')
          .subtract(1, 'month');
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

  const isListView = calendar.display === 'list';

  const [sheetOpen, setSheetOpen] = useState(false);

  const toView = useCallback(
    (target: 'calendar' | 'list') => {
      if ((target === 'list') === isListView) return;
      const display = target === 'list' ? 'list' : 'week';
      const range = getDateRange(display);
      calendar.setFilters({
        startDate: range.startDate,
        endDate: range.endDate,
        display,
        customer: calendar.customer,
      });
    },
    [calendar, isListView]
  );

  const [stateDdOpen, setStateDdOpen] = useState(false);
  const stateDdRef = useClickAway<HTMLDivElement>(() => setStateDdOpen(false));

  const setListStateFilter = useCallback(
    (next: ListStateFilter) => () => {
      if (calendar.listState === next) return;
      calendar.setListState(next);
    },
    [calendar]
  );

  // Buffer's list tabs: Queue · Drafts · Approvals · Sent — no 'All', Queue is
  // the default landing state. Approvals renders between Drafts and Sent.
  const listStateOptions: {
    value: ListStateFilter;
    label: string;
    approvalsBefore?: boolean;
  }[] = [
    { value: 'scheduled', label: t('queue', 'Queue') },
    { value: 'draft', label: t('drafts', 'Drafts') },
    { value: 'published', label: t('sent', 'Sent'), approvalsBefore: true },
  ];

  useEffect(() => {
    if (isListView && (calendar.listState as string) === 'all') {
      calendar.setListState('scheduled');
    }
  }, [isListView, calendar.listState]);

  // Per-tab count pills (Buffer): three feather-light list queries, 1 row each,
  // sharing the active customer/channel/tag filters. Read-path only.
  const countsKey = `tab-counts-${calendar.customer || ''}-${
    (calendar as any).integration || ''
  }-${(calendar as any).tags || ''}-${calendar.listTotal}`;
  const loadTabCounts = useCallback(async () => {
    const entries = await Promise.all(
      (['scheduled', 'draft', 'published'] as const).map(async (state) => {
        const search = new URLSearchParams({
          page: '1',
          limit: '1',
          customer: calendar.customer?.toString() || '',
          integration: ((calendar as any).integration || '').toString(),
          state,
        });
        const tags = (calendar as any).tags;
        if (tags) search.set('tags', tags);
        const raw = expandPostsList(
          await (await fetch(`/posts/list?${search.toString()}`)).json()
        );
        return [state, (raw as any)?.total ?? 0] as const;
      })
    );
    return Object.fromEntries(entries) as Record<string, number>;
  }, [calendar.customer, (calendar as any).integration, (calendar as any).tags]);
  const { data: tabCounts } = useSWR(isListView ? countsKey : null, loadTabCounts);

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
    <div
      className={clsx(
        'text-textColor flex flex-col !flex-row flex-wrap gap-[8px] items-center select-none',
        // Buffer's list tabs sit on a full-width hairline track
        isListView && 'border-b border-newTableBorder pb-[0px]'
      )}
    >
      {!isListView && (
        <div className="flex flex-grow flex-row items-center">
          {/* Buffer: the two chevrons sit ADJACENT, before the title */}
          <div
            onClick={previous}
            className="cursor-pointer text-newTextColor/70 rtl:rotate-180 w-[32px] h-[32px] rounded-[8px] flex items-center justify-center hover:bg-boxHover hover:text-newTextColor transition-colors duration-150"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </div>
          <div
            onClick={next}
            className="cursor-pointer text-newTextColor/70 rtl:rotate-180 w-[32px] h-[32px] rounded-[8px] flex items-center justify-center hover:bg-boxHover hover:text-newTextColor transition-colors duration-150"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </div>
          <h2 className="ms-[4px] text-[16px] font-[500] whitespace-nowrap">
            {monthTitle}
          </h2>
          <div
            onClick={setToday}
            className="ms-[16px] h-[24px] px-[10px] flex justify-center items-center rounded-[6px] border border-newTableBorder text-[14px] font-[500] cursor-pointer hover:bg-boxHover transition-colors duration-150 phone:hidden"
          >
            {t('today', 'Today')}
          </div>
          <div className="ms-[8px] phone:hidden">
            <ViewFilter />
          </div>
        </div>
      )}
      {isListView && (
        <div className="flex flex-grow flex-row items-center gap-[10px]">
          {/* Buffer shows no pager at all on a single page; when it must
              exist (>100 posts) it trails the tabs */}
          <div className={clsx('order-3 h-[36px] gap-[2px] flex items-center', calendar.listTotalPages <= 1 && 'hidden')}>
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
          <div className="order-1 flex flex-row h-[36px] gap-[28px] text-[14px] font-[500] phone:hidden">
            {listStateOptions.map((option) => (
              <Fragment key={option.value}>
                {/* Buffer's Approvals tab sits between Drafts and Sent
                    (lavender ⚡ pill) — visual anatomy until the approval
                    workflow is wired in this fork */}
                {option.approvalsBefore && (
                  <div
                    className="relative flex items-center gap-[6px] text-newTextColor/60 cursor-default"
                    title={t('approvals_soon', 'Approvals — coming soon')}
                  >
                    {t('approvals', 'Approvals')}
                    <span className="rounded-full bg-[#EDE9FE] px-[6px] h-[18px] flex items-center" data-cs>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="#7C3AED" stroke="none">
                        <path d="M13 2 3 14h9l-1 8 10-12h-9z" />
                      </svg>
                    </span>
                  </div>
                )}
                <div
                  onClick={setListStateFilter(option.value)}
                  className={clsx(
                    'relative cursor-pointer flex items-center gap-[6px] transition-colors duration-150',
                    calendar.listState === option.value
                      ? 'text-newTextColor'
                      : 'text-newTextColor/60 hover:text-newTextColor'
                  )}
                >
                  {option.label}
                  {tabCounts?.[option.value] !== undefined && (
                    <span className="rounded-full bg-newTextColor/10 px-[7px] h-[18px] flex items-center text-[12px] text-newTextColor" data-cs>
                      {tabCounts[option.value]}
                    </span>
                  )}
                  {calendar.listState === option.value && (
                    <div className="absolute -bottom-[1px] inset-x-0 h-[2px] bg-newTextColor" />
                  )}
                </div>
              </Fragment>
            ))}
          </div>
          {/* Buffer mobile compresses the state tabs into a "Queue 12 ▾"
              dropdown — same setter, same options */}
          <div className="order-2 hidden phone:block relative" ref={stateDdRef}>
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
          <div className="order-4 flex-1" />
        </div>
      )}
      {/* Buffer's toolbar filter order: Channels · All Posts · Tags · timezone
          (All Posts is calendar-only — the list view has its own state tabs;
          the customer selector is a Postiz capability kept before timezone).
          The List|Calendar view segmented moved up into PageHeader. On phone
          the whole group collapses behind Buffer's funnel → bottom sheet. */}
      <div className="contents phone:hidden">
        <ChannelsFilter />
        {!isListView && <StateFilter />}
        <TagsFilter />
        {calendar.display === 'month' && <NoDateToggle />}
        <SelectCustomer
          customer={calendar.customer as string}
          onChange={(customer: string) => setCustomer(customer)}
          integrations={calendar.integrations}
        />
        <TimezoneFilter />
      </div>
      <div className="hidden phone:flex items-center gap-[8px] ms-auto">
        <button
          type="button"
          aria-label={t('more_actions', 'More actions')}
          onClick={() => setSheetOpen(true)}
          className="w-[40px] h-[40px] flex items-center justify-center rounded-[8px] hover:bg-boxHover text-newTextColor"
        >
          {/* Buffer's phone funnel: three shrinking filter lines */}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 5h20" />
            <path d="M6 12h12" />
            <path d="M9 19h6" />
          </svg>
        </button>
        {/* icon-only List|Calendar segmented (Buffer phone toolbar) */}
        <div className="flex h-[32px] p-[4px] border border-newTableBorder rounded-[8px]">
          <button
            type="button"
            aria-label={t('list', 'List')}
            onClick={() => toView('list')}
            className={clsx(
              'flex items-center px-[8px] rounded-[6px] transition-colors duration-150',
              isListView ? segActive : segInactive
            )}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 5h.01" />
              <path d="M3 12h.01" />
              <path d="M3 19h.01" />
              <path d="M8 5h13" />
              <path d="M8 12h13" />
              <path d="M8 19h13" />
            </svg>
          </button>
          <button
            type="button"
            aria-label={t('calendar_view', 'Calendar')}
            onClick={() => toView('calendar')}
            className={clsx(
              'flex items-center px-[8px] rounded-[6px] transition-colors duration-150',
              !isListView ? segActive : segInactive
            )}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 2v4" />
              <path d="M16 2v4" />
              <rect width="18" height="18" x="3" y="4" rx="2" />
              <path d="M3 10h18" />
            </svg>
          </button>
        </div>
      </div>
      <PhoneFilterSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </div>
  );
};
