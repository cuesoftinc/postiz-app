'use client';

import { FC, ReactNode } from 'react';
import clsx from 'clsx';

/**
 * PagerStepper — the bordered prev/label/next group from launches/filters.tsx,
 * where the identical 42px recipe is duplicated twice (calendar date stepper
 * and list-mode "Page X of Y" stepper, the latter adding the
 * opacity-50/cursor-not-allowed disabled state).
 *
 * BUILD ONLY (plan row 14): do not adopt in filters.tsx yet — launches is
 * upstream's hottest file; adoption is opportunistic, when a fork change
 * already touches it.
 *
 * Recipe, verbatim from the source:
 *   group:  border h-[42px] border-newTableBorder bg-newTableBorder gap-[1px]
 *           flex items-center rounded-[8px] overflow-hidden
 *           (the bg + 1px gaps draw the separator lines between the cells)
 *   arrows: px-[9px] bg-newBgColorInner h-full, rtl:rotate-180, 8×12 chevron,
 *           hover:text-textItemFocused hover:bg-boxFocused when enabled,
 *           opacity-50 cursor-not-allowed when disabled
 *   label:  min-w 200px centered cell with an inner py-[3px] px-[9px]
 *           text-[14px] transition-all wrapper
 *
 * Both steppers in the source leave onClick attached and guard inside the
 * handler; here the disabled flags also drop the handler, so callers don't
 * have to guard.
 *
 * Size-ladder note: h-[42px] is not a ladder target (the ladder rescales
 * 40/44/48/52 only), so the group keeps its 42px height exactly like the
 * originals.
 */

const Chevron: FC<{ direction: 'prev' | 'next' }> = ({ direction }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="8"
    height="12"
    viewBox="0 0 8 12"
    fill="none"
  >
    <path
      d={direction === 'prev' ? 'M6.5 11L1.5 6L6.5 1' : 'M1.5 11L6.5 6L1.5 1'}
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const arrowClassName = (disabled: boolean) =>
  clsx(
    'text-textColor rtl:rotate-180 px-[9px] bg-newBgColorInner h-full flex items-center justify-center',
    disabled
      ? 'opacity-50 cursor-not-allowed'
      : 'cursor-pointer hover:text-textItemFocused hover:bg-boxFocused'
  );

export const PagerStepper: FC<{
  /** Center cell content, e.g. the date range or `Page 2 of 7`. */
  label: ReactNode;
  onPrev: () => void;
  onNext: () => void;
  prevDisabled?: boolean;
  nextDisabled?: boolean;
  /** Min width of the label cell in px. Source uses 200 in both steppers. */
  minLabelWidth?: number;
  className?: string;
}> = ({
  label,
  onPrev,
  onNext,
  prevDisabled = false,
  nextDisabled = false,
  minLabelWidth = 200,
  className,
}) => (
  <div
    className={clsx(
      'border h-[42px] border-newTableBorder bg-newTableBorder gap-[1px] flex items-center rounded-[8px] overflow-hidden',
      className
    )}
  >
    <div
      onClick={prevDisabled ? undefined : onPrev}
      className={arrowClassName(prevDisabled)}
    >
      <Chevron direction="prev" />
    </div>
    <div
      className="text-center bg-newBgColorInner h-full flex items-center justify-center"
      style={{ minWidth: minLabelWidth }}
    >
      <div className="py-[3px] px-[9px] rounded-[5px] transition-all text-[14px]">
        {label}
      </div>
    </div>
    <div
      onClick={nextDisabled ? undefined : onNext}
      className={arrowClassName(nextDisabled)}
    >
      <Chevron direction="next" />
    </div>
  </div>
);
