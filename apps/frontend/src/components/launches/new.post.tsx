import React, { useCallback, useEffect, useRef } from 'react';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import dayjs from 'dayjs';
import { useCalendar } from '@gitroom/frontend/components/launches/calendar.context';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { SetSelectionModal } from '@gitroom/frontend/components/launches/calendar';
import { AddEditModal } from '@gitroom/frontend/components/new-launch/add.edit.modal';
import { ModalWrapperComponent } from '@gitroom/frontend/components/new-launch/modal.wrapper.component';
import { useSearchParams } from 'next/navigation';

export const NewPost = () => {
  const fetch = useFetch();
  const modal = useModals();
  const { integrations, reloadCalendarView, sets } = useCalendar();
  const t = useT();

  const createAPost = useCallback(async () => {
    const date = (await (await fetch('/posts/find-slot')).json()).date;

    const set: any = !sets.length
      ? undefined
      : await new Promise((resolve) => {
          modal.openModal({
            title: t('select_set', 'Select a Set'),
            closeOnClickOutside: true,
            closeOnEscape: true,
            withCloseButton: false,
            onClose: () => resolve('exit'),
            classNames: {
              modal: 'text-textColor',
            },
            children: (
              <SetSelectionModal
                sets={sets}
                onSelect={(selectedSet) => {
                  resolve(selectedSet);
                  modal.closeAll();
                }}
                onContinueWithoutSet={() => {
                  resolve(undefined);
                  modal.closeAll();
                }}
              />
            ),
          });
        });

    if (set === 'exit') return;

    modal.openModal({
      id: 'add-edit-modal',
      closeOnClickOutside: false,
      removeLayout: true,
      closeOnEscape: false,
      withCloseButton: false,
      askClose: true,
      fullScreen: true,
      classNames: {
        modal: 'w-[100%] max-w-[1400px] text-textColor',
      },
      children: (
        <AddEditModal
          allIntegrations={integrations.map((p) => ({
            ...p,
          }))}
          {...(set?.content ? { set: JSON.parse(set.content) } : {})}
          reopenModal={createAPost}
          mutate={reloadCalendarView}
          integrations={integrations}
          date={dayjs.utc(date).local()}
        />
      ),
      size: '80%',
      title: ``,
    });
  }, [integrations, sets]);

  // Deep link for the sidebar's "+ New" pill (Buffer parity): landing on
  // /launches?newPost=1 opens the composer. The param is consumed immediately
  // so refresh/back never re-triggers it; the ref guards StrictMode double
  // effects, then resets so a second pill click (same page) works too.
  const searchParams = useSearchParams();
  const consumingNewPost = useRef(false);
  useEffect(() => {
    if (!searchParams.get('newPost') || consumingNewPost.current) return;
    consumingNewPost.current = true;
    const url = new URL(window.location.href);
    url.searchParams.delete('newPost');
    window.history.replaceState(null, '', url.pathname + url.search);
    createAPost();
    setTimeout(() => {
      consumingNewPost.current = false;
    }, 500);
  }, [searchParams, createAPost]);

  return (
    <button
      onClick={createAPost}
      className="flex-1 pt-[12px] pb-[14px] ps-[16px] pe-[20px] group-[.sidebar]:p-0 min-h-[44px] max-h-[44px] rounded-[8px] bg-btnPrimary flex justify-center items-center gap-[5px] outline-none"
    >
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
        className="min-w-[16px] min-h-[16px]"
      >
        <path d="M5 12h14" />
        <path d="M12 5v14" />
      </svg>
      <div className="flex-1 text-start text-[14px] group-[.sidebar]:hidden">
        {t('create_new_post', 'New Post')}
      </div>
    </button>
  );
};
