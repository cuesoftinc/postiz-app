import { SkeletonPage } from '@gitroom/frontend/components/layout/skeleton';

// Route-group loading boundary: every page here is force-dynamic, so without
// this, navigation blanks the content column for the whole server round-trip —
// on phones that reads as a full page reload. Buffer-style: a page-shaped
// skeleton (S1 header chip + title bar over content blocks), never a spinner.
export default function Loading() {
  return (
    <div className="flex flex-1 flex-col bg-newBgColorInner min-h-[50vh] p-[20px] phone:p-[16px]">
      <SkeletonPage />
    </div>
  );
}
