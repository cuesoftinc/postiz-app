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
 *  - SegmentedControl 'segmented': Buffer's own segmented control, measured
 *    live (see the recipe below); ADOPTED by all six segmented surfaces in the
 *    fork. 'chips': admin-stats' presets row (bg-forth "applied filter" chips
 *    - a deliberate second variant, not drift).
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
 * exactly as written, same as the hand-rolled originals. The segmented's own
 * values are off the ladder too (min-h-[32px], h-[24px], rounded-[8px]/[6px],
 * text-[14px]/[15px]); its ONE laddered value is the touch size's h-[44px],
 * which is why that wrapper carries data-cs. Note the shared
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
  /** Text, an icon node, or both — items lay out as a 6px-gapped flex row. */
  label: ReactNode;
  /** Accessible name for icon-only items, whose label reads as nothing. */
  ariaLabel?: string;
}

/** 'default' is the measured Buffer control. 'touch' exists only for the phone
 *  bottom sheets — see the size note on SegmentedControl. */
type SegmentedSize = 'default' | 'touch';

/* THE MEASURED RECIPE (Buffer, read back through a canvas pixel because Buffer
   serves lab()): wrapper 32px tall, white, radius 8, 1px #dedcd9 hairline, 4px
   padding, 4px gap; items 24px tall, radius 6, padding 0 8, 14px/500; inactive
   label #5a5a59; ACTIVE label #337046 on a #95cd8f fill at alpha 0.322. Two
   independent Buffer surfaces render exactly this — the List/Calendar toggle
   in Publish and the date range in Insights — so it is the system, not one
   instance.

   BRAND MAPPING: only Buffer's GREEN is substituted, by the fork's lime
   primary washed to that same 32% with its paired ink token. Every neutral is
   Buffer's own measured value, reached through the fork's existing tokens
   (bg-newBgColorInner = the white surface, border-newTableBorder = the
   hairline, newTextColor/60 = the muted label). Buffer's hexes are never
   hardcoded: color-mix over --new-btn-primary is what makes the active fill
   follow the theme instead of pinning one theme's pixels. */
const SEGMENTED_CONTAINER =
  'flex items-center p-[4px] gap-[4px] bg-newBgColorInner border border-newTableBorder';
const SEGMENTED_CONTAINER_SIZE: Record<SegmentedSize, string> = {
  /* min-h, not h: 24px items inside 4px padding ARE 32px, so a single row is
     pixel-identical to the measured wrapper, but Insights' metric picker is
     the same control with enough segments to wrap onto a second row, and a
     hard height would have spilled them out of the box. */
  default: 'min-h-[32px] rounded-[8px]',
  touch: 'w-full h-[44px] rounded-[12px]',
};
const SEGMENTED_ITEM =
  'flex items-center justify-center gap-[6px] font-[500] whitespace-nowrap cursor-pointer transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-[#325ea6]';
const SEGMENTED_ITEM_SIZE: Record<SegmentedSize, string> = {
  default: 'h-[24px] px-[8px] rounded-[6px] text-[14px]',
  touch: 'flex-1 h-[36px] rounded-[8px] text-[15px]',
};
const SEGMENTED_ACTIVE =
  'bg-[color:color-mix(in_srgb,var(--new-btn-primary)_32%,transparent)] text-newTableTextFocused';
const SEGMENTED_INACTIVE =
  'text-newTextColor/60 hover:text-newTextColor hover:bg-boxHover';

/**
 * SegmentedControl — the ONE segmented control / the preset chip row.
 *
 * ADOPTION (2026-08-13): all six hand-rolled copies now render from here —
 * launches/filters.tsx desktop List|Calendar, its phone icon-only twin and the
 * PhoneCalendarSheet 3 Days|Week|Month, platform-analytics' date range and its
 * metric picker, and agents' Assistant|Content.
 *
 * WHAT THE MIGRATION FIXED: the six copies had drifted onto TWO active fills —
 * the measured 32% lime tint on three of them, `bg-boxFocused
 * text-textItemFocused` on the other three. Only the tint is measured, so it
 * won; the boxFocused surfaces changed appearance deliberately. The earlier
 * 'pills' geometry this component used to carry (p-[4px] at rounded-[6px],
 * items pt-[6px] pb-[5px] min-w-[80px] px-[12px], active bg-boxFocused)
 * PREDATED the Buffer measurement and has been replaced rather than preserved:
 * adopting it as written would have regressed five surfaces.
 *
 * SIZE, and the one deviation: 'default' is the measured control. 'touch' is
 * for the phone BOTTOM SHEETS only, where a 24px segment is under the 40px tap
 * floor those sheets are built to (the sheet is a touch-only surface, so the
 * measured desktop geometry is not the right answer there): 44px wrapper /
 * 36px equal-width segments at 15px, everything else — fill, hairline,
 * radius family, ink — identical. It is a size, not a second control.
 *
 * data-cs is on the wrapper unconditionally: the global.scss size ladder
 * rescales `h-[44px]`→36px for elements without it, which would drop the touch
 * size back under the tap floor. The 32/24 default is off the ladder either
 * way, and the attribute is what the hand-rolled copies already carried.
 *
 * Two details are unified UP rather than to the lowest common denominator,
 * because the measurement is silent on both and half the copies already had
 * them: inactive segments take `hover:bg-boxHover` (three of six had it), and
 * every segment takes the kit's focus-visible ring (two of six had it). Both
 * are invisible at rest, so no surface loses its measured appearance.
 *
 * Items are real <button type="button"> elements carrying aria-pressed, which
 * is the toggle-button contract Tab + Enter/Space already satisfies. No
 * radiogroup/tablist role: those promise arrow-key navigation, and adding the
 * role without the roving tabindex would announce a contract the control does
 * not honour — a regression on what the plain buttons did before.
 *
 * variant='chips': admin-stats presets recipe — free-standing h-[36px]
 * bordered chips (the kit's 36px control height / 6px radius), active
 * bg-forth text-white border-forth (forth = brand blue), inactive
 * hover:bg-tableBorder (the "applied filter" affordance, deliberately kept
 * distinct from the segmented). Still unadopted: admin-stats.component.tsx
 * hand-rolls it and is not this change's file to touch.
 */
export const SegmentedControl: FC<{
  options: SegmentedOption[];
  value: string;
  onChange: (value: string) => void;
  variant?: 'segmented' | 'chips';
  /** Segmented only; 'touch' is for phone bottom sheets. */
  size?: SegmentedSize;
  /** Extra classes for every item (e.g. `shrink-0` in a scrolling strip). */
  itemClassName?: string;
  className?: string;
}> = ({
  options,
  value,
  onChange,
  variant = 'segmented',
  size = 'default',
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
      data-cs
      className={clsx(
        SEGMENTED_CONTAINER,
        SEGMENTED_CONTAINER_SIZE[size],
        className
      )}
    >
      {options.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-label={option.ariaLabel}
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={clsx(
              SEGMENTED_ITEM,
              SEGMENTED_ITEM_SIZE[size],
              active ? SEGMENTED_ACTIVE : SEGMENTED_INACTIVE,
              itemClassName
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
};
