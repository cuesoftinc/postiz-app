'use client';

import { Tooltip } from 'react-tooltip';
export const ToolTip = () => {
  return (
    // Buffer tooltips (measured): max-width 170px, body line-height; body
    // copy at 13px (measured 12-13px). Colors stay ours — react-tooltip's
    // core styles are injected at runtime, so the metric overrides carry !
    <Tooltip
      className="z-[200] !max-w-[170px] !text-[13px] !leading-[1.5]"
      id="tooltip"
    />
  );
};
