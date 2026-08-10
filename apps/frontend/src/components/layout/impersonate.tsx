import { Input } from '@gitroom/react/form/input';
import { ChangeEventHandler, FC, useCallback, useMemo, useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useUser } from '@gitroom/frontend/components/layout/user.context';
import { Select } from '@gitroom/react/form/select';
import { pricing } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/pricing';
import { deleteDialog } from '@gitroom/react/helpers/delete.dialog';
import { useVariables } from '@gitroom/react/helpers/variable.context';
import { setCookie } from '@gitroom/frontend/components/layout/layout.context';
import { SkeletonText } from '@gitroom/frontend/components/layout/skeleton';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { Button } from '@gitroom/react/form/button';
import { ImportDebugPostModal } from '@gitroom/frontend/components/launches/import-debug-post.modal';
import { useForm, FormProvider } from 'react-hook-form';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { AdminAddTeamMemberDto } from '@gitroom/nestjs-libraries/dtos/settings/admin.add.team.member.dto';
import { ModalBody } from '@gitroom/frontend/components/cuesoft/modal/modal-body';
import { ModalFooter } from '@gitroom/frontend/components/cuesoft/modal/modal-footer';
import {
  Chip,
  ChoiceChipGroup,
} from '@gitroom/frontend/components/cuesoft/pressables';
import {
  UserSearchDropdown,
  UserSearchItem,
} from '@gitroom/frontend/components/cuesoft/dropdown/user-search-dropdown';
import { DropdownPanel } from '@gitroom/frontend/components/cuesoft/dropdown/dropdown-panel';

interface Charge {
  id: string;
  amount: number;
  currency: string;
  created: number;
  status: string;
  refunded: boolean;
  amount_refunded: number;
  description: string | null;
  receipt_url: string | null;
  invoice_pdf: string | null;
}

const useCharges = () => {
  const fetch = useFetch();
  return useSWR<Charge[]>('/billing/charges', async () => {
    return (await fetch('/billing/charges')).json();
  }, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
  });
};

interface CouponInfo {
  tier: string | null;
  period: string | null;
  isLifetime: boolean;
  monthlyPrice: number;
  planPrice: number;
  nextPayment: number | null;
  coupons: {
    type: string;
    value: number;
    duration: string;
    durationInMonths: number | null;
    remainingMonths: number | null;
  }[];
  supported: boolean;
}

const useCouponInfo = () => {
  const fetch = useFetch();
  return useSWR<CouponInfo>('/billing/coupon-info', async () => {
    return (await fetch('/billing/coupon-info')).json();
  }, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
  });
};

const ApplyCouponModal: FC<{ close: () => void }> = ({ close }) => {
  const fetch = useFetch();
  const t = useT();
  const toast = useToaster();
  const { data: info, mutate } = useCouponInfo();
  const [type, setType] = useState('percentage');
  const [value, setValue] = useState('');
  const [months, setMonths] = useState('1');
  const [error, setError] = useState('');
  const [applying, setApplying] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const handleCancelCoupon = useCallback(async () => {
    if (
      !(await deleteDialog(
        t(
          'cancel_coupon_confirm',
          'Are you sure you want to cancel this coupon? The user will pay the full price from the next billing cycle.'
        ),
        t('yes_cancel_coupon', 'Yes, cancel coupon'),
        t('cancel_coupon_title', 'Cancel Coupon?'),
        t('no_go_back', 'No, go back')
      ))
    ) {
      return;
    }
    setCancelling(true);
    try {
      const response = await fetch('/billing/cancel-coupon', {
        method: 'POST',
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok || !json.cancelled) {
        toast.show(
          json.reason ||
            t('cancel_coupon_failed', 'Could not cancel the coupon'),
          'warning'
        );
        return;
      }
      toast.show(t('cancel_coupon_success', 'Coupon cancelled'));
      await mutate();
    } finally {
      setCancelling(false);
    }
  }, []);

  const handleApply = useCallback(async () => {
    if (!info) {
      return;
    }
    const numberValue = Number(value);
    const numberMonths = Number(months);
    if (
      type === 'percentage' &&
      (!numberValue || numberValue < 1 || numberValue > 100)
    ) {
      setError(
        t(
          'apply_coupon_invalid_percentage',
          'Invalid percentage: enter a value between 1 and 100'
        )
      );
      return;
    }
    if (
      type === 'amount' &&
      (!numberValue || numberValue < 1 || numberValue > info.monthlyPrice)
    ) {
      setError(
        `${t(
          'apply_coupon_invalid_amount',
          "Invalid amount: enter a value between 1 and the plan's monthly payment:"
        )} ${info.monthlyPrice}`
      );
      return;
    }
    if (
      !numberMonths ||
      !Number.isInteger(numberMonths) ||
      numberMonths < 1 ||
      numberMonths > 12
    ) {
      setError(
        t(
          'apply_coupon_invalid_months',
          'Invalid months: enter a whole number between 1 and 12'
        )
      );
      return;
    }
    setError('');
    setApplying(true);
    try {
      const response = await fetch('/billing/apply-coupon', {
        method: 'POST',
        body: JSON.stringify({
          type,
          value: numberValue,
          months: numberMonths,
        }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok || !json.applied) {
        toast.show(
          json.reason ||
            t('apply_coupon_failed', 'Could not apply the coupon'),
          'warning'
        );
        return;
      }
      toast.show(t('apply_coupon_success', 'Coupon applied'));
      setValue('');
      setMonths('1');
      await mutate();
    } finally {
      setApplying(false);
    }
  }, [info, type, value, months]);

  return (
    <div className="flex flex-col gap-[16px]">
      <div className="text-newTextColor/60 text-[13px]">
        {t(
          'apply_coupon_subtitle',
          "The coupon applied here is simply a deduction from the user's next billing cycle(s) — one or more, depending on how many months you choose to apply it for. It is NOT a refund; we use Stripe's built-in coupon mechanism and that's how it works."
        )}
      </div>
      {!info ? (
        // skeleton rows shaped like the plan-detail lines below — never a
        // loading text/spinner
        <div className="py-[20px]">
          <SkeletonText rows={4} />
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-[4px] text-[14px]">
            <div>
              {t('apply_coupon_plan', 'Plan:')} {info.tier || 'FREE'}
              {!!info.tier && ` - $${info.planPrice}`}
            </div>
            <div>
              {t('apply_coupon_period', 'Period:')}{' '}
              {info.period === 'MONTHLY'
                ? t('monthly', 'Monthly')
                : info.period === 'YEARLY'
                ? t('annual', 'Annual')
                : '-'}
            </div>
            <div>
              {t('apply_coupon_lifetime', 'Lifetime deal:')}{' '}
              {info.isLifetime ? t('yes', 'Yes') : t('no', 'No')}
            </div>
            <div>
              {t('apply_coupon_applied', 'Applied coupons:')}{' '}
              {!info.coupons.length && t('none', 'None')}
            </div>
            {info.coupons.map((coupon, index) => (
              <div key={index} className="ps-[10px] flex items-center gap-[10px]">
                <div>
                  -{' '}
                  {coupon.type === 'percentage'
                    ? `${coupon.value}%`
                    : `$${coupon.value}`}{' '}
                  {t('apply_coupon_off', 'off,')}{' '}
                  {coupon.duration === 'repeating'
                    ? `${coupon.durationInMonths} ${t(
                        'apply_coupon_months_total',
                        'month(s) total,'
                      )} ${coupon.remainingMonths} ${t(
                        'apply_coupon_months_left',
                        'month(s) left'
                      )}`
                    : coupon.duration === 'forever'
                    ? t('apply_coupon_forever', 'forever')
                    : t('apply_coupon_once', 'next billing cycle only')}
                </div>
                <Button
                  onClick={handleCancelCoupon}
                  loading={cancelling}
                  className="!bg-red-700 rounded-[4px] !h-[24px] !px-[10px] text-[12px]"
                >
                  {t('cancel', 'Cancel')}
                </Button>
              </div>
            ))}
            <div>
              {t('apply_coupon_next_payment', 'Next Payment:')}{' '}
              {info.nextPayment !== null ? `$${info.nextPayment}` : '-'}
            </div>
          </div>
          {info.supported ? (
            <div className="grid grid-cols-3 gap-[12px]">
              <Select
                label={t('apply_coupon_type', 'Coupon type')}
                name="couponType"
                disableForm={true}
                hideErrors={true}
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                <option value="percentage">
                  {t('apply_coupon_percentage', 'Percentage')}
                </option>
                <option value="amount">
                  {t('apply_coupon_fixed_amount', 'Fixed dollar amount')}
                </option>
              </Select>
              <Input
                label={t('apply_coupon_value', 'Value')}
                name="couponValue"
                type="number"
                disableForm={true}
                removeError={true}
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
              <Input
                label={t('apply_coupon_months', 'Months')}
                name="couponMonths"
                type="number"
                disableForm={true}
                removeError={true}
                value={months}
                onChange={(e) => setMonths(e.target.value)}
              />
            </div>
          ) : (
            <div className="text-newTextColor/60 text-[13px]">
              {t(
                'apply_coupon_not_supported',
                "We currently don't support applying a coupon for users either under an annual plan, with a lifetime deal or with another active coupon."
              )}
            </div>
          )}
          {!!error && <div className="text-red-400 text-[12px]">{error}</div>}
          <div className="flex gap-[12px] justify-end">
            <Button onClick={close} className="rounded-[4px]">
              {t('close', 'Close')}
            </Button>
            {info.supported && (
              <Button
                onClick={handleApply}
                loading={applying}
                className="!bg-blue-700 rounded-[4px]"
              >
                {t('apply', 'Apply')}
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
};

const ChargesModal: FC<{ close: () => void }> = ({ close }) => {
  const fetch = useFetch();
  const t = useT();
  const { openModal } = useModals();
  const { data: charges, mutate } = useCharges();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [refunding, setRefunding] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const toggleCharge = useCallback((chargeId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(chargeId)) {
        next.delete(chargeId);
      } else {
        next.add(chargeId);
      }
      return next;
    });
  }, []);

  const handleApplyCoupon = useCallback(() => {
    close();
    openModal({
      title: t('apply_coupon', 'Apply Coupon'),
      maxSize: 600,
      children: (closeCoupon) => <ApplyCouponModal close={closeCoupon} />,
    });
  }, []);

  const handleRefund = useCallback(async () => {
    if (!selected.size) return;
    if (
      !(await deleteDialog(
        t(
          'refund_selected_confirm',
          `Are you sure you want to refund ${selected.size} charge(s)? This cannot be undone.`
        ),
        t('yes_refund', 'Yes, refund'),
        t('confirm_refund', 'Confirm Refund'),
        t('no_cancel', 'No, cancel')
      ))
    ) {
      return;
    }
    setRefunding(true);
    try {
      await fetch('/billing/refund-charges', {
        method: 'POST',
        body: JSON.stringify({ chargeIds: Array.from(selected) }),
      });
      setSelected(new Set());
      await mutate();
    } finally {
      setRefunding(false);
    }
  }, [selected]);

  const handleCancel = useCallback(async () => {
    if (
      !(await deleteDialog(
        t(
          'cancel_subscription_confirm',
          'This will immediately cancel the subscription. The user will be downgraded to the FREE plan. This cannot be undone.'
        ),
        t('yes_cancel_subscription', 'Yes, cancel subscription'),
        t('cancel_subscription_title', 'Cancel Subscription?'),
        t('no_go_back', 'No, go back')
      ))
    ) {
      return;
    }
    setCancelling(true);
    try {
      await fetch('/billing/cancel-subscription', {
        method: 'POST',
      });
      close();
      window.location.reload();
    } catch {
      setCancelling(false);
    }
  }, []);

  return (
    <ModalBody width={500}>
      <div className="max-h-[400px] overflow-y-auto phone:overflow-x-auto">
        {!charges?.length ? (
          <div className="text-center py-[20px] text-newTextColor/60">
            {t('no_charges', 'No charges found')}
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="text-left border-b border-newTableBorder">
                <th className="p-[8px] w-[40px]" />
                <th className="p-[8px]">{t('date', 'Date')}</th>
                <th className="p-[8px]">{t('amount', 'Amount')}</th>
                <th className="p-[8px]">{t('status', 'Status')}</th>
                <th className="p-[8px] w-[50px]" />
              </tr>
            </thead>
            <tbody>
              {charges.map((charge) => (
                <tr
                  key={charge.id}
                  className="border-b border-newTableBorder hover:bg-tableBorder cursor-pointer"
                  onClick={() => !charge.refunded && toggleCharge(charge.id)}
                >
                  <td className="p-[8px]">
                    <div
                      className={`w-[20px] h-[20px] rounded-[4px] border-2 flex items-center justify-center ${
                        charge.refunded
                          ? 'border-newTextColor/20 opacity-40'
                          : selected.has(charge.id)
                          ? 'bg-forth border-forth'
                          : 'border-newTextColor/40'
                      }`}
                    >
                      {(selected.has(charge.id) || charge.refunded) && (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          width="14"
                          height="14"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M20 6 9 17l-5-5" />
                        </svg>
                      )}
                    </div>
                  </td>
                  <td className="p-[8px]">
                    {new Date(charge.created * 1000).toLocaleDateString()}
                  </td>
                  <td className="p-[8px]">
                    ${(charge.amount / 100).toFixed(2)}{' '}
                    {charge.currency.toUpperCase()}
                  </td>
                  <td className="p-[8px]">
                    {charge.refunded ? (
                      <span className="text-red-400">
                        {t('refunded', 'Refunded')}
                      </span>
                    ) : (
                      <span className="text-green-400">
                        {t('paid', 'Paid')}
                      </span>
                    )}
                  </td>
                  <td className="p-[8px]">
                    {(charge.invoice_pdf || charge.receipt_url) && (
                      <a
                        href={charge.invoice_pdf || charge.receipt_url!}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center justify-center w-[28px] h-[28px] rounded-[4px] hover:bg-tableBorder transition-colors"
                        title={charge.invoice_pdf ? t('download_invoice', 'Download Invoice') : t('view_receipt', 'View Receipt')}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          width="16"
                          height="16"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <path d="m7 10 5 5 5-5" />
                          <path d="M12 15V3" />
                        </svg>
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="flex gap-[12px] justify-end">
        <Button
          onClick={handleApplyCoupon}
          className="!bg-blue-700 rounded-[4px]"
        >
          {t('apply_coupon', 'Apply Coupon')}
        </Button>
        <Button
          onClick={handleRefund}
          loading={refunding}
          disabled={!selected.size}
          className="rounded-[4px]"
        >
          {t('refund_selected', 'Refund Selected')}
          {selected.size > 0 && ` (${selected.size})`}
        </Button>
        <Button
          onClick={handleCancel}
          loading={cancelling}
          className="!bg-red-700 rounded-[4px]"
        >
          {t('cancel_subscription', 'Cancel Subscription')}
        </Button>
      </div>
    </ModalBody>
  );
};

const ManageBilling = () => {
  const { openModal } = useModals();
  const t = useT();

  const handleClick = useCallback(() => {
    openModal({
      title: t('manage_billing', 'Manage Billing'),
      children: (close) => <ChargesModal close={close} />,
    });
  }, []);

  return (
    <Chip className="bg-red-700 !rounded-[6px]" onClick={handleClick}>
      {t('manage_billing', 'Manage Billing')}
    </Chip>
  );
};

export const Subscription = () => {
  const fetch = useFetch();
  const t = useT();

  const addSubscription: ChangeEventHandler<HTMLSelectElement> = useCallback(
    async (e) => {
      const value = e.target.value;
      if (
        await deleteDialog(
          'Are you sure you want to add a user subscription?',
          'Add'
        )
      ) {
        await fetch('/billing/add-subscription', {
          method: 'POST',
          body: JSON.stringify({
            subscription: value,
          }),
        });
        window.location.reload();
      }
    },
    []
  );
  return (
    <Select
      onChange={addSubscription}
      hideErrors={true}
      disableForm={true}
      name="sub"
      label=""
      value=""
    >
      <option>
        {t('add_free_subscription', '-- ADD FREE SUBSCRIPTION --')}
      </option>
      {Object.keys(pricing)
        .filter((f) => !f.includes('FREE'))
        .map((key) => (
          <option key={key} value={key}>
            {key}
          </option>
        ))}
    </Select>
  );
};
const colorOptions = [
  { value: 'INFO', label: 'Info (Blue)', className: 'bg-blue-600' },
  { value: 'WARNING', label: 'Warning (Amber)', className: 'bg-amber-600' },
  { value: 'ERROR', label: 'Error (Red)', className: 'bg-red-600' },
];

const AddAnnouncementModal: FC<{ close: () => void }> = ({ close }) => {
  const fetch = useFetch();
  const { mutate } = useSWRConfig();
  const t = useT();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('INFO');
  const [saving, setSaving] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!title.trim() || !description.trim()) return;
    setSaving(true);
    try {
      await fetch('/announcements', {
        method: 'POST',
        body: JSON.stringify({ title, description, color }),
      });
      await mutate('/announcements');
      close();
    } finally {
      setSaving(false);
    }
  }, [title, description, color]);

  return (
    <ModalBody width={500}>
      <Input
        label={t('announcement_title', 'Title')}
        name="title"
        disableForm={true}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={t('announcement_title_placeholder', 'Announcement title')}
      />
      <div className="flex flex-col gap-[6px]">
        <label className="text-[14px]">
          {t('announcement_description', 'Description')}
        </label>
        <textarea
          className="bg-input border border-tableBorder rounded-[8px] p-[10px] text-newTextColor min-h-[120px] outline-none resize-y"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t(
            'announcement_description_placeholder',
            'Announcement description'
          )}
        />
      </div>
      <div className="flex flex-col gap-[6px]">
        <label className="text-[14px]">
          {t('announcement_color', 'Color')}
        </label>
        <ChoiceChipGroup
          options={colorOptions}
          value={color}
          onChange={setColor}
        />
      </div>
      <ModalFooter>
        <Button
          onClick={handleSubmit}
          loading={saving}
          disabled={!title.trim() || !description.trim()}
          className="rounded-[4px]"
        >
          {t('create_announcement', 'Create Announcement')}
        </Button>
      </ModalFooter>
    </ModalBody>
  );
};

const AddAnnouncement = () => {
  const { openModal } = useModals();
  const t = useT();

  const handleClick = useCallback(() => {
    openModal({
      title: t('add_announcement', 'Add Announcement'),
      children: (close) => <AddAnnouncementModal close={close} />,
    });
  }, []);

  return (
    <Chip className="bg-emerald-600 !rounded-[6px]" onClick={handleClick}>
      {t('add_announcement', 'Add Announcement')}
    </Chip>
  );
};

const AddTeamMemberModal: FC<{ close: () => void }> = ({ close }) => {
  const fetch = useFetch();
  const toast = useToaster();
  const t = useT();
  const [saving, setSaving] = useState(false);
  const resolver = useMemo(() => {
    return classValidatorResolver(AdminAddTeamMemberDto);
  }, []);
  const form = useForm({
    values: {
      email: '',
      role: '',
    },
    resolver,
    mode: 'onChange',
  });

  const submit = useCallback(
    async (values: { email: string; role: string }) => {
      setSaving(true);
      try {
        const response = await fetch('/settings/team/add', {
          method: 'POST',
          body: JSON.stringify(values),
        });
        if (!response.ok) {
          toast.show(
            (await response.json()).message ||
              t('could_not_add_member', 'Could not add the member'),
            'warning'
          );
          return;
        }
        toast.show(t('member_added', 'Member added'));
        close();
      } finally {
        setSaving(false);
      }
    },
    []
  );

  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(submit)}>
        <ModalBody width={400} gap={10}>
          <Input
            label="Email"
            placeholder={t('enter_email', 'Enter email')}
            name="email"
          />
          <Select label="Role" name="role">
            <option value="">{t('select_role', 'Select Role')}</option>
            <option value="USER">{t('user', 'User')}</option>
            <option value="ADMIN">{t('admin', 'Admin')}</option>
          </Select>
          <Button type="submit" loading={saving} className="rounded-[4px]">
            {t('add_team_member', 'Add Team Member')}
          </Button>
        </ModalBody>
      </form>
    </FormProvider>
  );
};

const AddTeamMember = () => {
  const { openModal } = useModals();
  const t = useT();

  const handleClick = useCallback(() => {
    openModal({
      title: t('add_team_member', 'Add Team Member'),
      children: (close) => <AddTeamMemberModal close={close} />,
    });
  }, []);

  return (
    <Chip className="bg-teal-700 !rounded-[6px]" onClick={handleClick}>
      {t('add_team_member', 'Add Team Member')}
    </Chip>
  );
};

const ViewErrors = () => {
  const t = useT();
  return (
    <Chip href="/admin/errors" className="bg-forth !rounded-[6px]">
      {t('view_errors', 'View Errors')}
    </Chip>
  );
};

const ViewStats = () => {
  const t = useT();
  return (
    <Chip href="/admin/stats" className="bg-black/70 !rounded-[6px]">
      {t('view_stats', 'View Stats')}
    </Chip>
  );
};

const ImportDebugPost = () => {
  const { openModal } = useModals();
  const t = useT();

  const handleClick = useCallback(() => {
    openModal({
      title: t('import_debug_post', 'Import Debug Post'),
      maxSize: 800,
      children: (close) => <ImportDebugPostModal close={close} />,
    });
  }, []);

  return (
    <Chip
      className="bg-amber-500 !text-black !rounded-[6px]"
      onClick={handleClick}
    >
      {t('import_debug_post', 'Import Debug Post')}
    </Chip>
  );
};

const SwitchUser = () => {
  const fetch = useFetch();
  const t = useT();
  const toaster = useToaster();
  const currentUser = useUser();
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<UserSearchItem | null>(null);
  const [switching, setSwitching] = useState(false);

  const load = useCallback(async () => {
    if (!name) {
      return [];
    }
    return await (await fetch(`/user/impersonate?name=${name}`)).json();
  }, [name]);

  const { data } = useSWR(`/switch-search-${name}`, load, {
    refreshWhenHidden: false,
    revalidateOnMount: true,
    revalidateOnReconnect: false,
    revalidateOnFocus: false,
    refreshWhenOffline: false,
    revalidateIfStale: false,
    refreshInterval: 0,
  });

  const mapData = useMemo(() => {
    // one row per user-organization: dedupe by user id, drop the impersonated user
    const seen = new Set<string>();
    return (data || [])
      .filter((curr: any) => curr.user.id !== currentUser?.id)
      .filter((curr: any) => {
        if (seen.has(curr.user.id)) {
          return false;
        }
        seen.add(curr.user.id);
        return true;
      })
      .map((curr: any) => ({
        id: curr.user.id,
        name: curr.user.name,
        email: curr.user.email,
      }));
  }, [data, currentUser?.id]);

  const pick = useCallback((item: UserSearchItem) => {
    setSelected(item);
    setName('');
  }, []);

  const doSwitch = useCallback(async () => {
    if (!selected) {
      return;
    }
    if (
      !(await deleteDialog(
        t(
          'switch_user_confirm',
          `This will replace the current account's login with ${selected.email}. All data and the subscription stay with the account — only the login changes, and the new login gains its full access. Switch back to revert.`
        ),
        t('yes_switch', 'Yes, switch'),
        t('switch_user_title', 'Switch User?'),
        t('no_cancel', 'No, cancel')
      ))
    ) {
      return;
    }
    setSwitching(true);
    try {
      const res = await fetch('/user/switch', {
        method: 'POST',
        body: JSON.stringify({ id: selected.id }),
      });
      // customFetch does not throw on HTTP errors
      if (!res.ok) {
        throw new Error(await res.text().catch(() => ''));
      }
      window.location.reload();
    } catch {
      setSwitching(false);
      toaster.show(
        t('switch_user_failed', 'The user switch failed and nothing was changed'),
        'warning'
      );
    }
  }, [selected]);

  return (
    <div className="relative flex items-center gap-[10px] phone:flex-wrap">
      <div className="flex-1 min-w-[220px] phone:w-full phone:min-w-0">
        <Input
          autoComplete="off"
          placeholder={t('select_user_to_switch_to', 'Select user to switch to')}
          name="switchUser"
          disableForm={true}
          label=""
          removeError={true}
          value={
            selected
              ? `${selected.name ? `${selected.name} - ` : ''}${selected.email}`
              : name
          }
          onChange={(e) => {
            setSelected(null);
            setName(e.target.value);
          }}
        />
      </div>
      <Button
        onClick={doSwitch}
        loading={switching}
        disabled={!selected}
        className="rounded-[4px] whitespace-nowrap"
      >
        {t('switch_user', 'Switch User')}
      </Button>
      {!!mapData?.length && !selected && (
        <UserSearchDropdown
          // the pill popover sits at the viewport bottom — results open upward
          className="!top-auto bottom-[100%]"
          items={mapData}
          onPick={pick}
          onDismiss={() => setName('')}
        />
      )}
    </div>
  );
};

export const Impersonate = () => {
  const fetch = useFetch();
  const [name, setName] = useState('');
  const [open, setOpen] = useState(false);
  const { isSecured, billingEnabled } = useVariables();
  const user = useUser();
  const load = useCallback(async () => {
    if (!name) {
      return [];
    }
    const value = await (await fetch(`/user/impersonate?name=${name}`)).json();
    return value;
  }, [name]);
  const stopImpersonating = useCallback(async () => {
    if (!isSecured) {
      setCookie('impersonate', '', -10);
    } else {
      await fetch(`/user/impersonate`, {
        method: 'POST',
        body: JSON.stringify({
          id: '',
        }),
      });
    }
    window.location.reload();
  }, []);
  const t = useT();

  const setUser = useCallback(
    (userId: string) => async () => {
      await fetch(`/user/impersonate`, {
        method: 'POST',
        body: JSON.stringify({
          id: userId,
        }),
      });
      window.location.reload();
    },
    []
  );
  const { data } = useSWR(`/impersonate-${name}`, load, {
    refreshWhenHidden: false,
    revalidateOnMount: true,
    revalidateOnReconnect: false,
    revalidateOnFocus: false,
    refreshWhenOffline: false,
    revalidateIfStale: false,
    refreshInterval: 0,
  });
  const mapData = useMemo(() => {
    return data?.map(
      (curr: any) => ({
        id: curr.id,
        name: curr.user.name,
        email: curr.user.email,
      }),
      []
    );
  }, [data]);
  // Buffer parity r1: Buffer has no full-width top strip — the admin tool is
  // a fixed bottom-center pill (out of the layout flow, reserves no height).
  // The pill shows the impersonation state; the full toolset (search, debug
  // post, announcements, errors/stats, switch/billing) expands into a
  // DropdownPanel popover above it. The outer strip is pointer-events-none so
  // only the pill/popover intercept clicks.
  return (
    <div className="fixed bottom-[16px] inset-x-0 z-[600] flex flex-col items-center gap-[8px] pointer-events-none">
      {open && (
        <>
          {/* click-away layer — painted under the panel/pill (source order) */}
          <div
            className="fixed inset-0 pointer-events-auto"
            onClick={() => setOpen(false)}
          />
          <div className="pointer-events-auto w-[560px] max-w-[calc(100vw-24px)]">
            <DropdownPanel className="!static w-full p-[16px] shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
              {user?.impersonate ? (
                <div className="flex flex-col gap-[12px]">
                  <div className="text-[14px] font-[600]">
                    {t('currently_impersonating', 'Currently Impersonating')}
                  </div>
                  <div className="flex flex-wrap items-center gap-[8px]">
                    {user?.tier?.current === 'FREE' && <Subscription />}
                    {user?.tier?.team_members && <AddTeamMember />}
                    {billingEnabled && <ManageBilling />}
                  </div>
                  <SwitchUser />
                </div>
              ) : (
                <div className="flex flex-col gap-[12px]">
                  <div className="text-[14px] font-[600]">
                    {t('admin_tools', 'Admin tools')}
                  </div>
                  <div className="relative">
                    <Input
                      autoComplete="off"
                      placeholder="Write the user details"
                      name="impersonate"
                      disableForm={true}
                      label=""
                      removeError={true}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                    {!!data?.length && (
                      <UserSearchDropdown
                        // popover sits at the viewport bottom — open upward
                        className="!top-auto bottom-[100%]"
                        items={mapData || []}
                        onPick={(item) => setUser(item.id)()}
                        onDismiss={() => setName('')}
                      />
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-[8px]">
                    <ImportDebugPost />
                    <AddAnnouncement />
                    <ViewErrors />
                    <ViewStats />
                  </div>
                </div>
              )}
            </DropdownPanel>
          </div>
        </>
      )}
      <div
        data-cs
        className="pointer-events-auto flex items-center h-[32px] rounded-full bg-forth text-white shadow-[0_4px_12px_rgba(0,0,0,0.18)] overflow-hidden"
      >
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-[8px] h-full ps-[14px] pe-[12px] text-[13px] font-[500] hover:bg-white/10 transition-colors duration-150"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
          </svg>
          {user?.impersonate
            ? `${t('impersonating', 'Impersonating')}: ${
                user?.name || user?.email || ''
              }`
            : t('admin', 'Admin')}
        </button>
        {user?.impersonate && (
          <>
            <div className="w-[1px] h-[16px] bg-white/30" />
            <button
              type="button"
              onClick={stopImpersonating}
              aria-label={t('stop_impersonating', 'Stop impersonating')}
              className="h-full ps-[12px] pe-[14px] text-[13px] font-[600] hover:bg-white/10 transition-colors duration-150"
            >
              {t('stop', 'Stop')}
            </button>
          </>
        )}
      </div>
    </div>
  );
};
