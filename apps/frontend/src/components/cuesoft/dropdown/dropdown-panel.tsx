'use client';

import { FC, ReactNode, useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';

/**
 * Fork-owned (cuesoft). The positioned popover surface (plan row 13).
 * Open-state and dismissal live in useDropdown (or the call site's raw
 * useClickAway); the call site keeps the `relative` anchor wrapper, exactly
 * like the sites it replaces.
 *
 * PORTALED (live-verified fix): when open, the panel renders into
 * document.body via createPortal at position:fixed, placed from the anchor
 * wrapper's getBoundingClientRect. Anchored-in-place panels could NOT be
 * guaranteed to stack above the sidebar: at 1180px the calendar toolbar's
 * timezone panel (z-100, and z-300 inline on it plus every positioned
 * ancestor) still painted UNDER the sidebar's nav rows, because the content
 * card's stacking context (non-positioned, atomic) loses to the sidebar's
 * sticky column no matter what z is used inside it. A body portal is a
 * direct child of the root stacking context, so the dropdown band (100) wins
 * by definition.
 *
 * Portal mechanics:
 * - A hidden marker <span> stays in the original tree slot; its parentElement
 *   IS the old `relative` anchor wrapper, so the placement math reproduces
 *   the old `top-[100%]` + `start-0`/`end-0` geometry with no API change.
 * - anchor='start'|'end' aligns the panel's logical edge with the wrapper's
 *   same edge; logical means dir-aware (getComputedStyle(documentElement)
 *   .direction), so RTL mirrors exactly like the old start-0/end-0 classes.
 * - The consumer's own mt-* utility keeps providing the vertical gap: placed
 *   below, top = wrapper bottom and the margin pushes down; flipped above,
 *   the panel is bottom-anchored (margins cancel there) and the parsed
 *   margin-top is added into the bottom offset instead.
 * - Flip-above (the old sidebar-footer UTIL_FLIP behavior, now built in):
 *   after mount the panel is measured; if it would overflow the viewport
 *   bottom and there is more room above the trigger, it bottom-anchors above
 *   it. Horizontal overflow clamps to an 8px viewport margin (this also
 *   reproduces UTIL_FLIP's start-retarget for the 420px notifications panel).
 * - Repositions on scroll (capture phase, passive: inner scrollers do not
 *   bubble), window resize, and panel resize (async content); all listeners
 *   are cleaned up on close/unmount.
 * - Outside-click: useDropdown/useClickAway containment refs wrap only the
 *   trigger, and the portaled panel is no longer inside them, so presses
 *   inside the panel stop mousedown/touchstart from reaching the document
 *   listeners (native, bubble phase). Click still fires normally, so row
 *   onClick handlers are unaffected; the React onClick stopPropagation below
 *   keeps clicks from bubbling through the PORTAL to the trigger wrapper.
 * - className rides on the portaled node itself, so width utilities and
 *   consumer visibility gates (the notifications/channels `phone:hidden`,
 *   which must keep hiding the desktop panel when the phone sheet takes
 *   over) keep working unchanged.
 * - Escape hatch: a className containing `!static` (the impersonate pill
 *   uses the panel as an in-flow card) renders in place exactly as before,
 *   no portal.
 *
 * The `surface` prop encodes the app's three coexisting popover generations
 * verbatim (deliberately NOT normalized into one look - plan section 3):
 * - 'panel'  - the new-theme card: white, radius 12, layered Buffer-measured
 *              shadow stack (which includes a 1px alpha ring, so no hard
 *              border in light mode; dark mode keeps a hairline because the
 *              black-alpha ring vanishes on dark surfaces)
 * - 'menu'   - the compact action menu: third-party kebab (bg-fifth, padded,
 *              nowrap)
 * - 'legacy' - the old-theme list: impersonate autocompletes (bg-sixth,
 *              customColor6)
 * Site-specific width/animation/min-height stay at the call site via
 * className.
 *
 * Z: all three surfaces sit in the dropdown band (100 - see the canonical z
 * scale in global.scss). Portaled to body that is enough by definition; the
 * in-place `!static` escape resolves inside its host context (impersonate
 * pill) as before.
 */

const SURFACE_SKINS = {
  panel:
    'bg-newBgColorInner text-newTextColor rounded-[12px] shadow-[0_0_0_1px_rgba(0,0,0,.08),0_1px_1px_rgba(0,0,0,.02),0_4px_8px_rgba(0,0,0,.04)] dark:border dark:border-tableBorder z-[100]',
  menu: 'p-[8px] px-[20px] bg-fifth flex flex-col gap-[16px] rounded-[8px] border border-tableBorder text-nowrap z-[100]',
  legacy: 'bg-sixth border border-customColor6 text-newTextColor z-[100]',
} as const;

/** Breathing room kept between the panel and the viewport edges. */
const VIEWPORT_MARGIN = 8;

export const DropdownPanel: FC<{
  surface?: keyof typeof SURFACE_SKINS;
  /** Which edge of the anchor the panel hugs. */
  anchor?: 'start' | 'end';
  className?: string;
  children: ReactNode;
}> = ({ surface = 'panel', anchor = 'start', className, children }) => {
  // `!static` consumers use the panel as an in-flow card; SSR has no body.
  const inPlace =
    (className || '').split(/\s+/).includes('!static') ||
    typeof document === 'undefined';

  const markerRef = useRef<HTMLSpanElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Placement: viewport-fixed coordinates derived from the anchor wrapper
  // (the marker's parent - the same `relative` box the absolute version was
  // positioned against).
  const place = () => {
    const anchorEl = markerRef.current?.parentElement;
    const el = panelRef.current;
    if (!anchorEl || !el) return;
    // display:none (a consumer's phone:hidden) - nothing to place
    if (el.offsetWidth === 0 && el.offsetHeight === 0) return;
    const rect = anchorEl.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      // anchor is hidden (drawer closed mid-open, breakpoint flip) - do not
      // strand the panel at stale coordinates
      el.style.visibility = 'hidden';
      return;
    }
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    // the consumer's mt-* utility is the trigger gap in both directions
    const gap = parseFloat(getComputedStyle(el).marginTop) || 0;
    const rtl =
      getComputedStyle(document.documentElement).direction === 'rtl';

    // Horizontal: 'end' means right-aligned in LTR and left-aligned in RTL
    // ('start' is the mirror), matching the old end-0/start-0 classes; then
    // clamp into the viewport (replaces UTIL_FLIP's start-retarget).
    const rightAligned = (anchor === 'end') !== rtl;
    let left = rightAligned ? rect.right - w : rect.left;
    left = Math.min(
      Math.max(left, VIEWPORT_MARGIN),
      Math.max(vw - w - VIEWPORT_MARGIN, VIEWPORT_MARGIN)
    );

    // Vertical: below the wrapper (old top-[100%]) unless the panel would
    // overflow the viewport bottom AND there is more room above - then it
    // bottom-anchors above the wrapper (old UTIL_FLIP), so late growth
    // (async lists) extends upward, away from the edge.
    const overflowsBelow = rect.bottom + gap + h > vh - VIEWPORT_MARGIN;
    const flip = overflowsBelow && rect.top > vh - rect.bottom;

    el.style.left = `${left}px`;
    el.style.right = 'auto';
    if (flip) {
      el.style.top = 'auto';
      // margin-top cancels out of bottom-anchored fixed positioning, so the
      // gap is added here explicitly
      el.style.bottom = `${vh - rect.top + gap}px`;
    } else {
      el.style.top = `${rect.bottom}px`; // + the consumer's own margin-top
      el.style.bottom = 'auto';
    }
    el.style.visibility = '';
  };
  const placeRef = useRef(place);
  placeRef.current = place;

  // Position before paint on every commit (children/className changes can
  // change the panel's size, and the flip decision with it).
  useLayoutEffect(() => {
    if (!inPlace) placeRef.current();
  });

  useEffect(() => {
    if (inPlace) return;
    const el = panelRef.current;
    if (!el) return;
    // Presses inside the panel must not read as outside-clicks: the
    // useDropdown/useClickAway refs contain only the trigger wrapper now, and
    // their close handlers listen for document mousedown/touchstart. Stopping
    // those here (bubble phase, before they reach document) keeps the panel
    // "inside". Click is untouched, so React onClick rows work as before.
    const stop = (e: Event) => e.stopPropagation();
    el.addEventListener('mousedown', stop);
    el.addEventListener('touchstart', stop);
    const reposition = () => placeRef.current();
    // capture: scroll events from inner scroll containers do not bubble
    window.addEventListener('scroll', reposition, {
      capture: true,
      passive: true,
    });
    window.addEventListener('resize', reposition);
    const observer =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(reposition)
        : undefined;
    observer?.observe(el);
    return () => {
      el.removeEventListener('mousedown', stop);
      el.removeEventListener('touchstart', stop);
      window.removeEventListener('scroll', reposition, { capture: true });
      window.removeEventListener('resize', reposition);
      observer?.disconnect();
    };
  }, [inPlace]);

  if (inPlace) {
    return (
      <div
        onClick={(e) => e.stopPropagation()}
        className={clsx(
          'absolute top-[100%]',
          SURFACE_SKINS[surface],
          anchor === 'end' ? 'end-0' : 'start-0',
          className
        )}
      >
        {children}
      </div>
    );
  }

  return (
    <>
      <span ref={markerRef} className="hidden" aria-hidden="true" />
      {createPortal(
        <div
          ref={panelRef}
          onClick={(e) => e.stopPropagation()}
          className={clsx('fixed', SURFACE_SKINS[surface], className)}
          // hidden until the first placement pass (useLayoutEffect runs
          // before paint, so this never actually flashes)
          style={{ visibility: 'hidden' }}
        >
          {children}
        </div>,
        document.body
      )}
    </>
  );
};
