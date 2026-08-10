'use client';

import { FC, HTMLAttributes } from 'react';
import clsx from 'clsx';

/* Buffer-style loading: soft grey blocks shaped like the CONTENT they replace
   — never spinners. The shared layout skeleton component
   (components/layout/skeleton.tsx) did not exist when this was built, so the
   pattern classes are inlined here: bg-newTextColor/5 rounded-[8px]
   animate-pulse. If/when the shared component lands, these can delegate. */
export const SkeletonBlock: FC<HTMLAttributes<HTMLDivElement>> = ({
  className,
  ...rest
}) => (
  <div
    className={clsx(
      'bg-newTextColor/5 rounded-[8px] animate-pulse',
      className
    )}
    {...rest}
  />
);

/** Summary tiles — same grow/basis geometry as AnalyticsCard (216×77). */
export const TilesSkeleton: FC<{ count?: number }> = ({ count = 4 }) => (
  <div className="flex flex-wrap gap-[8px]">
    {Array.from({ length: count }).map((_, i) => (
      <SkeletonBlock
        key={`tile-skeleton-${i}`}
        className="grow basis-[200px] min-h-[77px]"
      />
    ))}
  </div>
);

/** Chart — metric-picker bar + the plot rectangle it will occupy. */
export const ChartSkeleton: FC = () => (
  <div className="flex flex-col gap-[10px]">
    <SkeletonBlock className="h-[24px] w-[260px] max-w-full" />
    <SkeletonBlock className="h-[220px] w-full" />
  </div>
);

/** Table — a shallow header bar + row bars (42px, untrapped by the ladder). */
export const TableRowsSkeleton: FC<{ rows?: number }> = ({ rows = 3 }) => (
  <div className="flex flex-col gap-[8px]">
    <SkeletonBlock className="h-[18px] w-full" />
    {Array.from({ length: rows }).map((_, i) => (
      <SkeletonBlock key={`table-skeleton-${i}`} className="h-[42px] w-full" />
    ))}
  </div>
);

/** Post rows — taller bars matching the two-line post row. */
export const PostRowsSkeleton: FC<{ rows?: number }> = ({ rows = 3 }) => (
  <div className="flex flex-col gap-[8px]">
    {Array.from({ length: rows }).map((_, i) => (
      <SkeletonBlock key={`post-skeleton-${i}`} className="h-[58px] w-full" />
    ))}
  </div>
);

/** Whole-page shape while /integrations/list loads: header chip + title,
    toolbar bar, then a grey Summary-shaped section holding tile blocks. */
export const AnalyticsPageSkeleton: FC = () => (
  <div className="bg-newBgColorInner flex-1 flex-col flex p-[20px] gap-[12px]">
    <div className="flex items-center gap-[10px]">
      {/* data-cs: the real header chip is a data-cs 40px r10 box — the
          skeleton must hold the same footprint, not the ladder's 32/8 */}
      <SkeletonBlock
        data-cs
        className="w-[40px] h-[40px] rounded-[10px] shrink-0"
      />
      <SkeletonBlock className="h-[20px] w-[120px]" />
    </div>
    <div className="border-b border-newTableBorder pb-[12px]">
      <SkeletonBlock className="h-[32px] w-[220px] max-w-full" />
    </div>
    <div className="bg-newTableHeader rounded-[12px] p-[8px] flex flex-col gap-[12px]">
      <div className="flex flex-col gap-[6px] px-[8px] pt-[8px]">
        <SkeletonBlock className="h-[16px] w-[90px]" />
        <SkeletonBlock className="h-[14px] w-[160px]" />
      </div>
      <TilesSkeleton />
    </div>
  </div>
);
