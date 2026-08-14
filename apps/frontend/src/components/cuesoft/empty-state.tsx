/**
 * Cuesoft fork - shared empty-state component.
 *
 * DOC PROVENANCE (corrected 2026-08-13): "UI-CONSISTENCY-PLAN row 9" and "the
 * brand-contract hero ramp" cited documents that do not exist in this repo and
 * never did. The decisions are real and are restated inline.
 *
 * Normalizes the ~18 hand-rolled empties: one type ramp per variant and ONE
 * muted color token instead of the 9-token roulette (text-gray-400,
 * text-gray-500, text-textColor, text-textColor/60, text-newTextColor/40,
 * text-newTextColor/60, opacity-70, text-customColor18, text-red-400).
 *
 * The muted token is `text-newTextColor/60` — the app's text color at
 * reduced opacity. NOT `text-textColor/60`: `textColor` is defined as a
 * plain `var(--new-btn-text)` without `<alpha-value>` in
 * tailwind.config.cjs, so Tailwind 3.4 silently emits NO CSS for its
 * opacity-modified classes (verified against 3.4.17 — the 17 existing
 * `text-textColor/NN` usages render at full strength). `--new-textColor`
 * and `--new-btn-text` are the same color in both themes (colors.scss:
 * 255 255 255 / #ffffff dark, 14 14 14 / #0e0e0e light), and `newTextColor`
 * is alpha-capable, so `text-newTextColor/60` is the working spelling of
 * "textColor at 60%".
 *
 * HERO TYPE RAMP - 16px / weight 550. One number, stated once.
 * Earlier revisions of this file disagreed with themselves: the variant list
 * said "20px/600", this note said "16/600", and the `title` prop doc said
 * "Hero: 16px/600", while the code has always rendered `text-[16px]
 * font-[550]`. All three now read 16/550, which is what ships. 550 is the kit
 * semibold (the same weight as the list day-group heading and the Buffer
 * section heading measured at 16/550), NOT 600.
 *
 * Size-ladder note: the hero title is written as `text-[16px]` directly, so it
 * is below every rung of the global.scss ladder (its type rungs start at
 * text-[18px]) and needs no `data-cs`. It renders 16px whatever the ladder
 * does. This is also where the old `text-[20px]` heroes ended up anyway -
 * the ladder rescales text-[20px] to 16px - but this file does not depend on
 * that.
 *
 * Variants (normalized from the best existing implementations):
 * - `hero` - illustration + 16px/550 title + 14px muted sub + optional
 *               CTA row; models launches.component.tsx:551 ("No channels
 *               yet") and media.component.tsx:481.
 *  - `pane`   — flex-1 centered 16px muted text; models the calendar
 *               ListView empty (calendar.tsx:525). Deliberate change per
 *               the plan: full-strength copies go muted.
 *  - `inline` — left-aligned px-[12px] py-[10px] 13px muted row for tables
 *               and dropdowns; models admin-stats.component.tsx:106.
 *
 * `tone="error"` swaps the muted token for `text-red-400` — keeps
 * import-debug-post.modal.tsx:204's red blocking-validation tone.
 *
 * Copy is passed in pre-translated (run it through `t()` at the call site).
 * No hooks or handlers, so no 'use client': usable from server components
 * (e.g. the p/[id] preview page) as well as client trees.
 */
import { FC, ReactNode } from 'react';
import clsx from 'clsx';

/**
 * The one muted-text token for empty/secondary copy. Exported so adjacent
 * hand-written copy in adopting files can stop rolling its own - no external
 * importer has taken it up yet (checked 2026-08-13), so treat the export as an
 * offer, not a convention already in force.
 */
export const MUTED_TEXT_CLASS = 'text-newTextColor/60';

const ERROR_TEXT_CLASS = 'text-red-400';

export const EmptyState: FC<{
  /** Layout + type ramp. Defaults to the plain centered pane message. */
  variant?: 'pane' | 'hero' | 'inline';
  /**
   * Glyph rendered above the title (e.g. `<NoMediaIcon />`). Rendered
   * as-is; keep sizing on the node.
   */
  icon?: ReactNode;
  /**
   * Illustration rendered above the title, before `icon`. Pass the whole
   * `<img>` so site-specific concerns stay at the call site (theme-picked
   * src, `min-w-[100%]`, ...), e.g. launches' no-channels.svg.
   */
  image?: ReactNode;
  /** Pre-translated. Hero: 16px/550 full-strength. Pane/inline: muted. */
  title: ReactNode;
  /** Pre-translated secondary line; 14px muted (hero/pane only). */
  description?: ReactNode;
  /** CTA button(s); wrapped in a centered `flex gap-[8px]` row. */
  action?: ReactNode;
  /** 'error' renders all copy in red-400 (blocking-validation empties). */
  tone?: 'default' | 'error';
  className?: string;
}> = ({
  variant = 'pane',
  icon,
  image,
  title,
  description,
  action,
  tone = 'default',
  className,
}) => {
  const muted = tone === 'error' ? ERROR_TEXT_CLASS : MUTED_TEXT_CLASS;

  if (variant === 'inline') {
    return (
      <div
        className={clsx(
          'px-[12px] py-[10px] text-[13px] flex items-center gap-[8px]',
          muted,
          className
        )}
      >
        {icon}
        <div>
          {title}
          {description && <div>{description}</div>}
        </div>
        {action}
      </div>
    );
  }

  if (variant === 'hero') {
    return (
      <div
        className={clsx('flex flex-1 items-center justify-center', className)}
      >
        {/* max-w + px are load-bearing, not decoration: without them the
            description takes the full container width, which at 393px left a
            1px gutter on each side and ran the copy into both screen edges
            (measured on the deployed build). The cap also keeps the line
            length readable on a wide desktop card. */}
        <div className="flex flex-col items-center gap-[12px] text-center max-w-[420px] px-[24px]">
          {image}
          {icon}
          <div
            className={clsx(
              'text-[16px] font-[550]',
              tone === 'error' && ERROR_TEXT_CLASS
            )}
          >
            {title}
          </div>
          {description && (
            <div className={clsx('text-[14px]', muted)}>{description}</div>
          )}
          {action && (
            <div className="flex gap-[8px] justify-center">{action}</div>
          )}
        </div>
      </div>
    );
  }

  // 'pane'
  return (
    <div
      className={clsx(
        'flex flex-1 flex-col items-center justify-center gap-[8px] py-[20px] text-center',
        className
      )}
    >
      {image}
      {icon}
      <div className={clsx('text-[16px]', muted)}>{title}</div>
      {description && (
        <div className={clsx('text-[14px]', muted)}>{description}</div>
      )}
      {action && <div className="flex gap-[8px] justify-center">{action}</div>}
    </div>
  );
};
