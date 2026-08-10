'use client';

import { useCallback } from 'react';
import SafeImage from '@gitroom/react/helpers/safe.image';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useVariables } from '@gitroom/react/helpers/variable.context';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { AUTH_PROVIDER_BUTTON } from '@gitroom/frontend/components/auth/auth.ui';
export const OauthProvider = () => {
  const fetch = useFetch();
  const { oauthLogoUrl, oauthDisplayName } = useVariables();
  const t = useT();
  const gotoLogin = useCallback(async () => {
    try {
      const response = await fetch('/auth/oauth/GENERIC');
      if (!response.ok) {
        throw new Error(
          `Login link request failed with status ${response.status}`
        );
      }
      const link = await response.text();
      window.location.href = link;
    } catch (error) {
      console.error('Failed to get generic oauth login link:', error);
    }
  }, []);
  // Kit provider button: white hairline 44px r8, 14/550 ink. The OIDC
  // handler (gotoLogin) is untouched; the label keeps the configured generic
  // provider naming (oauthDisplayName), "Continue with" per the kit.
  return (
    <div onClick={gotoLogin} className={AUTH_PROVIDER_BUTTON}>
      <div className="flex items-center justify-center w-[20px] h-[20px]">
        <SafeImage
          src={oauthLogoUrl || '/icons/generic-oauth.svg'}
          alt="genericOauth"
          width={20}
          height={20}
          className="object-contain"
        />
      </div>
      <div>
        {t('continue_with', 'Continue with')}&nbsp;
        {oauthDisplayName || 'Google'}
      </div>
    </div>
  );
};
