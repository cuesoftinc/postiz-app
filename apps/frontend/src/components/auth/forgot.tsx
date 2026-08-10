'use client';

import { useForm, SubmitHandler, FormProvider } from 'react-hook-form';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import Link from 'next/link';
import { Button } from '@gitroom/react/form/button';
import { Input } from '@gitroom/react/form/input';
import { useMemo, useState } from 'react';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { ForgotPasswordDto } from '@gitroom/nestjs-libraries/dtos/auth/forgot.password.dto';
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
};
export function Forgot() {
  const t = useT();
  const [loading, setLoading] = useState(false);
  const [state, setState] = useState(false);
  const resolver = useMemo(() => {
    return classValidatorResolver(ForgotPasswordDto);
  }, []);
  const form = useForm<Inputs>({
    resolver,
  });
  const fetchData = useFetch();
  const onSubmit: SubmitHandler<Inputs> = async (data) => {
    setLoading(true);
    await fetchData('/auth/forgot', {
      method: 'POST',
      body: JSON.stringify({
        ...data,
        provider: 'LOCAL',
      }),
    });
    setState(true);
    setLoading(false);
  };
  return (
    <div className="flex flex-1 flex-col">
      <FormProvider {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className="flex flex-col gap-[4px] mb-[24px]">
            <h1 className={AUTH_TITLE}>
              {t('forgot_password_1', 'Forgot Password')}
            </h1>
            <div className={AUTH_SUBLINE}>
              {t(
                'forgot_password_subline',
                'Enter your email and we will send you a reset link.'
              )}
            </div>
          </div>
          {!state ? (
            <>
              <div className="text-newTextColor">
                <Input
                  label="Email"
                  translationKey="label_email"
                  {...form.register('email')}
                  className={AUTH_INPUT}
                  type="email"
                  placeholder={t('email_address', 'Email Address')}
                />
              </div>
              <div className="text-center mt-[12px]">
                <div className="w-full flex">
                  <Button
                    type="submit"
                    className={AUTH_BUTTON}
                    loading={loading}
                  >
                    {t(
                      'send_password_reset_email',
                      'Send Password Reset Email'
                    )}
                  </Button>
                </div>
                <p className="mt-[16px]">
                  <Link href="/auth" className={AUTH_LINK}>
                    {t('go_back_to_login', 'Go back to login')}
                  </Link>
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="text-start text-[14px] text-newTextColor">
                {t(
                  'we_have_send_you_an_email_with_a_link_to_reset_your_password',
                  'We have send you an email with a link to reset your password.'
                )}
              </div>
              <p className="mt-[16px]">
                <Link href="/auth" className={AUTH_LINK}>
                  {t('go_back_to_login', 'Go back to login')}
                </Link>
              </p>
            </>
          )}
        </form>
      </FormProvider>
    </div>
  );
}
