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
    <div className="flex flex-col">
      {/* Buffer settings page title: 24/500 display face. data-cs opts out of
          the desktop ladder (which would pin text-[24px] to 20px); the phone
          ladder still steps it down to 18px. */}
      <h3 data-cs className="text-[24px] font-[500] font-display">
        {t('global_settings', 'Global Settings')}
      </h3>
      <MetricComponent />
      <EmailNotificationsComponent />
      <ShortlinkPreferenceComponent />
    </div>
  );
};
