'use client';

/**
 * Cuesoft fork — shared skeleton primitives (Buffer loading language).
 *
 * Buffer never shows spinners while content loads: it shows soft grey
 * blocks shaped like the content that is about to appear. `Skeleton` is
 * the one primitive (animate-pulse rounded block on the warm 5% ink
 * wash); the composed shapes below cover the recurring anatomies —
 * text rows, bordered cards, table rows, avatar rows and the S1
 * page-header + content-blocks page shell.
 *
 * Radius overrides need the important marker (`!rounded-full`,
 * `!rounded-[6px]`) because the base carries `rounded-[8px]` — same
 * precedent as filters.tsx:274 / third-party.component.tsx.
 *
 * Size-ladder note: bare h-/w- arbitrary values here are fine to
 * rescale with the global ladder — skeletons should shrink with the
 * content they stand in for, so no `data-cs` opt-out.
 */
import { FC } from 'react';
import clsx from 'clsx';

/** The primitive: one pulsing grey block. Shape it with className. */
export const Skeleton: FC<{
  className?: string;
}> = ({ className }) => (
  <div
    className={clsx('animate-pulse rounded-[8px] bg-newTextColor/5', className)}
  />
);

/** Paragraph-shaped rows; the last row is short like real text. */
export const SkeletonText: FC<{
  rows?: number;
  className?: string;
}> = ({ rows = 3, className }) => (
  <div className={clsx('w-full flex flex-col gap-[8px]', className)}>
    {[...new Array(rows)].map((_, i) => (
      <Skeleton
        key={i}
        className={clsx('h-[12px]', i === rows - 1 ? 'w-[60%]' : 'w-full')}
      />
    ))}
  </div>
);

/** Bordered card (radius 12, hairline) with a title bar + text rows. */
export const SkeletonCard: FC<{
  className?: string;
}> = ({ className }) => (
  <div
    className={clsx(
      'border border-newTableBorder rounded-[12px] p-[16px] flex flex-col gap-[12px]',
      className
    )}
  >
    <Skeleton className="h-[16px] w-[40%]" />
    <SkeletonText rows={2} />
  </div>
);

/** Table-shaped: one header wash bar + N row bars. */
export const SkeletonTable: FC<{
  rows?: number;
  className?: string;
}> = ({ rows = 5, className }) => (
  <div className={clsx('w-full flex flex-col gap-[8px]', className)}>
    <div className="h-[40px] rounded-[8px] bg-newTableHeader animate-pulse" />
    {/* Rows are 36px, not 44: the ladder rewrites h-[44px] to 36px, so
        authoring 44 here reserved a row taller than any real one. */}
    {[...new Array(rows)].map((_, i) => (
      <Skeleton key={i} className="h-[36px] w-full" />
    ))}
  </div>
);

/** List-row shape: round avatar + name/subline bars (channel rows). */
export const SkeletonAvatarRow: FC<{
  /** Avatar diameter in px (data, not a style constant — inline style
   *  keeps the class list static for Tailwind). */
  size?: number;
  className?: string;
}> = ({ size = 40, className }) => (
  <div className={clsx('flex items-center gap-[12px]', className)}>
    <div
      className="animate-pulse rounded-full bg-newTextColor/5 shrink-0"
      style={{ width: size, height: size }}
    />
    <div className="flex flex-col gap-[6px] flex-1">
      <Skeleton className="h-[14px] w-[160px] max-w-[60%]" />
      <Skeleton className="h-[12px] w-[100px] max-w-[40%]" />
    </div>
  </div>
);

/**
 * Page-shaped shell: the S1 header row (40px r10 icon chip + title bar)
 * over stacked content blocks. This is what the route loading boundary
 * and the generic LoadingComponent render.
 */
export const SkeletonPage: FC<{
  className?: string;
}> = ({ className }) => (
  <div
    className={clsx('w-full flex flex-col gap-[24px]', className)}
    aria-busy="true"
  >
    <div className="flex items-center gap-[10px]">
      {/* 32x32 r8 is Buffer's measured channel avatar. Authored as 32 rather
          than 40 on purpose: the size ladder rewrites h-[40px] to 32px but has
          no width rung, so a 40x40 square here reserved 40 wide by 32 tall and
          the skeleton was a different shape from the thing it stands in for. */}
      <Skeleton className="w-[32px] h-[32px] !rounded-[8px] shrink-0" />
      <Skeleton className="h-[20px] w-[180px] max-w-[50%]" />
    </div>
    <div className="flex flex-col gap-[12px]">
      <Skeleton className="h-[96px] w-full" />
      <Skeleton className="h-[96px] w-full" />
      <Skeleton className="h-[96px] w-[60%]" />
    </div>
  </div>
);
