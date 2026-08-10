'use client';

import { FC } from 'react';
import { Skeleton } from '@gitroom/frontend/components/layout/skeleton';

/* Buffer-style loading: soft grey blocks shaped like the CONTENT they
   replace — never spinners. The primitive is the shared layout/skeleton.tsx
   `Skeleton`; the shapes below are the Insights-page anatomies (summary
   tiles, chart rect, table rows, post rows, the page shell). */

/** Summary tiles — same grow/basis geometry as AnalyticsCard (216×77). */
export const TilesSkeleton: FC<{ count?: number }> = ({ count = 4 }) => (
  <div className="flex flex-wrap gap-[8px]">
    {Array.from({ length: count }).map((_, i) => (
      <Skeleton
        key={`tile-skeleton-${i}`}
        className="grow basis-[200px] min-h-[77px]"
      />
    ))}
  </div>
);

/** Chart — metric-picker bar + the plot rectangle it will occupy. */
export const ChartSkeleton: FC = () => (
  <div className="flex flex-col gap-[10px]">
    <Skeleton className="h-[24px] w-[260px] max-w-full" />
    <Skeleton className="h-[220px] w-full" />
  </div>
);

/** Table — a shallow header bar + row bars (42px, untrapped by the ladder). */
export const TableRowsSkeleton: FC<{ rows?: number }> = ({ rows = 3 }) => (
  <div className="flex flex-col gap-[8px]">
    <Skeleton className="h-[18px] w-full" />
    {Array.from({ length: rows }).map((_, i) => (
      <Skeleton key={`table-skeleton-${i}`} className="h-[42px] w-full" />
    ))}
  </div>
);

/** Post rows — taller bars matching the two-line post row. */
export const PostRowsSkeleton: FC<{ rows?: number }> = ({ rows = 3 }) => (
  <div className="flex flex-col gap-[8px]">
    {Array.from({ length: rows }).map((_, i) => (
      <Skeleton key={`post-skeleton-${i}`} className="h-[58px] w-full" />
    ))}
  </div>
);

/** Whole-page shape while /integrations/list loads: header chip + title,
    toolbar bar, then a grey Summary-shaped section holding tile blocks. */
export const AnalyticsPageSkeleton: FC = () => (
  <div className="bg-newBgColorInner flex-1 flex-col flex p-[20px] gap-[12px]">
    <div className="flex items-center gap-[10px]">
      {/* data-cs + raw block: the real header chip is a data-cs 40px r10 box,
          so its stand-in must hold the same footprint (the shared Skeleton
          rescales with the ladder by design and takes no data attrs) */}
      <div
        data-cs
        className="animate-pulse rounded-[10px] bg-newTextColor/5 w-[40px] h-[40px] shrink-0"
      />
      <Skeleton className="h-[20px] w-[120px]" />
    </div>
    <div className="border-b border-newTableBorder pb-[12px]">
      <Skeleton className="h-[32px] w-[220px] max-w-full" />
    </div>
    <div className="bg-newTableHeader rounded-[12px] p-[8px] flex flex-col gap-[12px]">
      <div className="flex flex-col gap-[6px] px-[8px] pt-[8px]">
        <Skeleton className="h-[16px] w-[90px]" />
        <Skeleton className="h-[14px] w-[160px]" />
      </div>
      <TilesSkeleton />
    </div>
  </div>
);
