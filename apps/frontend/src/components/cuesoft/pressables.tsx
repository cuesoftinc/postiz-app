'use client';

import { FC, MouseEventHandler, ReactNode } from 'react';
import clsx from 'clsx';

/**
 * Fork-owned (cuesoft). Real-button/anchor replacements for the one-off
 * clickable divs (plan row 11): the super-admin banner chips and the
 * announcement color-picker radio group in layout/impersonate.tsx.
 *
 * Pixel parity contract: the class strings are verbatim from the divs they
 * replace; per-action colors (bg-red-700, bg-green-700, bg-teal-700,
 * bg-blue-700, bg-purple-700, bg-yellow-600, bg-red-500, bg-blue-600,
 * bg-amber-600, bg-red-600) stay at the call sites via `className` — they are
 * intentional color coding, not drift. Tailwind's preflight makes the
 * button/anchor swap pixel-neutral (font/line-height/color inherit,
 * padding/border/background reset).
 *
 * What the swap adds, per the plan: keyboard reachability (real <button>),
 * middle-click/new-tab for navigation chips (real <a href>), and
 * radiogroup/radio semantics on the swatch group.
 *
 * Row 11's `PagerButton` (media pagination, stars arrows) lives at the bottom
 * of this file; per-context pager skins stay at the call sites via
 * `className`.
 */

export interface ChipProps {
  /** Navigation chips pass href and render a real <a> (middle-click works). */
  href?: string;
  onClick?: MouseEventHandler<HTMLElement>;
  /** Per-action color and any extras, e.g. 'bg-red-700'. */
  className?: string;
  /** For icon-ish chips like the stop-impersonating 'X'. */
  'aria-label'?: string;
  children: ReactNode;
}

const CHIP_CLASSES =
  'px-[10px] rounded-[4px] text-white cursor-pointer whitespace-nowrap';

export const Chip: FC<ChipProps> = ({
  href,
  onClick,
  className,
  'aria-label': ariaLabel,
  children,
}) => {
  const classes = clsx(CHIP_CLASSES, className);
  if (href) {
    return (
      <a href={href} onClick={onClick} aria-label={ariaLabel} className={classes}>
        {children}
      </a>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={classes}
    >
      {children}
    </button>
  );
};

export interface ChoiceChipOption {
  value: string;
  label: ReactNode;
  /** Per-option skin, e.g. 'bg-blue-600' — swatch colors stay at call sites. */
  className?: string;
}

export interface ChoiceChipGroupProps {
  options: ChoiceChipOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

/**
 * Single-choice swatch/chip row (the AddAnnouncement color picker). Verbatim
 * geometry from the source: `flex gap-[8px]` row, `flex-1 text-center
 * py-[8px] rounded-[8px] text-[13px]` items, selected = `opacity-100 ring-2
 * ring-white`, unselected = `opacity-40`.
 */
export const ChoiceChipGroup: FC<ChoiceChipGroupProps> = ({
  options,
  value,
  onChange,
  className,
}) => {
  return (
    <div role="radiogroup" className={clsx('flex gap-[8px]', className)}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={value === opt.value}
          onClick={() => onChange(opt.value)}
          className={clsx(
            'flex-1 text-center py-[8px] rounded-[8px] text-white text-[13px] cursor-pointer transition-opacity',
            opt.className,
            value === opt.value
              ? 'opacity-100 ring-2 ring-white'
              : 'opacity-40'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
};

export interface PagerButtonProps {
  /**
   * Sets the default aria-label ('Previous page' / 'Next page'); pass
   * `aria-label` to override (media keeps its 'Go to previous page' copy).
   */
  direction?: 'prev' | 'next';
  /** Page-number variant: stamps aria-current="page" (only when true). */
  active?: boolean;
  disabled?: boolean;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  /**
   * Per-context skin — media's boxed pager string, stars' bare arrows. The
   * base contributes only semantics + the one disabled convention
   * (`disabled:opacity-50 disabled:pointer-events-none`, byte-identical to
   * the classes stars toggled by hand; replaces media's parent-`<li>`
   * `opacity-20 pointer-events-none` hack — a plan-called change).
   */
  className?: string;
  'aria-label'?: string;
  children: ReactNode;
}

/**
 * Pager arrow / page-number pressable (plan row 11). Renders a real
 * `<button type="button">` where media's Pagination mixed a div (Previous),
 * an href-less `<a>` (Next) and div page numbers, and stars used bare divs —
 * keyboard reachability and a real `disabled` attribute for free. Chevron
 * icons/labels come in as children verbatim (pixel parity).
 */
export const PagerButton: FC<PagerButtonProps> = ({
  direction,
  active,
  disabled,
  onClick,
  className,
  'aria-label': ariaLabel,
  children,
}) => {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={
        ariaLabel ??
        (direction === 'prev'
          ? 'Previous page'
          : direction === 'next'
          ? 'Next page'
          : undefined)
      }
      aria-current={active ? 'page' : undefined}
      className={clsx(
        'cursor-pointer disabled:opacity-50 disabled:pointer-events-none',
        className
      )}
    >
      {children}
    </button>
  );
};
