'use client';

import {
  DetailedHTMLProps,
  FC,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from 'react';
import clsx from 'clsx';

/**
 * Toolbar kit - the filter/toolbar row family.
 *
 * DOC PROVENANCE (corrected 2026-08-13): earlier revisions of this docblock
 * cited "plan row 12", "plan §3", "the brand-contract control height" and
 * "the Cuesoft contract". No such documents exist in this repo, and none ever
 * did (`git log --diff-filter=A` over `*CONSISTENCY*`/`*CONTRACT*`/`*SURVEY*`
 * returns nothing). The rules below are real and in force; only the citations
 * were phantom, so they have been restated as decisions rather than
 * references. The live written references for this fork are
 * `apps/frontend/PARITY-CATALOG.md` and `apps/frontend/BUFFER-REPLICA-SPEC.md`.
 *
 * Source recipes:
 *  - ToolbarRow / ToolbarField / control chrome: the admin filter bars
 *    (admin-errors.component.tsx filter bar, admin-stats.component.tsx date
 *    bar - byte-identical recipes). These ARE adopted: admin-errors imports
 *    ToolbarRow/Field/Select/Input.
 *  - SegmentedControl 'pills': the launches/filters.tsx view-switcher pill
 *    group; 'chips': admin-stats' presets row (bg-forth "applied filter"
 *    chips - a deliberate second variant, not drift).
 *
 * Deliberate decisions for this kit:
 *  - ONE control height (36px) and ONE border token (border-newTableBorder),
 *    fixing the 38/40/42/44 scatter and the newColColor/newTableBorder split.
 *  - A visible focus state on the controls: outline-none +
 *    focus:border-[#325ea6] (brand blue - works on both themes and never
 *    fights the lime primaries; admin's native controls had none at all).
 *
 * Card chrome is a prop, not forced: admin bars sit on the page background
 * and get the card; filters/media rows sit inside bg-newBgColorInner panels
 * and must not.
 *
 * Size-ladder note (global.scss): h-[36px], text-[12px]/[13px]/[14px],
 * p-[12px]/px-[10px] and gap-[12px] are all outside the ladder's thresholds
 * (its control rungs are h-[40px]→32, h-[44px]/h-[48px]→36, h-[52px]→40; its
 * type rungs start at text-[18px]; its box rungs are p-[20px]/p-[24px]→16,
 * px-[20px]→16, gap-[20px]/gap-[24px]→16) - so everything here renders
 * exactly as written, same as the hand-rolled originals. Note the shared
 * `form/button.tsx` Button authors h-[40px] with NO data-cs, so it IS
 * laddered to 32px: a Button sitting in a ToolbarRow next to 36px controls is
 * the pre-existing mismatch, not something this kit introduces.
 */

/**
 * ToolbarRow — the flex-wrap filter bar.
 * `card` adds the admin chrome: bg-newBgColorInner border border-newTableBorder
 * rounded-[8px] p-[12px]. `align` defaults to 'end' (labels sit above the
 * controls, so the admin bars bottom-align everything).
 */
export const ToolbarRow: FC<{
  card?: boolean;
  align?: 'end' | 'center';
  className?: string;
  children: ReactNode;
}> = ({ card = false, align = 'end', className, children }) => (
  <div
    className={clsx(
      'flex flex-wrap gap-[12px]',
      align === 'end' ? 'items-end' : 'items-center',
      card &&
        'bg-newBgColorInner border border-newTableBorder rounded-[8px] p-[12px]',
      className
    )}
  >
    {children}
  </div>
);

/**
 * ToolbarField — the label + control stack from the admin bars:
 * a 12px opacity-70 label over the control, 6px apart.
 */
export const ToolbarField: FC<{
  label: ReactNode;
  className?: string;
  children: ReactNode;
}> = ({ label, className, children }) => (
  <div className={clsx('flex flex-col gap-[6px]', className)}>
    <div className="text-[12px] text-newTextColor/60">{label}</div>
    {children}
  </div>
);

/**
 * The ONE control chrome: the admin-errors select/input recipe plus the
 * kit's deliberate focus state. 36px tall, newTableBorder, rounded-[6px]
 * (contract control radius), brand-blue focus border.
 */
const controlClassName =
  'bg-newBgColorInner h-[36px] border border-newTableBorder rounded-[6px] px-[10px] text-[14px] text-newTextColor outline-none focus:border-[#325ea6]';

/** ToolbarSelect — a styled native <select>; pass min-width etc. via className. */
export const ToolbarSelect: FC<
  DetailedHTMLProps<SelectHTMLAttributes<HTMLSelectElement>, HTMLSelectElement>
> = ({ className, children, ...props }) => (
  <select {...props} className={clsx(controlClassName, className)}>
    {children}
  </select>
);

/** ToolbarInput — a styled native <input>; pass min-width etc. via className. */
export const ToolbarInput: FC<
  DetailedHTMLProps<InputHTMLAttributes<HTMLInputElement>, HTMLInputElement>
> = ({ className, ...props }) => (
  <input {...props} className={clsx(controlClassName, className)} />
);

export interface SegmentedOption {
  value: string;
  /** Text or an icon node (for icon items pass itemClassName="flex justify-center items-center"). */
  label: ReactNode;
}

/**
 * SegmentedControl — the view-switcher pill group / preset chip row.
 *
 * ADOPTION: ZERO consumers as of 2026-08-13 (`grep -rn SegmentedControl`
 * matches only this file). KEPT anyway - its consolidation target is very
 * much alive, and this is the primitive that target needs. Deleting it would
 * leave the duplication below with nothing to converge on.
 *
 * WHAT IT HAS NOT YET CONSOLIDATED - six hand-rolled segmented controls,
 * splitting into TWO different active fills:
 *   `segActive` = 32% green tint + text-newTableTextFocused (the live Buffer
 *   measurement, filters.tsx:452):
 *     1. launches/filters.tsx:1207   desktop List | Calendar
 *     2. launches/filters.tsx:1810   phone icon-only List | Calendar
 *     3. platform-analytics/analytics-chart.tsx:275  metric chooser
 *   `bg-boxFocused text-textItemFocused`:
 *     4. agents/agent.tsx:291        Assistant | Content
 *     5. platform-analytics/platform.analytics.tsx:287  date range
 *     6. launches/filters.tsx:880    PhoneCalendarSheet 3 Days | Week | Month
 *
 * STALE RECIPE WARNING: the 'pills' geometry below (p-[4px] container at
 * rounded-[6px], items pt-[6px] pb-[5px], min-w-[80px] px-[12px], active
 * bg-boxFocused) is the PRE-MEASUREMENT filters.tsx recipe. All five of the
 * six live copies that are not the phone sheet have since moved to the Buffer
 * anatomy measured 2026-08-10 and re-confirmed 2026-08-13: container h-[32px]
 * p-[4px] rounded-[8px] on bg-newBgColorInner + hairline, items h-[24px]
 * px-[8px] rounded-[6px] at 14/500. ANY migration onto this primitive must
 * first bring 'pills' up to that anatomy and pick ONE active fill - the 32%
 * green tint, which is the measured one. Do not migrate call sites onto the
 * geometry as written; it would regress five surfaces.
 *
 * variant='pills' (default): container + item recipe described above. Item
 * sizing defaults to the list-state pills (min-w-[80px] px-[12px]); pass
 * itemWidth for fixed-width groups (74 = Day/Week/Month, 34 = calendar/list
 * icon toggle).
 *
 * variant='chips': admin-stats presets recipe — free-standing h-[36px]
 * bordered chips (the kit's 36px control height / 6px radius), active
 * bg-forth text-white border-forth (forth = brand blue), inactive
 * hover:bg-tableBorder (the "applied filter" affordance, deliberately kept
 * distinct from the boxFocused pills).
 *
 * Items are real <button type="button"> elements (chips already are in the
 * source; pills were divs — same pixels under Tailwind preflight, better
 * keyboard semantics).
 */
export const SegmentedControl: FC<{
  options: SegmentedOption[];
  value: string;
  onChange: (value: string) => void;
  variant?: 'pills' | 'chips';
  /** Fixed item width in px; pills only. Omit for min-w-[80px] px-[12px]. */
  itemWidth?: number;
  /** Extra classes for every item (e.g. icon centering). */
  itemClassName?: string;
  className?: string;
}> = ({
  options,
  value,
  onChange,
  variant = 'pills',
  itemWidth,
  itemClassName,
  className,
}) => {
  if (variant === 'chips') {
    return (
      <div className={clsx('flex flex-wrap gap-[8px]', className)}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={clsx(
              'h-[36px] px-[12px] rounded-[6px] text-[13px] border cursor-pointer whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-[#325ea6]',
              value === option.value
                ? 'bg-forth text-white border-forth'
                : 'bg-newBgColorInner text-newTextColor border-newTableBorder hover:bg-tableBorder',
              itemClassName
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div
      className={clsx(
        'flex flex-row p-[4px] border border-newTableBorder rounded-[6px] text-[14px] font-[500]',
        className
      )}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={clsx(
            'pt-[6px] pb-[5px] cursor-pointer text-center rounded-[6px] outline-none focus-visible:ring-2 focus-visible:ring-[#325ea6]',
            typeof itemWidth === 'undefined' && 'min-w-[80px] px-[12px]',
            value === option.value && 'text-textItemFocused bg-boxFocused',
            itemClassName
          )}
          style={
            typeof itemWidth === 'undefined' ? undefined : { width: itemWidth }
          }
        >
          {option.label}
        </button>
      ))}
    </div>
  );
};
