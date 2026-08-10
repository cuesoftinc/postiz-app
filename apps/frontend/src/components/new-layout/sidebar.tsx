'use client';

import React, { FC, ReactNode, useCallback, useMemo } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { usePathname, useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { orderBy } from 'lodash';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useUser } from '@gitroom/frontend/components/layout/user.context';
import { useVariables } from '@gitroom/react/helpers/variable.context';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { useMenuItem } from '@gitroom/frontend/components/layout/top.menu';
import { useIntegrationList } from '@gitroom/frontend/components/launches/helpers/use.integration.list';
import { ChannelAvatar } from '@gitroom/frontend/components/new-layout/channel-avatar';

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
  const activeIntegration = searchParams.get('integration');

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
      <div className="px-[8px] pb-[4px] text-[13px] text-textItemBlur">
        {t('channels', 'Channels')}
      </div>
      {sorted.map((integration: any) => (
        <Link
          key={integration.id}
          prefetch={true}
          href={`/launches?integration=${integration.id}`}
          title={integration.name}
          className={clsx(
            channelRowClassName(integration.disabled),
            activeIntegration === integration.id &&
              'bg-newBorder text-newTextColor'
          )}
        >
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
          <div className="flex-1 truncate">{integration.name}</div>
        </Link>
      ))}
      <Link
        prefetch={true}
        href="/launches"
        className={channelRowClassName()}
      >
        <div className="w-[32px] h-[32px] min-w-[32px] rounded-[8px] border border-newBorder flex items-center justify-center">
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
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <div className="flex-1 truncate">
          {t('connect_more_channels', 'Connect more channels')}
        </div>
      </Link>
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

export const Sidebar: FC = () => {
  const t = useT();
  const { first, second } = useVisibleMenu();

  return (
    <aside className="phone:hidden w-[240px] shrink-0">
      {/* sticky (not fixed): banners in normal flow (Impersonate,
          AnnouncementBanner) push it down instead of overlapping it, so the
          old rail's #left-menu padding hacks are not needed here */}
      <div className="sticky top-[12px] h-[calc(100dvh-24px)] flex flex-col px-[8px]">
        {/* logo row — the ONLY logo on desktop; the content column's top bar
            keeps Title + the icon cluster and never duplicates it */}
        <div data-cs className="h-[48px] shrink-0 flex items-center px-[8px]">
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
        </div>
        {/* "+ New" pill — h-44 r-999 lime, dark ink (data-cs: the ladder
            rescales h-[44px] to 36). Navigation, not a new modal mechanism. */}
        <Link
          data-cs
          prefetch={true}
          href="/launches"
          className="h-[44px] shrink-0 mt-[8px] flex items-center justify-center gap-[8px] rounded-full bg-btnPrimary text-textItemFocused text-[14px] font-[600]"
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
        </Link>
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
