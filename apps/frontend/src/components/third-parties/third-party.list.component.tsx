'use client';

import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import useSWR from 'swr';
import React, { FC, useCallback, useState } from 'react';
import { Button } from '@gitroom/react/form/button';
import { useRouter } from 'next/navigation';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import { FieldValues, FormProvider, useForm } from 'react-hook-form';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { Input } from '@gitroom/react/form/input';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { ModalWrapperComponent } from '@gitroom/frontend/components/new-launch/modal.wrapper.component';

export const ApiModal: FC<{
  identifier: string;
  title: string;
  update: () => void;
}> = (props) => {
  const { title, identifier, update } = props;
  const fetch = useFetch();
  const router = useRouter();
  const modal = useModals();
  const toaster = useToaster();
  const [loading, setLoading] = useState(false);
  const closePopup = useCallback(() => {
    modal.closeAll();
  }, []);

  const methods = useForm({
    mode: 'onChange',
  });

  const close = useCallback(() => {
    if (closePopup) {
      return closePopup();
    }
    modal.closeAll();
  }, []);

  const submit = useCallback(
    async (data: FieldValues) => {
      setLoading(true);
      const add = await fetch(`/third-party/${identifier}`, {
        method: 'POST',
        body: JSON.stringify({
          api: data.api,
        }),
      });

      if (add.ok) {
        toaster.show('Integration added successfully', 'success');
        if (closePopup) {
          closePopup();
        } else {
          modal.closeAll();
        }
        router.refresh();
        if (update) update();
        return;
      }

      const { message } = await add.json();

      methods.setError('api', {
        message,
      });

      setLoading(false);
    },
    [props]
  );

  const t = useT();

  return (
    <div className="relative">
      <FormProvider {...methods}>
        <form
          className="gap-[8px] flex flex-col"
          onSubmit={methods.handleSubmit(submit)}
        >
          <div className="pt-[10px]">
            <Input label="API Key" name="api" />
          </div>
          <div>
            {/* modal primary keeps the lime fill; radius joins the 8px scale
                (!: the shared Button base carries rounded-[6px]) */}
            <Button loading={loading} type="submit" className="!rounded-[8px]">
              {t('add_integration', 'Add Integration')}
            </Button>
          </div>
        </form>
      </FormProvider>
    </div>
  );
};

export const ThirdPartyListComponent: FC<{ reload: () => void }> = (props) => {
  const fetch = useFetch();
  const modals = useModals();
  const { reload } = props;

  const integrationsList = useCallback(async () => {
    return (await fetch('/third-party/list')).json();
  }, []);

  const { data } = useSWR('third-party-list', integrationsList, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
    revalidateOnMount: true,
    refreshWhenHidden: false,
    refreshWhenOffline: false,
  });

  const addApiKey = useCallback(
    (title: string, identifier: string) => () => {
      modals.openModal({
        title: `Add API key for ${title}`,
        withCloseButton: false,
        children: (
          <ApiModal identifier={identifier} title={title} update={reload} />
        ),
      });
    },
    []
  );

  return (
    <div className="grid grid-cols-4 mobile:grid-cols-2 phone:grid-cols-1 gap-[16px] justify-items-center justify-center">
      {data?.map((p: any) => (
        <div
          onClick={addApiKey(p.title, p.identifier)}
          key={p.identifier}
          className="w-full h-full p-[16px] min-h-[100px] text-[14px] bg-newBgColorInner border border-newTableBorder hover:bg-boxHover rounded-[12px] transition-all text-newTextColor relative flex flex-col gap-[12px] cursor-pointer"
        >
          <div>
            <img
              className="w-[32px] h-[32px]"
              src={`/icons/third-party/${p.identifier}.png`}
            />
          </div>
          <div className="whitespace-pre-wrap text-left text-[15px] font-[550]">
            {p.title}
          </div>
          <div className="whitespace-pre-wrap text-left text-[14px] text-newTextColor/60">
            {p.description}
          </div>
          {/* mt-auto pins the button to the card bottom so Add buttons share
              one baseline across a row of unequal descriptions (the grid
              already stretches items to the tallest card) */}
          <div className="w-full flex mt-auto">
            {/* quiet 32px hairline secondary — a lime primary on every card
                was a wall of primaries; green stays reserved for the single
                page-level CTA (S4). !-overrides beat the Button base's
                h-[40px]/px-[24px]/rounded-[6px] (precedent: merge.post.tsx) */}
            <Button
              secondary={true}
              className="w-full !h-[32px] !px-[16px] !rounded-[8px] text-[14px] font-[500]"
            >
              Add
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
};
