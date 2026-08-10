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
import { useParams } from 'next/navigation';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { sidePanelRoot, sidePanelPane } from '@gitroom/frontend/components/new-layout/side-panel';
import {
  SidePanelHeader,
  useSidePanelCollapse,
} from '@gitroom/frontend/components/new-layout/side-panel-header';
import { ChannelAvatar } from '@gitroom/frontend/components/new-layout/channel-avatar';
import { Skeleton } from '@gitroom/frontend/components/layout/skeleton';

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
    // `agent-scope` keys the agents-only restyle of the shared Insert-Media
    // chip row (media.component.tsx is the composer's file — not touched);
    // see agent.styles.scss
    <div className="agent-scope pl-[14px] pr-[24px] whitespace-nowrap editor rm-bg">
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
            // S5: 40px meets the phone tap floor; unselected stays legible at
            // .60 (Buffer never ghosts controls) — selected keeps the lime ring
            'cursor-pointer rounded-full transition-opacity duration-150 shrink-0',
            selected.some((p) => p.id === integration.id)
              ? 'ring-2 ring-btnPrimary'
              : 'opacity-60 hover:opacity-100'
          )}
        >
          <ChannelAvatar
            picture={integration.picture}
            identifier={integration.identifier}
            name={integration.name}
            size={40}
            badgeSize={16}
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
  const t = useT();

  return (
    <PropertiesContext.Provider value={{ properties }}>
      {/* Buffer composer pattern: the channel toggles are a bar above the
          chat, not a side column */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* S1 page header — Buffer anatomy [40px r10 hairline icon chip ·
            20px/400 display title · flex-1 · lime page primary]. The row stays
            on phone (56px) where the primary collapses to an icon-only 40px
            square. NOTE: layout.component.tsx renders its generic 64px Title
            bar on desktop until /agents joins its /launches exclusion — that
            file is out of this scope. */}
        {/* px-[16px] not px-[20px]: the global ladder pins px-[20px] to 16px
            with !important, which would also defeat phone:px-[12px] */}
        <div className="flex items-center gap-[10px] h-[64px] px-[16px] bg-newBgColorInner border-b border-newTableBorder select-none phone:h-[56px] phone:px-[12px]">
          <div className="w-[40px] h-[40px] rounded-[10px] border border-newTableBorder flex items-center justify-center text-newTextColor shrink-0">
            {/* sparkle — the agent/AI glyph */}
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
              <path d="M20 3v4" />
              <path d="M22 5h-4" />
            </svg>
          </div>
          <h1
            className="font-display text-[20px] font-[400] text-newTextColor truncate"
            data-cs
          >
            {t('agent', 'Agent')}
          </h1>
          <div className="flex-1" />
          <Link
            href="/agents/new"
            title={t('new_chat', 'New chat')}
            data-cs
            className="h-[40px] px-[12px] rounded-[8px] bg-btnPrimary flex items-center justify-center gap-[6px] text-[14px] font-[500] transition-colors duration-150 shrink-0 phone:w-[40px] phone:px-0"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="shrink-0"
            >
              <path d="M5 12h14" />
              <path d="M12 5v14" />
            </svg>
            <span className="phone:hidden">{t('new_chat', 'New chat')}</span>
          </Link>
        </div>
        <AgentList onChange={setProperties} />
        {/* phone: rail + chat stack (Threads first); min-w-0 keeps the chat
            pane from being crushed by the rail's intrinsic width */}
        <div className="flex flex-1 gap-[1px] min-h-0 phone:flex-col">
          <div className="bg-newBgColorInner flex flex-1 min-w-0">
            {children}
          </div>
          <Threads />
        </div>
      </div>
    </PropertiesContext.Provider>
  );
};

const Threads: FC = () => {
  const fetch = useFetch();
  const t = useT();
  const threads = useCallback(async () => {
    return (await fetch('/copilot/list')).json();
  }, []);
  const { id } = useParams<{ id: string }>();
  const { collapsed, toggle } = useSidePanelCollapse();

  const { data } = useSWR('threads', threads);

  return (
    <div
      data-side-panel="absolute"
      className={clsx(
        // sidePanelRoot: 224px Buffer-calibrated rail (was a hardcoded 260px —
        // 36px wider than every sibling panel) + full-width on phone, where it
        // stacks above the chat
        'trz bg-newBgColorInner flex flex-col transition-all relative phone:order-first',
        sidePanelRoot(collapsed)
      )}
    >
      <div
        className={clsx(
          'absolute top-0 start-0 w-full h-full p-[20px] flex flex-col gap-[12px] overflow-auto scrollbar scrollbar-thumb-fifth scrollbar-track-newBgColor',
          sidePanelPane
        )}
      >
        <SidePanelHeader title={t('chats', 'Chats')} onToggle={toggle} />
        {/* quiet 32px hairline button — the page-level lime primary lives in
            the S1 header, so the rail copy demotes (S4) */}
        <Link
          href="/agents/new"
          title={t('start_a_new_chat', 'Start a new chat')}
          data-cs
          className="flex items-center justify-center gap-[6px] h-[32px] px-[12px] rounded-[8px] border border-newTableBorder bg-newBgColorInner text-[14px] font-[500] text-newTextColor hover:bg-boxHover transition-colors duration-150 outline-none whitespace-nowrap shrink-0 group-[.sidebar]:w-[32px] group-[.sidebar]:px-0 group-[.sidebar]:mx-auto"
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
            className="shrink-0"
          >
            <path d="M5 12h14" />
            <path d="M12 5v14" />
          </svg>
          <span className="group-[.sidebar]:hidden">
            {t('start_a_new_chat', 'Start a new chat')}
          </span>
        </Link>
        {!data ? (
          /* /copilot/list still loading — Buffer-style skeleton: three bars
             shaped like the 32px thread rows below, never a spinner */
          <div className="flex flex-col gap-[2px] group-[.sidebar]:hidden">
            {[...new Array(3)].map((_, i) => (
              <div key={i} className="flex items-center h-[32px] px-[10px]">
                <Skeleton
                  className={clsx('h-[14px]', i === 2 ? 'w-[55%]' : 'w-[80%]')}
                />
              </div>
            ))}
          </div>
        ) : data?.threads && !data.threads.length ? (
          /* S2 empty state — 64px muted circle + 24px stroke icon +
             16/600 heading + muted subline */
          <div className="flex flex-col items-center text-center gap-[4px] px-[12px] mt-[40px] group-[.sidebar]:hidden">
            <div className="w-[64px] h-[64px] rounded-full bg-newTextColor/5 flex items-center justify-center text-newTextColor/60 mb-[8px]">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
              </svg>
            </div>
            <div className="text-[16px] font-[600] text-newTextColor">
              {t('no_chats_yet', 'No chats yet')}
            </div>
            <div className="text-[14px] text-newTextColor/60">
              {t(
                'no_chats_yet_description',
                'Start a conversation and it will show up here.'
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-[2px]">
            {data?.threads?.map((p: any) => (
              <Link
                className={clsx(
                  'flex items-center h-[32px] px-[10px] rounded-[8px] text-[14px] cursor-pointer transition-colors duration-150 hover:bg-boxHover shrink-0',
                  p.id === id && 'bg-boxHover'
                )}
                href={`/agents/${p.id}`}
                key={p.id}
              >
                <span className="truncate">{p.title}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
