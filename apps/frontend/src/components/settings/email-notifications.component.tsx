'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import useSWR from 'swr';
import { Slider } from '@gitroom/react/form/slider';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { Skeleton } from '@gitroom/frontend/components/layout/skeleton';

interface EmailNotifications {
  sendSuccessEmails: boolean;
  sendFailureEmails: boolean;
  sendStreakEmails: boolean;
}

export const useEmailNotifications = () => {
  const fetch = useFetch();

  const load = useCallback(async () => {
    return (await fetch('/user/email-notifications')).json();
  }, []);

  return useSWR<EmailNotifications>('email-notifications', load, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
    revalidateOnMount: true,
    refreshWhenHidden: false,
    refreshWhenOffline: false,
  });
};

const EmailNotificationsComponent = () => {
  const t = useT();
  const fetch = useFetch();
  const toaster = useToaster();
  const { data, isLoading } = useEmailNotifications();

  const [localSettings, setLocalSettings] = useState<EmailNotifications>({
    sendSuccessEmails: true,
    sendFailureEmails: true,
    sendStreakEmails: true,
  });

  // Keep a ref to always have the latest state
  const settingsRef = useRef(localSettings);
  settingsRef.current = localSettings;

  // Sync local state with fetched data
  useEffect(() => {
    if (data) {
      setLocalSettings(data);
    }
  }, [data]);

  const updateSetting = useCallback(
    async (key: keyof EmailNotifications, value: boolean) => {
      // Use ref to get the latest state
      const currentSettings = settingsRef.current;
      const newData = {
        ...currentSettings,
        [key]: value,
      };

      // Update local state immediately
      setLocalSettings(newData);

      await fetch('/user/email-notifications', {
        method: 'POST',
        body: JSON.stringify(newData),
      });

      toaster.show(t('settings_updated', 'Settings updated'), 'success');
    },
    []
  );

  const handleSuccessEmailsChange = useCallback(
    (value: 'on' | 'off') => {
      updateSetting('sendSuccessEmails', value === 'on');
    },
    [updateSetting]
  );

  const handleFailureEmailsChange = useCallback(
    (value: 'on' | 'off') => {
      updateSetting('sendFailureEmails', value === 'on');
    },
    [updateSetting]
  );

  const handleStreakEmailsChange = useCallback(
    (value: 'on' | 'off') => {
      updateSetting('sendStreakEmails', value === 'on');
    },
    [updateSetting]
  );

  if (isLoading) {
    // Skeleton shaped like the section below: 16/600 heading bar + three
    // label/description rows each with a slider-sized block on the end
    return (
      <div className="my-[16px] pt-[16px] border-t border-newTableBorder flex flex-col gap-[16px]">
        <Skeleton className="h-[16px] w-[180px]" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center justify-between gap-[16px]">
            <div className="flex flex-col flex-1 gap-[8px]">
              <Skeleton className="h-[14px] w-[130px]" />
              <Skeleton className="h-[12px] w-[320px] max-w-full" />
            </div>
            {/* 43x24, not 44x24: the real control is Buffer's measured
                43x24 toggle (form/slider.tsx). A skeleton that reserves
                geometry the component does not use shifts the row by a pixel
                on load, and it is how the 57x34 slider went unnoticed for so
                long: the measurement had reached the placeholder only. */}
            <Skeleton className="h-[24px] w-[43px] !rounded-full shrink-0" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="my-[16px] pt-[16px] border-t border-newTableBorder flex flex-col gap-[16px]">
      {/* section headings: 16/600 ink (type scale) */}
      <div className="text-[16px] font-[550]">
        {t('email_notifications', 'Email Notifications')}
      </div>
      <div className="flex items-center justify-between gap-[16px]">
        <div className="flex flex-col">
          <div className="text-[14px] font-[500]">
            {t('success_emails', 'Success Emails')}
          </div>
          <div className="text-[14px] text-textItemBlur">
            {t(
              'success_emails_description',
              'Receive email notifications when posts are published successfully'
            )}
          </div>
        </div>
        <Slider
          value={localSettings.sendSuccessEmails ? 'on' : 'off'}
          onChange={handleSuccessEmailsChange}
          fill={true}
        />
      </div>
      <div className="flex items-center justify-between gap-[16px]">
        <div className="flex flex-col">
          <div className="text-[14px] font-[500]">
            {t('failure_emails', 'Failure Emails')}
          </div>
          <div className="text-[14px] text-textItemBlur">
            {t(
              'failure_emails_description',
              'Receive email notifications when posts fail to publish'
            )}
          </div>
        </div>
        <Slider
          value={localSettings.sendFailureEmails ? 'on' : 'off'}
          onChange={handleFailureEmailsChange}
          fill={true}
        />
      </div>
      <div className="flex items-center justify-between gap-[16px]">
        <div className="flex flex-col">
          <div className="text-[14px] font-[500]">
            {t('streak_emails', 'Streak Reminder Emails')}
          </div>
          <div className="text-[14px] text-textItemBlur">
            {t(
              'streak_emails_description',
              'Receive email reminders when your posting streak is about to end'
            )}
          </div>
        </div>
        <Slider
          value={localSettings.sendStreakEmails ? 'on' : 'off'}
          onChange={handleStreakEmailsChange}
          fill={true}
        />
      </div>
    </div>
  );
};

export default EmailNotificationsComponent;

