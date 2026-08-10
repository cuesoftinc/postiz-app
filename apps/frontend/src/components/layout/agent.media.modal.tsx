'use client';

import { FC, useCallback, useState } from 'react';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { Button } from '@gitroom/react/form/button';
import { ModalBody } from '@gitroom/frontend/components/cuesoft/modal/modal-body';

export const AgentMediaModal: FC = () => {
  const fetch = useFetch();
  const t = useT();
  const { closeCurrent } = useModals();
  const [loading, setLoading] = useState(false);

  const handleContinue = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/user/agent-media-sso');
      const data = await response.json();
      if (data.url) {
        window.open(data.url, '_blank');
      }
      closeCurrent();
    } catch (e) {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [fetch, closeCurrent]);

  return (
    <ModalBody gap={20} maxWidth={520}>
      <div className="text-[14px] leading-[22px] text-newTextColor">
        {t(
          'agent_media_different_company',
          'UGC videos are powered by AgentMedia (agent-media.ai), a separate product with its own account and pricing, not part of your Postiz subscription.'
        )}
      </div>

      <div className="flex flex-col gap-[12px]">
        <div className="text-[14px] font-[550] text-newTextColor">
          {t('agent_media_what_you_get', 'What you get with AgentMedia')}
        </div>
        <ul className="flex flex-col gap-[8px] text-[14px] leading-[20px] text-newTextColor">
          <li className="flex gap-[8px]">
            <span className="text-newTextColor/60">•</span>
            <span>
              {t(
                'agent_media_feature_videos',
                'AI-generated UGC videos with captions written and baked in automatically'
              )}
            </span>
          </li>
          <li className="flex gap-[8px]">
            <span className="text-newTextColor/60">•</span>
            <span>
              {t(
                'agent_media_feature_quality',
                'Studio-quality 9:16 vertical video at 1080p'
              )}
            </span>
          </li>
          <li className="flex gap-[8px]">
            <span className="text-newTextColor/60">•</span>
            <span>
              {t(
                'agent_media_feature_publish',
                'Auto-publishing to TikTok, Instagram, YouTube and X'
              )}
            </span>
          </li>
        </ul>
      </div>

      <div className="flex flex-col gap-[12px]">
        <div className="text-[14px] font-[550] text-newTextColor">
          {t('agent_media_pricing', 'Separate pricing')}
        </div>
        <div className="flex flex-col gap-[6px] text-[14px] leading-[20px] text-newTextColor">
          <div>
            {t('agent_media_plan_creator', 'Creator: $39/mo · 3,900 credits')}
          </div>
          <div>{t('agent_media_plan_pro', 'Pro: $69/mo · 6,900 credits')}</div>
          <div>
            {t(
              'agent_media_plan_pro_plus',
              'Pro Plus: $129/mo · 12,900 credits + early access'
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-[12px] mt-[8px]">
        <Button loading={loading} onClick={handleContinue}>
          {t('agent_media_continue', 'Continue to AgentMedia')}
        </Button>
        <Button secondary={true} onClick={closeCurrent}>
          {t('cancel', 'Cancel')}
        </Button>
      </div>
    </ModalBody>
  );
};
