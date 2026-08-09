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
 * - 'panel'  — the new-theme card: notification bell (rounded corners at 16,
 *              tableBorder, bg-third, z-600)
 * - 'menu'   — the compact action menu: third-party kebab (bg-fifth, padded,
 *              nowrap, z-100)
 * - 'legacy' — the old-theme list: impersonate autocompletes (bg-sixth,
 *              customColor6, z-999)
 * Site-specific width/animation/min-height stay at the call site via
 * className.
 */

const SURFACES = {
  panel:
    'absolute top-[100%] bg-third text-textColor rounded-[16px] border border-tableBorder z-[600]',
  menu: 'absolute top-[100%] p-[8px] px-[20px] bg-fifth flex flex-col gap-[16px] rounded-[8px] border border-tableBorder text-nowrap z-[100]',
  legacy:
    'absolute top-[100%] bg-sixth border border-customColor6 text-textColor z-[999]',
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
