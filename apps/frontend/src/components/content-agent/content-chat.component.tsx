'use client';

import {
  FC,
  KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import clsx from 'clsx';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import AutoResizingTextarea from '@gitroom/frontend/components/agents/agent.textarea';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useUser } from '@gitroom/frontend/components/layout/user.context';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
// .cs-chat-textarea (the shared composer scrollbar chrome) lives in the
// agents stylesheet; importing it here keeps the class defined wherever this
// pane renders, independent of the copilot page module
import '@gitroom/frontend/components/agents/agent.styles.scss';

type ChatMessage = {
  role: 'user' | 'assistant' | 'system';
  text: string;
};

export type BridgeProfile = 'content' | 'assistant';

/** Claude Code content chat (admin-only): each message drives a headless
 *  Claude Code turn on the host via the loopback bridge; deltas stream in
 *  live and the bridge session id keeps the thread continuous. One instance
 *  per bridge profile ('content' drafts, 'assistant' operates the schedule). */
export const ContentChatComponent: FC<{
  /** Which bridge profile the turns run under (README: postiz/bridge). */
  profile?: BridgeProfile;
  /** The page owns which session is open (sessions rail). When this changes
      to a session this pane is not already on, the pane resumes it: the
      bridge cannot replay a session's earlier messages, so the pane clears
      and shows a one-line resume notice instead. */
  activeSessionId?: string | null;
  /** Fired whenever the pane's session identity changes: the bridge minting
      an id for a fresh chat (and forked ids on resume), or a reset to null. */
  onSessionChange?: (id: string | null) => void;
  /** Fired when a turn finishes streaming, so the page can refresh the
      sessions rail (titles/order come from the bridge's session index). */
  onTurnEnd?: () => void;
  /** Hands the pane's session-reset up to the page header's New chat button
      (agent.tsx) — session state itself never leaves this component. */
  registerReset?: (reset: (() => void) | null) => void;
}> = ({
  profile = 'content',
  activeSessionId,
  onSessionChange,
  onTurnEnd,
  registerReset,
}) => {
  const t = useT();
  const fetch = useFetch();
  const user = useUser();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const sessionRef = useRef<string | null>(null);
  // bumping this invalidates any in-flight stream: a session switch or reset
  // must not let a stale reader keep appending into the fresh thread
  const runRef = useRef(0);
  const listRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const newChat = useCallback(() => {
    runRef.current++;
    sessionRef.current = null;
    setMessages([]);
    setStreaming(false);
    onSessionChange?.(null);
  }, [onSessionChange]);

  // the header's New chat (agent.tsx actions cluster) drives the reset —
  // the pane carries no control strip of its own
  useEffect(() => {
    registerReset?.(newChat);
    return () => registerReset?.(null);
  }, [registerReset, newChat]);

  // resume wiring: the page (sessions rail) hands down which session is
  // open. The bridge cannot replay a resumed session's messages, so the
  // pane clears and shows the one-line notice instead. The echo-back of an
  // id this pane just minted (onSessionChange -> page -> prop) is a no-op.
  useEffect(() => {
    if (activeSessionId === undefined) return; // uncontrolled usage
    if ((activeSessionId || null) === sessionRef.current) return;
    runRef.current++;
    setStreaming(false);
    sessionRef.current = activeSessionId || null;
    if (!activeSessionId) {
      setMessages([]);
      return;
    }
    setMessages([
      {
        role: 'system',
        text: t(
          'content_chat_resumed',
          'Resumed session; earlier messages are on this thread but not shown here.'
        ),
      },
    ]);
  }, [activeSessionId, t]);

  const send = useCallback(async () => {
    const message = input.trim();
    if (!message || streaming) return;
    const run = ++runRef.current;
    setInput('');
    // send keeps focus in the composer (parity with agent.input.tsx's send)
    textareaRef.current?.focus();
    setStreaming(true);
    setMessages((list) => [
      ...list,
      { role: 'user', text: message },
      { role: 'assistant', text: '' },
    ]);
    const appendAssistant = (chunk: string) =>
      setMessages((list) => {
        const next = [...list];
        const last = next[next.length - 1];
        if (last?.role === 'assistant') {
          next[next.length - 1] = { ...last, text: last.text + chunk };
        }
        return next;
      });
    const showOffline = () =>
      setMessages((list) => [
        ...list.filter(
          (m, i) => !(i === list.length - 1 && m.role === 'assistant' && !m.text)
        ),
        {
          role: 'system',
          text: t(
            'content_bridge_offline',
            'Content bridge is offline. Start it on the host: postiz/bridge/run.sh'
          ),
        },
      ]);
    try {
      const response = await fetch('/copilot/content-chat', {
        method: 'POST',
        body: JSON.stringify({
          message,
          sessionId: sessionRef.current || undefined,
          profile,
        }),
      });
      if (!response.ok || !response.body) throw new Error('offline');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffered = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (runRef.current !== run) {
          // the pane moved to another session/reset mid-stream: stop
          // applying this turn's events (the bridge finishes server-side)
          try {
            reader.cancel();
          } catch {}
          return;
        }
        if (done) break;
        buffered += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buffered.indexOf('\n\n')) !== -1) {
          const frame = buffered.slice(0, idx);
          buffered = buffered.slice(idx + 2);
          const line = frame.split('\n').find((l) => l.startsWith('data: '));
          if (!line) continue;
          let evt: any;
          try {
            evt = JSON.parse(line.slice(6));
          } catch {
            continue;
          }
          if (evt.type === 'delta' && evt.text) appendAssistant(evt.text);
          if (
            (evt.type === 'session' || evt.type === 'done') &&
            evt.sessionId &&
            evt.sessionId !== sessionRef.current
          ) {
            sessionRef.current = evt.sessionId;
            onSessionChange?.(evt.sessionId);
          }
          if (evt.type === 'error') showOffline();
        }
      }
    } catch {
      if (runRef.current === run) showOffline();
    }
    if (runRef.current === run) {
      setStreaming(false);
      onTurnEnd?.();
    }
  }, [input, streaming, fetch, t, profile, onSessionChange, onTurnEnd]);

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      // native composition flag: Enter that commits an IME conversion
      // candidate must not send (parity with agent.input.tsx's isComposing)
      if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
        e.preventDefault();
        send();
      }
    },
    [send]
  );

  if (!(user as any)?.admin) {
    return (
      <div className="flex-1 flex items-center justify-center text-[14px] text-newTextColor/60">
        {t('content_chat_admin_only', 'The content chat is admin-only.')}
      </div>
    );
  }

  return (
    // pb matches the copilot pane's admin clearance (agent.chat.tsx pins
    // pb-[56px] under the composer for the fixed admin pill; this pane is
    // admin-only, so it always needs the same dead space) — toggling the
    // segmented must not move the composer
    // phone:h-[65dvh] mirrors the copilot pane's phone:min-h-[65dvh]
    // (agent.chat.tsx) — exact `h` because this pane's list is in-flow, so a
    // min-h alone would let history grow the pane past the viewport
    <div
      // px/pb: the pane's seam lines must never touch the composer box (the
      // messages align to the same inset)
      className="flex flex-col flex-1 min-h-0 px-[16px] pb-[56px] phone:h-[65dvh] phone:px-[4px]"
      data-cs
    >
      {/* messages — scrollbar chrome matches the sibling kit panes (Threads
          rail, AgentList) and the CopilotKit list (agent.styles.scss aligns
          it to the same look), so flipping the segmented never swaps
          scrollbar styles on the pane */}
      <div
        ref={listRef}
        className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-[16px] py-[16px] scrollbar scrollbar-thumb-fifth scrollbar-track-newBgColor"
      >
        {messages.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center gap-[12px] text-center px-[24px]">
            <div className="w-[64px] h-[64px] rounded-full bg-newTextColor/5 flex items-center justify-center">
              {profile === 'assistant' ? (
                /* sparkle — the same glyph as the page-header chip */
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-newTextColor/60">
                  <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
                  <path d="M20 3v4" />
                  <path d="M22 5h-4" />
                </svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-newTextColor/60">
                  <path d="M12 20h9" />
                  <path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z" />
                </svg>
              )}
            </div>
            <div className="text-[16px] font-[600] text-newTextColor">
              {profile === 'assistant'
                ? t('assistant_chat_title', 'Ask about your schedule')
                : t('content_chat_title', 'Draft content with Claude')}
            </div>
            <div className="text-[14px] text-newTextColor/60 max-w-[420px]">
              {profile === 'assistant'
                ? t(
                    'assistant_chat_hint',
                    'Ask about your scheduled content, e.g. "What is scheduled this week?" or "How did last week perform?"'
                  )
                : t(
                    'content_chat_hint',
                    'Ask for content built from the content brief, e.g. "Draft week 34 posts".'
                  )}
            </div>
          </div>
        )}
        {messages.map((m, i) =>
          m.role === 'user' ? (
            <div
              key={i}
              className="self-end max-w-[70%] min-w-0 rounded-[12px] bg-boxFocused text-textItemFocused px-[12px] py-[8px] text-[14px] whitespace-pre-wrap break-words [overflow-wrap:anywhere]"
            >
              {m.text}
            </div>
          ) : m.role === 'assistant' ? (
            <div
              key={i}
              className="self-start max-w-[85%] min-w-0 text-[14px] text-newTextColor break-words [overflow-wrap:anywhere]"
            >
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  p: (props) => <p className="my-[6px] leading-[1.6]" {...props} />,
                  strong: (props) => <strong className="font-[550]" {...props} />,
                  h1: (props) => <div className="text-[16px] font-[600] mt-[12px] mb-[4px]" {...props} />,
                  h2: (props) => <div className="text-[15px] font-[600] mt-[12px] mb-[4px]" {...props} />,
                  h3: (props) => <div className="text-[14px] font-[600] mt-[10px] mb-[4px]" {...props} />,
                  h4: (props) => <div className="text-[14px] font-[600] mt-[10px] mb-[4px]" {...props} />,
                  h5: (props) => <div className="text-[14px] font-[600] mt-[10px] mb-[4px]" {...props} />,
                  h6: (props) => <div className="text-[14px] font-[600] mt-[10px] mb-[4px]" {...props} />,
                  ul: (props) => <ul className="list-disc ps-[20px] my-[6px] flex flex-col gap-[2px]" {...props} />,
                  ol: (props) => <ol className="list-decimal ps-[20px] my-[6px] flex flex-col gap-[2px]" {...props} />,
                  li: (props) => <li className="leading-[1.55]" {...props} />,
                  a: (props) => <a className="text-btnText hover:underline" target="_blank" rel="noreferrer" {...props} />,
                  code: ({ className, children, ...props }: any) => {
                    // v9 has no `inline` flag; fenced blocks carry a
                    // language-* class or contain newlines
                    const block =
                      /language-/.test(className || '') ||
                      /\n/.test(String(children));
                    return block ? (
                      <code className="block bg-newTableHeader border border-newTableBorder rounded-[8px] p-[10px] text-[13px] overflow-x-auto whitespace-pre" {...props}>
                        {children}
                      </code>
                    ) : (
                      <code className="bg-newTableHeader border border-newTableBorder rounded-[4px] px-[4px] py-[1px] text-[13px]" {...props}>
                        {children}
                      </code>
                    );
                  },
                  pre: (props) => <pre className="my-[8px] max-w-full overflow-x-auto" {...props} />,
                  blockquote: (props) => (
                    <blockquote className="border-s-[3px] border-newTableBorder ps-[10px] my-[6px] text-newTextColor/70" {...props} />
                  ),
                  hr: () => <div className="h-[1px] bg-newTableBorder my-[10px]" />,
                  // GFM tables on kit tokens: hairline borders, header wash,
                  // 14px cells; wide tables scroll inside the bubble
                  table: (props) => (
                    <div className="my-[6px] max-w-full overflow-x-auto">
                      <table className="w-full border-collapse text-[14px]" {...props} />
                    </div>
                  ),
                  thead: (props) => <thead className="bg-newTableHeader" {...props} />,
                  th: (props) => (
                    <th className="border border-newTableBorder px-[10px] py-[6px] text-[14px] font-[550] text-start" {...props} />
                  ),
                  td: (props) => (
                    <td className="border border-newTableBorder px-[10px] py-[6px] text-[14px]" {...props} />
                  ),
                }}
              >
                {m.text}
              </ReactMarkdown>
              {streaming && i === messages.length - 1 && (
                <span className="inline-block w-[7px] h-[14px] ms-[2px] align-middle bg-newTextColor/40 animate-pulse" />
              )}
            </div>
          ) : (
            <div
              key={i}
              className="self-center text-[13px] text-newTextColor/60"
            >
              {m.text}
            </div>
          )
        )}
      </div>

      {/* composer — the ONE shared anatomy (the CopilotKit pane renders the
          identical spec via agent.styles.scss): r12 hairline white container,
          borderless 14px ink textarea with muted placeholder, 32px lime send
          square. The list scrolls internally above it, so it needs no sticky
          wrapper. */}
      <div
        className="shrink-0 rounded-[12px] border border-newTableBorder bg-newBgColorInner p-[8px] flex items-end gap-[8px] cursor-text"
        // click-to-focus parity with agent.input.tsx's handleDivClick: any
        // non-button click on the surface focuses the textarea
        onClick={(e) => {
          if (!(e.target as HTMLElement).closest('button')) {
            textareaRef.current?.focus();
          }
        }}
      >
        <AutoResizingTextarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          maxRows={6}
          placeholder={
            profile === 'assistant'
              ? t('assistant_chat_placeholder', 'Ask your assistant…')
              : t('content_chat_placeholder', 'Ask for content…')
          }
          // min-h-[56px] restates the copilot floor here — agent.styles.scss
          // pins `.copilotKitInput > textarea { min-height: 56px }`, which
          // does not reach this pane. cs-chat-textarea = the shared overflow
          // scrollbar chrome (same file), matching the copilot textarea.
          className="cs-chat-textarea flex-1 resize-none bg-transparent outline-none text-[14px] leading-[24px] text-newTextColor placeholder:text-textItemBlur p-[4px] min-h-[56px]"
        />
        {/* Intentional asymmetry with agent.input.tsx: no Stop affordance
            here. A client-side abort cannot stop the headless bridge turn
            server-side, so the session transcript would diverge from what
            the user saw; the send square dims while streaming instead. */}
        <button
          type="button"
          onClick={send}
          disabled={streaming || !input.trim()}
          aria-label={t('send', 'Send')}
          className={clsx(
            // phone:44px — the primary action of the chat surface gets the
            // 40px+ tap floor (data-cs blocks the ladder, not plain phone:
            // utilities); desktop keeps the 32px square
            'w-[32px] h-[32px] phone:w-[44px] phone:h-[44px] shrink-0 rounded-[8px] bg-btnPrimary text-black flex items-center justify-center transition-opacity duration-150',
            (streaming || !input.trim()) && 'opacity-40'
          )}
          data-cs
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m5 12 14 0" />
            <path d="m13 6 6 6-6 6" />
          </svg>
        </button>
      </div>
    </div>
  );
};
