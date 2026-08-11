'use client';

import { EventEmitter } from 'events';
import { useEffect, useState } from 'react';
import { useVariables } from '@gitroom/react/helpers/variable.context';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { ChatbaseComponent } from '@gitroom/frontend/components/layout/chatbase.component';
import './support.scss';
export const supportEmitter = new EventEmitter();

/**
 * Buffer parity r1 — the floating help launcher. Buffer floats a single
 * "Helpcenter" bubble bottom-RIGHT on every view: ~36px circle, light-blue
 * #def0ff fill, dark-blue circled-"?" glyph (the hexes are Buffer's own —
 * sanctioned hardcodes, the bubble is self-colored in both themes).
 *
 * - Chatbase deployments keep the embed (script + widget); support.scss
 *   restyles the injected launcher into the same bubble.
 * - Discord deployments get the bubble rendered here (was a 194×58 pill).
 */
export const Support = () => {
  const [show, setShow] = useState(true);
  const { discordUrl, isChatBase } = useVariables();
  const t = useT();

  useEffect(() => {
    supportEmitter.on('change', setShow);
    return () => {
      supportEmitter.off('change', setShow);
    };
  }, []);
  if (isChatBase) {
    // Keep the widget mounted while hidden (its embed script + the scoped
    // launcher restyle live inside it); hide via CSS so `supportEmitter`
    // works for Chatbase exactly like it does for the Discord bubble.
    // Doubled id selector out-specifies the launcher restyle's own
    // !important rules regardless of document order.
    return (
      <>
        <ChatbaseComponent />
        {!show && (
          <style
            dangerouslySetInnerHTML={{
              __html: `#chatbase-bubble-button#chatbase-bubble-button, #chatbase-bubble-window#chatbase-bubble-window, #chatbase-message-bubbles#chatbase-message-bubbles { display: none !important; }`,
            }}
          />
        )}
      </>
    );
  }
  if (!discordUrl || !show) return null;
  return (
    <button
      id="support-discord"
      type="button"
      aria-label={t('support', 'Support')}
      title={t('discord_support', 'Discord Support')}
      onClick={() => window.open(discordUrl)}
      className="fixed end-[20px] bottom-[20px] z-[500] w-[36px] h-[36px] rounded-full flex items-center justify-center bg-[#def0ff] text-[#004781] shadow-[0_2px_8px_rgba(0,0,0,0.15)] cursor-pointer transition-transform duration-150 hover:scale-105"
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
        <path d="M12 17h.01" />
      </svg>
    </button>
  );
};
