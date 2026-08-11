'use client';

import { Tooltip } from 'react-tooltip';
export const ToolTip = () => {
  return (
    // Buffer tooltips (measured): max-width 170px, body line-height; body
    // copy at 13px (measured 12-13px). Colors stay ours — react-tooltip's
    // core styles are injected at runtime, so the metric overrides carry !
    // z-[750]: tooltip band (canonical z scale, global.scss) - the SINGLE z
    // declaration for tooltips; the old #tooltip{z-index:10000} escalation
    // in global.scss is gone. Above phone sheets (650), below toaster (900).
    <Tooltip
      className="z-[750] !max-w-[170px] !text-[13px] !leading-[1.5]"
      id="tooltip"
    />
  );
};
