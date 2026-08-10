'use client';

import React, { FC, useCallback, useMemo, useState } from 'react';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import useSWR from 'swr';
import { orderBy } from 'lodash';
import clsx from 'clsx';
import SafeImage from '@gitroom/react/helpers/safe.image';
import { AddProviderComponent } from '@gitroom/frontend/components/launches/add.provider.component';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import { ModalCloseButton } from '@gitroom/frontend/components/cuesoft/modal/modal-close-button';

interface OnboardingModalProps {
  onClose: () => void;
}

export const OnboardingModal: FC<OnboardingModalProps> = ({ onClose }) => {
  const [step, setStep] = useState(1);
  const modals = useModals();
  const t = useT();

  return (
    <div className="w-full min-h-full flex-1 p-[40px] flex relative">
      <style>
        {`#support-discord {display: none}`}
      </style>
      <div className="flex flex-1 bg-newBgColorInner rounded-[24px] flex-col relative">
        <ModalCloseButton onClick={modals.closeAll} />
        <div className="flex-1 flex p-[40px]">
          <div className="flex flex-col gap-[24px] flex-1">
            {/* Step indicators */}
            <div className="flex items-center justify-center gap-[16px]">
              <div className="flex items-center gap-[8px]">
                <div
                  className={clsx(
                    'w-[32px] h-[32px] rounded-full flex items-center justify-center text-[14px] font-semibold transition-colors',
                    step === 1
                      ? 'bg-boxFocused text-textItemFocused'
                      : 'bg-newTableHeader'
                  )}
                >
                  1
                </div>
                <span
                  className={clsx(
                    'text-[14px]',
                    step === 1 ? 'font-medium' : 'text-textItemBlur'
                  )}
                >
                  {t('connect_channels', 'Connect Channels')}
                </span>
              </div>
              <div className="w-[40px] h-[2px] bg-boxFocused" />
              <div className="flex items-center gap-[8px]">
                <div
                  className={clsx(
                    'w-[32px] h-[32px] rounded-full flex items-center justify-center text-[14px] font-semibold transition-colors',
                    step === 2
                      ? 'bg-boxFocused text-textItemFocused'
                      : 'bg-newTableHeader'
                  )}
                >
                  2
                </div>
                <span
                  className={clsx(
                    'text-[14px]',
                    step === 2 ? 'font-medium' : 'text-textItemBlur'
                  )}
                >
                  {t('watch_tutorial', 'Watch Tutorial')}
                </span>
              </div>
            </div>

            {/* Step content */}
            {step === 1 && (
              <OnboardingStep1
                onNext={() => setStep(2)}
                onSkip={() => setStep(2)}
              />
            )}
            {step === 2 && (
              <OnboardingStep2 onBack={() => setStep(1)} onFinish={onClose} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const OnboardingStep1: FC<{ onNext: () => void; onSkip: () => void }> = ({
  onNext,
  onSkip,
}) => {
  const fetch = useFetch();
  const t = useT();

  const getIntegrations = useCallback(async () => {
    return (await fetch('/integrations')).json();
  }, []);

  const load = useCallback(async (path: string) => {
    const list = (await (await fetch(path)).json()).integrations;
    return list;
  }, []);

  const { data: integrations } = useSWR('/integrations/list', load, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
    revalidateOnMount: true,
    refreshWhenHidden: false,
    refreshWhenOffline: false,
    fallbackData: [],
  });

  const sortedIntegrations = useMemo(() => {
    return orderBy(
      integrations,
      ['type', 'disabled', 'identifier'],
      ['desc', 'asc', 'asc']
    );
  }, [integrations]);

  const { data } = useSWR('get-all-integrations-onboarding', getIntegrations);

  return (
    <div className="flex flex-col gap-[24px]">
      <div className="flex gap-[4px] flex-col text-center">
        {/* Buffer replica: step titles in the display face, muted 14 helper.
            data-cs keeps the desktop ladder off the 24px title. */}
        <div data-cs className="text-[24px] font-[500] font-display">
          {t('connect_your_channels', 'Connect Your Channels')}
        </div>
        <div className="text-[14px] text-textItemBlur">
          {t(
            'connect_social_media_to_start',
            'Connect your social media accounts to start scheduling posts'
          )}
        </div>
      </div>

      {/* Connected channels */}
      {sortedIntegrations.length > 0 && (
        <div className="bg-newBgColorInner border border-newTableBorder rounded-[12px] p-[16px]">
          <div className="text-[12px] uppercase tracking-[0.08em] font-[500] text-newTextColor/60 mb-[12px]">
            {t('connected_channels', 'Connected Channels')} (
            {sortedIntegrations.length})
          </div>
          <div className="flex flex-wrap gap-[12px]">
            {sortedIntegrations.map((integration: any) => (
              <div
                key={integration.id}
                className="flex items-center gap-[8px] border border-newTableBorder rounded-[8px] px-[12px] py-[8px]"
              >
                <div className="relative w-[28px] h-[28px]">
                  <SafeImage
                    src={integration.picture}
                    className="rounded-full"
                    alt={integration.identifier}
                    width={28}
                    height={28}
                  />
                  <SafeImage
                    src={`/icons/platforms/${integration.identifier}.png`}
                    className="rounded-full absolute -bottom-[3px] -end-[3px] border border-newTableBorder"
                    alt={integration.identifier}
                    width={14}
                    height={14}
                  />
                </div>
                <span className="text-[13px]">{integration.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Available platforms - using AddProviderComponent */}
      <div className="flex flex-col gap-[12px]">
        <div className="text-[14px] font-medium">
          {t('click_channel_to_add', 'Click a channel to add it')}
        </div>
        {data && (
          <AddProviderComponent
            invite={false}
            social={data.social || []}
            article={data.article || []}
            onboarding={true}
          />
        )}
      </div>

      {/* Action buttons */}
      <div className="flex justify-end pt-[24px] mt-[8px]">
        <button
          onClick={onNext}
          className="group flex items-center gap-[12px] h-[44px] bg-btnPrimary hover:bg-[#a9e662] font-[600] px-[24px] rounded-[8px] text-[15px] transition-colors"
        >
          {sortedIntegrations.length > 0
            ? t('continue', 'Continue')
            : t('continue_without_channels', 'Continue without channels')}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="group-hover:translate-x-1 transition-transform"
          >
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
};

const OnboardingStep2: FC<{ onBack: () => void; onFinish: () => void }> = ({
  onBack,
  onFinish,
}) => {
  const t = useT();

  return (
    <div className="flex flex-col gap-[24px] flex-1">
      <div className="flex gap-[4px] flex-col text-center">
        <div data-cs className="text-[24px] font-[500] font-display">
          {t('watch_tutorial_title', 'Learn How to Use Postiz')}
        </div>
        <div className="text-[14px] text-textItemBlur">
          {t(
            'watch_tutorial_description',
            'Watch this short video to learn how to get the most out of Postiz'
          )}
        </div>
      </div>

      {/* YouTube Video Embed */}
      <div className="relative flex-1 rounded-[12px] overflow-hidden">
        <div className="absolute left-0 top-0 w-full h-full flex justify-center">
          <iframe
            className="h-full aspect-video"
            src="https://www.youtube.com/embed/BdsCVvEYgHU?si=vvhaZJ8I5oXXvVJS?autoplay=1"
            title="Postiz Tutorial"
            allow="autoplay"
            allowFullScreen
          />
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex justify-between pt-[24px] mt-[8px]">
        <button
          onClick={onBack}
          className="group flex items-center gap-[8px] h-[44px] bg-transparent border border-newTableBorder text-newTextColor hover:bg-boxHover font-[500] px-[20px] rounded-[8px] text-[14px] transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="group-hover:-translate-x-1 transition-transform"
          >
            <path d="m12 19-7-7 7-7" />
            <path d="M19 12H5" />
          </svg>
          {t('back', 'Back')}
        </button>
        <button
          onClick={onFinish}
          className="group flex items-center gap-[12px] h-[44px] bg-btnPrimary hover:bg-[#a9e662] font-[600] px-[24px] rounded-[8px] text-[15px] transition-colors"
        >
          {t('get_started', 'Get Started')}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="group-hover:scale-110 transition-transform"
          >
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        </button>
      </div>
    </div>
  );
};
