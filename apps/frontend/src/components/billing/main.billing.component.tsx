'use client';

import { Slider } from '@gitroom/react/form/slider';
import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@gitroom/react/form/button';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { Subscription } from '@prisma/client';
import { useDebouncedCallback } from 'use-debounce';
import { Loader } from '@gitroom/frontend/components/cuesoft/loader';
import { deleteDialog } from '@gitroom/react/helpers/delete.dialog';
import { useToaster } from '@gitroom/react/toaster/toaster';
import dayjs from 'dayjs';
import clsx from 'clsx';
import { pricing } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/pricing';
import { FAQComponent } from '@gitroom/frontend/components/billing/faq.component';
import { useSWRConfig } from 'swr';
import { useUser } from '@gitroom/frontend/components/layout/user.context';
import { useRouter, useSearchParams } from 'next/navigation';
import { useVariables } from '@gitroom/react/helpers/variable.context';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import { Textarea } from '@gitroom/react/form/textarea';
import { useFireEvents } from '@gitroom/helpers/utils/use.fire.events';
import { useUtmUrl } from '@gitroom/helpers/utils/utm.saver';
import { useTrack } from '@gitroom/react/helpers/use.track';
import { TrackEnum } from '@gitroom/nestjs-libraries/user/track.enum';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { FinishTrial } from '@gitroom/frontend/components/billing/finish.trial';
import { newDayjs } from '@gitroom/frontend/components/layout/set.timezone';
import { useDubClickId } from '@gitroom/frontend/components/layout/dubAnalytics';
import { LogoutComponent } from '@gitroom/frontend/components/layout/logout.component';
import { ModalFooter } from '@gitroom/frontend/components/cuesoft/modal/modal-footer';

export const Prorate: FC<{
  period: 'MONTHLY' | 'YEARLY';
  pack: 'STANDARD' | 'PRO';
}> = (props) => {
  const { period, pack } = props;
  const t = useT();
  const fetch = useFetch();
  const [price, setPrice] = useState<number | false>(0);
  const [loading, setLoading] = useState(false);
  const calculatePrice = useDebouncedCallback(async () => {
    setLoading(true);
    setPrice(
      (
        await (
          await fetch('/billing/prorate', {
            method: 'POST',
            body: JSON.stringify({
              period,
              billing: pack,
            }),
          })
        ).json()
      ).price
    );
    setLoading(false);
  }, 500);
  useEffect(() => {
    setPrice(false);
    calculatePrice();
  }, [period, pack]);
  if (loading) {
    return (
      <div className="pt-[12px]">
        <Loader size={20} color="#fff" />
      </div>
    );
  }
  if (price === false) {
    return null;
  }
  return (
    <div className="text-[12px] flex pt-[12px]">
      ({t('pay_today', 'Pay Today')} ${(price < 0 ? 0 : price)?.toFixed(1)})
    </div>
  );
};
export const Features: FC<{
  pack: 'FREE' | 'STANDARD' | 'PRO';
}> = (props) => {
  const { pack } = props;
  const features = useMemo(() => {
    const currentPricing = pricing[pack];
    const channelsOr = currentPricing.channel;
    const list = [];
    list.push(`${channelsOr} ${channelsOr === 1 ? 'channel' : 'channels'}`);
    list.push(
      `${
        currentPricing.posts_per_month > 10000
          ? 'Unlimited'
          : currentPricing.posts_per_month
      } posts per month`
    );
    if (currentPricing.team_members) {
      list.push(`Unlimited team members`);
    }
    if (currentPricing?.ai) {
      list.push(`AI auto-complete`);
      list.push(`AI copilots`);
      list.push(`AI Autocomplete`);
    }
    list.push(`Advanced Picture Editor`);
    if (currentPricing?.image_generator) {
      list.push(
        `${currentPricing?.image_generation_count} AI Images per month`
      );
    }
    if (currentPricing?.generate_videos) {
      list.push(`${currentPricing?.generate_videos} AI Videos per month`);
    }
    return list;
  }, [pack]);
  return (
    <div className="flex flex-col gap-[10px] justify-center text-[14px] text-newTableText">
      {features.map((feature) => (
        <div key={feature} className="flex gap-[20px]">
          <div>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-newTableTextFocused"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="m9 12 2 2 4-4" />
            </svg>
          </div>
          <div>{feature}</div>
        </div>
      ))}
    </div>
  );
};

const Accept: FC<{ resolve: (res: boolean) => void }> = ({ resolve }) => {
  const [loading, setLoading] = useState(false);
  const fetch = useFetch();
  const toaster = useToaster();

  const apply = useCallback(async () => {
    setLoading(true);
    await fetch('/billing/apply-discount', {
      method: 'POST',
    });

    resolve(true);
    toaster.show('50% discount applied successfully');
  }, []);

  return (
    <div>
      <div>
        Would you accept 50% discount for 3 months instead? 🙏🏻
      </div>
      <ModalFooter>
        <Button loading={loading} onClick={apply}>
          Apply 50% discount for 3 months
        </Button>
        <Button onClick={() => resolve(false)} className="!bg-red-700 !text-white">
          Cancel my subscription
        </Button>
      </ModalFooter>
    </div>
  );
};
const Info: FC<{
  proceed: (feedback: string) => void;
}> = (props) => {
  const [feedback, setFeedback] = useState('');
  const modal = useModals();
  const events = useFireEvents();
  const cancel = useCallback(() => {
    props.proceed(feedback);
    events('cancel_subscription');
    modal.closeAll();
  }, [modal, feedback]);

  const t = useT();

  return (
    <div className="relative flex gap-[20px] flex-col flex-1">
      <div>
        {t(
          'would_you_mind_shortly_tell_us_what_we_could_have_done_better',
          'Would you mind shortly tell us what we could have done better?'
        )}
      </div>
      <div>
        <Textarea
          className="bg-newBgColorInner"
          label={'Feedback'}
          name="feedback"
          disableForm={true}
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
        />
      </div>
      <div>
        <Button disabled={feedback.length < 20} onClick={cancel}>
          {feedback.length < 20
            ? t('please_add_at_least', 'Please add at least 20 chars')
            : t('cancel_subscription', 'Cancel Subscription')}
        </Button>
      </div>
    </div>
  );
};
export const MainBillingComponent: FC<{
  sub?: Subscription;
}> = (props) => {
  const { sub } = props;
  const { isGeneral } = useVariables();
  const { mutate } = useSWRConfig();
  const fetch = useFetch();
  const toast = useToaster();
  const user = useUser();
  const dub = useDubClickId();
  const modal = useModals();
  const router = useRouter();
  const utm = useUtmUrl();
  const track = useTrack();
  const t = useT();
  const queryParams = useSearchParams();
  const [finishTrial, setFinishTrial] = useState(
    !!queryParams.get('finishTrial')
  );

  const [subscription, setSubscription] = useState<Subscription | undefined>(
    sub
  );
  const [loading, setLoading] = useState<boolean>(false);
  const [period, setPeriod] = useState<'MONTHLY' | 'YEARLY'>(
    subscription?.period || 'MONTHLY'
  );
  const [monthlyOrYearly, setMonthlyOrYearly] = useState<'on' | 'off'>(
    period === 'MONTHLY' ? 'off' : 'on'
  );
  const [initialChannels, setInitialChannels] = useState(
    sub?.totalChannels || 1
  );
  useEffect(() => {
    if (initialChannels !== sub?.totalChannels) {
      setInitialChannels(sub?.totalChannels || 1);
    }
    if (period !== sub?.period) {
      setPeriod(sub?.period || 'MONTHLY');
      setMonthlyOrYearly(
        (sub?.period || 'MONTHLY') === 'MONTHLY' ? 'off' : 'on'
      );
    }
    setSubscription(sub);
  }, [sub]);
  const updatePayment = useCallback(async () => {
    const { portal } = await (await fetch('/billing/portal')).json();
    window.location.href = portal;
  }, []);
  const currentPackage = useMemo(() => {
    if (!subscription) {
      return 'FREE';
    }
    if (period === 'YEARLY' && monthlyOrYearly === 'off') {
      return '';
    }
    if (period === 'MONTHLY' && monthlyOrYearly === 'on') {
      return '';
    }
    return subscription?.subscriptionTier;
  }, [subscription, initialChannels, monthlyOrYearly, period]);
  const moveToCheckout = useCallback(
    (billing: 'STANDARD' | 'PRO' | 'FREE', reactivate = false) =>
      async () => {
        if (reactivate) {
          setLoading(true);
          const { cancel_at } = await (
            await fetch('/billing/cancel', {
              method: 'POST',
              body: JSON.stringify({
                feedback: '',
              }),
              headers: {
                'Content-Type': 'application/json',
              },
            })
          ).json();
          setSubscription((subs) => ({
            ...subs!,
            cancelAt: cancel_at,
          }));

          toast.show('Subscription reactivated successfully');
          setLoading(false);
          return;
        }

        const messages = [];
        if (
          !pricing[billing].team_members &&
          pricing[subscription?.subscriptionTier!]?.team_members
        ) {
          messages.push(
            `Your team members will be removed from your organization`
          );
        }
        if (billing === 'FREE') {
          if (
            subscription?.cancelAt ||
            (await deleteDialog(
              `Are you sure you want to cancel your subscription?
              ${messages.join(', ')}`,
              'Yes, cancel',
              'Cancel Subscription'
            ))
          ) {
            const checkDiscount = await (
              await fetch('/billing/check-discount')
            ).json();
            if (checkDiscount.offerCoupon) {
              const info = await new Promise((res) => {
                modal.openModal({
                  title: 'Before you cancel',
                  withCloseButton: true,
                  classNames: {
                    modal: 'text-textColor',
                  },
                  children: <Accept resolve={res} />,
                });
              });

              modal.closeAll();

              if (info) {
                return;
              }
            }

            const info = await new Promise((res) => {
              modal.openModal({
                title: t(
                  'we_are_sorry_to_see_you_go',
                  'We are sorry to see you go :('
                ),
                withCloseButton: true,
                classNames: {
                  modal: 'text-textColor',
                },
                children: <Info proceed={(e) => res(e)} />,
              });
            });

            setLoading(true);
            const { cancel_at } = await (
              await fetch('/billing/cancel', {
                method: 'POST',
                body: JSON.stringify({
                  feedback: info,
                }),
                headers: {
                  'Content-Type': 'application/json',
                },
              })
            ).json();
            setSubscription((subs) => ({
              ...subs!,
              cancelAt: cancel_at,
            }));
            if (cancel_at)
              toast.show('Subscription set to canceled successfully');
            setLoading(false);
          }
          return;
        }
        if (
          messages.length &&
          !(await deleteDialog(messages.join(', '), 'Yes, continue'))
        ) {
          return;
        }
        setLoading(true);
        const { url, portal, blocked } = await (
          await fetch('/billing/subscribe', {
            method: 'POST',
            body: JSON.stringify({
              period: monthlyOrYearly === 'on' ? 'YEARLY' : 'MONTHLY',
              utm,
              billing,
              ...(dub ? { dub } : {}),
            }),
          })
        ).json();
        if (blocked) {
          setLoading(false);
          await deleteDialog(
            t(
              'billing_other_account_subscribed',
              'Another account with this email already has an active subscription. Please log off and sign in to that account to manage your subscription.'
            ),
            t('ok', 'OK'),
            t('already_subscribed', 'Already subscribed')
          );
          return;
        }
        if (url) {
          await track(TrackEnum.InitiateCheckout, {
            value:
              pricing[billing][
                monthlyOrYearly === 'on' ? 'year_price' : 'month_price'
              ],
          });
          window.location.href = url;
          return;
        }
        if (portal) {
          if (
            await deleteDialog(
              'We could not charge your credit card, please update your payment method',
              'Update',
              'Payment Method Required'
            )
          ) {
            window.open(portal);
          }
        } else {
          setPeriod(monthlyOrYearly === 'on' ? 'YEARLY' : 'MONTHLY');
          setSubscription((subs) => ({
            ...subs!,
            subscriptionTier: billing,
            cancelAt: null,
          }));
          mutate(
            '/user/self',
            {
              ...user,
              tier: billing,
            },
            {
              revalidate: false,
            }
          );
          toast.show('Subscription updated successfully');
        }
        setLoading(false);
      },
    [monthlyOrYearly, subscription, user, utm]
  );
  if (user?.isLifetime) {
    router.replace('/');
    return null;
  }
  return (
    <div className="flex flex-col gap-[16px]">
      <div className="flex flex-row items-center">
        <div className="flex-1 text-[20px] font-display">
          {t('plans', 'Plans')}
        </div>
        <div className="flex items-center gap-[16px]">
          <div className="text-[14px] text-newTableText">
            {t('monthly', 'MONTHLY')}
          </div>
          <div>
            <Slider value={monthlyOrYearly} onChange={setMonthlyOrYearly} />
          </div>
          <div className="text-[14px] text-newTableText">
            {t('yearly', 'YEARLY')}
          </div>
        </div>
      </div>

      {finishTrial && <FinishTrial close={() => setFinishTrial(false)} />}
      <div className="flex gap-[16px] [@media(max-width:1024px)]:flex-col [@media(max-width:1024px)]:text-center">
        {Object.entries(pricing)
          .filter((f) => !isGeneral || f[0] !== 'FREE')
          .map(([name, values]) => (
            <div
              key={name}
              className="flex-1 bg-sixth border border-newTableBorder rounded-[12px] p-[24px] gap-[16px] flex flex-col [@media(max-width:1024px)]:items-center"
            >
              <div className="text-[18px] font-[600] font-display">{name}</div>
              <div className="text-[38px] flex gap-[2px] items-center">
                <div>
                  $
                  {monthlyOrYearly === 'on'
                    ? values.year_price
                    : values.month_price}
                </div>
                <div className={`text-[14px] text-newTableText`}>
                  {monthlyOrYearly === 'on' ? '/year' : '/month'}
                </div>
              </div>
              <div className="text-[14px] flex gap-[10px]">
                {currentPackage === name.toUpperCase() &&
                subscription?.cancelAt ? (
                  <div className="gap-[3px] flex flex-col">
                    <div>
                      <Button
                        onClick={moveToCheckout('FREE', true)}
                        loading={loading}
                      >
                        {t(
                          'reactivate_subscription',
                          'Reactivate subscription'
                        )}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    loading={loading}
                    disabled={
                      (!!subscription?.cancelAt &&
                        name.toUpperCase() === 'FREE') ||
                      currentPackage === name.toUpperCase()
                    }
                    className={clsx(
                      subscription &&
                        name.toUpperCase() === 'FREE' &&
                        '!bg-red-500'
                    )}
                    onClick={moveToCheckout(
                      name.toUpperCase() as 'STANDARD' | 'PRO'
                    )}
                  >
                    {currentPackage === name.toUpperCase()
                      ? 'Current Plan'
                      : name.toUpperCase() === 'FREE'
                      ? subscription?.cancelAt
                        ? `Downgrade on ${dayjs
                            .utc(subscription?.cancelAt)
                            .local()
                            .format('D MMM, YYYY')}`
                        : 'Cancel subscription'
                      : // @ts-ignore
                      (user?.tier === 'FREE' ||
                          user?.tier?.current === 'FREE') &&
                        user.allowTrial
                      ? t('start_7_days_free_trial', 'Start 7 days free trial')
                      : 'Purchase'}
                  </Button>
                )}
                {subscription &&
                  currentPackage !== name.toUpperCase() &&
                  name !== 'FREE' &&
                  !!name && (
                    <Prorate
                      period={monthlyOrYearly === 'on' ? 'YEARLY' : 'MONTHLY'}
                      pack={name.toUpperCase() as 'STANDARD' | 'PRO'}
                    />
                  )}
              </div>
              <Features
                pack={name.toUpperCase() as 'FREE' | 'STANDARD' | 'PRO'}
              />
            </div>
          ))}
      </div>
      {!!subscription?.id && (
        <div className="flex justify-center mt-[20px] gap-[10px]">
          <Button onClick={updatePayment}>
            {t(
              'update_payment_method_invoices_history',
              'Update Payment Method / Invoices History'
            )}
          </Button>
          {isGeneral && !subscription?.cancelAt && (
            <Button
              className="bg-red-500"
              loading={loading}
              onClick={moveToCheckout('FREE')}
            >
              {t('cancel_subscription_1', 'Cancel subscription')}
            </Button>
          )}
        </div>
      )}
      {subscription?.cancelAt && isGeneral && (
        <div className="text-center">
          {t(
            'your_subscription_will_be_canceled_at',
            'Your subscription will be canceled at'
          )}{' '}
          {newDayjs(subscription.cancelAt).local().format('D MMM, YYYY')}
          <br />
          {t(
            'you_will_never_be_charged_again',
            'You will never be charged again'
          )}
        </div>
      )}
      <FAQComponent />
      <div className="flex justify-center mt-[20px]">
        <LogoutComponent />
      </div>
    </div>
  );
};
