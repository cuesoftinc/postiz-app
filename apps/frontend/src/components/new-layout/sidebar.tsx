'use client';

import React, { FC, ReactNode, useCallback, useMemo } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
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
 */

type SidebarMenuItem = ReturnType<typeof useMenuItem>['firstMenu'][number];

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
}> = ({ label, icon, path, onClick }) => {
  const currentPath = usePathname();
  // Same active test as menu-item.tsx.
  const isActive = currentPath.indexOf(path) === 0;

  const className = clsx(
    'flex w-full items-center gap-[10px] h-[32px] px-[8px] rounded-[8px] text-[14px] font-[400] transition-colors',
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
      <div className="flex-1 truncate text-start">{label}</div>
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
 *  filters both views by the id); management stays in the launches panel. */
const SidebarChannels: FC = () => {
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

  return (
    <div className="flex flex-col gap-[2px] pt-[16px]">
      <div className="px-[8px] pb-[4px] flex items-center text-[13px] text-textItemBlur">
        <span className="flex-1">{t('channels', 'Channels')}</span>
        <Link
          prefetch={true}
          href="/launches?manageChannels=1"
          title={t('manage_channels', 'Manage channels')}
          className="w-[24px] h-[24px] flex items-center justify-center rounded-[6px] hover:bg-boxHover hover:text-newTextColor"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" stroke="currentColor" strokeWidth="1.6"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" stroke="currentColor" strokeWidth="1.6"/>
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
            className="opacity-0 group-hover/chrow:opacity-100 focus-visible:opacity-100 w-[24px] h-[24px] min-w-[24px] flex items-center justify-center rounded-[6px] hover:bg-boxHover"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="5" r="1.6" />
              <circle cx="12" cy="12" r="1.6" />
              <circle cx="12" cy="19" r="1.6" />
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
                className="w-[24px] h-[24px] rounded-[6px] flex items-center justify-center hover:bg-boxHover"
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
            className="w-[24px] h-[24px] rounded-[6px] border border-newBorder flex items-center justify-center text-textItemBlur hover:bg-boxHover hover:text-newTextColor"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="12"
              height="12"
              viewBox="0 0 16 16"
              fill="none"
            >
              <path
                d="M8 3.33334V12.6667M3.33334 8H12.6667"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
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
 *  reuses OrganizationSelector's own SWR key, so no new request is made. */
const SidebarOrganization: FC = () => {
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
    </div>
  );
};


/** Buffer's "+ New" pill opens a creation menu, not the composer directly.
 *  Every item maps to an EXISTING mechanism: Post -> the composer deep link,
 *  Connect -> the manage-channels deep link, Invite -> team settings. */
const NewMenu: FC = () => {
  const t = useT();
  const { open, toggle, ref } = useDropdown();

  const item =
    'flex items-center gap-[12px] px-[12px] py-[8px] rounded-[8px] hover:bg-boxHover text-[14px] text-newTextColor';
  const tile =
    'w-[36px] h-[36px] min-w-[36px] rounded-[8px] flex items-center justify-center';

  return (
    <div className="relative shrink-0 mt-[8px]" ref={ref}>
      <button
        data-cs
        type="button"
        onClick={toggle}
        className="h-[44px] w-full flex items-center justify-center gap-[8px] rounded-full bg-btnPrimary text-textItemFocused text-[14px] font-[600]"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
        >
          <path
            d="M8 3.33334V12.6667M3.33334 8H12.6667"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
        {t('new', 'New')}
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
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M11.6667 2.5H5.83333C5.39131 2.5 4.96738 2.67559 4.65482 2.98816C4.34226 3.30072 4.16667 3.72464 4.16667 4.16667V15.8333C4.16667 16.2754 4.34226 16.6993 4.65482 17.0118C4.96738 17.3244 5.39131 17.5 5.83333 17.5H14.1667C14.6087 17.5 15.0326 17.3244 15.3452 17.0118C15.6577 16.6993 15.8333 16.2754 15.8333 15.8333V6.66667L11.6667 2.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M11.6667 2.5V6.66667H15.8333" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
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
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M10 4.16666V15.8333M4.16667 10H15.8333" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </span>
            <span className="font-[500]">
              {t('connect_a_new_channel', 'Connect Channel')}
            </span>
          </Link>
          <Link prefetch={true} href="/settings" className={item}>
            <span className={clsx(tile, 'border border-newTableBorder')}>
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M13.3333 17.5V15.8333C13.3333 14.9493 12.9821 14.1014 12.357 13.4763C11.7319 12.8512 10.884 12.5 10 12.5H5C4.11594 12.5 3.2681 12.8512 2.64298 13.4763C2.01786 14.1014 1.66667 14.9493 1.66667 15.8333V17.5M17.5 6.66666V11.6667M20 9.16666H15M10.8333 5.83333C10.8333 7.67428 9.34095 9.16666 7.5 9.16666C5.65905 9.16666 4.16667 7.67428 4.16667 5.83333C4.16667 3.99238 5.65905 2.5 7.5 2.5C9.34095 2.5 10.8333 3.99238 10.8333 5.83333Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
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

  return (
    <aside
      className={clsx(
        inDrawer
          ? 'w-full' // inside the phone drawer the sidebar IS the content
          : 'phone:hidden w-[240px] shrink-0'
      )}
    >
      {/* sticky (not fixed): banners in normal flow (Impersonate,
          AnnouncementBanner) push it down instead of overlapping it, so the
          old rail's #left-menu padding hacks are not needed here */}
      <div className="sticky top-[12px] h-[calc(100dvh-24px)] flex flex-col px-[8px]">
        {/* logo row — the ONLY logo on desktop; the content column's top bar
            keeps Title + the icon cluster and never duplicates it. Spec
            §Sidebar row 1: logo left, streak icon right. */}
        <div
          data-cs
          className="h-[48px] shrink-0 flex items-center justify-between px-[8px]"
        >
          <Link prefetch={true} href="/launches" className="flex items-center">
            <img
              src="/cuesoft-mark-white.png"
              alt="Cuesoft"
              width={28}
              height={28}
              className="hidden dark:block object-contain"
            />
            <img
              src="/cuesoft-mark-primary.png"
              alt="Cuesoft"
              width={28}
              height={28}
              className="block dark:hidden object-contain"
            />
          </Link>
          <StreakComponent />
        </div>
        {/* "+ New" pill — h-44 r-999 lime, dark ink (data-cs: the ladder
            rescales h-[44px] to 36). Navigation, not a new modal mechanism. */}
        <NewMenu />
        {/* nav + channels scroll on short viewports; footer stays put */}
        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-[2px] pt-[16px] pb-[8px]">
          {first.map((item) => (
            <NavRow
              key={item.name}
              path={item.path}
              label={item.name}
              icon={item.icon}
              onClick={item.onClick}
            />
          ))}
          {second.map((item) => (
            <NavRow
              key={item.name}
              path={item.path}
              label={item.name}
              icon={item.icon}
              onClick={item.onClick}
            />
          ))}
          <SidebarChannels />
        </div>
        <div className="shrink-0 pb-[4px]">
          <SidebarOrganization />
        </div>
      </div>
    </aside>
  );
};
