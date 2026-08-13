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
  /** ISO 8601 strings, NOT epoch numbers: the bridge's session index writes
      `new Date().toISOString()` (postiz/bridge/server.mjs, upsertSession) and
      the proxy passes that JSON through untouched. */
  createdAt: string;
  updatedAt: string;
  /** Session ids this conversation has already forked through, oldest first, with
      the live one in `id`. Listed here because the proxy passes the index record
      through untouched, so it is genuinely on the wire; nothing in this rail uses
      it. It is read by the bridge's history endpoint, which follows the chain so a
      conversation that changed id still replays whole. Absent on records written
      before the field existed. */
  chain?: string[];
};

/** compact relative timestamp for the rail rows ("now", "5m", "3h", "2d",
 *  "1w"). Typed as a number, the age arithmetic ran on an ISO string, so every
 *  row came out NaN and rendered as "now" whatever its real age. A value that
 *  will not parse now renders nothing at all, rather than looking fresh. */
const relTime = (ts: string) => {
  const ms = Date.parse(ts || '');
  if (!Number.isFinite(ms)) return '';
  const minutes = Math.floor((Date.now() - ms) / 60000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return `${Math.floor(d / 7)}w`;
};

/** The bridge sessions rail (available to every org user, and shared by both
 *  segmented tabs, never between users): the same visual shell as the copilot
 *  Chats rail in agent.tsx, i.e. a 224px Buffer-calibrated side panel,
 *  SidePanelHeader + collapse cookie and 32px r8 rows, listing the bridge's
 *  per-profile session index via the /copilot/content-sessions proxies. Tapping
 *  a row resumes that session in the chat pane (the page owns which session is
 *  open); the hover x prunes the entry from the index.
 *
 *  OWNERSHIP IS ENFORCED SERVER-SIDE, so this component does none of it: the
 *  proxy sends the signed-in user's id to the bridge and the bridge returns only
 *  that user's sessions. Do not add a client-side owner filter: a filter here
 *  would imply the payload can contain other people's rows, which is precisely
 *  the leak that was fixed (it could, until 2026-08-13, and the rail dutifully
 *  rendered them). Two consequences worth keeping in mind while editing:
 *  - ZERO ROWS IS A NORMAL STATE now, not a failure. A new user legitimately
 *    sees none, and the empty list renders the S2 empty state below; only a
 *    null (the proxy's offline shape) means something is wrong.
 *  - the SWR key carries the profile but no user, which is safe because both
 *    signing in and switching impersonation reload the page (impersonate.tsx),
 *    discarding this in-memory cache with everything else. */
export const SessionsRail: FC<{
  profile: BridgeProfile;
  activeId: string | null;
  /** bumped by the page when a turn finishes, so new sessions and updated
      ordering show up without a tab flip */
  version: number;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  /** Fired after the x removes a row, with the id that went. THE ENTRY IS THE
      OWNERSHIP RECORD, so a removed session is not merely absent from this
      list: the bridge resumes only what its index says the caller owns, so the
      id is now refused on every path. A parent holding it as the open session
      must stop pointing at it, or the next turn in that pane comes back 403
      with no way out but a reload. Required, not optional, for exactly that
      reason: a mount that ignores this can brick its own pane. */
  onRemoved: (id: string) => void;
}> = ({ profile, activeId, version, onSelect, onNewChat, onRemoved }) => {
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
      // Reported whatever came back, deliberately. The proxy collapses every
      // non-2xx into one { error } shape, and each of them means this id is
      // unusable to this caller from here on: it was deleted, or the bridge
      // answered "not found" (already gone, or never this caller's: the same
      // answer on purpose, so the route cannot be walked for ids), or the
      // bridge is unreachable and no session resumes anyway. Waiting for a
      // clean 200 would leave the pane pointed at a dead id in the two cases
      // that need the reset most.
      onRemoved(id);
      mutate();
    },
    [fetch, mutate, onRemoved]
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
                {/* hover-revealed 16px x: prunes the rail entry via the DELETE
                    proxy. The transcript file on the host survives, but the
                    entry was the record of who owns the session, so removing it
                    also ends resuming it from the web chat, since the bridge
                    resumes only what its index says the caller owns. */}
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
