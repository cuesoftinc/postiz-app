import { Button } from '@gitroom/react/form/button';
import React, { FC, useCallback, useState } from 'react';
import clsx from 'clsx';
import { Loader } from '@gitroom/frontend/components/cuesoft/loader';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { useLaunchStore } from '@gitroom/frontend/components/new-launch/store';
import useSWR from 'swr';
import { VideoWrapper } from '@gitroom/frontend/components/videos/video.render.component';
import { FormProvider, useForm } from 'react-hook-form';
import { useUser } from '@gitroom/frontend/components/layout/user.context';
import { VideoContextWrapper } from '@gitroom/frontend/components/videos/video.context.wrapper';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import { createPortal } from 'react-dom';

export const Modal: FC<{
  close: () => void;
  type: any;
  setLoading: (loading: boolean) => void;
  onChange: (params: { id: string; path: string }) => void;
}> = (props) => {
  const { type, onChange, close, setLoading } = props;
  const fetch = useFetch();
  const setLocked = useLaunchStore((state) => state.setLocked);
  const form = useForm();
  const [position, setPosition] = useState('vertical');
  const toaster = useToaster();

  const loadCredits = useCallback(async () => {
    return (
      await fetch(`/copilot/credits?type=ai_videos`, {
        method: 'GET',
      })
    ).json();
  }, []);

  const { data } = useSWR('copilot-credits', loadCredits);

  const generate = useCallback(async () => {
    await fetch(`/media/generate-video/${type.identifier}/allowed`);
    setLoading(true);
    close();
    setLocked(true);

    const customParams = form.getValues();
    if (!(await form.trigger())) {
      toaster.show('Please fill all required fields', 'warning');
      return;
    }
    try {
      const image = await fetch(`/media/generate-video`, {
        method: 'POST',
        body: JSON.stringify({
          type: type.identifier,
          output: position,
          customParams,
        }),
      });

      if (image.status == 200 || image.status == 201) {
        onChange(await image.json());
      }
    } catch (e) {}

    setLocked(false);
    setLoading(false);
  }, [type, position]);

  return (
    // Start with an empty prompt — we no longer copy the post's text field.
    <VideoContextWrapper.Provider value={{ value: '' }}>
      <form
        onSubmit={form.handleSubmit(generate)}
        className="flex flex-col gap-[10px]"
      >
        {createPortal(
          <>{data?.credits || 0} credits left</>,
          document.querySelector('.top-title-content') ||
            document.createElement('div')
        )}
        <FormProvider {...form}>
          <div>
            <div className="relative h-[400px]">
              <div className="absolute left-0 top-0 w-full h-full overflow-hidden overflow-y-auto">
                <div className="mt-[10px] flex w-full justify-center items-center gap-[10px]">
                  <div className="flex-1 flex">
                    <Button
                      className="!flex-1"
                      onClick={() => setPosition('vertical')}
                      secondary={position === 'horizontal'}
                    >
                      Vertical (Stories, Reels)
                    </Button>
                  </div>
                  <div className="flex-1 flex mt-[10px]">
                    <Button
                      className="!flex-1"
                      onClick={() => setPosition('horizontal')}
                      secondary={position === 'vertical'}
                    >
                      Horizontal (Normal Post)
                    </Button>
                  </div>
                </div>
                <VideoWrapper identifier={type.identifier} />
              </div>
            </div>
            <div className="flex">
              <Button type="submit" className="flex-1">
                Generate
              </Button>
            </div>
          </div>
        </FormProvider>
      </form>
    </VideoContextWrapper.Provider>
  );
};

const AiVideoModal: FC<{
  list: any[];
  close: () => void;
  setLoading: (loading: boolean) => void;
  onChange: (params: { id: string; path: string }) => void;
}> = (props) => {
  const { list, close, setLoading, onChange } = props;
  const t = useT();
  const [type, setType] = useState<any | null>(
    list.length === 1 ? list[0] : null
  );

  if (!type) {
    return (
      <div className="flex flex-col gap-[10px]">
        <div className="text-[14px]">
          {t('choose_a_video_type', 'Choose a video type')}
        </div>
        {list.map((p) => (
          <Button key={p.identifier} type="button" onClick={() => setType(p)}>
            {p.title}
          </Button>
        ))}
      </div>
    );
  }

  return (
    <Modal
      type={type}
      close={close}
      setLoading={setLoading}
      onChange={onChange}
    />
  );
};

export const AiVideo: FC<{
  value: string;
  onChange: (params: { id: string; path: string }) => void;
}> = (props) => {
  const t = useT();
  const { onChange } = props;
  const [loading, setLoading] = useState(false);
  const fetch = useFetch();
  const modals = useModals();

  const loadVideoList = useCallback(async () => {
    return (await (await fetch('/media/video-options')).json()).filter(
      (f: any) => f.placement === 'text-to-image'
    );
  }, []);

  const { isLoading, data } = useSWR('load-videos-ai', loadVideoList, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    refreshWhenHidden: false,
    revalidateIfStale: false,
    refreshWhenOffline: false,
    keepPreviousData: true,
  });

  const openVideoModal = useCallback(() => {
    if (loading || !data?.length) {
      return;
    }
    modals.openModal({
      title: <div className="top-title-content" />,
      children: (close) => (
        <AiVideoModal
          list={data}
          onChange={onChange}
          setLoading={setLoading}
          close={close}
        />
      ),
    });
  }, [loading, data, onChange]);

  if (isLoading || data?.length === 0) {
    return null;
  }

  return (
    <div className="relative">
      <div
        onClick={openVideoModal}
        className={clsx(
          'cursor-pointer h-[30px] phone:h-[40px] rounded-[6px] justify-center items-center flex bg-newColColor px-[8px]'
        )}
      >
        {loading && (
          <div className="absolute start-[50%] -translate-x-[50%]">
            <Loader size={30} color="#fff" />
          </div>
        )}
        <div
          className={clsx('flex gap-[5px] items-center', loading && 'invisible')}
        >
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
            >
              <rect width="18" height="18" x="3" y="3" rx="2" />
              <path d="M7 3v18" />
              <path d="M3 7.5h4" />
              <path d="M3 12h18" />
              <path d="M3 16.5h4" />
              <path d="M17 3v18" />
              <path d="M21 7.5h-4" />
              <path d="M21 16.5h-4" />
            </svg>
          </div>
          <div className="text-[12px] font-[500] iconBreak:hidden block">
            {t('ai', 'AI')} Video
          </div>
        </div>
      </div>
    </div>
  );
};
