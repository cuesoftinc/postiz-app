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
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useUser } from '@gitroom/frontend/components/layout/user.context';
import { useT } from '@gitroom/react/translation/get.transation.service.client';

type ChatMessage = {
  role: 'user' | 'assistant' | 'system';
  text: string;
};

/** Claude Code content chat (admin-only): each message drives a headless
 *  Claude Code turn on the host via the loopback bridge; deltas stream in
 *  live and the bridge session id keeps the thread continuous. */
export const ContentChatComponent: FC = () => {
  const t = useT();
  const fetch = useFetch();
  const user = useUser();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const sessionRef = useRef<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const newChat = useCallback(() => {
    sessionRef.current = null;
    setMessages([]);
  }, []);

  const send = useCallback(async () => {
    const message = input.trim();
    if (!message || streaming) return;
    setInput('');
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
    try {
      const response = await fetch('/copilot/content-chat', {
        method: 'POST',
        body: JSON.stringify({
          message,
          sessionId: sessionRef.current || undefined,
        }),
      });
      if (!response.ok || !response.body) throw new Error('offline');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffered = '';
      for (;;) {
        const { done, value } = await reader.read();
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
          if (evt.type === 'session' && evt.sessionId) {
            sessionRef.current = evt.sessionId;
          }
          if (evt.type === 'done' && evt.sessionId) {
            sessionRef.current = evt.sessionId;
          }
          if (evt.type === 'error') {
            setMessages((list) => [
              ...list.filter(
                (m, i) =>
                  !(i === list.length - 1 && m.role === 'assistant' && !m.text)
              ),
              {
                role: 'system',
                text: t(
                  'content_bridge_offline',
                  'Content bridge is offline — start it on the host: postiz/bridge/run.sh'
                ),
              },
            ]);
          }
        }
      }
    } catch {
      setMessages((list) => [
        ...list.filter(
          (m, i) => !(i === list.length - 1 && m.role === 'assistant' && !m.text)
        ),
        {
          role: 'system',
          text: t(
            'content_bridge_offline',
            'Content bridge is offline — start it on the host: postiz/bridge/run.sh'
          ),
        },
      ]);
    }
    setStreaming(false);
  }, [input, streaming, fetch, t]);

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
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
    <div className="flex flex-col flex-1 min-h-0">
      {/* page header — standard dimensions */}
      <div
        data-cs
        className="flex items-center gap-[10px] h-[48px] phone:h-[56px] shrink-0 select-none"
      >
        <div
          data-cs
          className="w-[40px] h-[40px] rounded-[10px] border border-newTableBorder flex items-center justify-center text-newTextColor shrink-0"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9" />
            <path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z" />
          </svg>
        </div>
        <h1
          data-cs
          className="font-display text-[20px] font-[400] text-newTextColor truncate"
        >
          {t('content', 'Content')}
        </h1>
        <div className="flex-1" />
        <button
          type="button"
          onClick={newChat}
          className="h-[32px] px-[12px] rounded-[8px] border border-newTableBorder bg-newBgColorInner text-[14px] font-[500] text-newTextColor hover:bg-boxHover transition-colors duration-150"
          data-cs
        >
          {t('new_chat', 'New chat')}
        </button>
      </div>

      {/* messages */}
      <div
        ref={listRef}
        className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-[16px] py-[16px]"
      >
        {messages.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center gap-[12px] text-center px-[24px]">
            <div className="w-[64px] h-[64px] rounded-full bg-newTextColor/5 flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-newTextColor/60">
                <path d="M12 20h9" />
                <path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z" />
              </svg>
            </div>
            <div className="text-[16px] font-[600] text-newTextColor">
              {t('content_chat_title', 'Draft content with Claude')}
            </div>
            <div className="text-[14px] text-newTextColor/60 max-w-[420px]">
              {t(
                'content_chat_hint',
                'Ask for content built from content-brief.md — e.g. "Draft week 34 posts". Sessions are read-only against the design-system repo.'
              )}
            </div>
          </div>
        )}
        {messages.map((m, i) =>
          m.role === 'user' ? (
            <div
              key={i}
              className="self-end max-w-[70%] rounded-[12px] bg-boxFocused text-textItemFocused px-[12px] py-[8px] text-[14px] whitespace-pre-wrap"
            >
              {m.text}
            </div>
          ) : m.role === 'assistant' ? (
            <div
              key={i}
              className="self-start max-w-[85%] text-[14px] text-newTextColor whitespace-pre-wrap"
            >
              {m.text}
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

      {/* composer */}
      <div className="shrink-0 rounded-[12px] border border-newTableBorder bg-newBgColorInner p-[8px] flex items-end gap-[8px]">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          rows={2}
          placeholder={t('content_chat_placeholder', 'Ask for content…')}
          className="flex-1 resize-none bg-transparent outline-none text-[14px] text-newTextColor placeholder:text-newTextColor/40 p-[4px]"
        />
        <button
          type="button"
          onClick={send}
          disabled={streaming || !input.trim()}
          aria-label={t('send', 'Send')}
          className={clsx(
            'w-[32px] h-[32px] shrink-0 rounded-[8px] bg-btnPrimary text-black flex items-center justify-center transition-opacity duration-150',
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
