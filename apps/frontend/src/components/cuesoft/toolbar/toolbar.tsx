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
 * Toolbar kit — the filter/toolbar row family (plan row 12).
 *
 * Source recipes:
 *  - ToolbarRow / ToolbarField / control chrome: the admin filter bars
 *    (admin-errors.component.tsx filter bar, admin-stats.component.tsx date
 *    bar — byte-identical recipes).
 *  - SegmentedControl 'pills': the launches/filters.tsx view-switcher pill
 *    group (duplicated 3× in that file); 'chips': admin-stats' presets row
 *    (bg-forth "applied filter" chips — a variant, not drift, per plan §3).
 *
 * Deliberate changes the plan calls out for this kit:
 *  - ONE control height (38px) and ONE border token (border-newTableBorder),
 *    fixing the 38/40/42/44 scatter and the newColColor/newTableBorder split.
 *  - A visible focus state on the controls: outline-none +
 *    focus:border-[#612BD3] (the sanctioned purple; admin's native controls
 *    currently have no focus styling at all, media hardcodes the same hex).
 *
 * Card chrome is a prop, not forced: admin bars sit on the page background
 * and get the card; filters/media rows sit inside bg-newBgColorInner panels
 * and must not (plan §3).
 *
 * Size-ladder note (global.scss): h-[38px], text-[12px]/[13px]/[14px],
 * p-[12px]/px-[10px] and gap-[12px] are all outside the ladder's thresholds
 * (it starts at h-[40px], text-[18px], p-[20px], gap-[20px]) — these render
 * exactly as written, same as the hand-rolled originals. Note the shared
 * Button (h-[40px]) IS laddered to 32px, so when a Button sits in a
 * ToolbarRow next to 38px controls, that mismatch is the pre-existing state,
 * not something this kit introduces.
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
    <div className="text-[12px] opacity-70">{label}</div>
    {children}
  </div>
);

/**
 * The ONE control chrome: the admin-errors select/input recipe plus the
 * kit's deliberate focus state. 38px tall, newTableBorder, rounded-[8px].
 */
const controlClassName =
  'bg-newBgColorInner h-[38px] border border-newTableBorder rounded-[8px] px-[10px] text-[14px] text-textColor outline-none focus:border-[#612BD3]';

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
 * variant='pills' (default): filters.tsx recipe — p-[4px] bordered container,
 * items pt-[6px] pb-[5px] rounded-[6px], active text-textItemFocused
 * bg-boxFocused. Item sizing defaults to the list-state pills
 * (min-w-[80px] px-[12px]); pass itemWidth for the fixed-width groups
 * (74 = Day/Week/Month, 34 = calendar/list icon toggle).
 *
 * variant='chips': admin-stats presets recipe — free-standing h-[32px]
 * bordered chips, active bg-forth text-white border-forth, inactive
 * hover:bg-tableBorder (the "applied filter" affordance, kept distinct from
 * the boxFocused pills per plan §3).
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
              'h-[32px] px-[12px] rounded-[8px] text-[13px] border cursor-pointer whitespace-nowrap',
              value === option.value
                ? 'bg-forth text-white border-forth'
                : 'bg-newBgColorInner text-textColor border-newTableBorder hover:bg-tableBorder',
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
        'flex flex-row p-[4px] border border-newTableBorder rounded-[8px] text-[14px] font-[500]',
        className
      )}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={clsx(
            'pt-[6px] pb-[5px] cursor-pointer text-center rounded-[6px]',
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
