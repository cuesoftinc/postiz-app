'use client';

import { FC } from 'react';
import { useT } from '@gitroom/react/translation/get.transation.service.client';

/**
 * Buffer-style preview placeholder: a CSS-built grey post-card
 * (avatar circle + two line bars) with a muted hint underneath.
 * Pure presentation — rendered by the preview pane whenever a
 * provider has nothing to preview yet.
 */
export const PreviewEmptyState: FC = () => {
  const t = useT();

  return (
    <div className="flex flex-col items-center justify-center gap-[16px] py-[40px] select-none">
      <div className="w-[160px] h-[200px] rounded-[8px] bg-newTextColor/5 p-[16px] flex flex-col gap-[12px]">
        <div className="w-[24px] h-[24px] rounded-full bg-newTextColor/10" />
        <div className="h-[8px] w-[75%] rounded-[4px] bg-newTextColor/10" />
        <div className="h-[8px] w-[55%] rounded-[4px] bg-newTextColor/10" />
      </div>
      <div className="text-[14px] text-newTextColor/60">
        {t('see_post_preview_here', "See your post's preview here")}
      </div>
    </div>
  );
};
