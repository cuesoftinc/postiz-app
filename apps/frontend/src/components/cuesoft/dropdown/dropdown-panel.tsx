'use client';

import { FC, ReactNode } from 'react';
import clsx from 'clsx';

/**
 * Fork-owned (cuesoft). The positioned popover surface (plan row 13).
 * Purely presentational — open-state and dismissal live in useDropdown; the
 * call site keeps the `relative` anchor wrapper, exactly like the sites it
 * replaces.
 *
 * The `surface` prop encodes the app's three coexisting popover generations
 * verbatim (deliberately NOT normalized into one look — plan section 3):
 * - 'panel'  — the new-theme card: white, radius 12, layered Buffer-measured
 *              shadow stack (which includes a 1px alpha ring, so no hard
 *              border in light mode; dark mode keeps a hairline because the
 *              black-alpha ring vanishes on dark surfaces)
 * - 'menu'   — the compact action menu: third-party kebab (bg-fifth, padded,
 *              nowrap)
 * - 'legacy' — the old-theme list: impersonate autocompletes (bg-sixth,
 *              customColor6)
 * Site-specific width/animation/min-height stay at the call site via
 * className.
 *
 * Z: all three surfaces sit in the page dropdown band (100 - see the
 * canonical z scale in global.scss): above sticky chrome (50), below fixed
 * page furniture (150+) and the modal layer (200+). Inside a host stacking
 * context (impersonate pill, modals) the value resolves locally.
 */

const SURFACES = {
  panel:
    'absolute top-[100%] bg-newBgColorInner text-newTextColor rounded-[12px] shadow-[0_0_0_1px_rgba(0,0,0,.08),0_1px_1px_rgba(0,0,0,.02),0_4px_8px_rgba(0,0,0,.04)] dark:border dark:border-tableBorder z-[100]',
  menu: 'absolute top-[100%] p-[8px] px-[20px] bg-fifth flex flex-col gap-[16px] rounded-[8px] border border-tableBorder text-nowrap z-[100]',
  legacy:
    'absolute top-[100%] bg-sixth border border-customColor6 text-newTextColor z-[100]',
} as const;

export const DropdownPanel: FC<{
  surface?: keyof typeof SURFACES;
  /** Which edge of the anchor the panel hugs. */
  anchor?: 'start' | 'end';
  className?: string;
  children: ReactNode;
}> = ({ surface = 'panel', anchor = 'start', className, children }) => (
  <div
    onClick={(e) => e.stopPropagation()}
    className={clsx(
      SURFACES[surface],
      anchor === 'end' ? 'end-0' : 'start-0',
      className
    )}
  >
    {children}
  </div>
);
