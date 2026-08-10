'use client';

import useSWR from 'swr';
import { useCallback, useMemo } from 'react';
import { orderBy } from 'lodash';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { Button } from '@gitroom/react/form/button';
import { useRouter, useSearchParams } from 'next/navigation';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { PlugsContext } from '@gitroom/frontend/components/plugs/plugs.context';
import { Plug } from '@gitroom/frontend/components/plugs/plug';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { LoadingComponent } from '@gitroom/frontend/components/layout/loading';
import { ChannelRow } from '@gitroom/frontend/components/new-layout/channel-row';
import { ToolbarSelect } from '@gitroom/frontend/components/cuesoft/toolbar/toolbar';

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
          'Please refresh the integration from the calendar',
          'warning'
        );
        return;
      }
      router.push(`/plugs?integration=${integration.id}`);
    },
    [router, toaster]
  );

  if (isLoading || plugLoading) {
    return (
      <div className="bg-newBgColorInner p-[20px] flex flex-1 flex-col gap-[15px] transition-all items-center justify-center">
        <LoadingComponent />
      </div>
    );
  }

  if (!sortedIntegrations.length && !isLoading) {
    return (
      <div className="bg-newBgColorInner p-[20px] flex flex-1 flex-col gap-[15px] transition-all items-center justify-center">
        <div>
          <img src="/peoplemarketplace.svg" />
        </div>
        <div className="text-[16px] font-[600] font-display text-center">
          {t(
            'there_are_not_plugs_matching_your_channels',
            'There are not plugs matching your channels'
          )}
          <br />
          <span className="text-[14px] font-[400] font-sans text-newTextColor/60">
            {t(
              'you_have_to_add_x_linkedin_page_threads_or_bluesky',
              'You have to add: X, LinkedIn Page, Threads or Bluesky'
            )}
          </span>
        </div>
        <Button onClick={() => router.push('/launches')}>
          {t(
            'go_to_the_calendar_to_add_channels',
            'Go to the calendar to add channels'
          )}
        </Button>
      </div>
    );
  }
  return (
    <>
      {/* PHONE-ONLY channels panel. Desktop has no second panel (Buffer);
          on a phone the global.scss [data-side-panel] rules turn this into
          the horizontal chip strip, which stays the phone's selector. The
          header/chevron were dropped: global.scss already hid them on phones
          and no desktop ever sees this element now. */}
      <div
        data-side-panel="flow"
        className="hidden phone:flex bg-newBgColorInner flex-col gap-[15px] transition-all phone:p-[12px] phone:w-full phone:min-w-0 phone:h-auto"
      >
        <div className="flex gap-[12px] flex-col">
          {sortedIntegrations.map((integration: any) => (
            <ChannelRow
              key={integration.id}
              integration={integration}
              onClick={() => selectIntegration(integration)}
              dimmed={currentIntegration.id !== integration.id}
            />
          ))}
        </div>
      </div>
      <div className="bg-newBgColorInner flex-1 flex-col flex p-[20px] gap-[12px]">
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
      </div>
    </>
  );
};
