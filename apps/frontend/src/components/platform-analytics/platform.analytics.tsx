'use client';

import useSWR from 'swr';
import { useCallback, useMemo, useState } from 'react';
import { capitalize, orderBy } from 'lodash';
import clsx from 'clsx';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { RenderAnalytics } from '@gitroom/frontend/components/platform-analytics/render.analytics';
import { Button } from '@gitroom/react/form/button';
import { useRouter } from 'next/navigation';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { useVariables } from '@gitroom/react/helpers/variable.context';
import { LoadingComponent } from '@gitroom/frontend/components/layout/loading';
import { sidePanelRoot } from '@gitroom/frontend/components/new-layout/side-panel';
import {
  SidePanelHeader,
  useSidePanelCollapse,
} from '@gitroom/frontend/components/new-layout/side-panel-header';
import { ChannelRow } from '@gitroom/frontend/components/new-layout/channel-row';
import { ToolbarSelect } from '@gitroom/frontend/components/cuesoft/toolbar/toolbar';
const allowedIntegrations = [
  'facebook',
  'instagram',
  'instagram-standalone',
  'linkedin-page',
  'tiktok',
  'youtube',
  'gmb',
  'pinterest',
  'threads',
  'x',
];
export const PlatformAnalytics = () => {
  const fetch = useFetch();
  const t = useT();
  const router = useRouter();
  const { disableXAnalytics } = useVariables();

  const [current, setCurrent] = useState(0);
  const [key, setKey] = useState(7);
  const [refresh, setRefresh] = useState(false);
  const { collapsed, toggle } = useSidePanelCollapse();
  const toaster = useToaster();
  const load = useCallback(async () => {
    const int = (
      await (await fetch('/integrations/list')).json()
    ).integrations.filter((f: any) => {
      if (f.identifier === 'x' && disableXAnalytics) {
        return false;
      }
      return true;
    });
    return int.filter((f: any) => allowedIntegrations.includes(f.identifier));
  }, []);
  const { data, isLoading } = useSWR('analytics-list', load, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
    revalidateOnMount: true,
    refreshWhenHidden: false,
    refreshWhenOffline: false,
    fallbackData: [],
  });
  const sortedIntegrations = useMemo(() => {
    return orderBy(
      data,
      ['type', 'disabled', 'identifier'],
      ['desc', 'asc', 'asc']
    );
  }, [data]);
  const currentIntegration = useMemo(() => {
    return sortedIntegrations[current];
  }, [current, sortedIntegrations]);
  const options = useMemo(() => {
    if (!currentIntegration) {
      return [];
    }
    const arr = [];
    if (
      [
        'facebook',
        'instagram',
        'instagram-standalone',
        'linkedin-page',
        'pinterest',
        'youtube',
        'threads',
        'gmb',
        'x',
        'tiktok',
      ].indexOf(currentIntegration.identifier) !== -1
    ) {
      arr.push({
        key: 7,
        value: t('7_days', '7 Days'),
      });
    }
    if (
      [
        'facebook',
        'instagram',
        'instagram-standalone',
        'linkedin-page',
        'pinterest',
        'youtube',
        'threads',
        'gmb',
        'x',
        'tiktok',
      ].indexOf(currentIntegration.identifier) !== -1
    ) {
      arr.push({
        key: 30,
        value: t('30_days', '30 Days'),
      });
    }
    if (
      ['facebook', 'linkedin-page', 'pinterest', 'youtube', 'x', 'gmb'].indexOf(
        currentIntegration.identifier
      ) !== -1
    ) {
      arr.push({
        key: 90,
        value: t('90_days', '90 Days'),
      });
    }
    return arr;
  }, [currentIntegration]);
  const keys = useMemo(() => {
    if (!currentIntegration) {
      return 7;
    }
    if (options.find((p) => p.key === key)) {
      return key;
    }
    return options[0]?.key;
  }, [key, currentIntegration]);

  if (isLoading) {
    return (
      <div className="bg-newBgColorInner p-[20px] flex flex-1 flex-col gap-[15px] transition-all items-center justify-center">
        <LoadingComponent />
      </div>
    );
  }

  if (!sortedIntegrations.length && !isLoading) {
    return (
      <div className="bg-newBgColorInner p-[20px] flex flex-col gap-[15px] transition-all flex-1 justify-center items-center text-center">
        <div>
          <img src="/peoplemarketplace.svg" />
        </div>
        <div className="text-[48px]">
          {t('can_t_show_analytics_yet', "Can't show analytics yet")}
          <br />
          {t(
            'you_have_to_add_social_media_channels',
            'You have to add Social Media channels'
          )}
        </div>
        <div className="text-[20px]">
          {t('supported', 'Supported:')}
          {allowedIntegrations.map((p) => capitalize(p)).join(', ')}
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
        {!!options.length && (
          <div className="flex-1 flex flex-col gap-[14px]">
            <div className="max-w-[200px]">
              <ToolbarSelect
                name="date"
                value={keys}
                onChange={(e) => setKey(+e.target.value)}
                className="w-full"
              >
                {options.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.value}
                  </option>
                ))}
              </ToolbarSelect>
            </div>
            <div className="flex-1">
              {!!keys && !!currentIntegration && !refresh && (
                <RenderAnalytics integration={currentIntegration} date={keys} />
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
};
