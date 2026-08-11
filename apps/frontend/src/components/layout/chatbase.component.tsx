'use client';

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    chatbase: any;
  }
}

import { FC, useCallback, useEffect, useState } from 'react';
import Script from 'next/script';
import { useVariables } from '@gitroom/react/helpers/variable.context';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { deleteDialog } from '@gitroom/react/helpers/delete.dialog';
import useSWR from 'swr';

/* Buffer help-bubble slot for the injected Chatbase launcher (Buffer floats a
   ~44px light "?" circle bottom-RIGHT; Chatbase's default is a dark circle
   bottom-LEFT with its bot glyph). Repositions to bottom-right at a 16px
   inset, light surface + hairline, hides the embedded branding glyph and
   draws an ink circled-"?" instead. The bubble is self-colored in both themes
   (sanctioned hardcodes, same precedent as the Discord bubble in support.tsx).

   Degrades gracefully: every rule is keyed on Chatbase's stable element ids
   (#chatbase-bubble-button / -window / -message-bubbles); if the embed ever
   changes its DOM the selectors simply match nothing and the widget renders
   its own default launcher, no errors. The <style> mounts only alongside the
   widget itself (CHATBASE_TOKEN gate + token fetch), so self-hosted
   deployments without Chatbase never carry the override. */
const launcherOverride = `
#chatbase-bubble-button {
  left: auto !important;
  right: 16px !important;
  bottom: 16px !important;
  /* The embed inlines zIndex 2147483646, which floats the launcher over the
     modal layer (new-modal.tsx stacks at 200+) and let it cover the create
     post footer CTA. Cap it at 199 - the CEILING of the fixed page furniture
     band (150-199, canonical z scale in global.scss) - so it can never
     overlap a modal; the Support emitter additionally hides it while a
     modal is open. */
  z-index: 199 !important;
  width: 44px !important;
  height: 44px !important;
  min-width: 0 !important;
  border-radius: 9999px !important;
  background: #ffffff !important;
  border: 1px solid rgba(43, 32, 17, 0.12) !important;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15) !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  transition: transform 0.15s ease-in-out !important;
}

#chatbase-bubble-button:hover {
  transform: scale(1.05);
}

/* hide the embedded bot glyph / branding and draw the circled "?" ourselves */
#chatbase-bubble-button img,
#chatbase-bubble-button svg {
  display: none !important;
}

#chatbase-bubble-button::after {
  content: '?';
  box-sizing: border-box;
  width: 20px;
  height: 20px;
  border: 2px solid #292928;
  border-radius: 9999px;
  color: #292928;
  font-size: 12px;
  font-weight: 650;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* the chat window + proactive message bubbles follow the launcher's corner */
#chatbase-bubble-window,
#chatbase-message-bubbles {
  left: auto !important;
  right: 16px !important;
}
`;

export const ChatbaseComponent: FC = () => {
  const { isChatBase } = useVariables();
  if (!isChatBase) {
    return null;
  }
  return <ChatbaseComponentLoad />;
};
export const ChatbaseComponentLoad: FC = () => {
  const fetch = useFetch();

  const { data } = useSWR(
    'chatbase-token',
    async () => {
      const { token } = await (await fetch('/user/chatbase-token')).json();

      return token;
    },
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      revalidateIfStale: false,
      refreshWhenHidden: false,
      refreshWhenOffline: false,
      refreshInterval: 0,
    }
  );

  if (!data) {
    return null;
  }

  return <ChatBaseCode token={data} />;
};

const ChatBaseCode: FC<{ token: string }> = ({ token }) => {
  const fetch = useFetch();

  useEffect(() => {
    if (!window.chatbase || window.chatbase('getState') !== 'initialized') {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      window.chatbase = (...arg) => {
        if (!window.chatbase.q) {
          window.chatbase.q = [];
        }
        window.chatbase.q.push(arg);
      };
      window.chatbase = new Proxy(window.chatbase, {
        get(target, prop) {
          if (prop === 'q') {
            return target.q;
          }
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          return (...args) => target(prop, ...args);
        },
      });
    }
    const onLoad = function () {
      const script = document.createElement('script');
      script.src = 'https://www.chatbase.co/embed.min.js';
      script.id = '1zVZuOz0vgFE_NLumfPPj';
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      script.domain = 'www.chatbase.co';
      document.body.appendChild(script);
    };
    if (document.readyState === 'complete') {
      onLoad();
    } else {
      window.addEventListener('load', onLoad);
    }

    window.chatbase('identify', { token });

    window.chatbase('registerTools', {
      stripe_refund: async () => {
        try {
          const previewResponse = await fetch('/billing/chatbase-refund/preview');

          if (!previewResponse.ok) {
            return {
              status: 'error',
              error: 'Could not process the refund request',
            };
          }

          const preview = await previewResponse.json();

          if (!preview.eligible) {
            return {
              status: 'success',
              data: { refunded: false, reason: preview.reason },
            };
          }

          const approved = await deleteDialog(
            `You are cancelling your ${
              preview.tier || ''
            } subscription and will receive a refund of ${preview.amount} ${(
              preview.currency || ''
            ).toUpperCase()}. Do you approve?`,
            'Yes, cancel and refund',
            'Cancel subscription'
          );

          if (!approved) {
            return {
              status: 'success',
              data: {
                refunded: false,
                reason: 'The user declined the refund confirmation',
              },
            };
          }

          const response = await fetch('/billing/chatbase-refund', {
            method: 'POST',
          });

          if (!response.ok) {
            return {
              status: 'error',
              error: 'Could not process the refund request',
            };
          }

          return {
            status: 'success',
            data: await response.json(),
          };
        } catch (err) {
          return {
            status: 'error',
            error: 'Could not process the refund request',
          };
        }
      },
    });
  }, []);
  // scoped launcher restyle rides along with the widget itself
  return <style dangerouslySetInnerHTML={{ __html: launcherOverride }} />;
};
