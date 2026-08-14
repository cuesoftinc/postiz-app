'use client';

import {
  FC,
  KeyboardEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
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
import { Skeleton } from '@gitroom/frontend/components/layout/skeleton';
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

/** A session this user cannot resume, told apart from every other failure that
 *  arrives in the same {type:'error'} frame.
 *
 *  The bridge answers a resume it does not own with a 403 (server.mjs: "session
 *  not found for this user"), which also covers an id that is not in its index
 *  at all (pruned from the rail, evicted by the per-owner cap, or a legacy
 *  ownerless record), and the proxy turns that into the product-language
 *  message matched here (copilot.controller.ts content-chat). The HTTP status
 *  cannot be used instead: the proxy flushes the SSE headers BEFORE it calls
 *  the bridge, so every one of these turns is a 200 to the browser and the
 *  message is the only thing that distinguishes them.
 *
 *  Matched on the distinctive phrase of each, not on the whole sentence, so a
 *  copy edit on either side does not silently turn this back into "try again in
 *  a moment" for a state that never resolves. Not looser than that: the bridge
 *  also reports a FAILED TURN through the same frame, carrying the child's own
 *  words, and a stray phrase in those must not cost a live session its id (the
 *  caller pairs this with "did this turn even try to resume"). */
const REFUSED_SESSION = /belongs to another user|not found for this user/i;

/** Messages per history page. One page has to fill the pane on open — a page
 *  that stops above the fold reads as a broken transcript, since the reader
 *  cannot see that there is a Load-earlier control above them — and 40 covers a
 *  tall desktop pane with room to spare. The bridge caps it at 200 and pages
 *  backwards from there (postiz/bridge/README.md). */
const HISTORY_PAGE = 40;

/** The bridge normalises its transcripts into exactly the shape below, so a
 *  replayed turn renders through the same branches as a streamed one. Trusted for
 *  its SHAPE and nothing else: anything unrecognised is dropped rather than
 *  rendered, and `workingDone` is stamped here rather than read, because a
 *  replayed turn is finished by definition and a false value would put a live
 *  activity panel on a message from last week. */
const historyMessages = (raw: unknown): ChatMessage[] =>
  Array.isArray(raw)
    ? raw.flatMap((m: any): ChatMessage[] => {
        if (!m || typeof m.text !== 'string') return [];
        if (m.role === 'user') return [{ role: 'user' as const, text: m.text }];
        if (m.role !== 'assistant') return [];
        return [
          {
            role: 'assistant' as const,
            text: m.text,
            ...(typeof m.working === 'string' && m.working
              ? { working: m.working }
              : {}),
            workingDone: true,
          },
        ];
      })
    : [];

/** Claude Code content chat (every org user): each message drives a headless
 *  Claude Code turn on the host via the loopback bridge; deltas stream in
 *  live and the bridge session id keeps the thread continuous. One instance
 *  per bridge profile ('content' drafts, 'assistant' operates the schedule). */
export const ContentChatComponent: FC<{
  /** Which bridge profile the turns run under (README: postiz/bridge). */
  profile?: BridgeProfile;
  /** The page owns which session is open (sessions rail). When this changes to a
      session this pane is not already on, the pane resumes it AND replays it: the
      bridge's history route hands back that session's own past messages, already
      in this component's message shapes, newest page first. Only when that cannot
      be read does the pane fall back to the one-line notice it used to show
      always. */
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

  // Replayed history (the sessions rail opening a past conversation). Kept in its
  // own state, never derived from `messages`, so that nothing about typing or
  // taking a turn can reach it: the ONE thing that loads a transcript is the
  // session identity changing, which is a single effect with a single guard.
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyCursor, setHistoryCursor] = useState<string | null>(null);
  const [historyMore, setHistoryMore] = useState(false);
  const [historyPartial, setHistoryPartial] = useState(false);
  // bumped ONLY by a session switch, deliberately not shared with runRef: runRef
  // also moves on every send, and a user who types while their history is still
  // arriving must not lose the transcript to their own message
  const historyRunRef = useRef(0);
  // scroll work that must land in the same commit as a history page, and before
  // the browser paints. `prepend` is the list's scrollHeight from just before an
  // older page went in, or null for the first page of a session.
  const historyPaintRef = useRef<{ prepend: number | null } | null>(null);
  const [historyPaint, setHistoryPaint] = useState(0);

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

  // A history page has to be placed before the frame is drawn, which is why this
  // is a LAYOUT effect: as a passive one, the reader saw the list at its old
  // offset for a frame first — the newest message arriving already scrolled past
  // on open, and an older page shoving the whole conversation down under the
  // cursor. Older pages also clear the stick-to-bottom flag, which is both true
  // (the reader is at the top, reading upwards) and what stops the effect above
  // from dragging them back to the newest message in the same commit.
  useLayoutEffect(() => {
    const el = listRef.current;
    const job = historyPaintRef.current;
    if (!el || !job) return;
    historyPaintRef.current = null;
    if (job.prepend === null) {
      el.scrollTop = el.scrollHeight;
    } else {
      el.scrollTop += el.scrollHeight - job.prepend;
      stickToBottomRef.current = false;
    }
  }, [historyPaint]);

  /** Fetch one page of a session's messages. `cursor` null is the newest page,
   *  which REPLACES the pane; a cursor prepends an older page above what is
   *  already there. A failure degrades to the one-line notice this pane showed
   *  before it could replay anything, rather than leaving a resumed session
   *  looking empty. */
  const loadHistory = useCallback(
    async (id: string, cursor: string | null, run: number) => {
      // Every way this can fail, in one place. The Load-earlier control always
      // goes away, because a page that did not arrive is not a page the reader
      // can be invited to ask for again. A notice REPLACES the pane only on the
      // newest page: a failed older page leaves the conversation that did load
      // sitting exactly where it is, which is worth more than the explanation.
      const degrade = (code?: string) => {
        setHistoryMore(false);
        setHistoryCursor(null);
        if (cursor) return;
        setMessages([
          {
            role: 'system',
            text:
              code === 'session_not_found'
                ? t(
                    'content_history_gone',
                    'That conversation is no longer available.'
                  )
                : t(
                    'content_chat_resumed',
                    'Resumed session; earlier messages are on this thread but not shown here.'
                  ),
          },
        ]);
      };
      setHistoryLoading(true);
      try {
        const qs = new URLSearchParams({ limit: String(HISTORY_PAGE) });
        if (cursor) qs.set('cursor', cursor);
        const data = await (
          await fetch(
            `/copilot/content-sessions/${encodeURIComponent(
              id
            )}/history?${qs.toString()}`
          )
        ).json();
        // the pane moved to another session while this was in flight
        if (historyRunRef.current !== run) return;
        if (!data || data.error || !Array.isArray(data.messages)) {
          degrade(typeof data?.code === 'string' ? data.code : undefined);
          return;
        }
        const page = historyMessages(data.messages);
        setHistoryMore(!!data.hasMore && typeof data.cursor === 'string');
        setHistoryCursor(typeof data.cursor === 'string' ? data.cursor : null);
        // `complete` is a property of the conversation, not of the page, so it is
        // taken from whichever page answered last and reported the same either way
        setHistoryPartial(data.complete === false);
        const el = listRef.current;
        historyPaintRef.current = {
          prepend: cursor ? (el ? el.scrollHeight : 0) : null,
        };
        setMessages((list) => (cursor ? [...page, ...list] : page));
        setHistoryPaint((n) => n + 1);
      } catch {
        if (historyRunRef.current !== run) return;
        degrade();
      } finally {
        if (historyRunRef.current === run) setHistoryLoading(false);
      }
    },
    [fetch, t]
  );

  const loadEarlier = useCallback(() => {
    const id = sessionRef.current;
    if (!id || !historyCursor || historyLoading) return;
    loadHistory(id, historyCursor, historyRunRef.current);
  }, [historyCursor, historyLoading, loadHistory]);

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

  // every history affordance resets with the pane, or a fresh chat would offer to
  // load the previous conversation's earlier pages into it
  const resetHistory = useCallback(() => {
    historyRunRef.current++;
    historyPaintRef.current = null;
    setHistoryLoading(false);
    setHistoryCursor(null);
    setHistoryMore(false);
    setHistoryPartial(false);
  }, []);

  const newChat = useCallback(() => {
    runRef.current++;
    sessionRef.current = null;
    stickToBottomRef.current = true;
    resetHistory();
    setMessages([]);
    setStreaming(false);
    onSessionChange?.(null);
  }, [onSessionChange, resetHistory]);

  // the header's New chat (agent.tsx actions cluster) drives the reset —
  // the pane carries no control strip of its own
  useEffect(() => {
    registerReset?.(newChat);
    return () => registerReset?.(null);
  }, [registerReset, newChat]);

  // resume wiring: the page (sessions rail) hands down which session is open, and
  // the pane REPLAYS it — the transcript was always on disk, and until the bridge
  // grew a history route this showed a one-line notice next to an Ace who
  // silently remembered every word of it.
  //
  // THE ONE GUARD, and it carries the no-refetch requirement on its own: the
  // effect returns immediately unless the id it is handed differs from the one the
  // pane is already on. That covers the echo-back of an id this pane just minted
  // (onSessionChange -> page -> prop), which is how a brand new chat avoids
  // fetching history for the conversation it is itself in the middle of writing,
  // and it covers a re-run from the dependencies below, since `loadHistory`
  // closes over the translator and the fetch helper and neither changing is a
  // reason to load anything. Nothing here is keyed on `messages` or `input`, so a
  // keystroke and a finished turn cannot reach this effect at all.
  useEffect(() => {
    if (activeSessionId === undefined) return; // uncontrolled usage
    if ((activeSessionId || null) === sessionRef.current) return;
    runRef.current++;
    setStreaming(false);
    stickToBottomRef.current = true;
    sessionRef.current = activeSessionId || null;
    resetHistory();
    setMessages([]);
    if (!activeSessionId) return;
    loadHistory(activeSessionId, null, historyRunRef.current);
  }, [activeSessionId, loadHistory, resetHistory]);

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
    // captured before the request: ONLY a turn that tried to resume an id can
    // be refused for ownership, so this is what tells a real refusal apart from
    // a failed turn whose text happens to read like one. A first message has no
    // id to refuse, and a mint mid-turn must not change the answer.
    const resumedId = sessionRef.current;
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
    // THE TURN ENDS ON AN EVENT, NOT ON THE SOCKET. The bridge's SSE contract
    // (postiz/bridge/server.mjs) closes every turn with exactly one terminal
    // event: 'done' (carrying result + sessionId) when the child finished, or
    // 'error' when it could not start, exited without a result, or reported the
    // turn itself as failed. The backend proxy emits that same 'error' shape for
    // its own two answers: the bridge unreachable, and a resume this user does
    // not own (see REFUSED_SESSION, and `fail` below for why the two must not
    // read alike). Its ': keepalive' comment frames carry no `data:` line, so
    // they fall out at the filter below. Gating the reveal on the stream
    // closing instead made a dropped connection indistinguishable from a
    // finished turn: whatever narration happened to be buffered was published
    // as the reply.
    let doneEvent = false;
    let failed = false;

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
    // the notice REPLACES the empty assistant placeholder rather than landing
    // under it, so a failed turn never leaves a blank reply standing
    const showNotice = (text: string) =>
      setMessages((list) => [
        ...list.filter(
          (m, i) => !(i === list.length - 1 && m.role === 'assistant' && !m.text)
        ),
        { role: 'system', text },
      ]);
    // one notice per turn, wherever the failure is noticed (an 'error' event,
    // a throw, or a close with no terminal event), and the RIGHT notice, which
    // needs the server's own message.
    //
    // A refused session and an unreachable bridge arrive in the same
    // {type:'error',message} frame and are nothing alike. The refusal is FINAL:
    // the id this pane holds will never become resumable (see REFUSED_SESSION),
    // so the offline copy sent the user to wait for something that cannot
    // resolve, with no way out but a reload. It is also the only failure that
    // has a recovery, and the pane can take it: dropping the id leaves a
    // working chat, and the user is told why in the same breath.
    //
    // Everything else keeps the generic notice ON PURPOSE. The bridge's own
    // error text carries a child exit code and a stderr tail (server.mjs), i.e.
    // paths and tool names, and no user-facing string in this product may
    // expose those, so an unrecognised message is reported, never printed.
    const fail = (reported?: string, code?: string) => {
      if (failed) return;
      failed = true;
      // `code` is the primary signal and REFUSED_SESSION is the fallback. The
      // proxy now stamps every error frame with a machine-readable code
      // (session_refused / bridge_offline), which is what this should branch on;
      // the phrase match stays because the bridge may be restarted out of step
      // with the backend, and during that window an older frame arrives with no
      // code at all. Delete the regex once both have been deployed together.
      const refused =
        code === 'session_refused' ||
        (!code && !!reported && REFUSED_SESSION.test(reported));
      if (resumedId && refused) {
        // drop the dead id FIRST so the next turn opens a fresh session
        // instead of being refused again. Echoing null up matches what the
        // pane already does for a mint, and because sessionRef is already null
        // the round trip back through activeSessionId is a no-op, which is
        // what keeps this explanation on screen.
        //
        // The transcript above it STAYS: several turns of drafted copy can be
        // sitting in this pane (the session can go unusable long after it was
        // minted, e.g. pruned from the rail in another tab), and a session the
        // user cannot resume is no reason to clear work off their screen.
        sessionRef.current = null;
        showNotice(
          `${reported.trim().replace(/\s*\.?$/, '')}. ${t(
            'content_session_refused',
            'Started a new chat so you can carry on.'
          )}`
        );
        onSessionChange?.(null);
        return;
      }
      showNotice(
        t(
          'content_bridge_offline',
          'Ace is unavailable right now. Please try again in a moment.'
        )
      );
    };
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
          if (evt.type === 'done') {
            doneEvent = true;
            if (typeof evt.result === 'string') finalResult = evt.result;
          }
          if (
            (evt.type === 'session' || evt.type === 'done') &&
            evt.sessionId &&
            evt.sessionId !== sessionRef.current
          ) {
            sessionRef.current = evt.sessionId;
            onSessionChange?.(evt.sessionId);
          }
          if (evt.type === 'error')
            fail(
              typeof evt.message === 'string' ? evt.message : undefined,
              typeof evt.code === 'string' ? evt.code : undefined
            );
        }
      }
    } catch {
      // a read that threw after 'done' still delivered the turn
      if (runRef.current === run && !doneEvent) fail();
    }
    if (runRef.current !== run) return;
    if (!doneEvent) {
      // the stream ended without its terminal event: a dropped proxy
      // connection, a restarted bridge, a killed child. fail() is a no-op if
      // an 'error' event already said so, and it takes the empty assistant
      // placeholder with it, so nothing is revealed as an answer.
      fail();
    } else {
      // whatever text no tool followed is the answer, type it into the body
      const answer = ((finalResult ?? '') || buffer).trim();
      buffer = '';
      if (answer) await typeAnswer(answer);
      if (runRef.current !== run) return;
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
    }
    setStreaming(false);
    onTurnEnd?.();
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
      //
      // min-w-0 IS WHAT KEEPS THIS PANE INSIDE THE PHONE. It is a flex item of
      // agent.tsx's `flex flex-1 min-w-0` row, so without it `min-width: auto`
      // resolves to this column's min-content width — and the composer sets
      // that floor, because the textarea below is `flex-1` with the same
      // automatic minimum (a bare <textarea> has an intrinsic cols-based
      // width). Measured at a 402px viewport: the pane refused to shrink below
      // 501px inside a 378px parent, so the document scrolled to 513px, the
      // self-end user bubble ended at x=509 (clipped off the right edge) and
      // every markdown table went with it — the table's own scroll container
      // was working, it was just off-screen. Both min-w-0 are required: this
      // one lets the pane shrink, the textarea's lets the composer shrink
      // inside it. With them the pane measures 378px and nothing overflows.
      className="flex flex-col flex-1 min-w-0 min-h-0 px-[16px] pb-[12px] phone:h-[65dvh] phone:px-[4px]"
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
        {/* Opening a past conversation. A SKELETON, not a spinner, and shaped
            like the messages it is standing in for — the same choice the sessions
            rail makes for the same reason (sessions-rail.component.tsx). It also
            has to hold the pane's full height, or the empty state below would
            flash in behind it for the length of the fetch. */}
        {historyLoading && messages.length === 0 && (
          <div className="flex-1 flex flex-col gap-[16px] py-[8px]">
            {[
              // alternating user/assistant widths, so the wait reads as a
              // conversation arriving rather than as a blank pane
              'self-end items-end w-[70%]',
              'self-start w-[85%]',
              'self-end items-end w-[55%]',
            ].map((shape, i) => (
              <div
                key={i}
                className={clsx('flex flex-col gap-[6px] min-w-0', shape)}
              >
                <Skeleton className="h-[14px] w-full" />
                <Skeleton
                  className={clsx('h-[14px]', i % 2 === 0 ? 'w-[60%]' : 'w-[80%]')}
                />
              </div>
            ))}
            <span className="sr-only">
              {t('loading_conversation', 'Loading this conversation…')}
            </span>
          </div>
        )}
        {/* Older pages, above the oldest message on screen. Present only once
            there IS something on screen: on an empty pane the skeleton above is
            already saying the same thing. */}
        {messages.length > 0 && historyMore && (
          <button
            type="button"
            onClick={loadEarlier}
            disabled={historyLoading}
            data-cs
            className="self-center shrink-0 h-[28px] phone:h-[44px] px-[10px] rounded-[8px] border border-newTableBorder text-[12px] font-[550] text-newTextColor/60 hover:text-newTextColor hover:bg-boxHover transition-colors duration-150 disabled:opacity-40"
          >
            {historyLoading
              ? t('loading_earlier_messages', 'Loading earlier messages…')
              : t('load_earlier_messages', 'Load earlier messages')}
          </button>
        )}
        {/* THE HONEST MARKER. Shown only once there is nothing left to page back
            through, because until then "could not be recovered" would be a guess
            about pages nobody has asked for yet. A conversation reaches this
            state when it forked to a new session id before the index began
            tracking the old ones, which leaves the earlier messages on disk under
            a name nothing records (postiz/bridge/README.md). Saying so is the
            point: the alternative is presenting a fragment as the whole thread.
            The copy deliberately does NOT promise that Ace remembers the missing
            part. Whether it does depends on which transcript the next turn resumes
            from, which is exactly the thing this state means we cannot establish,
            and a reassurance nobody verified is worse than a plain statement. */}
        {messages.length > 0 && !historyMore && historyPartial && (
          <div className="self-center shrink-0 text-[13px] text-newTextColor/60 text-center px-[16px]">
            {t(
              'content_history_partial',
              'The earlier part of this conversation could not be recovered.'
            )}
          </div>
        )}
        {messages.length === 0 && !historyLoading && (
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
                  pre: (props) => (
                    <pre
                      className="my-[8px] max-w-full overflow-x-auto overscroll-x-contain"
                      {...props}
                    />
                  ),
                  blockquote: (props) => (
                    <blockquote className="border-s-[3px] border-newTableBorder ps-[10px] my-[6px] text-newTextColor/70" {...props} />
                  ),
                  hr: () => <div className="h-[1px] bg-newTableBorder my-[10px]" />,
                  // GFM tables on kit tokens: hairline borders, header wash,
                  // 14px cells; wide tables scroll inside the bubble. Ace
                  // answers with tables routinely, so on a phone this is the
                  // common path, not an edge case: a four-column table needs
                  // ~493px of min-content against a ~315px bubble, and the only
                  // reason it used to be cut off instead of scrolling was that
                  // the whole pane sat off-screen (see min-w-0 on the root).
                  // overscroll-x-contain keeps a swipe that runs out of table
                  // from turning into a page scroll.
                  table: (props) => (
                    <div className="my-[6px] max-w-full overflow-x-auto overscroll-x-contain">
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
              // system lines carry bridge wording verbatim, which can include a
              // session id or a URL with no break opportunity in it — same
              // wrapping contract as the two bubbles above so one of those
              // cannot widen the list
              className="self-center max-w-full text-center text-[13px] text-newTextColor/60 break-words [overflow-wrap:anywhere]"
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
          //
          // min-w-0: a textarea's `min-width: auto` is its cols-based intrinsic
          // width (~420px as measured here), so `flex-1` alone cannot shrink it
          // and it set the whole pane's minimum — see the note on the pane root.
          className="cs-chat-textarea flex-1 min-w-0 resize-none bg-transparent outline-none text-[14px] leading-[24px] text-newTextColor placeholder:text-textItemBlur p-[4px] min-h-[56px]"
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
