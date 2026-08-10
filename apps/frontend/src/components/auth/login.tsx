'use client';

import { useForm, SubmitHandler, FormProvider } from 'react-hook-form';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import Link from 'next/link';
import { Button } from '@gitroom/react/form/button';
import { Input } from '@gitroom/react/form/input';
import { useMemo, useState } from 'react';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { LoginUserDto } from '@gitroom/nestjs-libraries/dtos/auth/login.user.dto';
import { GithubProvider } from '@gitroom/frontend/components/auth/providers/github.provider';
import { OauthProvider } from '@gitroom/frontend/components/auth/providers/oauth.provider';
import { GoogleProvider } from '@gitroom/frontend/components/auth/providers/google.provider';
import { useVariables } from '@gitroom/react/helpers/variable.context';
import { FarcasterProvider } from '@gitroom/frontend/components/auth/providers/farcaster.provider';
import WalletProvider from '@gitroom/frontend/components/auth/providers/wallet.provider';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import {
  AUTH_BUTTON,
  AUTH_INPUT,
  AUTH_LINK,
  AUTH_SUBLINE,
  AUTH_TITLE,
} from '@gitroom/frontend/components/auth/auth.ui';
type Inputs = {
  email: string;
  password: string;
  providerToken: '';
  provider: 'LOCAL';
};

/** "Account not activated" notice, calibrated for the light card. */
const NotActivatedNotice = () => {
  const t = useT();
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-[8px] p-[16px]">
      <p className="text-amber-800 text-[14px] mb-[8px]">
        {t(
          'account_not_activated',
          'Your account is not activated yet. Please check your email for the activation link.'
        )}
      </p>
      <Link
        href="/auth/activate"
        className="text-amber-800 text-[14px] underline"
      >
        {t('resend_activation_email', 'Resend Activation Email')}
      </Link>
    </div>
  );
};

export function Login() {
  const t = useT();
  const [loading, setLoading] = useState(false);
  const [notActivated, setNotActivated] = useState(false);
  // SSO-only mode secondary path: reveal the LOCAL email/password form for
  // direct-provisioned accounts outside the Google Workspace. Declared with
  // the other hooks, before any early return, to keep hook order stable.
  const [showEmail, setShowEmail] = useState(false);
  const { isGeneral, neynarClientId, billingEnabled, genericOauth } =
    useVariables();
  const resolver = useMemo(() => {
    return classValidatorResolver(LoginUserDto);
  }, []);
  const form = useForm<Inputs>({
    resolver,
    defaultValues: {
      providerToken: '',
      provider: 'LOCAL',
    },
  });
  const fetchData = useFetch();
  const onSubmit: SubmitHandler<Inputs> = async (data) => {
    setLoading(true);
    setNotActivated(false);
    const login = await fetchData('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        ...data,
        provider: 'LOCAL',
      }),
    });
    if (login.status === 400) {
      const errorMessage = await login.text();
      if (errorMessage === 'User is not activated') {
        setNotActivated(true);
      } else {
        form.setError('email', {
          message: errorMessage,
        });
      }
      setLoading(false);
    }
  };
  // SSO-only mode (Cuesoft internal): render a clean, dedicated Generic OIDC
  // sign-in block. Every hook above runs unconditionally before this early
  // return, so hook order is stable. The legacy Github/Google/email-password
  // form below is kept intact but unreachable while isGeneral && genericOauth.
  if (isGeneral && genericOauth) {
    return (
      <FormProvider {...form}>
        <div className="flex flex-col flex-1 gap-[24px]">
          <div className="flex flex-col gap-[4px]">
            <h1 className={AUTH_TITLE}>{t('sign_in', 'Sign In')}</h1>
            <div className={AUTH_SUBLINE}>
              {t('sign_in_subline', 'Welcome back. Sign in to continue.')}
            </div>
          </div>
          {/* Primary: Cuesoft SSO */}
          <div className="flex">
            <OauthProvider />
          </div>
          {/* Secondary, discreet: LOCAL email/password for direct-provisioned
              accounts that cannot use SSO. Reuses the same form + onSubmit. */}
          {!showEmail ? (
            <div className="text-center">
              <button
                type="button"
                onClick={() => setShowEmail(true)}
                className={AUTH_LINK}
              >
                {t('sign_in_with_email', 'Sign in with email')}
              </button>
            </div>
          ) : (
            <form
              className="flex flex-col gap-[12px]"
              onSubmit={form.handleSubmit(onSubmit)}
            >
              <div className="text-newTextColor">
                <Input
                  label="Email"
                  translationKey="label_email"
                  {...form.register('email')}
                  className={AUTH_INPUT}
                  type="email"
                  placeholder={t('email_address', 'Email Address')}
                />
                <Input
                  label="Password"
                  translationKey="label_password"
                  {...form.register('password')}
                  className={AUTH_INPUT}
                  autoComplete="off"
                  type="password"
                  placeholder={t('label_password', 'Password')}
                />
              </div>
              {notActivated && <NotActivatedNotice />}
              <div className="w-full flex">
                <Button type="submit" className={AUTH_BUTTON} loading={loading}>
                  {t('sign_in_1', 'Sign in')}
                </Button>
              </div>
              <p className="text-center">
                <Link href="/auth/forgot" className={AUTH_LINK}>
                  {t('forgot_password', 'Forgot password')}
                </Link>
              </p>
            </form>
          )}
        </div>
      </FormProvider>
    );
  }
  return (
    <FormProvider {...form}>
      <form className="flex-1 flex" onSubmit={form.handleSubmit(onSubmit)}>
        <div className="flex flex-col flex-1">
          <div className="flex flex-col gap-[4px]">
            <h1 className={AUTH_TITLE}>{t('sign_in', 'Sign In')}</h1>
            <div className={AUTH_SUBLINE}>
              {t('sign_in_subline', 'Welcome back. Sign in to continue.')}
            </div>
          </div>
          <div className="flex flex-col mt-[24px]">
            {isGeneral && genericOauth ? (
              <OauthProvider />
            ) : !isGeneral ? (
              <GithubProvider />
            ) : (
              <div className="gap-[8px] flex">
                <GoogleProvider />
                {!!neynarClientId && <FarcasterProvider />}
                {billingEnabled && <WalletProvider />}
              </div>
            )}
            <div className="h-[20px] mb-[24px] mt-[24px] relative">
              <div className="absolute w-full h-[1px] bg-newTableBorder top-[50%] -translate-y-[50%]" />
              <div
                className={`absolute z-[1] justify-center items-center w-full start-0 top-[50%] -translate-y-[50%] flex`}
              >
                <div
                  className={`px-[16px] bg-newBgColorInner ${AUTH_SUBLINE}`}
                >
                  {t('or', 'or')}
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-[12px]">
              <div className="text-newTextColor">
                <Input
                  label="Email"
                  translationKey="label_email"
                  {...form.register('email')}
                  className={AUTH_INPUT}
                  type="email"
                  placeholder={t('email_address', 'Email Address')}
                />
                <Input
                  label="Password"
                  translationKey="label_password"
                  {...form.register('password')}
                  className={AUTH_INPUT}
                  autoComplete="off"
                  type="password"
                  placeholder={t('label_password', 'Password')}
                />
              </div>
              {notActivated && <NotActivatedNotice />}
              <div className="text-center mt-[12px]">
                <div className="w-full flex">
                  <Button
                    type="submit"
                    className={AUTH_BUTTON}
                    loading={loading}
                  >
                    {t('sign_in_1', 'Sign in')}
                  </Button>
                </div>
                <p className="mt-[16px]">
                  <Link href="/auth/forgot" className={AUTH_LINK}>
                    {t('forgot_password', 'Forgot password')}
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </form>
    </FormProvider>
  );
}
