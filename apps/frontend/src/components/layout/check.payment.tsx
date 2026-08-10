import { FC, ReactNode, useCallback, useEffect, useState } from 'react';
import {
  Skeleton,
  SkeletonText,
} from '@gitroom/frontend/components/layout/skeleton';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { timer } from '@gitroom/helpers/utils/timer';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { useDecisionModal } from '@gitroom/frontend/components/layout/new-modal';
export const CheckPayment: FC<{
  check: string;
  mutate: () => void;
  children: ReactNode;
}> = (props) => {
  if (!props.check) {
    return <>{props.children}</>;
  }
  return <CheckPaymentInner {...props} />;
};

export const CheckPaymentInner: FC<{
  check: string;
  mutate: () => void;
  children: ReactNode;
}> = (props) => {
  const [showLoader, setShowLoader] = useState(true);
  const fetch = useFetch();
  const toaster = useToaster();
  const modal = useDecisionModal();

  useEffect(() => {
    if (showLoader) {
      document.querySelector('body')?.classList.add('overflow-hidden');
      Array.from(document.querySelectorAll('.blurMe') || []).map((p) =>
        p.classList.add('blur-xs', 'pointer-events-none')
      );
    } else {
      document.querySelector('body')?.classList.remove('overflow-hidden');
      Array.from(document.querySelectorAll('.blurMe') || []).map((p) =>
        p.classList.remove('blur-xs', 'pointer-events-none')
      );
    }
  }, [showLoader]);

  const checkSubscription = useCallback(async () => {
    const { status } = await (
      await fetch('/billing/check/' + props.check)
    ).json();
    if (status === 0) {
      await timer(1000);
      return checkSubscription();
    }
    if (status === 1) {
      modal.open({
        title: 'Invalid Payment',
        onlyApprove: true,
        approveLabel: 'OK',
        description:
          'We could not validate your payment method, please try again',
      });
      setShowLoader(false);
    }
    if (status === 2) {
      setShowLoader(false);
      props.mutate();
    }
  }, []);
  useEffect(() => {
    checkSubscription();
  }, []);
  if (showLoader) {
    // Buffer-style: a ghost card of skeleton rows (shaped like the payment
    // confirmation that is about to appear) instead of a 250px spinner
    return (
      <div className="fixed bg-black/40 w-full h-full flex justify-center items-center z-[400]">
        <div className="w-[360px] max-w-[calc(100vw-48px)] bg-newBgColorInner border border-newTableBorder rounded-[12px] p-[20px] flex flex-col gap-[16px]">
          <Skeleton className="h-[16px] w-[55%]" />
          <SkeletonText rows={3} />
        </div>
      </div>
    );
  }
  return props.children;
};
