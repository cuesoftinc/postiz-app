'use client';

import React, { FC, ReactNode, useCallback, useMemo } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
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
 * Sizes come from the spec (rows h-32 r-8, pill h-44 r-999, labels 14px,
 * section header 13px). `data-cs` marks the two spots where the global.scss
 * ladder would rescale spec sizes (h-[44px] pill, h-[48px] logo row).
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

/** Lucide panel-left, the measured collapse/expand glyph (16x16, viewBox 24,
 *  stroke 2.2, round caps/joins) — same icon on both the collapse control in
 *  the expanded footer and the expand control at the rail's bottom. */
const PanelLeftIcon: FC = () => (
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
  </svg>
);

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
}> = ({ label, icon, path, onClick, collapsed }) => {
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
      {/* stock icons range 18-23px; box them at 20 so rows never jitter */}
      <div className="w-[20px] h-[20px] shrink-0 flex items-center justify-center [&_svg]:max-w-[18px] [&_svg]:max-h-[18px]">
        {icon}
      </div>
      {!collapsed && <div className="flex-1 truncate text-start">{label}</div>}
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

/** Read-only channel list. Same sort as the launches panel. Each row opens
 *  that channel's queue (/launches?integration=<id> — the calendar context
 *  filters both views by the id); management stays in the launches panel.
 *  In the collapsed rail the same rows render as a bare 24px avatar stack
 *  (presence dots kept, same channelHref navigation, name as title). */
const SidebarChannels: FC<{ collapsed?: boolean }> = ({ collapsed }) => {
  const t = useT();
  const { data: integrations } = useIntegrationList();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const activeIntegration = searchParams.get('integration');
  const router = useRouter();
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
      <div className="px-[8px] pb-[4px] flex items-center text-[13px] text-textItemBlur">
        <span className="flex-1">{t('channels', 'Channels')}</span>
        <Link
          prefetch={true}
          href="/launches?manageChannels=1"
          title={t('manage_channels', 'Manage channels')}
          className="w-[24px] h-[24px] flex items-center justify-center rounded-[6px] hover:bg-boxHover hover:text-newTextColor transition-colors duration-150"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
            <path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        </Link>
      </div>
      {sorted.map((integration: any) => (
        <Link
          key={integration.id}
          prefetch={true}
          href={channelHref(integration.id)}
          title={integration.name}
          className={clsx(
            'group/chrow',
            channelRowClassName(integration.disabled),
            activeIntegration === integration.id &&
              'bg-newBorder text-newTextColor'
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
          <span
            role="button"
            tabIndex={0}
            title={t('manage_channels', 'Manage channels')}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              router.push('/launches?manageChannels=1');
            }}
            className="opacity-0 group-hover/chrow:opacity-100 focus-visible:opacity-100 w-[24px] h-[24px] min-w-[24px] flex items-center justify-center rounded-[6px] hover:bg-boxHover transition-colors duration-150"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="1" />
              <circle cx="12" cy="5" r="1" />
              <circle cx="12" cy="19" r="1" />
            </svg>
          </span>
        </Link>
      ))}
      {/* spec §Sidebar 6: muted label + row of 24px platform icon buttons
          ending in a "+" — every button deep-links to the same
          manage-channels panel (same mechanism, different composition). */}
      <div className="pt-[8px]">
        <div className="px-[8px] pb-[4px] text-[13px] text-textItemBlur">
          {t('connect_more_channels', 'Connect more channels')}
        </div>
        <div className="px-[8px] flex items-center gap-[6px]">
          {['facebook', 'instagram', 'linkedin', 'x', 'tiktok', 'youtube'].map(
            (identifier) => (
              <Link
                key={identifier}
                prefetch={true}
                href="/launches?manageChannels=1"
                title={t('manage_channels', 'Manage channels')}
                className="w-[24px] h-[24px] rounded-[6px] flex items-center justify-center hover:bg-boxHover transition-colors duration-150"
              >
                <img
                  src={`/icons/platforms/${identifier}.png`}
                  alt={identifier}
                  width={16}
                  height={16}
                  className="rounded-[4px]"
                />
              </Link>
            )
          )}
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
    </div>
  );
};

/** Org footer row: mark 32 + org name 14 + tier 12 muted. OrganizationSelector
 *  is a header-shaped hover dropdown (and renders null for single-org users),
 *  so it does not drop in here; org switching stays in the top bar. The name
 *  reuses OrganizationSelector's own SWR key, so no new request is made.
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
          <PanelLeftIcon />
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
            : 'h-[44px] w-full flex items-center justify-center gap-[8px] rounded-full bg-btnPrimary text-textItemFocused text-[14px] font-[600] transition-colors duration-150'
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

export const Sidebar: FC<{ inDrawer?: boolean }> = ({ inDrawer }) => {
  const t = useT();
  const { first, second } = useVisibleMenu();

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
          old rail's #left-menu padding hacks are not needed here */}
      <div className="sticky top-[12px] h-[calc(100dvh-24px)] flex flex-col px-[8px]">
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
          </Link>
          {!collapsed && <StreakComponent />}
        </div>
        {/* "+ New" pill — h-44 r-999 lime, dark ink (data-cs: the ladder
            rescales h-[44px] to 36). Navigation, not a new modal mechanism.
            Collapsed: the measured 32x32 green square. */}
        <NewMenu collapsed={collapsed} />
        {/* nav + channels scroll on short viewports; footer stays put */}
        <div
          className={clsx(
            'flex-1 min-h-0 overflow-y-auto flex flex-col gap-[2px] pt-[16px] pb-[8px]',
            collapsed && 'items-center'
          )}
        >
          {first.map((item) => (
            <NavRow
              key={item.name}
              path={item.path}
              label={item.name}
              icon={item.icon}
              onClick={item.onClick}
              collapsed={collapsed}
            />
          ))}
          {second.map((item) => (
            <NavRow
              key={item.name}
              path={item.path}
              label={item.name}
              icon={item.icon}
              onClick={item.onClick}
              collapsed={collapsed}
            />
          ))}
          {/* rail spec: hairline separator between nav icons and channels */}
          {collapsed && (
            <div className="h-[1px] w-[24px] shrink-0 bg-newTableBorder mt-[8px]" />
          )}
          <SidebarChannels collapsed={collapsed} />
        </div>
        {collapsed ? (
          /* rail footer: expand control (panel-left) over the org mark */
          <div className="shrink-0 pb-[8px] flex flex-col items-center gap-[8px]">
            <button
              type="button"
              onClick={toggleCollapsed}
              title={t('expand_sidebar', 'Expand sidebar')}
              className="w-[32px] h-[32px] flex items-center justify-center rounded-[8px] text-textItemBlur hover:bg-boxHover hover:text-newTextColor transition-colors"
            >
              <PanelLeftIcon />
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
            <SidebarOrganization
              onCollapse={inDrawer ? undefined : toggleCollapsed}
            />
          </div>
        )}
      </div>
    </aside>
  );
};
