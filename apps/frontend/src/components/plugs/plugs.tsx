'use client';

import useSWR from 'swr';
import { useCallback, useMemo, useState } from 'react';
import { capitalize, orderBy } from 'lodash';
import clsx from 'clsx';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { Select } from '@gitroom/react/form/select';
import { Button } from '@gitroom/react/form/button';
import { useRouter } from 'next/navigation';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { PlugsContext } from '@gitroom/frontend/components/plugs/plugs.context';
import { Plug } from '@gitroom/frontend/components/plugs/plug';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { LoadingComponent } from '@gitroom/frontend/components/layout/loading';
import { sidePanelRoot } from '@gitroom/frontend/components/new-layout/side-panel';
import {
  SidePanelHeader,
  useSidePanelCollapse,
} from '@gitroom/frontend/components/new-layout/side-panel-header';
import { ChannelRow } from '@gitroom/frontend/components/new-layout/channel-row';
export const Plugs = () => {
  const fetch = useFetch();
  const router = useRouter();
  const [current, setCurrent] = useState(0);
  const [refresh, setRefresh] = useState(false);
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

  const { collapsed, toggle } = useSidePanelCollapse();

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
  const currentIntegration = useMemo(() => {
    return sortedIntegrations[current];
  }, [current, sortedIntegrations]);
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
        <div className="text-[48px]">
          {t(
            'there_are_not_plugs_matching_your_channels',
            'There are not plugs matching your channels'
          )}
          <br />
          {t(
            'you_have_to_add_x_linkedin_page_threads_or_bluesky',
            'You have to add: X, LinkedIn Page, Threads or Bluesky'
          )}
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
      <div
        data-side-panel="flow"
        className={clsx(
          'bg-newBgColorInner p-[20px] flex flex-col gap-[15px] transition-all phone:p-[12px]',
          sidePanelRoot(collapsed)
        )}
      >
        <div className="flex gap-[12px] flex-col">
          <SidePanelHeader title={t('channels')} onToggle={toggle} />
          {sortedIntegrations.map((integration, index) => (
            <ChannelRow
              key={integration.id}
              integration={integration}
              onClick={() => {
                if (integration.refreshNeeded) {
                  toaster.show(
                    'Please refresh the integration from the calendar',
                    'warning'
                  );
                  return;
                }
                setRefresh(true);
                setTimeout(() => {
                  setRefresh(false);
                }, 10);
                setCurrent(index);
              }}
              dimmed={currentIntegration.id !== integration.id}
            />
          ))}
        </div>
      </div>
      <div className="bg-newBgColorInner flex-1 flex-col flex p-[20px] gap-[12px]">
        <PlugsContext.Provider value={currentIntegrationPlug}>
          <Plug />
        </PlugsContext.Provider>
      </div>
    </>
  );
};
