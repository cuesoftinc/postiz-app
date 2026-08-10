'use client';

import { FC } from 'react';
import clsx from 'clsx';
import { Button } from '@gitroom/react/form/button';

/**
 * TablePagination — the "Page X of Y" + Previous/Next Button pair, extracted
 * verbatim from admin-errors.component.tsx (the block under the errors table).
 *
 * One of three pagination families in the app; this is the one any fork-built
 * listing screen should use. Do NOT migrate media's numbered pager (right UX
 * for a large grid) or stars' chevron-in-heading controls to it — both are
 * intentional per-context designs (plan §3).
 *
 * `page` is 0-based, matching the admin-errors state — the label renders
 * `page + 1`. Copy is intentionally hardcoded English like the source
 * (super-admin-only surface, untranslated upstream).
 */
export const TablePagination: FC<{
  /** 0-based current page. Previous disables at 0. */
  page: number;
  /** Total page count, already clamped to >= 1 by the caller. */
  totalPages: number;
  /** Next disables when false (admin-errors passes `!!data?.hasMore`). */
  hasMore: boolean;
  onPrev: () => void;
  onNext: () => void;
  className?: string;
}> = ({ page, totalPages, hasMore, onPrev, onNext, className }) => (
  <div className={clsx('flex items-center justify-between', className)}>
    <div className="text-[13px] text-newTextColor/60">
      Page {page + 1} of {totalPages}
    </div>
    <div className="flex gap-[8px]">
      <Button secondary disabled={page === 0} onClick={onPrev}>
        Previous
      </Button>
      <Button disabled={!hasMore} onClick={onNext}>
        Next
      </Button>
    </div>
  </div>
);
