'use client';

import React, {
  createContext,
  FC,
  useCallback,
  useEffect,
  useMemo,
  useRef,
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
import { useParams, useSearchParams } from 'next/navigation';
import { useUser } from '@gitroom/frontend/components/layout/user.context';
import { ContentChatComponent } from '@gitroom/frontend/components/content-agent/content-chat.component';
import { SessionsRail } from '@gitroom/frontend/components/content-agent/sessions-rail.component';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { sidePanelRoot, sidePanelPane } from '@gitroom/frontend/components/new-layout/side-panel';
import {
  SidePanelHeader,
  useSidePanelCollapse,
} from '@gitroom/frontend/components/new-layout/side-panel-header';
import { ChannelAvatar } from '@gitroom/frontend/components/new-layout/channel-avatar';
import { Skeleton } from '@gitroom/frontend/components/layout/skeleton';
import {
  PageHeader,
  PageShell,
} from '@gitroom/frontend/components/new-layout/page-header';

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
    // see agent.styles.scss. No horizontal padding of its own: the composer
    // below it sits flush with the PageShell inset now, and the chips align
    // with its edge.
    <div className="agent-scope whitespace-nowrap editor rm-bg">
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
    // no horizontal padding of its own — the PageShell inset aligns the strip
    // with the header chip above it
    <div className="flex items-center gap-[10px] py-[10px] bg-newBgColorInner border-b border-newTableBorder overflow-x-auto scrollbar scrollbar-thumb-fifth scrollbar-track-newBgColor">
      <div className="text-[13px] text-newTextColor/60 whitespace-nowrap">
        {t('select_channels', 'Select Channels')}
      </div>
      {!sortedIntegrations.length && (
        <Link
          href="/schedule"
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
  const user = useUser();
  // Owner's decision (2026-08-11): this is an internal tool, so EVERY org
  // user gets the bridge experience (Assistant + Content tabs); the old
  // CopilotKit chat (children) is no longer reachable but kept as the
  // fallback while user context loads. Backend gates were opened to match.
  const isAdmin = !!user;
  const searchParams = useSearchParams();
  // /content redirects here with ?mode=content so old links preselect the
  // Content segment (the (app) tree is force-dynamic — no Suspense needed)
  const [mode, setMode] = useState<'assistant' | 'content'>(() =>
    searchParams.get('mode') === 'content' ? 'content' : 'assistant'
  );
  useEffect(() => {
    // this layout survives /agents/* client navigations — re-read the param
    // when a navigation actually carries it (thread links never do)
    if (searchParams.get('mode') === 'content') setMode('content');
  }, [searchParams]);
  const contentMode = isAdmin && mode === 'content';

  // Admins: BOTH tabs are bridge panes now (Assistant runs the bridge's
  // 'assistant' profile, Content its 'content' profile), kept mounted so a
  // stream survives a tab flip; the segmented just swaps which one shows.
  // Non-admins keep the CopilotKit chat (children) untouched — the bridge
  // runs on the operator's Claude account.

  // each pane registers its session-reset here so the header's (and rail's)
  // New chat can drive the ACTIVE profile's pane
  const resetRefs = useRef<Record<'assistant' | 'content', (() => void) | null>>(
    { assistant: null, content: null }
  );
  const registerAssistantReset = useCallback(
    (reset: (() => void) | null) => {
      resetRefs.current.assistant = reset;
    },
    []
  );
  const registerContentReset = useCallback((reset: (() => void) | null) => {
    resetRefs.current.content = reset;
  }, []);
  const newBridgeChat = useCallback(() => {
    resetRefs.current[mode]?.();
  }, [mode]);

  // the page owns which bridge session is open per profile: the rail resumes
  // one, the pane reports the ids the bridge mints (onSessionChange), New
  // chat clears back to null
  const [bridgeSessions, setBridgeSessions] = useState<{
    assistant: string | null;
    content: string | null;
  }>({ assistant: null, content: null });
  const onAssistantSession = useCallback(
    (id: string | null) =>
      setBridgeSessions((s) =>
        s.assistant === id ? s : { ...s, assistant: id }
      ),
    []
  );
  const onContentSession = useCallback(
    (id: string | null) =>
      setBridgeSessions((s) => (s.content === id ? s : { ...s, content: id })),
    []
  );
  const selectSession = useCallback(
    (id: string) => setBridgeSessions((s) => ({ ...s, [mode]: id })),
    [mode]
  );

  // bumped when a turn finishes so the rail refetches (new sessions appear,
  // updatedAt reorders)
  const [sessionsVersion, setSessionsVersion] = useState(0);
  const bumpSessions = useCallback(() => setSessionsVersion((v) => v + 1), []);

  const switchMode = useCallback((next: 'assistant' | 'content') => {
    setMode(next);
    // keep the URL shareable/refresh-stable without a Next navigation —
    // same history.replaceState pattern as the launches filters
    const url = new URL(window.location.href);
    if (next === 'content') url.searchParams.set('mode', 'content');
    else url.searchParams.delete('mode');
    window.history.replaceState(null, '', url.pathname + url.search);
  }, []);

  return (
    <PropertiesContext.Provider value={{ properties }}>
      {/* Buffer composer pattern: the channel toggles are a bar above the
          chat, not a side column. min-w-0 keeps the shell from being crushed
          inside the layout row. */}
      <PageShell className="min-w-0">
        {/* ONE shared page header (new-layout/page-header.tsx): 48px row,
            40px r10 chip, 20/400 display title — visible on phone (56px)
            where the lime primary collapses to an icon-only 40px square */}
        <PageHeader
          icon={
            /* sparkle — the agent/AI glyph */
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
          }
          title={t('agent', 'Agent')}
          actions={
            <>
              {/* [Assistant | Content] segmented — launches List|Calendar
                  anatomy (32px band, 4px inset, hairline r8; active =
                  boxFocused/textItemFocused). Admin-only: without the
                  Content segment there is nothing to switch. */}
              {isAdmin && (
                <div
                  data-cs
                  className="flex h-[32px] phone:h-[44px] p-[4px] border border-newTableBorder rounded-[8px] text-[14px] font-[500] shrink-0"
                >
                  <button
                    type="button"
                    onClick={() => switchMode('assistant')}
                    className={clsx(
                      'flex items-center px-[8px] rounded-[6px] transition-colors duration-150',
                      !contentMode
                        ? 'bg-boxFocused text-textItemFocused'
                        : 'text-newTextColor/60 hover:text-newTextColor'
                    )}
                  >
                    {t('assistant', 'Assistant')}
                  </button>
                  <button
                    type="button"
                    onClick={() => switchMode('content')}
                    className={clsx(
                      'flex items-center px-[8px] rounded-[6px] transition-colors duration-150',
                      contentMode
                        ? 'bg-boxFocused text-textItemFocused'
                        : 'text-newTextColor/60 hover:text-newTextColor'
                    )}
                  >
                    {t('content', 'Content')}
                  </button>
                </div>
              )}
              {/* New chat lives HERE in both modes — quiet 32px hairline (S4:
                  the segmented is the page focal point, so the old lime
                  primary demotes). Admins: clears the ACTIVE profile's bridge
                  pane to a fresh session; non-admins: a new copilot thread. */}
              {isAdmin ? (
                <button
                  type="button"
                  onClick={newBridgeChat}
                  title={t('new_chat', 'New chat')}
                  data-cs
                  className="h-[32px] phone:h-[44px] px-[12px] rounded-[8px] border border-newTableBorder bg-newBgColorInner flex items-center justify-center gap-[6px] text-[14px] font-[500] text-newTextColor hover:bg-boxHover transition-colors duration-150 shrink-0 whitespace-nowrap phone:w-[44px] phone:px-0"
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
                  <span className="phone:hidden">
                    {t('new_chat', 'New chat')}
                  </span>
                </button>
              ) : (
                <Link
                  href="/agents/new"
                  title={t('new_chat', 'New chat')}
                  data-cs
                  className="h-[32px] phone:h-[44px] px-[12px] rounded-[8px] border border-newTableBorder bg-newBgColorInner flex items-center justify-center gap-[6px] text-[14px] font-[500] text-newTextColor hover:bg-boxHover transition-colors duration-150 shrink-0 whitespace-nowrap phone:w-[44px] phone:px-0"
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
                  <span className="phone:hidden">
                    {t('new_chat', 'New chat')}
                  </span>
                </Link>
              )}
            </>
          }
        />
        {/* channel toggles feed PropertiesContext → the copilot chat only;
            they mean nothing to the bridge chat, so admins (both tabs are
            bridge panes) drop them */}
        {!isAdmin && <AgentList onChange={setProperties} />}
        {/* phone: rail + chat stack (rail first); min-w-0 keeps the chat
            pane from being crushed by the rail's intrinsic width. The row's
            own bg paints the 1px seam between chat and rail — the shell's
            white would otherwise swallow it. */}
        <div className="flex flex-1 gap-[1px] min-h-0 bg-newBgLineColor phone:flex-col">
          <div className="bg-newBgColorInner flex flex-1 min-w-0">
            {isAdmin ? (
              /* both bridge panes stay mounted (a stream survives a tab
                 flip); the segmented hides the inactive one */
              <>
                <div
                  className={clsx(
                    'flex flex-1 min-w-0',
                    contentMode && 'hidden'
                  )}
                >
                  <ContentChatComponent
                    profile="assistant"
                    activeSessionId={bridgeSessions.assistant}
                    onSessionChange={onAssistantSession}
                    onTurnEnd={bumpSessions}
                    registerReset={registerAssistantReset}
                  />
                </div>
                <div
                  className={clsx(
                    'flex flex-1 min-w-0',
                    !contentMode && 'hidden'
                  )}
                >
                  <ContentChatComponent
                    profile="content"
                    activeSessionId={bridgeSessions.content}
                    onSessionChange={onContentSession}
                    onTurnEnd={bumpSessions}
                    registerReset={registerContentReset}
                  />
                </div>
              </>
            ) : (
              children
            )}
          </div>
          {/* admins: ONE sessions rail shared by both tabs, listing the
              active profile's bridge sessions; non-admins keep the copilot
              Threads rail */}
          {isAdmin ? (
            <SessionsRail
              profile={mode}
              activeId={bridgeSessions[mode]}
              version={sessionsVersion}
              onSelect={selectSession}
              onNewChat={newBridgeChat}
            />
          ) : (
            <Threads />
          )}
        </div>
      </PageShell>
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
          // phone:px-[4px] — with the shell's 12px this lands the rail
          // content on the app's single 16px phone gutter
          'absolute top-0 start-0 w-full h-full p-[20px] phone:px-[4px] flex flex-col gap-[12px] overflow-auto scrollbar scrollbar-thumb-fifth scrollbar-track-newBgColor',
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
          className="flex items-center justify-center gap-[6px] h-[32px] phone:h-[44px] px-[12px] rounded-[8px] border border-newTableBorder bg-newBgColorInner text-[14px] font-[500] text-newTextColor hover:bg-boxHover transition-colors duration-150 outline-none whitespace-nowrap shrink-0 group-[.sidebar]:w-[32px] group-[.sidebar]:px-0 group-[.sidebar]:mx-auto"
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
                  'flex items-center h-[32px] phone:h-[44px] px-[10px] rounded-[8px] text-[14px] cursor-pointer transition-colors duration-150 hover:bg-boxHover shrink-0',
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
