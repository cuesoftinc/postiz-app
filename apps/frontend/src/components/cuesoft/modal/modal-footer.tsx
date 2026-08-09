'use client';

import { FC, ReactNode } from 'react';
import clsx from 'clsx';

/**
 * Fork-owned (cuesoft). The standard modal footer row — one rhythm
 * (`flex gap-[10px] mt-[16px]`) replacing the eight coexisting footer recipes
 * (gap-8/10/12, left/right/stretch, ad-hoc wrappers) across confirm/form
 * modals (DecisionModal, tags ConfirmDelete, SaveSet, announcement, billing
 * Accept, extension warnings, the "already published" inline confirms).
 *
 * Normalizing gap to 10px is the plan's called-out deliberate change;
 * alignment stays a prop:
 * - 'end' (default): actions right-aligned
 * - 'start': actions left-aligned (the old DecisionModal look)
 * - 'between': actions pushed to opposite edges
 * - 'stretch': full-width row, children share it equally — the
 *   `flex w-full gap-[10px]` + per-child `flex-1` recipe from the
 *   "already published" confirms and extension warnings
 */
export const ModalFooter: FC<{
  align?: 'start' | 'end' | 'between' | 'stretch';
  className?: string;
  children: ReactNode;
}> = ({ align = 'end', className, children }) => {
  return (
    <div
      className={clsx(
        'flex gap-[10px] mt-[16px]',
        align === 'start' && 'justify-start',
        align === 'end' && 'justify-end',
        align === 'between' && 'justify-between',
        align === 'stretch' && 'w-full [&>*]:flex-1',
        className
      )}
    >
      {children}
    </div>
  );
};
