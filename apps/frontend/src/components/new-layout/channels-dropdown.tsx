'use client';

import { FC, ReactNode, useCallback, useMemo, useState } from 'react';
import clsx from 'clsx';
import { useClickAway } from '@uidotdev/usehooks';
import { DropdownPanel } from '@gitroom/frontend/components/cuesoft/dropdown/dropdown-panel';
import { ChannelAvatar } from '@gitroom/frontend/components/new-layout/channel-avatar';
import { useT } from '@gitroom/react/translation/get.transation.service.client';

/**
 * The Buffer channels dropdown, extracted verbatim from the calendar toolbar's
 * ChannelsFilter (launches/filters.tsx) so Insights and Plugs can reuse it
 * instead of their phone chip strips. Presentation is the measured Buffer
 * anatomy: 32px transparent r8 trigger ([16px icon][label][16px chevron]),
 * 300px r12 panel with a search field and 28px-avatar checklist rows.
 *
 * Two modes:
 *  - multi (the calendar filter): four-circles glyph + label trigger,
 *    checkbox rows + Select all header. onChange receives the FULL selected
 *    id list on every toggle — the call site owns the plumbing (the calendar
 *    keeps its ?integration= comma-list replaceState wiring unchanged).
 *  - single (Insights/Plugs channel selection): the trigger is the selected
 *    channel's avatar + name; rows carry a check in a left 16px slot
 *    (the spec's select-menu anatomy) and picking one closes the dropdown.
 *
 * Phone: the trigger lifts to a 40px tap target (phone:h-[40px] — prefixed,
 * so the global.scss ladder leaves it alone) and the panel renders as the
 * standard bottom sheet (scrim, rounded top, drag handle) instead of the
 * anchored popover.
 */

export interface ChannelsDropdownIntegration {
  id: string;
  name: string;
  identifier: string;
  picture?: string;
  refreshNeeded?: boolean;
}

/* Buffer toolbar trigger (same string as filters.tsx ddTriggerCls) + the
 * phone 40px tap target. */
const triggerCls =
  'flex items-center gap-[6px] h-[32px] px-[10px] rounded-[8px] text-[14px] font-[500] text-newTextColor/70 hover:text-newTextColor hover:bg-boxHover transition-colors duration-150 phone:h-[40px]';

/** Buffer's channels glyph is four circles, not squares. */
const FourCircles: FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 6.5C10 8.433 8.433 10 6.5 10C4.567 10 3 8.433 3 6.5C3 4.567 4.567 3 6.5 3C8.433 3 10 4.567 10 6.5Z" />
    <path d="M21 6.5C21 8.433 19.433 10 17.5 10C15.567 10 14 8.433 14 6.5C14 4.567 15.567 3 17.5 3C19.433 3 21 4.567 21 6.5Z" />
    <path d="M10 17.5C10 19.433 8.433 21 6.5 21C4.567 21 3 19.433 3 17.5C3 15.567 4.567 14 6.5 14C8.433 14 10 15.567 10 17.5Z" />
    <path d="M21 17.5C21 19.433 19.433 21 17.5 21C15.567 21 14 19.433 14 17.5C14 15.567 15.567 14 17.5 14C19.433 14 21 15.567 21 17.5Z" />
  </svg>
);

const ChevronDown: FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m6 9 6 6 6-6" />
  </svg>
);

const Check: FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

export const ChannelsDropdown: FC<{
  integrations: ChannelsDropdownIntegration[];
  /** Selected integration ids. Single mode reads [0]. */
  selectedIds: string[];
  /** Always called with the full selected id list (single mode: [id]). */
  onChange: (ids: string[]) => void;
  /** Checkbox rows + Select all (the calendar filter). Default false. */
  multi?: boolean;
  /** Trigger label. Multi default: "Channels". Single mode shows the
   *  selected channel's avatar + name instead; `label` is its fallback. */
  label?: ReactNode;
  /** Which trigger edge the panel hugs. The calendar toolbar sits at the
   *  content's right edge ('end'); Insights/Plugs sit at the left ('start'
   *  — an end-anchored 300px panel would hang off the pane). */
  anchor?: 'start' | 'end';
}> = ({
  integrations,
  selectedIds,
  onChange,
  multi = false,
  label,
  anchor = 'end',
}) => {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useClickAway<HTMLDivElement>(() => setOpen(false));

  const selected = useMemo(() => new Set<string>(selectedIds), [selectedIds]);
  const current = useMemo(
    () => integrations.find((i) => i.id === selectedIds[0]),
    [integrations, selectedIds]
  );

  const list = useMemo(
    () =>
      integrations.filter((i) =>
        (i.name || '').toLowerCase().includes(q.toLowerCase())
      ),
    [integrations, q]
  );

  const toggleChannel = useCallback(
    (id: string) => {
      const next = new Set<string>(selected);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      onChange([...next]);
    },
    [selected, onChange]
  );

  const pickChannel = useCallback(
    (id: string) => {
      onChange([id]);
      setOpen(false);
      setQ('');
    },
    [onChange]
  );

  const searchField = (
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
  );

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={triggerCls}
      >
        {!multi && current ? (
          <>
            <ChannelAvatar
              picture={current.picture}
              identifier={current.identifier}
              name={current.name}
              size={20}
              badgeSize={10}
              badgeOffset="-bottom-[2px] -end-[2px]"
              youtubeBadgeSize={12}
              fallback="placeholder"
            />
            <span className="max-w-[180px] truncate">{current.name}</span>
          </>
        ) : (
          <>
            <FourCircles />
            {label ?? t('channels', 'Channels')}
          </>
        )}
        <ChevronDown />
      </button>
      {open && (
        <>
          {/* Desktop: the anchored popover (calendar-toolbar anatomy). */}
          <DropdownPanel
            surface="panel"
            anchor={anchor}
            className="phone:hidden mt-[6px] w-[300px] p-[10px] flex flex-col gap-[8px]"
          >
            {searchField}
            {multi && (
              <div className="flex items-center justify-between px-[6px]">
                <span className="text-[13px] font-[550]">
                  {t('channels', 'Channels')}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    onChange(
                      selected.size === integrations.length
                        ? []
                        : integrations.map((i) => i.id)
                    )
                  }
                  className="text-[13px] text-newTextColor/70 hover:text-newTextColor"
                >
                  {t('select_all', 'Select all')}
                </button>
              </div>
            )}
            <div className="flex flex-col max-h-[280px] overflow-y-auto">
              {list.map((integration) =>
                multi ? (
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
                ) : (
                  <div
                    key={integration.id}
                    onClick={() => pickChannel(integration.id)}
                    className={clsx(
                      'flex items-center gap-[10px] px-[6px] py-[6px] rounded-[6px] hover:bg-boxHover cursor-pointer',
                      selected.has(integration.id)
                        ? 'text-newTextColor'
                        : 'text-newTextColor/80'
                    )}
                  >
                    <span className="w-[16px] shrink-0 flex items-center justify-center">
                      {selected.has(integration.id) && <Check />}
                    </span>
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
                  </div>
                )
              )}
            </div>
          </DropdownPanel>
          {/* Phone: the standard bottom sheet (same shell as the launches
              filter sheet — scrim, rounded top, drag handle). h-[100dvh]
              because a fixed inset-0 box refuses to stretch between insets
              in this stack (verified live on the launches sheet). */}
          <div
            className="hidden phone:flex fixed inset-0 h-[100dvh] w-full z-[650] bg-black/50 items-end"
            onClick={(e) => {
              if (e.target === e.currentTarget) setOpen(false);
            }}
          >
            <div className="w-full bg-newBgColorInner rounded-t-[16px] px-[8px] pb-[20px] max-h-[70vh] overflow-y-auto">
              <div className="w-[36px] h-[4px] rounded-full bg-newTextColor/20 mx-auto my-[10px]" />
              <div className="flex flex-col gap-[2px]">
                {integrations.map((integration) =>
                  multi ? (
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
                        checked={selected.has(integration.id)}
                        onChange={() => toggleChannel(integration.id)}
                        className="accent-btnPrimary w-[16px] h-[16px]"
                      />
                    </label>
                  ) : (
                    <button
                      key={integration.id}
                      type="button"
                      onClick={() => pickChannel(integration.id)}
                      className="flex items-center gap-[10px] w-full min-h-[44px] px-[12px] py-[6px] rounded-[8px] text-[15px] text-newTextColor hover:bg-boxHover text-start"
                    >
                      <span className="w-[16px] flex items-center justify-center shrink-0">
                        {selected.has(integration.id) && <Check />}
                      </span>
                      <ChannelAvatar
                        picture={integration.picture}
                        identifier={integration.identifier}
                        name={integration.name}
                        size={28}
                        badgeSize={12}
                        fallback="placeholder"
                      />
                      <span className="flex-1 truncate">
                        {integration.name}
                      </span>
                    </button>
                  )
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
