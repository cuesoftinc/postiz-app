import { Button } from '@gitroom/react/form/button';
import { FC, useCallback, useState } from 'react';
import clsx from 'clsx';
import Loading from '@gitroom/frontend/components/layout/loading';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { useLaunchStore } from '@gitroom/frontend/components/new-launch/store';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import { useToaster } from '@gitroom/react/toaster/toaster';
const list = [
  'Realistic',
  'Cartoon',
  'Anime',
  'Fantasy',
  'Abstract',
  'Pixel Art',
  'Sketch',
  'Watercolor',
  'Minimalist',
  'Cyberpunk',
  'Monochromatic',
  'Surreal',
  'Pop Art',
  'Fantasy Realism',
];

const AiImageModal: FC<{
  close: () => void;
  setLoading: (loading: boolean) => void;
  onChange: (params: { id: string; path: string }) => void;
}> = (props) => {
  const { close, setLoading, onChange } = props;
  const t = useT();
  const fetch = useFetch();
  const toaster = useToaster();
  const setLocked = useLaunchStore((p) => p.setLocked);
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState(list[0]);

  const generate = useCallback(async () => {
    if (!prompt.trim()) {
      toaster.show(
        t('please_type_your_prompt', 'Please type your prompt'),
        'warning'
      );
      return;
    }

    setLoading(true);
    close();
    setLocked(true);
    try {
      const image = await (
        await fetch('/media/generate-image-with-prompt', {
          method: 'POST',
          body: JSON.stringify({
            prompt: `
<!-- description -->
${prompt}
<!-- /description -->

<!-- style -->
${style}
<!-- /style -->

`,
          }),
        })
      ).json();
      if (image) {
        onChange(image);
      }
    } catch (e) {}
    setLocked(false);
    setLoading(false);
  }, [prompt, style, onChange]);

  return (
    <div className="flex flex-col gap-[16px]">
      <div className="flex flex-col gap-[6px]">
        <div className="text-[14px]">{t('prompt', 'Prompt')}</div>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={t(
            'describe_the_image_you_want_to_generate',
            'Describe the image you want to generate'
          )}
          className="bg-input min-h-[150px] p-[16px] outline-none border-fifth border rounded-[4px] text-inputText placeholder-inputText"
        />
      </div>
      <div className="flex flex-col gap-[6px]">
        <div className="text-[14px]">{t('style', 'Style')}</div>
        <div className="flex flex-wrap gap-[8px]">
          {list.map((p) => (
            <div
              key={p}
              onClick={() => setStyle(p)}
              className={clsx(
                'cursor-pointer rounded-[4px] px-[10px] h-[30px] flex items-center text-[12px] border',
                style === p
                  ? 'bg-[#612BD3] border-[#612BD3] text-white'
                  : 'bg-newColColor border-newBgLineColor'
              )}
            >
              {p}
            </div>
          ))}
        </div>
      </div>
      <div className="flex">
        <Button type="button" onClick={generate} className="flex-1">
          {t('generate', 'Generate')}
        </Button>
      </div>
    </div>
  );
};

export const AiImage: FC<{
  value: string;
  onChange: (params: { id: string; path: string }) => void;
}> = (props) => {
  const t = useT();
  const { onChange } = props;
  const [loading, setLoading] = useState(false);
  const modals = useModals();

  const openImageModal = useCallback(() => {
    if (loading) {
      return;
    }
    modals.openModal({
      title: t('generate_ai_image', 'Generate AI Image'),
      children: (close) => (
        <AiImageModal
          close={close}
          setLoading={setLoading}
          onChange={onChange}
        />
      ),
    });
  }, [loading, onChange]);

  return (
    <div className="relative">
      <div
        onClick={openImageModal}
        className={clsx(
          'cursor-pointer h-[30px] rounded-[6px] justify-center items-center flex bg-newColColor px-[8px]'
        )}
      >
        {loading && (
          <div className="absolute start-[50%] -translate-x-[50%]">
            <Loading height={15} width={15} type="spin" color="#fff" />
          </div>
        )}
        <div
          className={clsx(
            'flex gap-[5px] items-center',
            loading && 'invisible'
          )}
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
              <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
              <circle cx="9" cy="9" r="2" />
              <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
            </svg>
          </div>
          <div className="text-[10px] font-[600] iconBreak:hidden block">
            {t('ai', 'AI')} Image
          </div>
        </div>
      </div>
    </div>
  );
};
