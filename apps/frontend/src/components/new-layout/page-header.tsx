'use client';

import { FC, ReactNode } from 'react';
import clsx from 'clsx';

/**
 * THE one page header + page container, cloned from the /launches reference
 * (launches/filters.tsx PageHeader row + launches.component.tsx page pane) —
 * the Buffer-measured rhythm: 24px top / 32px side insets, 8px between the
 * title row and whatever follows, 48px header band holding a 40px r10 hairline
 * icon chip and a 20/400 display-face title.
 *
 * Analytics, Agents, Media and Third-party all hand-rolled their own copy of
 * this anatomy with drifting dimensions (64px bars, 56px phone-only rows,
 * p-[20px] panes); they now render these two components instead.
 *
 * TWO `PageHeader` COMPONENTS EXIST, AND THEY HAVE DRIFTED. /launches keeps
 * its own (`launches/filters.tsx:1123`) because it carries page-specific
 * chrome: bookmark, segmented view switch, per-channel title. An earlier
 * revision of this docblock claimed "this file matches it exactly". It does
 * not, as of 2026-08-13:
 *
 *   |                  | this file            | launches/filters.tsx  |
 *   |------------------|----------------------|-----------------------|
 *   | band height      | h-[48px] phone:h-[56px] | h-[48px] only      |
 *   | title classes    | truncate min-w-0     | truncate (no min-w-0) |
 *   | bookmark button  | none                 | 24px "Save current view" |
 *   | title source     | `title` prop         | derived (single ?integration= → channel name, else "All Channels") |
 *
 * The 40px r10 chip, the 20/400 display title and every `data-cs` DO match.
 * The drift is in the phone band, the min-w-0 shrink chain and the bookmark.
 * If you touch either one, decide deliberately whether the other follows -
 * filters.tsx is upstream's hottest file, so "make them identical" is a real
 * rebase cost and has so far not been paid.
 *
 * `data-cs` everywhere a dimension is load-bearing: the global.scss ladder
 * would otherwise rescale h-[48px]→36, w/h-[40px]→32, rounded-[10px]→8,
 * text-[20px]→16 and px-[32px] descendants. phone:* variants escape the
 * ladder by prefix, so the 56px phone band needs no opt-out.
 */

export const PageHeader: FC<{
  /** 20px vb24 stroke-2.2 glyph, centered in the 40px chip. */
  icon: ReactNode;
  title: string;
  /** Right-side cluster after the flex-1 spacer — callers pass their existing
      primaries/controls unchanged (analytics/third-party pass none). */
  actions?: ReactNode;
  className?: string;
}> = ({ icon, title, actions, className }) => (
  <div
    data-cs
    className={clsx(
      'flex items-center gap-[10px] h-[48px] phone:h-[56px] shrink-0 select-none',
      className
    )}
  >
    <div
      data-cs
      className="w-[40px] h-[40px] rounded-[10px] border border-newTableBorder flex items-center justify-center text-newTextColor shrink-0"
    >
      {icon}
    </div>
    <h1
      data-cs
      className="font-display text-[20px] font-[400] text-newTextColor truncate min-w-0"
    >
      {title}
    </h1>
    <div className="flex-1" />
    {actions}
  </div>
);

/** Page pane matching the /launches container: white card interior with the
 *  Buffer page rhythm. Callers append className for page-specific needs
 *  (e.g. third-party's `!pb-[56px]` admin-pill clearance, agents' min-w-0). */
export const PageShell: FC<{
  children: ReactNode;
  className?: string;
}> = ({ children, className }) => (
  <div
    data-cs
    className={clsx(
      'bg-newBgColorInner flex-1 min-h-0 flex flex-col pt-[24px] px-[32px] pb-[20px] gap-[8px] phone:pt-[12px] phone:px-[12px]',
      className
    )}
  >
    {children}
  </div>
);
