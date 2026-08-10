'use client';

import React from 'react';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import dynamic from 'next/dynamic';
import EmailNotificationsComponent from '@gitroom/frontend/components/settings/email-notifications.component';
import ShortlinkPreferenceComponent from '@gitroom/frontend/components/settings/shortlink-preference.component';

const MetricComponent = dynamic(
  () => import('@gitroom/frontend/components/settings/metric.component'),
  {
    ssr: false,
  }
);

export const GlobalSettings = () => {
  const t = useT();
  return (
    // pb-[56px]: the fixed bottom-center admin pill (S6) hovers over dead
    // space instead of the last settings row's control.
    <div className="flex flex-col pb-[56px]">
      {/* Buffer settings content H1 measures 20px/400 display face (round-1
          structure JSON: 'Profile'). data-cs opts out of the desktop ladder
          so it renders at the literal 20px. */}
      <h3 data-cs className="text-[20px] font-[400] font-display">
        {t('global_settings', 'Global Settings')}
      </h3>
      <MetricComponent />
      <EmailNotificationsComponent />
      <ShortlinkPreferenceComponent />
    </div>
  );
};
