'use client';

import { Button } from '@gitroom/react/form/button';
import clsx from 'clsx';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import React, {
  createContext,
  FC,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import useSWR from 'swr';
import { TopTitle } from '@gitroom/frontend/components/launches/helpers/top.title.component';
import './providers/heygen.provider';
import { thirdPartyList } from '@gitroom/frontend/components/third-parties/third-party.wrapper';
import { useLaunchStore } from '@gitroom/frontend/components/new-launch/store';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import { ChevronLeftIcon } from '@gitroom/frontend/components/ui/icons';

const ThirdPartyContext = createContext({
  id: '',
  name: '',
  title: '',
  identifier: '',
  description: '',
  close: () => {},
  onChange: (data: any) => {},
  fields: [],
  data: [
    {
      content: '',
      id: '',
      image: [
        {
          id: '',
          path: '',
        },
      ],
    },
  ],
});
export const useThirdParty = () => React.useContext(ThirdPartyContext);
const EmptyComponent: FC = () => null;

export const ThirdPartyPopup: FC<{
  closeModal: () => void;
  thirdParties: any[];
  onChange: (data: any) => void;
  allData: {
    content: string;
    id?: string;
    image?: Array<{
      id: string;
      path: string;
    }>;
  }[];
}> = (props) => {
  const { closeModal, thirdParties, allData, onChange } = props;
  const t = useT();
  const [thirdParty, setThirdParty] = useState<any>(null);
  const refNew = useRef(null);

  const setActivateExitButton = useLaunchStore((e) => e.setActivateExitButton);
  useEffect(() => {
    setActivateExitButton(false);
    return () => {
      setActivateExitButton(true);
    };
  }, []);

  const Component = useMemo(() => {
    if (!thirdParty) {
      return EmptyComponent;
    }

    return (
      thirdPartyList.find((p) => p.identifier === thirdParty.identifier)
        ?.Component || EmptyComponent
    );
  }, [thirdParty]);

  const close = useCallback(() => {
    setThirdParty(null);
    closeModal();
  }, [setThirdParty, closeModal]);

  useEffect(() => {
    refNew?.current?.scrollIntoView({
      behavior: 'smooth',
    });
  }, []);

  return (
    <div className={clsx('flex flex-wrap flex-col gap-[10px] pt-[20px]')}>
      {!thirdParty && (
        <div className="grid grid-cols-4 gap-[10px] justify-items-center justify-center">
          {thirdParties.map((p: any) => (
            <div
              onClick={() => {
                setThirdParty(p);
              }}
              key={p.identifier}
              className="w-full h-full p-[20px] min-h-[100px] text-[14px] bg-newTableHeader hover:bg-newTableBorder rounded-[12px] transition-all text-textColor relative flex flex-col gap-[15px] cursor-pointer"
            >
              <div>
                <img
                  className="w-[32px] h-[32px]"
                  src={`/icons/third-party/${p.identifier}.png`}
                />
              </div>
              <div className="whitespace-pre-wrap text-left text-[15px] font-[600]">
                {p.title}: {p.name}
              </div>
              <div className="whitespace-pre-wrap text-left text-[14px] text-newTextColor/60">
                {p.description}
              </div>
              <div className="w-full flex">
                <Button className="w-full">Use</Button>
              </div>
            </div>
          ))}
        </div>
      )}
      {thirdParty && (
        <>
          <div>
            <button
              type="button"
              className="cursor-pointer float-left flex items-center gap-[4px] text-[14px] text-newTextColor/60 hover:text-newTextColor transition-colors"
              onClick={() => setThirdParty(null)}
            >
              <ChevronLeftIcon size={16} />
              {t('back', 'Back')}
            </button>
          </div>
          <ThirdPartyContext.Provider
            value={{ ...thirdParty, data: allData, close, onChange }}
          >
            <Component />
          </ThirdPartyContext.Provider>
        </>
      )}
    </div>
  );
};

export const ThirdPartyMedia: FC<{
  onChange: (data: any) => void;
  allData: {
    content: string;
    id?: string;
    image?: Array<{
      id: string;
      path: string;
    }>;
  }[];
}> = (props) => {
  const { allData, onChange } = props;
  const t = useT();
  const fetch = useFetch();
  const modals = useModals();

  const thirdParties = useCallback(async () => {
    return (await (await fetch('/third-party')).json()).filter(
      (f: any) => f.position === 'media'
    );
  }, []);

  const { data, isLoading, mutate } = useSWR('third-party', thirdParties, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
    revalidateOnMount: true,
    refreshWhenHidden: false,
    refreshWhenOffline: false,
  });

  if (isLoading || !data.length) {
    return null;
  }

  return (
    <>
      <div className="relative group">
        <div
          className={clsx(
            'cursor-pointer h-[30px] rounded-[6px] justify-center items-center flex bg-newColColor px-[8px]'
          )}
          onClick={() => {
            modals.openModal({
              title: t('integrations', 'Integrations'),
              size: '80%',
              children: (close) => (
                <ThirdPartyPopup
                  thirdParties={data}
                  closeModal={close}
                  allData={allData}
                  onChange={onChange}
                />
              ),
            });
          }}
        >
          <div className={clsx('flex gap-[5px] items-center')}>
            <div>
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
                <rect width="7" height="7" x="3" y="3" rx="1" />
                <rect width="7" height="7" x="14" y="3" rx="1" />
                <rect width="7" height="7" x="14" y="14" rx="1" />
                <rect width="7" height="7" x="3" y="14" rx="1" />
              </svg>
            </div>
            <div className="text-[11px] font-[600] iconBreak:hidden block">
              {t('integrations', 'Integrations')}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
