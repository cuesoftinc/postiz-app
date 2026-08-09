'use client';

import { CSSProperties, FC, ReactNode } from 'react';
import clsx from 'clsx';

/**
 * Fork-owned (cuesoft). The standard modal-body column, replacing the
 * hand-copied `flex flex-col gap-[16px] min-w-[500px] phone:min-w-0
 * phone:w-[calc(100vw-64px)]` recipe (impersonate x3, import-debug-post,
 * announcement.banner, agent.media, first.billing, calendar DebugJson).
 *
 * The point of the component: whenever `width` or `maxWidth` is set, the
 * phone fallback (`phone:min-w-0 phone:w-[calc(100vw-64px)]`) is baked in and
 * impossible to forget — announcement.banner shipped a live mobile overflow
 * by dropping exactly that suffix.
 *
 * Implementation notes:
 * - `width`/`maxWidth` land as min-width/max-width through CSS vars consumed
 *   by static min-w/max-w arbitrary-value classes reading those vars (Tailwind
 *   can't JIT dynamic `min-w-[500px]` strings). Being classes — not inline
 *   min-width/max-width — the `phone:` overrides still beat them, exactly
 *   like the literal `min-w-[500px] phone:min-w-0` recipe they replace.
 * - `gap` renders as a literal gap arbitrary-value class when N is one of the values
 *   in use around modals (8/10/12/16/20/24) so the global.scss size ladder
 *   keeps applying to it (the ladder rescales `gap-[20px]`/`gap-[24px]` to
 *   16px; a swapped site must stay pixel-identical, ladder included). Other
 *   values fall back to an inline style — which the ladder does NOT touch —
 *   so stick to the mapped values unless bypassing the ladder is deliberate.
 */

/** Gaps rendered as real classes so the global.scss size ladder still applies. */
const GAP_CLASSES: Record<number, string> = {
  8: 'gap-[8px]',
  10: 'gap-[10px]',
  12: 'gap-[12px]',
  16: 'gap-[16px]',
  20: 'gap-[20px]',
  24: 'gap-[24px]',
};

const toPx = (value: number | string) =>
  typeof value === 'number' ? `${value}px` : value;

export const ModalBody: FC<{
  /** Becomes min-width (px when numeric). Adds the phone fallback. */
  width?: number | string;
  /** Becomes max-width (px when numeric). Adds the phone fallback. */
  maxWidth?: number | string;
  /** Column gap in px; default 16. See GAP_CLASSES for ladder-safe values. */
  gap?: number;
  className?: string;
  children: ReactNode;
}> = ({ width, maxWidth, gap = 16, className, children }) => {
  const hasWidth = typeof width !== 'undefined';
  const hasMaxWidth = typeof maxWidth !== 'undefined';
  const gapClass = GAP_CLASSES[gap];

  const style: CSSProperties = {
    ...(hasWidth ? { ['--cs-modal-min-w' as string]: toPx(width) } : {}),
    ...(hasMaxWidth ? { ['--cs-modal-max-w' as string]: toPx(maxWidth) } : {}),
    ...(!gapClass ? { gap } : {}),
  };

  return (
    <div
      className={clsx(
        'flex flex-col',
        gapClass,
        hasWidth && 'min-w-[var(--cs-modal-min-w)]',
        hasMaxWidth && 'max-w-[var(--cs-modal-max-w)]',
        // the mobile fallback the pasted recipes kept forgetting — baked in
        (hasWidth || hasMaxWidth) && 'phone:min-w-0 phone:w-[calc(100vw-64px)]',
        className
      )}
      {...(Object.keys(style).length ? { style } : {})}
    >
      {children}
    </div>
  );
};
