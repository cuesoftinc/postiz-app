'use client';

import React, { FC, ReactNode, useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import dynamic from 'next/dynamic';
import useCookie from 'react-use-cookie';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { orderBy } from 'lodash';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useUser } from '@gitroom/frontend/components/layout/user.context';
import { useVariables } from '@gitroom/react/helpers/variable.context';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { useMenuItem } from '@gitroom/frontend/components/layout/top.menu';
import { useIntegrationList } from '@gitroom/frontend/components/launches/helpers/use.integration.list';
import { ChannelAvatar } from '@gitroom/frontend/components/new-layout/channel-avatar';
import { DropdownPanel } from '@gitroom/frontend/components/cuesoft/dropdown/dropdown-panel';
import { useDropdown } from '@gitroom/frontend/components/cuesoft/dropdown/use-dropdown';
import { StreakComponent } from '@gitroom/frontend/components/layout/streak.component';
import NotificationComponent from '@gitroom/frontend/components/notifications/notification.component';
import { LanguageComponent } from '@gitroom/frontend/components/layout/language.component';
import { ChromeExtensionComponent } from '@gitroom/frontend/components/layout/chrome.extension.component';
import { AttachToFeedbackIcon } from '@gitroom/frontend/components/new-layout/sentry.feedback.component';
import { OrganizationSelector } from '@gitroom/frontend/components/layout/organization.selector';

// Same ssr:false pattern the top bar used: the toggle reads the 'mode' cookie
// on mount, so server-rendering it would hydrate the wrong glyph.
const ModeComponent = dynamic(
  () => import('@gitroom/frontend/components/layout/mode.component'),
  { ssr: false }
);

/**
 * Buffer-replica desktop sidebar (spec §Sidebar): 240px, flat on the page bg,
 * no border. Replaces the 80px icon rail on desktop only — the rail element in
 * layout.component.tsx is now phone-only and keeps the bottom-tab-bar behavior
 * untouched.
 *
 * Logic-preserving by construction:
 *  - Nav rows render the SAME items array as the phone bar (useMenuItem) with
 *    TopMenu's exact visibility filter, so route access never diverges.
 *  - Channels is a read-only render of the launches panel's own SWR
 *    (useIntegrationList → '/integrations/list', already fetched at layout
 *    level by ContinueProvider, so this dedupes). Rows navigate to /launches;
 *    management (add/refresh/disable/groups) stays in the launches panel.
 *  - The "+ New" pill navigates to /launches: the app has no search-param /
 *    deep-link that opens the Create Post modal (grepped: display, startDate,
 *    endDate, customer, added/continue, msg are the only handled params), and
 *    inventing one would be a new mechanism.
 *
 * Sizes come from the spec (rows h-32 r-8, pill h-40 r-999, labels 14px,
 * section header 13px). `data-cs` marks the spots where the global.scss
 * ladder would rescale spec sizes (the 40px pill, the 48px logo row, the
 * 20px wordmark).
 * Active/hover fills use CSS-var tokens only: bg-newBorder is the 10%-alpha
 * fill (white-alpha in dark, black-alpha in light — the spec's mirroring),
 * boxHover is the quieter wash.
 *
 * Collapse (Buffer parity): a cookie-persisted ('sidebarCollapsed', pure UI
 * state, same react-use-cookie pattern as the panels' 'collapseMenu') 52px
 * icon rail — logo mark 24, 32x32 green [+] square, icon-only nav rows with
 * native title tooltips, hairline, 24px channel avatar stack (presence dots
 * kept, same channelHref), then panel-left expand control + org mark at the
 * bottom. The collapse control lives in the expanded org footer row; width
 * animates 0.15s ease-in-out. The phone drawer never collapses.
 */

type SidebarMenuItem = ReturnType<typeof useMenuItem>['firstMenu'][number];

/** Lucide panel-left-close / panel-left-open, the measured collapse/expand
 *  glyphs (16x16, viewBox 24, stroke 2.2, round caps/joins). Buffer uses the
 *  directional pair: an inward arrow on the collapse control in the expanded
 *  footer, the mirrored outward arrow on the rail's expand button. */
const PanelLeftCloseIcon: FC = () => (
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
    <rect width="18" height="18" x="3" y="3" rx="2" />
    <path d="M9 3v18" />
    <path d="m16 15-3-3 3-3" />
  </svg>
);

const PanelLeftOpenIcon: FC = () => (
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
    <rect width="18" height="18" x="3" y="3" rx="2" />
    <path d="M9 3v18" />
    <path d="m14 9 3 3-3 3" />
  </svg>
);

/** Single lightweight read of the scheduled queue (existing list endpoint,
 *  display-only): the exact org-wide total feeds the Publish nav badge, and
 *  grouping the first page (max the endpoint allows) by integration feeds the
 *  per-channel counts. Counts render only once data exists — a null count
 *  simply hides the badge slot. Per-channel numbers can undercount past 100
 *  queued posts; the total stays exact. */
const useScheduledCounts = () => {
  const fetch = useFetch();
  const load = useCallback(async () => {
    return await (
      await fetch('/posts/list?state=scheduled&page=0&limit=100')
    ).json();
  }, []);
  const { data } = useSWR('sidebar-scheduled-counts', load, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    refreshWhenHidden: false,
    refreshWhenOffline: false,
  });

  return useMemo(() => {
    if (!data || !Array.isArray(data.posts)) {
      return {
        total: undefined as number | undefined,
        perIntegration: undefined as Record<string, number> | undefined,
      };
    }
    const perIntegration: Record<string, number> = {};
    for (const post of data.posts) {
      const id = post?.integration?.id;
      if (id) {
        perIntegration[id] = (perIntegration[id] || 0) + 1;
      }
    }
    return {
      total: typeof data.total === 'number' ? data.total : undefined,
      perIntegration,
    };
  }, [data]);
};

/** TopMenu's visibility rules, verbatim, so the sidebar and the phone bar can
 *  never disagree about which routes a user sees. */
const useVisibleMenu = () => {
  const user = useUser();
  const { isGeneral, billingEnabled } = useVariables();
  const { firstMenu, secondMenu } = useMenuItem();

  const predicate = (f: SidebarMenuItem) => {
    if (f.hide) {
      return false;
    }
    if (f.requireBilling && !billingEnabled) {
      return false;
    }
    if (f.name === 'Billing' && user?.isLifetime) {
      return false;
    }
    if (f.role) {
      return f.role.includes(user?.role!);
    }
    return true;
  };

  // Same gate TopMenu puts on its first group (including the @ts-ignore'd
  // tier comparison — parity over prettiness).
  const showFirst =
    // @ts-ignore
    !!user?.orgId &&
    // @ts-ignore
    (user.tier !== 'FREE' || !isGeneral || !billingEnabled);

  return {
    first: showFirst ? firstMenu.filter(predicate) : [],
    second: secondMenu.filter(predicate),
  };
};

const NavRow: FC<{
  label: string;
  icon: ReactNode;
  path: string;
  onClick?: () => void;
  /** Icon rail mode: 32x32 icon-only square, label survives as the native
   *  title tooltip (already set on both render branches below). */
  collapsed?: boolean;
  /** Right-aligned badge slot (Buffer parity: plain muted counts, tinted
   *  pills). Hidden in the collapsed rail. */
  trailing?: ReactNode;
}> = ({ label, icon, path, onClick, collapsed, trailing }) => {
  const currentPath = usePathname();
  // Same active test as menu-item.tsx.
  const isActive = currentPath.indexOf(path) === 0;

  const className = clsx(
    'flex items-center rounded-[8px] text-[14px] font-[400] transition-[padding-inline-start,background-color,color] duration-150 ease-in-out',
    collapsed
      ? 'w-[32px] h-[32px] shrink-0 justify-center'
      : 'w-full gap-[10px] h-[32px] px-[8px]',
    isActive
      ? 'bg-newBorder text-newTextColor'
      : 'text-textItemBlur hover:bg-boxHover hover:text-newTextColor'
  );

  const inner = (
    <>
      {/* leading icons render at 16 (Buffer's measured size); the 20px box
          keeps rows from jittering when a stock icon is drawn wider */}
      <div className="w-[20px] h-[20px] shrink-0 flex items-center justify-center [&_svg]:max-w-[16px] [&_svg]:max-h-[16px]">
        {icon}
      </div>
      {!collapsed && <div className="flex-1 truncate text-start">{label}</div>}
      {!collapsed && trailing != null && (
        <div className="shrink-0 flex items-center">{trailing}</div>
      )}
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} title={label} className={className}>
        {inner}
      </button>
    );
  }

  return (
    <Link
      prefetch={true}
      href={path}
      title={label}
      {...(path.indexOf('http') === 0 && { target: '_blank' })}
      className={className}
    >
      {inner}
    </Link>
  );
};

const channelRowClassName = (disabled?: boolean) =>
  clsx(
    'flex items-center gap-[8px] px-[8px] py-[4px] rounded-[8px] text-[14px] text-textItemBlur hover:bg-boxHover hover:text-newTextColor transition-colors',
    disabled && 'opacity-50'
  );

/** Buffer shows quick-connect tiles only for platforms NOT yet connected;
 *  this pool is ordered to surface the trio Buffer leads with. */
const QUICK_CONNECT_POOL = [
  'instagram',
  'threads',
  'bluesky',
  'facebook',
  'linkedin',
  'x',
  'tiktok',
  'youtube',
  'pinterest',
  'mastodon',
];

/** One expanded channel row: avatar + presence dot + name + a fixed 24px
 *  right slot. Buffer parity: the slot shows the muted scheduled-post count
 *  at rest and swaps to the manage kebab on row hover — both are absolutely
 *  stacked in the same box so nothing shifts. A null count simply hides. */
const ChannelRow: FC<{
  integration: any;
  href: string;
  active: boolean;
  count?: number;
}> = ({ integration, href, active, count }) => {
  const t = useT();
  const router = useRouter();

  return (
    <Link
      prefetch={true}
      href={href}
      title={integration.name}
      className={clsx(
        'group/chrow',
        channelRowClassName(integration.disabled),
        active && 'bg-newBorder text-newTextColor'
      )}
    >
      {/* spec §Sidebar 5: presence dot top-left — green for healthy
          channels, red-family when a refresh is needed, omitted for
          disabled ones. Driven by fields already on this SWR row. */}
      <span className="relative flex shrink-0">
        <ChannelAvatar
          picture={integration.picture}
          identifier={integration.identifier}
          name={integration.name}
          size={32}
          badgeSize={14}
          badgeOffset="-bottom-[2px] -end-[2px]"
          fallback="placeholder"
          className="min-w-[32px] min-h-[32px]"
        />
        {!integration.disabled && (
          <span
            className={clsx(
              'absolute -top-[2px] -start-[2px] z-10 w-[9px] h-[9px] rounded-full border-2 border-newBgColor',
              integration.refreshNeeded ? 'bg-red-500' : 'bg-green-500'
            )}
          />
        )}
      </span>
      <div className="flex-1 truncate">{integration.name}</div>
      <span className="relative w-[24px] h-[24px] min-w-[24px]">
        {count != null && (
          <span className="absolute inset-0 flex items-center justify-end text-[14px] text-textItemBlur group-hover/chrow:opacity-0 transition-opacity duration-150">
            {count}
          </span>
        )}
        <span
          role="button"
          tabIndex={0}
          title={t('manage_channels', 'Manage channels')}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            router.push('/launches?manageChannels=1');
          }}
          className="absolute inset-0 opacity-0 group-hover/chrow:opacity-100 focus-visible:opacity-100 flex items-center justify-center rounded-[6px] hover:bg-boxHover transition-opacity duration-150"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="1" />
            <circle cx="12" cy="5" r="1" />
            <circle cx="12" cy="19" r="1" />
          </svg>
        </span>
      </span>
    </Link>
  );
};

/** Read-only channel list. Same sort as the launches panel. Each row opens
 *  that channel's queue (/launches?integration=<id> — the calendar context
 *  filters both views by the id); management stays in the launches panel.
 *  In the collapsed rail the same rows render as a bare 24px avatar stack
 *  (presence dots kept, same channelHref navigation, name as title). */
const SidebarChannels: FC<{ collapsed?: boolean }> = ({ collapsed }) => {
  const t = useT();
  const { billingEnabled } = useVariables();
  const { data: integrations } = useIntegrationList();
  const { perIntegration } = useScheduledCounts();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const activeIntegration = searchParams.get('integration');
  const [searchOpen, setSearchOpen] = useState(false);
  const [channelFilter, setChannelFilter] = useState('');
  const [showLocked, setShowLocked] = useState(false);
  // Context-aware rows (Buffer parity): on Analytics a channel click selects
  // that channel's stats; everywhere else it opens the channel's queue.
  const channelHref = (id: string) =>
    pathname?.startsWith('/analytics')
      ? `/analytics?integration=${id}`
      : pathname?.startsWith('/plugs')
      ? `/plugs?integration=${id}`
      : `/launches?integration=${id}`;

  const sorted = useMemo(
    () =>
      orderBy(
        integrations,
        ['type', 'disabled', 'identifier'],
        ['desc', 'asc', 'asc']
      ),
    [integrations]
  );

  // Buffer's "Locked channels" drawer: billing-gated plans tuck disabled /
  // over-limit channels behind a muted expander. Self-hosted (no billing) or
  // zero locked keeps the flat list — the row is omitted entirely.
  const locked = useMemo(
    () => (billingEnabled ? sorted.filter((i: any) => i.disabled) : []),
    [billingEnabled, sorted]
  );
  const unlocked = useMemo(
    () => (locked.length > 0 ? sorted.filter((i: any) => !i.disabled) : sorted),
    [locked.length, sorted]
  );
  const visible = useMemo(() => {
    const q = channelFilter.trim().toLowerCase();
    if (!q) {
      return unlocked;
    }
    return unlocked.filter((i: any) =>
      String(i.name || '').toLowerCase().includes(q)
    );
  }, [channelFilter, unlocked]);

  // Quick-connect tiles show only platforms NOT already connected, matched on
  // the provider family (a linkedin-page connection hides the linkedin tile),
  // capped at three like Buffer.
  const quickConnect = useMemo(() => {
    const connectedBases = new Set(
      sorted.map((i: any) => String(i.identifier || '').split('-')[0])
    );
    return QUICK_CONNECT_POOL.filter(
      (identifier) => !connectedBases.has(identifier.split('-')[0])
    ).slice(0, 3);
  }, [sorted]);

  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-[8px] pt-[12px]">
        {sorted.map((integration: any) => (
          <Link
            key={integration.id}
            prefetch={true}
            href={channelHref(integration.id)}
            title={integration.name}
            className={clsx(
              'relative flex shrink-0',
              integration.disabled && 'opacity-50'
            )}
          >
            <ChannelAvatar
              picture={integration.picture}
              identifier={integration.identifier}
              name={integration.name}
              size={24}
              badgeSize={12}
              badgeOffset="-bottom-[2px] -end-[2px]"
              fallback="placeholder"
              className="min-w-[24px] min-h-[24px]"
            />
            {!integration.disabled && (
              <span
                className={clsx(
                  'absolute -top-[2px] -start-[2px] z-10 w-[8px] h-[8px] rounded-full border-2 border-newBgColor',
                  integration.refreshNeeded ? 'bg-red-500' : 'bg-green-500'
                )}
              />
            )}
          </Link>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[2px] pt-[16px]">
      {/* Buffer parity: at rest the header is just the muted label; the
          search and gear controls reveal on header hover (and on keyboard
          focus). Search filters the rows client-side — display only. */}
      <div className="group/chead px-[8px] pb-[4px] flex items-center gap-[2px] text-[13px] text-textItemBlur">
        <span className="flex-1">{t('channels', 'Channels')}</span>
        <button
          type="button"
          title={t('search_channels', 'Search channels')}
          onClick={() => {
            setSearchOpen(!searchOpen);
            setChannelFilter('');
          }}
          className={clsx(
            'w-[24px] h-[24px] flex items-center justify-center rounded-[6px] hover:bg-boxHover hover:text-newTextColor transition-opacity duration-150',
            !searchOpen &&
              'opacity-0 group-hover/chead:opacity-100 focus-visible:opacity-100'
          )}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
            <path d="m21 21-4.34-4.34" />
            <circle cx="11" cy="11" r="8" />
          </svg>
        </button>
        <Link
          prefetch={true}
          href="/launches?manageChannels=1"
          title={t('manage_channels', 'Manage channels')}
          className="opacity-0 group-hover/chead:opacity-100 focus-visible:opacity-100 w-[24px] h-[24px] flex items-center justify-center rounded-[6px] hover:bg-boxHover hover:text-newTextColor transition-opacity duration-150"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
            <path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        </Link>
      </div>
      {searchOpen && (
        <input
          autoFocus
          type="text"
          value={channelFilter}
          onChange={(e) => setChannelFilter(e.target.value)}
          placeholder={t('search_channels', 'Search channels')}
          className="mx-[8px] mb-[4px] h-[28px] px-[8px] rounded-[6px] border border-newTableBorder bg-transparent text-[13px] text-newTextColor placeholder:text-textItemBlur outline-none"
        />
      )}
      {visible.map((integration: any) => (
        <ChannelRow
          key={integration.id}
          integration={integration}
          href={channelHref(integration.id)}
          active={activeIntegration === integration.id}
          count={
            perIntegration ? perIntegration[integration.id] || 0 : undefined
          }
        />
      ))}
      {/* spec §Sidebar 6: muted label + quick-connect tiles (unconnected
          platforms only, full-bleed 24px brand art) ending in a "+" — every
          button deep-links to the same manage-channels panel. */}
      <div className="pt-[8px]">
        <div className="px-[8px] pb-[4px] text-[13px] text-textItemBlur">
          {t('connect_more_channels', 'Connect more channels')}
        </div>
        <div className="px-[8px] flex items-center gap-[8px]">
          {quickConnect.map((identifier) => (
            <Link
              key={identifier}
              prefetch={true}
              href="/launches?manageChannels=1"
              title={t('manage_channels', 'Manage channels')}
              className="w-[24px] h-[24px] rounded-[6px] overflow-hidden hover:opacity-80 transition-opacity duration-150"
            >
              <img
                src={`/icons/platforms/${identifier}.png`}
                alt={identifier}
                width={24}
                height={24}
                className="w-[24px] h-[24px] rounded-[6px] object-cover"
              />
            </Link>
          ))}
          <Link
            prefetch={true}
            href="/launches?manageChannels=1"
            title={t('manage_channels', 'Manage channels')}
            className="w-[24px] h-[24px] rounded-[6px] border border-newBorder flex items-center justify-center text-textItemBlur hover:bg-boxHover hover:text-newTextColor transition-colors duration-150"
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
              <path d="M5 12h14" />
              <path d="M12 5v14" />
            </svg>
          </Link>
        </div>
      </div>
      {/* Buffer's "Locked channels · N ›" expander — only when billing is on
          and some channels are locked, so self-hosted stays clean. */}
      {locked.length > 0 && (
        <div className="pt-[8px]">
          <button
            type="button"
            onClick={() => setShowLocked(!showLocked)}
            className="w-full px-[8px] py-[4px] flex items-center gap-[4px] text-[14px] text-textItemBlur hover:text-newTextColor transition-colors duration-150"
          >
            <span>
              {t('locked_channels', 'Locked channels')} · {locked.length}
            </span>
            <svg
              className={clsx(
                'transition-transform duration-150',
                showLocked && 'rotate-90'
              )}
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
          {showLocked &&
            locked.map((integration: any) => (
              <ChannelRow
                key={integration.id}
                integration={integration}
                href={channelHref(integration.id)}
                active={activeIntegration === integration.id}
              />
            ))}
        </div>
      )}
    </div>
  );
};

/** Buffer's channels-limit upsell card, pinned above the org footer: bordered
 *  r12 card with "<connected>/<limit> channels connected", segmented progress
 *  bars (brand lime for Buffer's green) and a bordered "Upgrade for More"
 *  button into /billing. Display-only: gated on billing being enabled AND the
 *  FREE tier, cookie-dismissable, and hidden when the plan reports no positive
 *  channel limit (self-hosted reports billing off anyway). */
const ChannelsLimitCard: FC = () => {
  const t = useT();
  const user = useUser();
  const { billingEnabled } = useVariables();
  const { data: integrations } = useIntegrationList();
  const [dismissed, setDismissed] = useCookie('channelsLimitCardDismissed', '0');

  const limit = user?.totalChannels || 0;
  if (
    !billingEnabled ||
    user?.tier?.current !== 'FREE' ||
    dismissed === '1' ||
    limit <= 0
  ) {
    return null;
  }

  const connected = (integrations || []).filter(
    (i: any) => !i.disabled
  ).length;
  // Segment count mirrors the limit (Buffer: equal thirds on 3/3), capped so
  // an unusual plan shape can never render sliver bars.
  const segments = Math.min(limit, 10);
  const filled =
    segments === limit
      ? Math.min(connected, segments)
      : Math.min(segments, Math.round((connected / limit) * segments));

  return (
    <div className="mb-[8px] p-[12px] rounded-[12px] border border-newTableBorder">
      <div className="flex items-start gap-[8px]">
        <div className="flex-1 text-[13px] font-[600] text-newTextColor">
          {`${Math.min(connected, limit)}/${limit} `}
          {t('channels_connected', 'channels connected')}
        </div>
        <button
          type="button"
          title={t('dismiss', 'Dismiss')}
          onClick={() => setDismissed('1')}
          className="w-[16px] h-[16px] shrink-0 flex items-center justify-center text-textItemBlur hover:text-newTextColor transition-colors duration-150"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      </div>
      <div className="flex gap-[4px] mt-[8px]">
        {Array.from({ length: segments }).map((_, index) => (
          <div
            key={index}
            className={clsx(
              'h-[6px] flex-1 rounded-full',
              index < filled ? 'bg-btnPrimary' : 'bg-newTableBorder'
            )}
          />
        ))}
      </div>
      <Link
        prefetch={true}
        href="/billing"
        className="mt-[12px] h-[32px] w-full flex items-center justify-center gap-[6px] rounded-[8px] border border-newTableBorder bg-newBgColorInner text-[14px] font-[500] text-newTextColor hover:bg-boxHover transition-colors duration-150"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
          <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" />
        </svg>
        {t('upgrade_for_more', 'Upgrade for More')}
      </Link>
    </div>
  );
};

/** Utility cluster relocated from the desktop top bar into the sidebar footer,
 *  directly above the org card row (user-critical: theme + language MUST stay
 *  reachable on desktop AND phone — the sidebar renders inside the phone
 *  drawer, so the row travels with it). Buffer's footer is org card + collapse
 *  only; this extra row is a sanctioned functional deviation, kept visually
 *  quiet: 32px icon buttons, 8px gap, muted ink with hover, hairline above.
 *
 *  Display-only wrappers — none of the six components changed:
 *  - `empty:hidden` collapses a wrapper whose component rendered null
 *    (OrganizationSelector with one org, ChromeExtension without billing,
 *    AttachToFeedbackIcon without a Sentry DSN, ModeComponent pre-mount), so
 *    no phantom 32px hover squares appear.
 *  - UTIL_FLIP retargets the subtree's two class-positioned popovers (the
 *    bell's DropdownPanel and the org selector's hover menu, both
 *    `absolute top-[100%] end-0`): in the DESKTOP footer they must open
 *    UPWARD (the row sits ~90px above the viewport bottom) and hug `start`
 *    (end-anchoring at the screen's start edge would push the 420px
 *    notifications panel off-screen). The language flag's inline-style
 *    absolute img is untouched (class selector only). In the phone drawer
 *    the row is high in the page with room below, so stock anchoring stays.
 *  - The org selector's trailing 1px block separator (a top-bar artifact) is
 *    hidden; the row gap provides the rhythm.
 *
 *  Collapsed 52px rail (judgment, flagged in the handoff notes): a vertical
 *  stack of just bell + theme + language — the three highest-value utilities,
 *  and the two user-critical ones stay reachable in EVERY sidebar state —
 *  above the expand control. Extension/feedback/org-switch return on expand.
 *  With all six live (multi-org + billing + Sentry), the expanded 208px row
 *  wraps to a quiet second line (6×32 + 5×8 = 232px); typical deployments
 *  render 3-4 icons on one line. */
const UTIL_FLIP =
  '[&_.absolute]:!top-auto [&_.absolute]:!bottom-[calc(100%+8px)] [&_.absolute]:!start-0 [&_.absolute]:!end-auto';

const SidebarUtilities: FC<{ inDrawer?: boolean; collapsed?: boolean }> = ({
  inDrawer,
  collapsed,
}) => {
  const t = useT();
  const box =
    'empty:hidden w-[32px] h-[32px] shrink-0 flex items-center justify-center rounded-[8px] text-textItemBlur hover:bg-boxHover hover:text-newTextColor transition-colors duration-150';

  if (collapsed) {
    return (
      <div className={clsx('flex flex-col items-center gap-[4px]', UTIL_FLIP)}>
        <div className="h-[1px] w-[24px] shrink-0 bg-newTableBorder mb-[4px]" />
        <div className={box} title={t('notifications', 'Notifications')}>
          <NotificationComponent />
        </div>
        <div className={box} title={t('toggle_theme', 'Toggle theme')}>
          <ModeComponent />
        </div>
        <div className={box} title={t('change_language', 'Change Language')}>
          <LanguageComponent />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="h-[1px] bg-newTableBorder" />
      {/* px-[8px] lines the first button up with the org mark below */}
      <div
        className={clsx(
          'flex items-center flex-wrap gap-[8px] px-[8px] py-[8px]',
          !inDrawer && UTIL_FLIP
        )}
      >
        <div
          className={clsx(box, '[&_.bg-blockSeparator]:hidden')}
          title={t('change_organization', 'Change organization')}
        >
          <OrganizationSelector />
        </div>
        <div className={box} title={t('toggle_theme', 'Toggle theme')}>
          <ModeComponent />
        </div>
        <div className={box} title={t('change_language', 'Change Language')}>
          <LanguageComponent />
        </div>
        <div className={box} title={t('chrome_extension', 'Chrome extension')}>
          <ChromeExtensionComponent />
        </div>
        <div className={box} title={t('feedback', 'Feedback')}>
          <AttachToFeedbackIcon />
        </div>
        <div className={box} title={t('notifications', 'Notifications')}>
          <NotificationComponent />
        </div>
      </div>
    </div>
  );
};

/** Org footer row: mark 32 + org name 14 + tier 12 muted. OrganizationSelector
 *  is a header-shaped hover dropdown (and renders null for single-org users),
 *  so it does not drop in here; org SWITCHING lives in the SidebarUtilities
 *  row above. The name reuses OrganizationSelector's own SWR key, so no new
 *  request is made.
 *  `onCollapse` (desktop only — the drawer never collapses) appends the
 *  panel-left collapse control to the row, Buffer-style. */
const SidebarOrganization: FC<{ onCollapse?: () => void }> = ({
  onCollapse,
}) => {
  const t = useT();
  const fetch = useFetch();
  const user = useUser();
  const { billingEnabled } = useVariables();

  const load = useCallback(async () => {
    return await (await fetch('/user/organizations')).json();
  }, []);
  const { data } = useSWR('organizations', load, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    refreshWhenOffline: false,
    refreshWhenHidden: false,
    revalidateOnReconnect: false,
  });

  const current = useMemo(
    () => data?.find((d: any) => d.id === user?.orgId),
    [data, user?.orgId]
  );

  const tier = user?.tier?.current;
  const tierLabel = tier
    ? tier.charAt(0).toUpperCase() + tier.slice(1).toLowerCase() + ' Plan'
    : '';

  return (
    <div className="flex items-center gap-[10px] px-[8px] py-[8px] rounded-[8px]">
      <img
        src="/cuesoft-mark-white.png"
        alt=""
        width={32}
        height={32}
        className="hidden dark:block object-contain shrink-0"
      />
      <img
        src="/cuesoft-mark-primary.png"
        alt=""
        width={32}
        height={32}
        className="block dark:hidden object-contain shrink-0"
      />
      <div className="flex flex-col min-w-0 flex-1">
        <div className="text-[14px] text-newTextColor truncate">
          {current?.name || ''}
        </div>
        {billingEnabled && tierLabel && (
          <div className="text-[12px] text-textItemBlur truncate">
            {tierLabel}
          </div>
        )}
      </div>
      {onCollapse && (
        <button
          type="button"
          onClick={onCollapse}
          title={t('collapse_sidebar', 'Collapse sidebar')}
          className="w-[24px] h-[24px] shrink-0 flex items-center justify-center rounded-[6px] text-textItemBlur hover:bg-boxHover hover:text-newTextColor transition-colors"
        >
          <PanelLeftCloseIcon />
        </button>
      )}
    </div>
  );
};


/** Buffer's "+ New" pill opens a creation menu, not the composer directly.
 *  Every item maps to an EXISTING mechanism: Post -> the composer deep link,
 *  Connect -> the manage-channels deep link, Invite -> team settings.
 *  Collapsed rail: the pill becomes the measured 32x32 green SQUARE (radius
 *  8, lucide plus) — same trigger, same dropdown, same links. */
const NewMenu: FC<{ collapsed?: boolean }> = ({ collapsed }) => {
  const t = useT();
  const { open, toggle, ref } = useDropdown();

  const item =
    'flex items-center gap-[12px] px-[12px] py-[8px] rounded-[8px] hover:bg-boxHover text-[14px] text-newTextColor transition-colors duration-150';
  const tile =
    'w-[36px] h-[36px] min-w-[36px] rounded-[8px] flex items-center justify-center';

  return (
    <div className="relative shrink-0 mt-[8px]" ref={ref}>
      <button
        data-cs
        type="button"
        onClick={toggle}
        title={collapsed ? t('new', 'New') : undefined}
        className={
          collapsed
            ? 'w-[32px] h-[32px] mx-auto flex items-center justify-center rounded-[8px] bg-btnPrimary text-textItemFocused transition-colors duration-150'
            : 'h-[40px] w-full flex items-center justify-center gap-[8px] rounded-full bg-btnPrimary text-textItemFocused text-[14px] font-[600] transition-colors duration-150'
        }
      >
        {collapsed ? (
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
            <path d="M5 12h14" />
            <path d="M12 5v14" />
          </svg>
        ) : (
          <>
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
              <path d="M5 12h14" />
              <path d="M12 5v14" />
            </svg>
            {t('new', 'New')}
          </>
        )}
      </button>
      {open && (
        <DropdownPanel
          surface="panel"
          anchor="start"
          //: SURFACES.panel still carries the legacy
          // bg-third navy; float on the elevated-surface token instead
          className="mt-[6px] w-[248px] p-[6px] flex flex-col gap-[2px]"
        >
          <Link prefetch={true} href="/launches?newPost=1" className={item}>
            <span className={clsx(tile, 'bg-seventh')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
                <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/>
                <path d="M14 2v4a2 2 0 0 0 2 2h4"/>
              </svg>
            </span>
            <span className="flex flex-col">
              <span className="font-[600]">{t('post', 'Post')}</span>
              <span className="text-[12px] text-newTextColor/60">
                {t('publish_content_to_a_channel', 'Publish content to a channel')}
              </span>
            </span>
          </Link>
          <div className="h-[1px] bg-newTableBorder my-[4px]" />
          <Link prefetch={true} href="/launches?manageChannels=1" className={item}>
            <span className={clsx(tile, 'border border-newTableBorder')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
                <path d="M5 12h14"/>
                <path d="M12 5v14"/>
              </svg>
            </span>
            <span className="font-[500]">
              {t('connect_a_new_channel', 'Connect Channel')}
            </span>
          </Link>
          <Link prefetch={true} href="/settings" className={item}>
            <span className={clsx(tile, 'border border-newTableBorder')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M19 8v6"/>
                <path d="M22 11h-6"/>
              </svg>
            </span>
            <span className="font-[500]">
              {t('invite_a_team_member', 'Invite a Team Member')}
            </span>
          </Link>
        </DropdownPanel>
      )}
    </div>
  );
};

/** Utility routes Buffer has no counterpart for — they render demoted below a
 *  hairline at the bottom of the scroll block instead of leading the nav. */
const UTILITY_PATHS = ['/plugs', '/third-party'];

export const Sidebar: FC<{ inDrawer?: boolean }> = ({ inDrawer }) => {
  const t = useT();
  const { first, second } = useVisibleMenu();
  const { total: scheduledTotal } = useScheduledCounts();

  // Buffer parity: Publish leads and carries a plain muted scheduled count;
  // the non-Buffer utility rows drop below a hairline at the bottom of the
  // scroll block. The visibility filter above stays the single gate.
  const primary = useMemo(
    () => first.filter((item) => !UTILITY_PATHS.includes(item.path)),
    [first]
  );
  const utility = useMemo(
    () => [
      ...first.filter((item) => UTILITY_PATHS.includes(item.path)),
      ...second,
    ],
    [first, second]
  );

  // Buffer's collapse: cookie-persisted pure-UI state (same react-use-cookie
  // pattern as the side panels' 'collapseMenu'). The phone drawer never
  // collapses, so inDrawer skips the whole mechanism.
  const [sidebarCollapsed, setSidebarCollapsed] = useCookie(
    'sidebarCollapsed',
    '0'
  );
  const collapsed = !inDrawer && sidebarCollapsed === '1';
  const toggleCollapsed = useCallback(
    () => setSidebarCollapsed(sidebarCollapsed === '1' ? '0' : '1'),
    [sidebarCollapsed, setSidebarCollapsed]
  );

  return (
    <aside
      className={clsx(
        inDrawer
          ? 'w-full' // inside the phone drawer the sidebar IS the content
          : clsx(
              'phone:hidden shrink-0 transition-[width] duration-150 ease-in-out',
              collapsed ? 'w-[52px]' : 'w-[240px]'
            )
      )}
    >
      {/* sticky (not fixed): banners in normal flow (Impersonate,
          AnnouncementBanner) push it down instead of overlapping it, so the
          old rail's #left-menu padding hacks are not needed here.
          16px side padding = Buffer's 208px-wide rows inside 240px; the
          52px rail keeps a slimmer inset so its 32px squares still fit. */}
      <div
        className={clsx(
          'flex flex-col',
          // In the drawer the sidebar is in-flow content: natural height, the
          // PAGE scrolls (Buffer's push-down menu). The desktop shell keeps
          // the sticky viewport-height column with its own inner scroll.
          inDrawer
            ? 'px-[16px]'
            : clsx(
                'sticky top-[12px] h-[calc(100dvh-24px)]',
                collapsed ? 'px-[10px]' : 'px-[16px]'
              )
        )}
      >
        {/* logo row — the ONLY logo on desktop; the content column's top bar
            keeps Title + the icon cluster and never duplicates it. Spec
            §Sidebar row 1: logo left, streak icon right. Rail: mark 24
            centered, streak stays a rail-less nicety. */}
        <div
          data-cs
          className={clsx(
            'h-[48px] shrink-0 flex items-center',
            collapsed ? 'justify-center' : 'justify-between px-[8px]'
          )}
        >
          <Link prefetch={true} href="/launches" className="flex items-center">
            <img
              src="/cuesoft-mark-white.png"
              alt="Cuesoft"
              width={collapsed ? 24 : 28}
              height={collapsed ? 24 : 28}
              className="hidden dark:block object-contain"
            />
            <img
              src="/cuesoft-mark-primary.png"
              alt="Cuesoft"
              width={collapsed ? 24 : 28}
              height={collapsed ? 24 : 28}
              className="block dark:hidden object-contain"
            />
            {/* Buffer anchors the sidebar with mark + bold wordmark */}
            {!collapsed && (
              <span
                data-cs
                className="ms-[8px] font-display text-[20px] font-[700] leading-none text-newTextColor"
              >
                Cuesoft
              </span>
            )}
          </Link>
          {!collapsed && <StreakComponent />}
        </div>
        {/* "+ New" pill — Buffer's measured 40px-tall rounded-full row in
            lime with dark ink (data-cs keeps the ladder from rescaling it to
            32). Navigation, not a new modal mechanism. Collapsed: the
            measured 32x32 green square. */}
        <NewMenu collapsed={collapsed} />
        {/* nav + channels scroll on short viewports; footer stays put.
            4px row gap = Buffer's 36px nav pitch on 32px rows. */}
        <div
          className={clsx(
            'flex flex-col gap-[4px] pt-[16px] pb-[8px]',
            // drawer: natural height (page scrolls); desktop: inner scroll
            !inDrawer && 'flex-1 min-h-0 overflow-y-auto',
            collapsed && 'items-center'
          )}
        >
          {primary.map((item) => (
            <NavRow
              key={item.name}
              path={item.path}
              label={item.name}
              icon={item.icon}
              onClick={item.onClick}
              collapsed={collapsed}
              trailing={
                item.path === '/launches' &&
                typeof scheduledTotal === 'number' ? (
                  <span className="text-[14px] text-textItemBlur">
                    {scheduledTotal}
                  </span>
                ) : undefined
              }
            />
          ))}
          {/* rail spec: hairline separator between nav icons and channels */}
          {collapsed && (
            <div className="h-[1px] w-[24px] shrink-0 bg-newTableBorder mt-[8px]" />
          )}
          <SidebarChannels collapsed={collapsed} />
          {/* non-Buffer utility rows sit demoted below a hairline at the
              bottom of the scroll block */}
          {utility.length > 0 && (
            <div
              className={clsx(
                'mt-auto pt-[16px] flex flex-col gap-[4px]',
                collapsed ? 'items-center w-full' : 'w-full'
              )}
            >
              <div
                className={clsx(
                  'h-[1px] shrink-0 bg-newTableBorder mb-[4px]',
                  collapsed ? 'w-[24px]' : 'w-full'
                )}
              />
              {utility.map((item) => (
                <NavRow
                  key={item.name}
                  path={item.path}
                  label={item.name}
                  icon={item.icon}
                  onClick={item.onClick}
                  collapsed={collapsed}
                />
              ))}
            </div>
          )}
        </div>
        {collapsed ? (
          /* rail footer: bell/theme/language stack, then the expand control
             (panel-left) over the org mark */
          <div className="shrink-0 pb-[8px] flex flex-col items-center gap-[8px]">
            <SidebarUtilities collapsed />
            <button
              type="button"
              onClick={toggleCollapsed}
              title={t('expand_sidebar', 'Expand sidebar')}
              className="w-[32px] h-[32px] flex items-center justify-center rounded-[8px] text-textItemBlur hover:bg-boxHover hover:text-newTextColor transition-colors"
            >
              <PanelLeftOpenIcon />
            </button>
            <img
              src="/cuesoft-mark-white.png"
              alt=""
              width={24}
              height={24}
              className="hidden dark:block object-contain"
            />
            <img
              src="/cuesoft-mark-primary.png"
              alt=""
              width={24}
              height={24}
              className="block dark:hidden object-contain"
            />
          </div>
        ) : (
          <div className="shrink-0 pb-[4px]">
            <ChannelsLimitCard />
            {/* utility icon row sits directly above the org card row */}
            <SidebarUtilities inDrawer={inDrawer} />
            <SidebarOrganization
              onCollapse={inDrawer ? undefined : toggleCollapsed}
            />
          </div>
        )}
      </div>
    </aside>
  );
};
