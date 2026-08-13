'use client';

import { FC } from 'react';
import { Skeleton } from '@gitroom/frontend/components/layout/skeleton';
import { PageShell } from '@gitroom/frontend/components/new-layout/page-header';

/* Buffer-style loading: soft grey blocks shaped like the CONTENT they
   replace, never spinners. The primitive is the shared layout/skeleton.tsx
   `Skeleton`; the shapes below are the Insights-page anatomies.

   THESE NUMBERS ARE A PROMISE. A skeleton that draws a size the real
   component does not adopt is a defect in its own right (this fork already
   has one elsewhere, where a settings skeleton draws a Buffer-sized toggle
   the real control never took), so every dimension here is copied from the
   component that replaces it:

     tiles   -> render.analytics.tsx  AnalyticsCard   basis-[216px], min-h 77
     chart   -> analytics-chart.tsx   PLOT_HEIGHT     160
     cards   -> recent-posts.tsx      InsightCard     212 × 179, r12

   Change one of those and change it here in the same edit. */

/** Summary tiles: same grow/basis geometry as AnalyticsCard (Buffer 216×77).
    Five is Buffer's own tile count (Posts, Total Followers, Reactions,
    Comments, Eng. Rate); the real row renders one per metric the provider
    actually returns, so this is a shape, not a count promise. */
export const TilesSkeleton: FC<{ count?: number }> = ({ count = 5 }) => (
  <div className="flex flex-wrap gap-[8px]">
    {Array.from({ length: count }).map((_, i) => (
      <Skeleton
        key={`tile-skeleton-${i}`}
        className="grow basis-[216px] min-h-[77px]"
      />
    ))}
  </div>
);

/** Chart: metric-picker bar + the plot rectangle it will occupy. 160 tall
    because the chart is a 1060×160 bar chart now, not the 220 the line
    version used. */
export const ChartSkeleton: FC = () => (
  <div className="flex flex-col gap-[12px]">
    <Skeleton className="h-[24px] w-[260px] max-w-full" />
    <Skeleton className="h-[160px] w-full" />
  </div>
);

/** Top 5 Posts: five 212×179 r12 insight cards in one scrolling row, the
    exact footprint of recent-posts.tsx's InsightCard. This replaced a stack of
    58px row bars, which was the anatomy before the section became cards. */
export const InsightCardsSkeleton: FC<{ cards?: number }> = ({ cards = 5 }) => (
  <div className="flex gap-[8px] overflow-hidden">
    {Array.from({ length: cards }).map((_, i) => (
      <Skeleton
        key={`insight-card-skeleton-${i}`}
        className="w-[212px] h-[179px] shrink-0 rounded-[12px]"
      />
    ))}
  </div>
);

/** Whole-page shape while /integrations/list loads: header chip + title,
    toolbar bar, then a grey Summary-shaped section holding tile blocks.
    Container + header band mirror the shared PageShell/PageHeader
    (new-layout/page-header.tsx) so the loading→loaded swap doesn't shift.

    Deliberately NOT drawn here: the Export control. It only exists once there
    is data to export, so a block in its slot would promise a button that may
    never arrive: the same failure this file's header comment warns about. */
export const AnalyticsPageSkeleton: FC = () => (
  <PageShell>
    <div
      data-cs
      className="flex items-center gap-[10px] h-[48px] phone:h-[56px] shrink-0"
    >
      {/* data-cs + raw block: the real header chip is a data-cs 40px r10 box,
          so its stand-in must hold the same footprint (the shared Skeleton
          rescales with the ladder by design and takes no data attrs) */}
      <div
        data-cs
        className="animate-pulse rounded-[10px] bg-newTextColor/5 w-[40px] h-[40px] shrink-0"
      />
      <Skeleton className="h-[20px] w-[120px]" />
    </div>
    {/* channels dropdown + the range segmented. The segmented's real width
        depends on how many ranges the channel supports (three or four), which
        is unknowable before the channel loads, so this is one honest 32px bar
        rather than a precise width the control might not take. */}
    <div className="flex items-center gap-[10px] border-b border-newTableBorder pb-[12px]">
      <Skeleton className="h-[32px] w-[200px] max-w-full" />
      <Skeleton className="h-[32px] w-[280px] max-w-full phone:hidden" />
    </div>
    <div className="bg-newTableHeader rounded-[12px] p-[8px] flex flex-col gap-[12px]">
      <div className="flex flex-col gap-[6px] px-[8px] pt-[8px]">
        <Skeleton className="h-[16px] w-[90px]" />
        {/* the window subtitle is 12px now and names the comparison window,
            so it is a good deal wider than the old bare date range */}
        <Skeleton className="h-[12px] w-[280px] max-w-full" />
      </div>
      <TilesSkeleton />
    </div>
  </PageShell>
);
