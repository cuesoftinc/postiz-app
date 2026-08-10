'use client';

import { FC } from 'react';
import { SkeletonPage } from '@gitroom/frontend/components/layout/skeleton';

// Spinner stays exported for ACTION progress only (inside buttons while a
// user-triggered request runs — ai.image's generate chip). Content loading
// must use the skeletons in layout/skeleton.tsx instead (Buffer never shows
// a spinner where content is about to appear).
const Spinner: FC<{
  type?: string;
  color?: string;
  width?: number;
  height?: number;
}> = ({ color = '#325ea6', width = 100, height = 100 }) => {
  const size = Math.min(width, height);
  const borderWidth = Math.max(2, Math.round(size / 8));

  return (
    <div
      style={{
        width: size,
        height: size,
        border: `${borderWidth}px solid transparent`,
        borderTopColor: color,
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }}
    />
  );
};

export { Spinner as default };

// Kept exported under its old name/signature (width/height are accepted and
// ignored) so every existing consumer keeps compiling, but it now renders
// the Buffer-style generic page skeleton instead of the pt-[100px] spinner.
export const LoadingComponent: FC<{
  width?: number;
  height?: number;
}> = () => {
  return (
    <div className="flex-1 w-full p-[20px]">
      <SkeletonPage />
    </div>
  );
};
