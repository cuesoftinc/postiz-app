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
            {/* Buffer Insights date-range chip row: active = green chip
                (boxFocused/textItemFocused mirrors on both themes), inactive =
                hairline chip, muted text, white-alpha hover fill. Same setter
                (setKey) + same option keys the old ToolbarSelect drove — the
                option set is the existing bounded 7/30/90 per-platform list. */}
            <div className="flex flex-wrap items-center gap-[8px]">
              {options.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setKey(option.key)}
                  className={clsx(
                    'h-[32px] px-[14px] rounded-[8px] border text-[14px] whitespace-nowrap cursor-pointer transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#325ea6]',
                    keys === option.key
                      ? 'bg-boxFocused text-textItemFocused border-transparent font-[500]'
                      : 'text-textItemBlur border-newTableBorder hover:bg-newTableBorder'
                  )}
                >
                  {option.value}
                </button>
              ))}
            </div>
            {/* Buffer Insights "Summary" section header: title 18/600 (data-cs
                keeps the ladder from forcing 18 -> 16, same as the composer
                title) + muted 14px date-range line from the existing selected
                option — no computed dates, no compared-to (no such data). */}
            <div className="flex flex-col gap-[2px]">
              <div data-cs className="text-[18px] font-display font-[600]">
                {t('summary', 'Summary')}
              </div>
              <div className="text-[14px] text-textItemBlur">
                {options.find((option) => option.key === keys)?.value}
              </div>
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
