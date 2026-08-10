'use client';

import { FC } from 'react';
import clsx from 'clsx';

/**
 * Fork-owned (cuesoft). The Mantine-legacy modal X button, extracted verbatim
 * from the ~10 byte-identical copies pasted around the app (the canonical one
 * lives in layout/new-modal.tsx; twins in add.provider UrlModal, signatures,
 * comment.component, finish.trial, bot.picture, dummy.code, onboarding.modal,
 * post.url.selector, linkedin.component).
 *
 * Pixel parity contract: with no props beyond `onClick` this renders the exact
 * class string + 16x16 X svg the pasted copies use — `absolute end-[20px]
 * top-[20px]` and the legacy `mantine-*` classes preserved verbatim so nothing
 * moves when a site swaps to it.
 *
 * Site variations are covered by props, not new markup:
 * - `offset` shifts the absolute position via inline style (inline wins over
 *   the default classes). E.g. comment.component uses top 15; finish.trial
 *   uses top/end 10.
 * - `className` appends extras such as the `bg-primary` some twins carry
 *   (finish.trial, linkedin.component, post.url.selector).
 */
export const ModalCloseButton: FC<{
  onClick: () => void;
  /** Shift the absolute position (px). Defaults: end 20 / top 20. */
  offset?: {
    top?: number;
    end?: number;
  };
  className?: string;
}> = ({ onClick, offset, className }) => {
  return (
    <button
      className={clsx(
        'outline-none absolute end-[20px] top-[20px] mantine-UnstyledButton-root mantine-ActionIcon-root hover:bg-tableBorder cursor-pointer mantine-Modal-close mantine-1dcetaa',
        className
      )}
      {...(offset
        ? {
            style: {
              ...(typeof offset.top !== 'undefined' ? { top: offset.top } : {}),
              // matches the logical `end` inset utility (RTL-safe)
              ...(typeof offset.end !== 'undefined'
                ? { insetInlineEnd: offset.end }
                : {}),
            },
          }
        : {})}
      type="button"
      onClick={onClick}
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
      >
        <path d="M18 6 6 18" />
        <path d="m6 6 12 12" />
      </svg>
    </button>
  );
};
