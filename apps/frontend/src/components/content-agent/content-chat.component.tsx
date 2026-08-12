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
  /** The message body. For a finished assistant turn this is ONLY the final
      answer (the bridge's done.result); Ace's between-tool narration lives in
      `working` instead of polluting the transcript. */
  text: string;
  /** Ace's streamed working notes (between-tool narration). While the turn
      runs they render as a live, subdued activity panel; once the turn
      finishes they collapse behind a "Show Ace's working" toggle. */
  working?: string;
  /** True once the turn finished and `text` holds the clean final answer. */
  workingDone?: boolean;
};

export type BridgeProfile = 'content' | 'assistant' | 'post';

/** Claude Code content chat (every org user): each message drives a headless
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
  /** Prepended ONCE to the first message of a session before it goes to the
      bridge (no session id minted yet = first message). Invisible to the
      transcript: the thread renders only the user's own text. Lets an
      embedding surface (the composer's assistant pane) hand the bridge its
      live context without polluting the chat. */
  contextPrefix?: string;
  /** Copy overrides for embedding surfaces (the composer's post assistant):
      empty-state title/hint and the input placeholder. Defaults keep the
      agents-page per-profile copy. */
  emptyTitle?: string;
  emptyHint?: string;
  inputPlaceholder?: string;
}> = ({
  profile = 'content',
  activeSessionId,
  onSessionChange,
  onTurnEnd,
  registerReset,
  contextPrefix,
  emptyTitle,
  emptyHint,
  inputPlaceholder,
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
  // follow the stream only while the reader is at the bottom: scrolling up
  // to reread must not fight the typewriter. Programmatic pinning lands the
  // list back at the bottom, so the flag re-arms itself via onScroll.
  const stickToBottomRef = useRef(true);

  const onListScroll = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    stickToBottomRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  }, []);

  useEffect(() => {
    const el = listRef.current;
    if (el && stickToBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // The live working panel is height-capped; without pinning, narration past
  // the cap streams below the fold and the panel looks frozen. Pin it to the
  // newest line on every commit (only one live panel exists at a time).
  const workingRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = workingRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // transient per-message "Copied" acknowledgement for the copy affordance
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const copyMessage = useCallback((i: number, text: string) => {
    navigator.clipboard
      ?.writeText(text)
      .then(() => {
        setCopiedIdx(i);
        window.setTimeout(
          () => setCopiedIdx((c) => (c === i ? null : c)),
          1500
        );
      })
      .catch(() => {});
  }, []);

  const newChat = useCallback(() => {
    runRef.current++;
    sessionRef.current = null;
    stickToBottomRef.current = true;
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
    stickToBottomRef.current = true;
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
    // first message of a session (nothing minted/resumed yet): the context
    // prefix rides along to the bridge but never enters the transcript. If
    // the first turn fails before a session exists, the retry re-prefixes;
    // that is still the session's first message.
    const outbound =
      contextPrefix && !sessionRef.current
        ? `${contextPrefix}\n\n${message}`
        : message;
    const run = ++runRef.current;
    setInput('');
    // send keeps focus in the composer (parity with agent.input.tsx's send)
    textareaRef.current?.focus();
    // sending always returns the reader to the live end of the thread
    stickToBottomRef.current = true;
    setStreaming(true);
    setMessages((list) => [
      ...list,
      { role: 'user', text: message },
      { role: 'assistant', text: '' },
    ]);
    // TEXT CLASSIFICATION — the rule that keeps the two areas pure:
    // narration only in the working notes, the answer only in the body, and
    // NEITHER ever rendered in the other's place, not even for a frame.
    //
    // Streamed text is buffered, never rendered where it lands. A tool call
    // starting proves the buffered text was narration (Ace talks, then acts),
    // so `tool_start` commits it to the notes. Whatever is left when the turn
    // ends is the answer — no tool followed it — and only then does it type
    // into the body. This is the only classification available at stream
    // time; guessing earlier is what produced the text-hopping regressions.
    let buffer = '';
    let notes = '';
    // the clean final answer, delivered separately by the bridge's done event
    let finalResult: string | null = null;

    const appendAssistant = (chunk: string) =>
      setMessages((list) => {
        const next = [...list];
        const last = next[next.length - 1];
        if (last?.role === 'assistant') {
          next[next.length - 1] = { ...last, text: last.text + chunk };
        }
        return next;
      });
    // A tool call closes the current narration AND records the step Ace took.
    // The step matters: Ace often acts without narrating, and a working panel
    // that then had nothing to keep simply vanished at the end of the turn
    // (user report) — the notes must say what it DID, not only what it said.
    let lastStep = '';
    const commitWork = (label?: string) => {
      const chunk = buffer.trim();
      buffer = '';
      const lines: string[] = [];
      if (chunk) lines.push(chunk);
      // consecutive repeats of the same step collapse into one line
      if (label && label !== lastStep) {
        lines.push(`· ${label}`);
        lastStep = label;
      }
      if (!lines.length) return;
      notes = notes ? `${notes}\n${lines.join('\n')}` : lines.join('\n');
      setMessages((list) => {
        const next = [...list];
        const last = next[next.length - 1];
        if (last?.role === 'assistant') {
          next[next.length - 1] = { ...last, working: notes };
        }
        return next;
      });
    };
    // typewriter for the ANSWER only: a few characters per tick so it types
    // on rather than appearing at once. The step scales with what is left, so
    // the whole answer lands in ~2.5s regardless of length (24ms ticks —
    // setTimeout, not rAF: background tabs clamp timers but never stop them).
    const typeAnswer = (full: string) =>
      new Promise<void>((resolve) => {
        let i = 0;
        const tick = () => {
          if (runRef.current !== run || i >= full.length) return resolve();
          const step = Math.max(1, Math.ceil((full.length - i) / 100));
          appendAssistant(full.slice(i, i + step));
          i += step;
          setTimeout(tick, 24);
        };
        tick();
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
            'Ace is unavailable right now. Please try again in a moment.'
          ),
        },
      ]);
    try {
      const response = await fetch('/copilot/content-chat', {
        method: 'POST',
        body: JSON.stringify({
          message: outbound,
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
          if (evt.type === 'delta' && evt.text) buffer += evt.text;
          if (evt.type === 'tool_start') commitWork(evt.label);
          if (evt.type === 'done' && typeof evt.result === 'string') {
            finalResult = evt.result;
          }
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
    // whatever text no tool followed is the answer — type it into the body
    const answer = ((finalResult ?? '') || buffer).trim();
    buffer = '';
    if (runRef.current === run && answer) await typeAnswer(answer);
    if (runRef.current === run) {
      // the notes collapse behind the toggle; a turn that never narrated has
      // none, and renders as a plain message with no toggle at all
      setMessages((list) => {
        const next = [...list];
        const last = next[next.length - 1];
        if (last?.role === 'assistant' && !last.workingDone) {
          next[next.length - 1] = {
            role: 'assistant',
            text: answer || last.text,
            working: notes,
            workingDone: true,
          };
        }
        return next;
      });
      setStreaming(false);
      onTurnEnd?.();
    }
  }, [
    input,
    streaming,
    fetch,
    t,
    profile,
    contextPrefix,
    onSessionChange,
    onTurnEnd,
  ]);

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

  return (
    // pb matches the copilot pane's clearance (agent.chat.tsx pins
    // pb-[56px] under the composer for the fixed admin pill; kept for
    // everyone so the composer sits identically whoever is signed in) —
    // toggling the segmented must not move the composer
    // phone:h-[65dvh] mirrors the copilot pane's phone:min-h-[65dvh]
    // (agent.chat.tsx) — exact `h` because this pane's list is in-flow, so a
    // min-h alone would let history grow the pane past the viewport
    <div
      // px/pb: the pane's seam lines must never touch the composer box (the
      // messages align to the same inset)
      className="flex flex-col flex-1 min-h-0 px-[16px] pb-[12px] phone:h-[65dvh] phone:px-[4px]"
      data-cs
    >
      {/* messages — scrollbar chrome matches the sibling kit panes (Threads
          rail, AgentList) and the CopilotKit list (agent.styles.scss aligns
          it to the same look), so flipping the segmented never swaps
          scrollbar styles on the pane */}
      <div
        ref={listRef}
        onScroll={onListScroll}
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
              {emptyTitle ??
                (profile === 'assistant'
                  ? t('assistant_chat_title', 'Ask Ace about your schedule')
                  : t('content_chat_title', 'Draft content with Ace'))}
            </div>
            <div className="text-[14px] text-newTextColor/60 max-w-[420px]">
              {emptyHint ??
                (profile === 'assistant'
                  ? t(
                      'assistant_chat_hint',
                      'Ask about your scheduled content, e.g. "What is scheduled this week?" or "How did last week perform?"'
                    )
                  : t(
                      'content_chat_hint',
                      'Ask for content built from the content brief, e.g. "Draft week 34 posts".'
                    ))}
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
              {/* Ace's working notes. Live: a subdued activity panel that
                  streams the between-tool narration (with the caret). Done:
                  the notes collapse behind a toggle and the clean final
                  answer below stands alone (owner's pick: option C). */}
              {/* live activity: visible for the whole working phase (with
                  just the label until Ace's first narration commits), then
                  replaced by the collapsed toggle below */}
              {!m.workingDone && streaming && i === messages.length - 1 && (
                <div
                  ref={workingRef}
                  className="mb-[6px] rounded-[10px] border border-newTableBorder bg-newTableHeader/60 px-[10px] py-[8px] text-[13px] leading-[1.55] text-newTextColor/60 whitespace-pre-wrap max-h-[160px] overflow-y-auto"
                >
                  <div className="flex items-center gap-[6px] text-[12px] font-[550] text-newTextColor/50">
                    <span className="w-[6px] h-[6px] rounded-full bg-btnPrimary animate-pulse" />
                    {t('ace_working', 'Ace is working…')}
                  </div>
                  {m.working ? <div className="mt-[4px]">{m.working}</div> : null}
                </div>
              )}
              {m.workingDone && m.working ? (
                <details className="mb-[6px]">
                  {/* phone:py-[13px] lifts the 18px text line to a 44px tap
                      target (measured at 393px; iOS minimum) */}
                  <summary className="cursor-pointer select-none text-[12px] font-[550] text-newTextColor/50 hover:text-newTextColor/80 transition-colors duration-150 phone:py-[13px]">
                    {t('ace_show_working', "Show Ace's working")}
                    {(() => {
                      const steps =
                        m.working.split('\n').filter((l) => l.startsWith('· '))
                          .length || m.working.split('\n').length;
                      return ` · ${steps} ${
                        steps === 1 ? t('ace_step', 'step') : t('ace_steps', 'steps')
                      }`;
                    })()}
                  </summary>
                  <div className="mt-[6px] rounded-[10px] border border-newTableBorder bg-newTableHeader/60 px-[10px] py-[8px] text-[13px] leading-[1.55] text-newTextColor/60 whitespace-pre-wrap">
                    {m.working}
                  </div>
                </details>
              ) : null}
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
              {/* copy the finished reply — quiet ghost under the text; the
                  phone padding lifts the row to a 44px tap target */}
              {m.text && !(streaming && i === messages.length - 1) && (
                <button
                  type="button"
                  onClick={() => copyMessage(i, m.text)}
                  aria-label={t('ace_copy', 'Copy message')}
                  className="mt-[4px] -ms-[6px] h-[28px] px-[6px] rounded-[6px] flex items-center gap-[5px] text-[12px] text-newTextColor/40 hover:text-newTextColor/80 hover:bg-boxHover transition-colors duration-150 phone:h-[44px] phone:px-[10px]"
                >
                  {copiedIdx === i ? (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                      {t('ace_copied', 'Copied')}
                    </>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                    </svg>
                  )}
                </button>
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
            inputPlaceholder ??
            (profile === 'assistant'
              ? t('assistant_chat_placeholder', 'Ask Ace…')
              : t('content_chat_placeholder', 'Ask for content…'))
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
