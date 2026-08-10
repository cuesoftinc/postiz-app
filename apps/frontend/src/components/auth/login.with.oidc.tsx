'use client';

import { OauthProvider } from '@gitroom/frontend/components/auth/providers/oauth.provider';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { useVariables } from '@gitroom/react/helpers/variable.context';
import { AUTH_TITLE } from '@gitroom/frontend/components/auth/auth.ui';

export const LoginWithOidc = () => {
  const { isGeneral, genericOauth } = useVariables();
  const t = useT();

  if (!(isGeneral && genericOauth)) {
    return null;
  }

  return (
    <>
      <div className="mb-[16px]">
        <h1 className={AUTH_TITLE}>{t('sign_up', 'Sign Up')}</h1>
      </div>
      <OauthProvider />
      <div className="h-[20px] mb-[24px] mt-[24px] relative">
        <div className="absolute w-full h-[1px] bg-newTableBorder top-[50%] -translate-y-[50%]" />
        <div
          className={`absolute z-[1] justify-center items-center w-full start-0 top-0 flex`}
        />
      </div>
    </>
  );
};
