'use client';
import { useForm, SubmitHandler, FormProvider } from 'react-hook-form';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import Link from 'next/link';
import { Button } from '@gitroom/react/form/button';
import { Input } from '@gitroom/react/form/input';
import { useMemo, useState } from 'react';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { ForgotReturnPasswordDto } from '@gitroom/nestjs-libraries/dtos/auth/forgot-return.password.dto';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import {
  AUTH_BUTTON,
  AUTH_INPUT,
  AUTH_LINK,
  AUTH_SUBLINE,
  AUTH_TITLE,
} from '@gitroom/frontend/components/auth/auth.ui';
type Inputs = {
  password: string;
  repeatPassword: string;
  token: string;
};
export function ForgotReturn({ token }: { token: string }) {
  const [loading, setLoading] = useState(false);
  const t = useT();
  const [state, setState] = useState(false);
  const resolver = useMemo(() => {
    return classValidatorResolver(ForgotReturnPasswordDto);
  }, []);
  const form = useForm<Inputs>({
    resolver,
    mode: 'onChange',
    defaultValues: {
      token,
    },
  });
  const fetchData = useFetch();
  const onSubmit: SubmitHandler<Inputs> = async (data) => {
    setLoading(true);
    const { reset } = await (
      await fetchData('/auth/forgot-return', {
        method: 'POST',
        body: JSON.stringify({
          ...data,
        }),
      })
    ).json();
    setState(true);
    if (!reset) {
      form.setError('password', {
        type: 'manual',
        message: t('password_reset_link_expired', 'Your password reset link has expired. Please try again.'),
      });
      return false;
    }
    setLoading(false);
  };
  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <div className="flex flex-col gap-[4px] mb-[24px]">
          <h1 className={AUTH_TITLE}>
            {t('forgot_password_1', 'Forgot Password')}
          </h1>
          <div className={AUTH_SUBLINE}>
            {t(
              'reset_password_subline',
              'Choose a new password for your account.'
            )}
          </div>
        </div>
        {!state ? (
          <>
            <div className="text-newTextColor">
              <Input
                label="New Password"
                translationKey="label_new_password"
                {...form.register('password')}
                className={AUTH_INPUT}
                type="password"
                placeholder={t('label_password', 'Password')}
              />
              <Input
                label="Repeat Password"
                translationKey="label_repeat_password"
                {...form.register('repeatPassword')}
                className={AUTH_INPUT}
                type="password"
                placeholder={t('label_repeat_password', 'Repeat Password')}
              />
            </div>
            <div className="text-center mt-[12px]">
              <div className="w-full flex">
                <Button type="submit" className={AUTH_BUTTON} loading={loading}>
                  {t('change_password', 'Change Password')}
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
                'we_successfully_reset_your_password_you_can_now_login_with_your',
                'We successfully reset your password. You can now login with your'
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
  );
}
