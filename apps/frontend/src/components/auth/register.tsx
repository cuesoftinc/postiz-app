'use client';

import { FormProvider, SubmitHandler, useForm } from 'react-hook-form';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import Link from 'next/link';
import { Button } from '@gitroom/react/form/button';
import { Input } from '@gitroom/react/form/input';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { CreateOrgUserDto } from '@gitroom/nestjs-libraries/dtos/auth/create.org.user.dto';
import { GithubProvider } from '@gitroom/frontend/components/auth/providers/github.provider';
import { useRouter, useSearchParams } from 'next/navigation';
import { LoadingComponent } from '@gitroom/frontend/components/layout/loading';
import clsx from 'clsx';
import { GoogleProvider } from '@gitroom/frontend/components/auth/providers/google.provider';
import { OauthProvider } from '@gitroom/frontend/components/auth/providers/oauth.provider';
import { useFireEvents } from '@gitroom/helpers/utils/use.fire.events';
import { useVariables } from '@gitroom/react/helpers/variable.context';
import { useTrack } from '@gitroom/react/helpers/use.track';
import { TrackEnum } from '@gitroom/nestjs-libraries/user/track.enum';
import { FarcasterProvider } from '@gitroom/frontend/components/auth/providers/farcaster.provider';
import dynamic from 'next/dynamic';
import { WalletUiProvider } from '@gitroom/frontend/components/auth/providers/placeholder/wallet.ui.provider';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import useCookie from 'react-use-cookie';
const WalletProvider = dynamic(
  () => import('@gitroom/frontend/components/auth/providers/wallet.provider'),
  {
    ssr: false,
    loading: () => <WalletUiProvider />,
  }
);
type Inputs = {
  email: string;
  password: string;
  company: string;
  providerToken: string;
  provider: string;
};
export function Register() {
  const t = useT();
  const { isGeneral, genericOauth } = useVariables();
  const getQuery = useSearchParams();
  const fetch = useFetch();
  const [provider] = useState(getQuery?.get('provider')?.toUpperCase());
  const [code, setCode] = useState(getQuery?.get('code') || '');
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (provider && code) {
      load();
    }
  }, []);
  const load = useCallback(async () => {
    const { token } = await (
      await fetch(`/auth/oauth/${provider?.toUpperCase() || 'LOCAL'}/exists`, {
        method: 'POST',
        body: JSON.stringify({
          code,
        }),
      })
    ).json();
    if (token) {
      setCode(token);
      setShow(true);
    }
  }, [provider, code]);
  // Pre-auth signup UI only (no OAuth callback in progress: no code & no
  // provider). In SSO-only mode render the same clean Generic OIDC block as
  // /auth/login instead of the email/password sign-up form. The OAuth callback
  // path (provider && code -> load() -> RegisterAfter) below is untouched.
  if (!code && !provider) {
    if (isGeneral && genericOauth) {
      return (
        <div className="flex flex-col flex-1 gap-[24px]">
          <h1 className="text-[40px] font-[500] -tracking-[0.8px] text-start">
            {t('sign_in', 'Sign In')}
          </h1>
          <div className="flex">
            <OauthProvider />
          </div>
        </div>
      );
    }
    return <RegisterAfter token="" provider="LOCAL" />;
  }
  if (!show) {
    return <LoadingComponent />;
  }
  return (
    <RegisterAfter token={code} provider={provider?.toUpperCase() || 'LOCAL'} />
  );
}
function getHelpfulReasonForRegistrationFailure(httpCode: number) {
  switch (httpCode) {
    case 400:
      return 'Email already exists';
    case 404:
      return 'Your browser got a 404 when trying to contact the API, the most likely reasons for this are the NEXT_PUBLIC_BACKEND_URL is set incorrectly, or the backend is not running.';
  }
  return 'Unhandled error: ' + httpCode;
}
export function RegisterAfter({
  token,
  provider,
}: {
  token: string;
  provider: string;
}) {
  const t = useT();
  const { isGeneral, genericOauth, neynarClientId, billingEnabled } =
    useVariables();
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const fireEvents = useFireEvents();
  const track = useTrack();
  const [datafast_visitor_id] = useCookie('datafast_visitor_id');
  const isAfterProvider = useMemo(() => {
    return !!token && !!provider;
  }, [token, provider]);
  // SSO (provider) registrations skip the company-name screen entirely: a
  // provider token is present and the provider is not LOCAL. For these we
  // default the company field to a sensible non-empty value (>= 3 chars, so
  // CreateOrgUserDto still validates) and auto-submit once on mount. LOCAL
  // signup is unchanged and still shows the company field.
  const isProviderSignup = !!token && provider !== 'LOCAL';
  const resolver = useMemo(() => {
    return classValidatorResolver(CreateOrgUserDto);
  }, []);
  const form = useForm<Inputs>({
    resolver,
    defaultValues: {
      providerToken: token,
      provider: provider,
      // No human-entered name/email is available in provider mode, so default
      // the personal-workspace org name to a constant. The user joins Cuesoft
      // Inc via the invite afterwards.
      ...(isProviderSignup ? { company: 'Personal' } : {}),
    },
  });
  const fetchData = useFetch();
  const autoSubmittedRef = useRef(false);
  const onSubmit: SubmitHandler<Inputs> = async (data) => {
    setLoading(true);
    await fetchData('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        ...data,
        datafast_visitor_id,
      }),
    })
      .then(async (response) => {
        setLoading(false);
        if (response.status === 200) {
          fireEvents('register');
          return track(TrackEnum.CompleteRegistration).then(() => {
            if (response.headers.get('activate') === 'true') {
              router.push('/auth/activate');
            } else {
              router.push('/auth/login');
            }
          });
        } else {
          form.setError('email', {
            message: await response.text(),
          });
        }
      })
      .catch((e) => {
        form.setError('email', {
          message:
            'General error: ' +
            e.toString() +
            '. Please check your browser console.',
        });
      });
  };
  useEffect(() => {
    if (!isProviderSignup) {
      return;
    }
    // Guard against React StrictMode's double-invoked effects (dev) so the
    // registration is submitted exactly once. The `company` default is already
    // seeded via defaultValues above, so handleSubmit validates and submits it.
    if (autoSubmittedRef.current) {
      return;
    }
    autoSubmittedRef.current = true;
    form.handleSubmit(onSubmit)();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Provider mode never renders the form; it shows a loading state while the
  // auto-submit above completes and the user is redirected.
  if (isProviderSignup) {
    return <LoadingComponent />;
  }
  return (
    <FormProvider {...form}>
      <form className="flex-1 flex" onSubmit={form.handleSubmit(onSubmit)}>
        <div className="flex flex-col flex-1">
          <div>
            <h1 className="text-[40px] font-[500] -tracking-[0.8px] text-start cursor-pointer">
              {t('sign_up', 'Sign Up')}
            </h1>
          </div>
          <div className="text-[14px] mt-[32px] mb-[12px]">
            {t('continue_with', 'Continue With')}
          </div>
          <div className="flex flex-col">
            {!isAfterProvider &&
              (!isGeneral ? (
                <GithubProvider />
              ) : (
                <div className="gap-[8px] flex">
                  {genericOauth && isGeneral ? (
                    <OauthProvider />
                  ) : (
                    <GoogleProvider />
                  )}
                  {!!neynarClientId && <FarcasterProvider />}
                  {billingEnabled && <WalletProvider />}
                </div>
              ))}
            {!isAfterProvider && (
              <div className="h-[20px] mb-[24px] mt-[24px] relative">
                <div className="absolute w-full h-[1px] bg-fifth top-[50%] -translate-y-[50%]" />
                <div
                  className={`absolute z-[1] justify-center items-center w-full start-0 -top-[4px] flex`}
                >
                  <div className="px-[16px]">{t('or', 'or')}</div>
                </div>
              </div>
            )}
            <div className="flex flex-col gap-[12px]">
              <div className="text-textColor">
                {!isAfterProvider && (
                  <>
                    <Input
                      label="Email"
                      translationKey="label_email"
                      {...form.register('email')}
                      type="email"
                      placeholder={t('email_address', 'Email Address')}
                    />
                    <Input
                      label="Password"
                      translationKey="label_password"
                      {...form.register('password')}
                      autoComplete="off"
                      type="password"
                      placeholder={t('label_password', 'Password')}
                    />
                  </>
                )}
                <Input
                  label="Company"
                  translationKey="label_company"
                  {...form.register('company')}
                  autoComplete="off"
                  type="text"
                  placeholder={t('label_company', 'Company')}
                />
              </div>
              <div className={clsx('text-[12px]')}>
                {t(
                  'by_registering_you_agree_to_our',
                  'By registering you agree to our'
                )}
                &nbsp;
                <a
                  href={`https://postiz.com/terms`}
                  className="underline hover:font-bold"
                  rel="nofollow"
                >
                  {t('terms_of_service', 'Terms of Service')}
                </a>
                &nbsp;
                {t('and', 'and')}&nbsp;
                <a
                  href={`https://postiz.com/privacy`}
                  rel="nofollow"
                  className="underline hover:font-bold"
                >
                  {t('privacy_policy', 'Privacy Policy')}
                </a>
                &nbsp;
              </div>
              <div className="text-center mt-6">
                <div className="w-full flex">
                  <Button
                    type="submit"
                    className="flex-1 rounded-[10px] !h-[52px]"
                    loading={loading}
                  >
                    {t('create_account', 'Create Account')}
                  </Button>
                </div>
                <p className="mt-4 text-sm">
                  {t('already_have_an_account', 'Already Have An Account?')}
                  &nbsp;
                  <Link
                    href="/auth/login"
                    className="underline  cursor-pointer"
                  >
                    {t('sign_in', 'Sign In')}
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