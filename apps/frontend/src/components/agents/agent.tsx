'use client';

import React, {
  createContext,
  FC,
  useCallback,
  useMemo,
  useState,
  ReactNode,
} from 'react';
import clsx from 'clsx';
import useSWR from 'swr';
import { orderBy } from 'lodash';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useWaitForClass } from '@gitroom/helpers/utils/use.wait.for.class';
import { MultiMediaComponent } from '@gitroom/frontend/components/media/media.component';
import { Integration } from '@prisma/client';
import Link from 'next/link';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { sidePanelRoot, sidePanelPane } from '@gitroom/frontend/components/new-layout/side-panel';
import {
  SidePanelHeader,
  useSidePanelCollapse,
} from '@gitroom/frontend/components/new-layout/side-panel-header';
import { ChannelAvatar } from '@gitroom/frontend/components/new-layout/channel-avatar';

export const MediaPortal: FC<{
  media: { path: string; id: string }[];
  value: string;
  setMedia: (event: {
    target: {
      name: string;
      value?: {
        id: string;
        path: string;
        alt?: string;
        thumbnail?: string;
        thumbnailTimestamp?: number;
      }[];
    };
  }) => void;
}> = ({ media, setMedia, value }) => {
  const waitForClass = useWaitForClass('copilotKitMessages');
  const t = useT();
  if (!waitForClass) return null;
  return (
    <div className="pl-[14px] pr-[24px] whitespace-nowrap editor rm-bg">
      <MultiMediaComponent
        allData={[{ content: value }]}
        text={value}
        label={t('attachments', 'Attachments')}
        description=""
        value={media}
        dummy={false}
        name="image"
        onChange={setMedia}
        onOpen={() => {}}
        onClose={() => {}}
      />
    </div>
  );
};

export const AgentList: FC<{ onChange: (arr: any[]) => void }> = ({
  onChange,
}) => {
  const fetch = useFetch();
  const t = useT();
  const [selected, setSelected] = useState([]);

  const load = useCallback(async () => {
    return (await (await fetch('/integrations/list')).json()).integrations;
  }, []);

  const { data } = useSWR('integrations', load, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
    revalidateOnMount: true,
    refreshWhenHidden: false,
    refreshWhenOffline: false,
    fallbackData: [],
  });

  const setIntegration = useCallback(
    (integration: Integration) => () => {
      if (selected.some((p) => p.id === integration.id)) {
        onChange(selected.filter((p) => p.id !== integration.id));
        setSelected(selected.filter((p) => p.id !== integration.id));
      } else {
        onChange([...selected, integration]);
        setSelected([...selected, integration]);
      }
    },
    [selected]
  );

  const sortedIntegrations = useMemo(() => {
    return orderBy(
      data || [],
      ['type', 'disabled', 'identifier'],
      ['desc', 'asc', 'asc']
    );
  }, [data]);

  return (
    <div className="flex items-center gap-[10px] px-[20px] py-[10px] bg-newBgColorInner border-b border-newTableBorder overflow-x-auto scrollbar scrollbar-thumb-fifth scrollbar-track-newBgColor">
      <div className="text-[13px] text-newTextColor/60 whitespace-nowrap">
        {t('select_channels', 'Select Channels')}
      </div>
      {!sortedIntegrations.length && (
        <Link
          href="/launches"
          className="text-[13px] text-newTextColor/60 underline hover:text-newTextColor transition-colors whitespace-nowrap"
        >
          {t('connect_channels', 'Connect channels')}
        </Link>
      )}
      {sortedIntegrations.map((integration) => (
        <div
          key={integration.id}
          title={integration.name}
          onClick={setIntegration(integration)}
          className={clsx(
            'cursor-pointer rounded-full transition-all shrink-0',
            selected.some((p) => p.id === integration.id)
              ? 'ring-2 ring-btnPrimary'
              : 'opacity-40 hover:opacity-80'
          )}
        >
          <ChannelAvatar
            picture={integration.picture}
            identifier={integration.identifier}
            name={integration.name}
            size={34}
            badgeSize={14}
            badgeOffset="-bottom-[2px] -end-[2px]"
            fallback="placeholder"
          />
        </div>
      ))}
    </div>
  );
};

export const PropertiesContext = createContext({ properties: [] });
export const Agent: FC<{ children: ReactNode }> = ({ children }) => {
  const [properties, setProperties] = useState([]);

  return (
    <PropertiesContext.Provider value={{ properties }}>
      {/* Buffer composer pattern: the channel toggles are a bar above the
          chat, not a side column */}
      <div className="flex flex-col flex-1 min-w-0">
        <AgentList onChange={setProperties} />
        <div className="flex flex-1 gap-[1px] min-h-0">
          <div className="bg-newBgColorInner flex flex-1">{children}</div>
          <Threads />
        </div>
      </div>
    </PropertiesContext.Provider>
  );
};

const Threads: FC = () => {
  const fetch = useFetch();
  const router = useRouter();
  const pathname = usePathname();
  const t = useT();
  const threads = useCallback(async () => {
    return (await fetch('/copilot/list')).json();
  }, []);
  const { id } = useParams<{ id: string }>();

  const { data } = useSWR('threads', threads);

  return (
    <div
      className={clsx(
        'trz bg-newBgColorInner flex flex-col gap-[15px] transition-all relative',
        'w-[260px]'
      )}
    >
      <div
        className={clsx(
          'absolute top-0 start-0 w-full h-full p-[20px] overflow-auto scrollbar scrollbar-thumb-fifth scrollbar-track-newBgColor',
          sidePanelPane
        )}
      >
        <div className="mb-[15px] justify-center flex group-[.sidebar]:pb-[15px]">
          <Link
            href={`/agents`}
            className="text-white whitespace-nowrap flex-1 pt-[12px] pb-[14px] ps-[16px] pe-[20px] group-[.sidebar]:p-0 min-h-[44px] max-h-[44px] rounded-md bg-btnPrimary flex justify-center items-center gap-[5px] outline-none"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="21"
              height="20"
              viewBox="0 0 21 20"
              fill="none"
              className="min-w-[21px] min-h-[20px]"
            >
              <path
                d="M10.5001 4.16699V15.8337M4.66675 10.0003H16.3334"
                stroke="white"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <div className="flex-1 text-start text-[16px] group-[.sidebar]:hidden">
              {t('start_a_new_chat', 'Start a new chat')}
            </div>
          </Link>
        </div>
        <div className="flex flex-col gap-[1px]">
          {data?.threads?.map((p: any) => (
            <Link
              className={clsx(
                'overflow-ellipsis overflow-hidden whitespace-nowrap hover:bg-newBgColor px-[10px] py-[6px] rounded-[10px] cursor-pointer',
                p.id === id && 'bg-newBgColor'
              )}
              href={`/agents/${p.id}`}
              key={p.id}
            >
              {p.title}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};
