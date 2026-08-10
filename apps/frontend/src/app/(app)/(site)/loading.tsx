import { LoadingComponent } from '@gitroom/frontend/components/layout/loading';

// Route-group loading boundary: every page here is force-dynamic, so without
// this, navigation blanks the content column for the whole server round-trip —
// on phones that reads as a full page reload.
export default function Loading() {
  return (
    <div className="flex flex-1 items-center justify-center bg-newBgColorInner min-h-[50vh]">
      <LoadingComponent />
    </div>
  );
}
