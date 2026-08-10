'use client';

import { FC, useEffect, useRef, useState } from 'react';
import * as Sentry from '@sentry/nextjs';
import { useVariables } from '@gitroom/react/helpers/variable.context';

export const AttachToFeedbackIcon: FC = () => {
  const { sentryDsn } = useVariables();
  const [feedback, setFeedback] = useState<any>();
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!sentryDsn) return;
    try {
      const fb = (Sentry as any).getFeedback?.();
      setFeedback(fb);
    } catch (e) {
      setFeedback(undefined);
    }
  }, [sentryDsn]);

  useEffect(() => {
    if (feedback && buttonRef.current) {
      const unsubscribe = feedback.attachTo(buttonRef.current);
      return unsubscribe;
    }
    return () => {};
  }, [feedback]);

  if (!sentryDsn) return null;

  return (
    <button
      ref={buttonRef}
      type="button"
      aria-label="Feedback"
      className="hover:text-newTextColor"
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
        <path d="M16 10a2 2 0 0 1-2 2H6.414a1 1 0 0 0-.707.293L3 15V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2z" />
        <path d="M20 9a2 2 0 0 1 2 2v11l-2.707-2.707a1 1 0 0 0-.707-.293H10a2 2 0 0 1-2-2v-1" />
      </svg>
    </button>
  );
};
