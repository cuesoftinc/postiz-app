'use client';

import { FC, MouseEvent, useCallback, useEffect } from 'react';
import clsx from 'clsx';
import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import {
  sidePanelRoot,
  sidePanelPane,
} from '@gitroom/frontend/components/new-layout/side-panel';
import {
  SidePanelHeader,
  useSidePanelCollapse,
} from '@gitroom/frontend/components/new-layout/side-panel-header';
import { Skeleton } from '@gitroom/frontend/components/layout/skeleton';
import { BridgeProfile } from '@gitroom/frontend/components/content-agent/content-chat.component';

type BridgeSession = {
  id: string;
  profile: BridgeProfile;
  title: string;
  createdAt: number;
  updatedAt: number;
};

/** compact relative timestamp for the rail rows ("now", "5m", "3h", "2d",
 *  "1w"); tolerates second-epoch values from the bridge index */
const relTime = (ts: number) => {
  const ms = ts < 1e12 ? ts * 1000 : ts;
  const minutes = Math.floor((Date.now() - ms) / 60000);
  if (!Number.isFinite(minutes) || minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return `${Math.floor(d / 7)}w`;
};

/** The bridge sessions rail (every org user, shared by both segmented tabs):
 *  the same visual shell as the copilot Chats rail in agent.tsx — 224px
 *  Buffer-calibrated side panel, SidePanelHeader + collapse cookie, 32px r8
 *  rows — listing the bridge's per-profile session index via the
 *  /copilot/content-sessions proxies. Tapping a row resumes that session in
 *  the chat pane (the page owns which session is open); the hover x prunes
 *  the entry from the index (the underlying Claude Code session survives). */
export const SessionsRail: FC<{
  profile: BridgeProfile;
  activeId: string | null;
  /** bumped by the page when a turn finishes, so new sessions and updated
      ordering show up without a tab flip */
  version: number;
  onSelect: (id: string) => void;
  onNewChat: () => void;
}> = ({ profile, activeId, version, onSelect, onNewChat }) => {
  const fetch = useFetch();
  const t = useT();
  const { collapsed, toggle } = useSidePanelCollapse();

  const load = useCallback(async (): Promise<BridgeSession[] | null> => {
    try {
      const data = await (
        await fetch(`/copilot/content-sessions?profile=${profile}`)
      ).json();
      // the bridge returns a bare array; the proxy collapses failures to
      // { error: 'Content bridge is offline' } — normalize both shapes
      if (Array.isArray(data)) return data;
      if (Array.isArray(data?.sessions)) return data.sessions;
      return null;
    } catch {
      return null;
    }
  }, [profile]);

  const { data, mutate } = useSWR(`content-sessions-${profile}`, load);

  useEffect(() => {
    if (version > 0) mutate();
  }, [version, mutate]);

  const remove = useCallback(
    (id: string) => async (e: MouseEvent) => {
      // the row underneath resumes on click — the x must not
      e.preventDefault();
      e.stopPropagation();
      await fetch(`/copilot/content-sessions/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      mutate();
    },
    [fetch, mutate]
  );

  return (
    <div
      data-side-panel="absolute"
      className={clsx(
        // same shell as the copilot Threads rail: 224px Buffer-calibrated
        // panel, full-width stacked above the chat on phone
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
        <SidePanelHeader title={t('sessions', 'Sessions')} onToggle={toggle} />
        {/* quiet 32px hairline button — same demotion (S4) as the Threads
            rail copy; clears the pane to a fresh bridge session */}
        <button
          type="button"
          onClick={onNewChat}
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
        </button>
        {data === undefined ? (
          /* index loading — the Threads rail's skeleton: three bars shaped
             like the 32px rows below, never a spinner */
          <div className="flex flex-col gap-[2px] group-[.sidebar]:hidden">
            {[...new Array(3)].map((_, i) => (
              <div key={i} className="flex items-center h-[32px] px-[10px]">
                <Skeleton
                  className={clsx('h-[14px]', i === 2 ? 'w-[55%]' : 'w-[80%]')}
                />
              </div>
            ))}
          </div>
        ) : data === null ? (
          /* proxy said the bridge is unreachable — same wording as the pane */
          <div className="text-[14px] text-newTextColor/60 px-[10px] group-[.sidebar]:hidden">
            {t('content_bridge_offline_short', 'Content bridge is offline.')}
          </div>
        ) : !data.length ? (
          /* S2 empty state — 64px muted circle + 24px stroke icon +
             16/600 heading + muted subline (Threads rail shell) */
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
              {t('no_sessions_yet', 'No sessions yet')}
            </div>
            <div className="text-[14px] text-newTextColor/60">
              {t(
                'no_sessions_yet_description',
                'Start a conversation and it will show up here.'
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-[2px]">
            {data.map((s) => (
              <div
                key={s.id}
                onClick={() => onSelect(s.id)}
                className={clsx(
                  // 44px phone rows (tap floor) + a right-aligned muted
                  // relative timestamp so bare truncated titles read as
                  // tappable list items
                  'group/session flex items-center gap-[6px] h-[32px] phone:h-[44px] px-[10px] rounded-[8px] text-[14px] cursor-pointer transition-colors duration-150 hover:bg-boxHover shrink-0',
                  s.id === activeId && 'bg-boxHover'
                )}
              >
                <span className="flex-1 min-w-0 truncate">
                  {s.title || t('untitled_session', 'Untitled session')}
                </span>
                <span className="shrink-0 text-[12px] text-newTextColor/50 group-hover/session:hidden">
                  {relTime(s.updatedAt)}
                </span>
                {/* hover-revealed 16px x: prunes the rail entry via the
                    DELETE proxy (the session itself stays resumable) */}
                <button
                  type="button"
                  onClick={remove(s.id)}
                  aria-label={t('remove_session', 'Remove session')}
                  title={t('remove_session', 'Remove session')}
                  className="w-[16px] h-[16px] shrink-0 flex items-center justify-center rounded-[4px] text-newTextColor/60 hover:text-newTextColor opacity-0 group-hover/session:opacity-100 transition-opacity duration-150"
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M18 6 6 18" />
                    <path d="m6 6 12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
