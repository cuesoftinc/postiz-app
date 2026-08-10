'use client';

import useSWR from 'swr';
import { FC, useCallback, useMemo } from 'react';
import { orderBy } from 'lodash';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { Button } from '@gitroom/react/form/button';
import { useRouter, useSearchParams } from 'next/navigation';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { PlugsContext } from '@gitroom/frontend/components/plugs/plugs.context';
import { Plug } from '@gitroom/frontend/components/plugs/plug';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { SkeletonPage } from '@gitroom/frontend/components/layout/skeleton';
import { ChannelRow } from '@gitroom/frontend/components/new-layout/channel-row';
import { ToolbarSelect } from '@gitroom/frontend/components/cuesoft/toolbar/toolbar';
import { EmptyState } from '@gitroom/frontend/components/cuesoft/empty-state';
import {
  PageHeader,
  PageShell,
} from '@gitroom/frontend/components/new-layout/page-header';

/** Plug glyph for the page-header chip — vb24, stroke 2.2, round caps
    (Lucide 'plug'), rendered at 20px inside the 40px r10 chip. */
const PlugGlyph: FC<{ size: number }> = ({ size }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 22v-5" />
    <path d="M9 8V2" />
    <path d="M15 8V2" />
    <path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z" />
  </svg>
);

/**
 * Buffer-replica treatment (same as analytics): Buffer has NO second channel
 * panel next to the sidebar — the desktop channels panel dies and content goes
 * full-width. Selection becomes URL-driven (`?integration=<id>`, fallback =
 * first plug-capable channel) so it survives the panel's removal.
 *
 * The panel itself stays PHONE-ONLY (`hidden phone:flex`): phones have no
 * sidebar, so the global.scss chip-strip (keyed off [data-side-panel]) remains
 * the phone's channel selector — tapping a chip now pushes the URL param
 * instead of setting a local index.
 *
 * Desktop caveat: the global sidebar's channel rows link to /launches from
 * /plugs (acceptable navigation, but NOT a selection affordance), so desktop
 * keeps a MINIMAL selector — a compact ToolbarSelect above the content, driving
 * the same URL setter. It is `phone:hidden`; the chip strip owns phones.
 */
export const Plugs = () => {
  const fetch = useFetch();
  const router = useRouter();
  const searchParams = useSearchParams();
  const toaster = useToaster();
  const load = useCallback(async () => {
    return (await (await fetch('/integrations/list')).json()).integrations;
  }, []);
  const load2 = useCallback(async (path: string) => {
    return await (await fetch(path)).json();
  }, []);
  const { data: plugList, isLoading: plugLoading } = useSWR(
    '/integrations/plug/list',
    load2,
    {
      fallbackData: [],
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      revalidateIfStale: false,
      revalidateOnMount: true,
      refreshWhenHidden: false,
      refreshWhenOffline: false,
    }
  );
  const { data, isLoading } = useSWR('analytics-list', load, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
    revalidateOnMount: true,
    refreshWhenHidden: false,
    refreshWhenOffline: false,
    fallbackData: [],
  });

  const t = useT();

  const sortedIntegrations = useMemo(() => {
    return orderBy(
      data.filter((integration: any) =>
        plugList?.plugs?.some(
          (f: any) => f.identifier === integration.identifier
        )
      ),
      // data.filter((integration) => !integration.disabled),
      ['type', 'disabled', 'identifier'],
      ['desc', 'asc', 'asc']
    );
  }, [data, plugList]);
  // URL-driven selection: ?integration=<id> wins, first channel otherwise.
  // (A stale id — e.g. a removed channel — falls back the same way.)
  const activeIntegration = searchParams.get('integration');
  const currentIntegration = useMemo(() => {
    return (
      sortedIntegrations.find((f: any) => f.id === activeIntegration) ||
      sortedIntegrations[0]
    );
  }, [activeIntegration, sortedIntegrations]);
  const currentIntegrationPlug = useMemo(() => {
    const plug = plugList?.plugs?.find(
      (f: any) => f?.identifier === currentIntegration?.identifier
    );
    if (!plug) {
      return null;
    }
    return {
      providerId: currentIntegration.id,
      ...plug,
    };
  }, [currentIntegration, plugList]);

  // The one setter both selectors (phone chip strip, desktop ToolbarSelect)
  // drive. Same refreshNeeded guard the old panel rows had.
  const selectIntegration = useCallback(
    (integration: any) => {
      if (integration.refreshNeeded) {
        toaster.show(
          'Please refresh the channel from Publish',
          'warning'
        );
        return;
      }
      router.push(`/plugs?integration=${integration.id}`);
    },
    [router, toaster]
  );

  if (isLoading || plugLoading) {
    // page-shaped skeleton (it draws its own header chip + title bar over
    // content blocks) inside the standard page pane — never a spinner
    return (
      <PageShell>
        <SkeletonPage />
      </PageShell>
    );
  }

  if (!sortedIntegrations.length && !isLoading) {
    return (
      <PageShell>
        <PageHeader
          icon={<PlugGlyph size={20} />}
          title={t('plugs', 'Plugs')}
        />
        <div className="flex flex-1 flex-col items-center justify-center">
          <EmptyState
            variant="hero"
            image={<img src="/peoplemarketplace.svg" />}
            title={t(
              'there_are_not_plugs_matching_your_channels',
              'There are no plugs matching your channels'
            )}
            description={t(
              'you_have_to_add_x_linkedin_page_threads_or_bluesky',
              'You have to add: X, LinkedIn Page, Threads or Bluesky'
            )}
            action={
              <Button onClick={() => router.push('/launches')}>
                {t(
                  'go_to_the_calendar_to_add_channels',
                  'Go to Publish to connect channels'
                )}
              </Button>
            }
          />
        </div>
      </PageShell>
    );
  }
  return (
    <PageShell>
      {/* ONE shared page header (new-layout/page-header.tsx) — visible at
          every width, same anatomy as analytics/agents/media (48px band,
          40px r10 hairline chip, 20/400 display title). */}
      <PageHeader icon={<PlugGlyph size={20} />} title={t('plugs', 'Plugs')} />
      {/* PHONE-ONLY channels panel. Desktop has no second panel (Buffer);
          on a phone the global.scss [data-side-panel] rules turn this into
          the horizontal chip strip, which stays the phone's selector. It
          lives INSIDE the shell (under the single header) — the shell's
          phone:px-[12px] supplies the inset, so the strip carries no padding
          of its own. Compact 32/14 avatar density (sidebar precedent) keeps
          the chips at analytics-strip scale. */}
      <div
        data-side-panel="flow"
        className="hidden phone:flex bg-newBgColorInner flex-col gap-[15px] transition-all phone:w-full phone:min-w-0 phone:h-auto"
      >
        <div className="flex gap-[12px] flex-col">
          {sortedIntegrations.map((integration: any) => (
            <ChannelRow
              key={integration.id}
              integration={integration}
              onClick={() => selectIntegration(integration)}
              dimmed={currentIntegration.id !== integration.id}
              avatarProps={{
                size: 32,
                badgeSize: 14,
                badgeOffset: '-bottom-[2px] -end-[2px]',
              }}
              // Buffer never ghosts controls (same treatment as the analytics
              // strip): dimmed's opacity-20 lifts to a legible .55 on phones,
              // and the SELECTED chip gets an ink border instead of pure
              // opacity contrast (! beats global.scss's chip border). This
              // strip is hidden phone:flex, so neither acts on desktop.
              className={
                currentIntegration.id !== integration.id
                  ? 'phone:opacity-[0.55]'
                  : 'phone:!border-newTextColor'
              }
            />
          ))}
        </div>
      </div>
      {/* Minimal desktop selector (see header comment): the sidebar offers
          no ?integration= affordance on /plugs, so without this a desktop
          user could never leave the first channel. Kit control chrome comes
          from ToolbarSelect itself (36px, radius 6, blue focus). */}
      <div className="phone:hidden flex">
        <ToolbarSelect
          value={currentIntegration.id}
          onChange={(e) => {
            const integration = sortedIntegrations.find(
              (f: any) => f.id === e.target.value
            );
            if (integration) {
              selectIntegration(integration);
            }
          }}
          className="min-w-[220px]"
        >
          {sortedIntegrations.map((integration: any) => (
            <option
              key={integration.id}
              value={integration.id}
              disabled={!!integration.refreshNeeded}
            >
              {integration.name}
            </option>
          ))}
        </ToolbarSelect>
      </div>
      <PlugsContext.Provider value={currentIntegrationPlug}>
        <Plug />
      </PlugsContext.Provider>
    </PageShell>
  );
};
