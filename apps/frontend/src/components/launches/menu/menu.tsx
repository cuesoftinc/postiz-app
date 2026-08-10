'use client';

import React, {
  FC,
  MouseEventHandler,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useClickOutside } from '@mantine/hooks';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { deleteDialog } from '@gitroom/react/helpers/delete.dialog';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import { TimeTable } from '@gitroom/frontend/components/launches/time.table';
import {
  Integrations,
  useCalendar,
} from '@gitroom/frontend/components/launches/calendar.context';
import { BotPicture } from '@gitroom/frontend/components/launches/bot.picture';
import { CustomerModal } from '@gitroom/frontend/components/launches/customer.modal';
import { Integration } from '@prisma/client';
import { SettingsModal } from '@gitroom/frontend/components/launches/settings.modal';
import { CustomVariables } from '@gitroom/frontend/components/launches/add.provider.component';
import { useRouter } from 'next/navigation';
import { useVariables } from '@gitroom/react/helpers/variable.context';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { AddEditModal } from '@gitroom/frontend/components/new-launch/add.edit.modal';
import dayjs from 'dayjs';
import { ModalWrapperComponent } from '@gitroom/frontend/components/new-launch/modal.wrapper.component';
import copy from 'copy-to-clipboard';

export const Menu: FC<{
  canEnable: boolean;
  canDisable: boolean;
  canChangeProfilePicture: boolean;
  canChangeNickName: boolean;
  refreshChannel: (
    integration: Integration & {
      identifier: string;
    }
  ) => () => void;
  id: string;
  mutate: () => void;
  onChange: (shouldReload: boolean) => void;
}> = (props) => {
  const {
    canEnable,
    canDisable,
    id,
    onChange,
    mutate,
    canChangeProfilePicture,
    canChangeNickName,
    refreshChannel,
  } = props;
  const t = useT();

  const fetch = useFetch();
  const router = useRouter();
  const { extensionId } = useVariables();
  const { integrations, reloadCalendarView } = useCalendar();
  const toast = useToaster();
  const modal = useModals();
  const [show, setShow] = useState<false | { x: number; y: number }>(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const ref = useClickOutside<HTMLDivElement>(() => {
    setShow(false);
  });
  const showRef = useRef(undefined);

  // Adjust menu position if it would overflow viewport
  useLayoutEffect(() => {
    if (show && menuRef.current) {
      const menuRect = menuRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const padding = 10;

      // Check if menu overflows bottom of viewport
      if (menuRect.bottom > viewportHeight - padding) {
        const newY = Math.max(
          padding,
          viewportHeight - menuRect.height - padding
        );
        // Only update if position actually changed significantly to avoid infinite loop
        if (Math.abs(show.y - newY) > 1) {
          setShow((prev) => (prev ? { ...prev, y: newY } : false));
        }
      }
    }
  }, [show]);
  const findIntegration: any = useMemo(() => {
    return integrations.find((integration) => integration.id === id);
  }, [integrations, id]);
  const changeShow: MouseEventHandler<HTMLDivElement> = useCallback(
    (e) => {
      e.stopPropagation();
      // @ts-ignore
      const boundBox = showRef?.current?.getBoundingClientRect();
      setShow(
        show
          ? false
          : { x: boundBox?.left, y: boundBox?.top + boundBox?.height }
      );
    },
    [show]
  );
  const disableChannel = useCallback(async () => {
    if (
      !(await deleteDialog(
        t('are_you_sure_disable_channel', 'Are you sure you want to disable this channel?'),
        t('disable_channel_title', 'Disable Channel')
      ))
    ) {
      return;
    }
    await fetch('/integrations/disable', {
      method: 'POST',
      body: JSON.stringify({
        id,
      }),
    });
    toast.show(t('channel_disabled', 'Channel Disabled'), 'success');
    setShow(false);
    onChange(false);
  }, [t]);
  const deleteChannel = useCallback(async () => {
    if (
      !(await deleteDialog(
        t('are_you_sure_delete_channel', 'Are you sure you want to delete this channel?'),
        t('delete_channel_title', 'Delete Channel')
      ))
    ) {
      return;
    }
    const deleteIntegration = await fetch('/integrations', {
      method: 'DELETE',
      body: JSON.stringify({
        id,
      }),
    });
    if (deleteIntegration.status === 406) {
      toast.show(
        t('delete_posts_before_channel', 'You have to delete all the posts associated with this channel before deleting it'),
        'warning'
      );
      return;
    }
    // Clean up extension refresh token if applicable
    if (
      extensionId &&
      typeof chrome !== 'undefined' &&
      chrome?.runtime?.sendMessage
    ) {
      try {
        chrome.runtime.sendMessage(
          extensionId,
          { type: 'REMOVE_REFRESH_TOKEN', integrationId: id },
          () => {}
        );
      } catch {
        // Silently ignore
      }
    }
    toast.show(t('channel_deleted', 'Channel Deleted'), 'success');
    setShow(false);
    onChange(true);
  }, [t, extensionId, id]);

  const enableChannel = useCallback(async () => {
    await fetch('/integrations/enable', {
      method: 'POST',
      body: JSON.stringify({
        id,
      }),
    });
    toast.show(t('channel_enabled', 'Channel Enabled'), 'success');
    setShow(false);
    onChange(false);
  }, [t]);

  const editTimeTable = useCallback(() => {
    const findIntegration = integrations.find(
      (integration) => integration.id === id
    );
    modal.openModal({
      withCloseButton: true,
      closeOnEscape: false,
      closeOnClickOutside: false,
      askClose: true,
      title: t('time_table_slots', 'Time Table Slots'),
      children: <TimeTable integration={findIntegration!} mutate={mutate} />,
    });
    setShow(false);
  }, [integrations, t]);

  const copyChannelId = useCallback(
    (integration: Integrations) => async () => {
      setShow(false);
      const channelId = integration.id;
      copy(channelId);
      toast.show(t('channel_id_copied', 'Channel ID copied to clipboard'), 'success');
    },
    [t]
  );

  const createPost = useCallback(
    (integration: Integrations) => async () => {
      setShow(false);

      const { date } = await (
        await fetch(`/posts/find-slot/${integration.id}`)
      ).json();

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
            reopenModal={createPost(integration)}
            mutate={reloadCalendarView}
            integrations={integrations}
            selectedChannels={[integration.id]}
            // focusedChannel={integration.id}
            date={dayjs.utc(date).local()}
          />
        ),
        size: '80%',
        title: ``,
      });
    },
    [integrations]
  );

  const changeBotPicture = useCallback(() => {
    const findIntegration = integrations.find(
      (integration) => integration.id === id
    );
    modal.openModal({
      classNames: {
        modal: 'w-[100%] max-w-[600px] bg-transparent text-textColor',
      },
      size: '100%',
      withCloseButton: false,
      closeOnEscape: true,
      closeOnClickOutside: true,
      children: (
        <BotPicture
          canChangeProfilePicture={canChangeProfilePicture}
          canChangeNickName={canChangeNickName}
          integration={findIntegration!}
          mutate={mutate}
        />
      ),
    });
    setShow(false);
  }, [integrations]);
  const additionalSettings = useCallback(() => {
    const findIntegration = integrations.find(
      (integration) => integration.id === id
    );
    modal.openModal({
      title: t('additional_settings', 'Additional Settings'),
      children: (
        <SettingsModal
          // @ts-ignore
          integration={findIntegration}
          onClose={() => {
            mutate();
            toast.show(t('settings_updated', 'Settings Updated'), 'success');
          }}
        />
      ),
    });
    setShow(false);
  }, [integrations, t]);
  const addToCustomer = useCallback(() => {
    const findIntegration = integrations.find(
      (integration) => integration.id === id
    );
    modal.openModal({
      classNames: {
        modal: 'md',
      },
      title: t('move_add_to_group', 'Move / Add to group'),
      withCloseButton: false,
      closeOnEscape: true,
      closeOnClickOutside: true,
      children: (
        <CustomerModal
          // @ts-ignore
          integration={findIntegration}
          onClose={() => {
            mutate();
            toast.show(t('customer_updated', 'Customer Updated'), 'success');
          }}
        />
      ),
    });
    setShow(false);
  }, [integrations, t]);
  const updateCredentials = useCallback(() => {
    modal.openModal({
      title: t('custom_url', 'Custom URL'),
      withCloseButton: false,
      classNames: {
        modal: 'md',
      },
      children: (
        <CustomVariables
          identifier={findIntegration.identifier}
          gotoUrl={(url: string) => router.push(url)}
          variables={findIntegration.customFields}
        />
      ),
    });
  }, [t]);

  return (
    <div
      className="cursor-pointer relative select-none flex"
      onClick={changeShow}
      ref={ref}
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
        className="text-menuDots group-hover/profile:text-menuDotsHover"
      >
        <circle cx="12" cy="5" r="1" />
        <circle cx="12" cy="12" r="1" />
        <circle cx="12" cy="19" r="1" />
      </svg>
      <div>
        <div ref={showRef} />
      </div>
      {show && (
        <div
          ref={menuRef}
          onClick={(e) => e.stopPropagation()}
          style={{ left: show.x, top: show.y }}
          className={`fixed p-[12px] bg-newBgColorInner shadow-menu flex flex-col gap-[16px] z-[100] rounded-[8px] border border-tableBorder text-nowrap`}
        >
          {canDisable && !findIntegration?.refreshNeeded && (
            <div
              className="flex gap-[12px] items-center py-[8px] px-[10px]"
              onClick={createPost(findIntegration!)}
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
                  className="text-green-500"
                >
                  <path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .505-.852z" />
                </svg>
              </div>
              <div className="text-[14px]">
                {t('create_new_post', 'Create a new post')}
              </div>
            </div>
          )}
          <div
            className="flex gap-[12px] items-center py-[8px] px-[10px]"
            onClick={copyChannelId(findIntegration)}
          >
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
                <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
              </svg>
            </div>
            <div className="text-[14px]">{t('copy_id', 'Copy Channel ID')}</div>
          </div>
          {canDisable &&
            findIntegration?.refreshNeeded &&
            !findIntegration.customFields && (
              <div
                className="flex gap-[12px] items-center py-[8px] px-[10px]"
                onClick={refreshChannel(findIntegration!)}
              >
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
                    className="text-yellow-500"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                    <path d="M21 3v5h-5" />
                    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                    <path d="M8 16H3v5" />
                  </svg>
                </div>
                <div className="text-[14px]">
                  {t('reconnect_channel', 'Reconnect channel')}
                </div>
              </div>
            )}
          {!!findIntegration?.isCustomFields && (
            <div
              className="flex gap-[12px] items-center py-[8px] px-[10px]"
              onClick={updateCredentials}
            >
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
                  <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                  <path d="M21 3v5h-5" />
                  <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                  <path d="M8 16H3v5" />
                </svg>
              </div>
              <div className="text-[14px]">
                {t('update_credentials', 'Update Credentials')}
              </div>
            </div>
          )}
          {findIntegration?.additionalSettings !== '[]' && (
            <div
              className="flex gap-[12px] items-center py-[8px] px-[10px]"
              onClick={additionalSettings}
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
                  <path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </div>
              <div className="text-[14px]">
                {t('additional_settings', 'Additional Settings')}
              </div>
            </div>
          )}
          {(canChangeProfilePicture || canChangeNickName) && (
            <div
              className="flex gap-[12px] items-center py-[8px] px-[10px]"
              onClick={changeBotPicture}
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
              <div className="text-[14px]">
                {t('change_bot', 'Change Bot')}{' '}
                {[
                  canChangeProfilePicture && t('picture', 'Picture'),
                  canChangeNickName && t('label_nickname', 'Nickname'),
                ]
                  .filter((f) => f)
                  .join(' / ')}
              </div>
            </div>
          )}
          <div
            className="flex gap-[12px] items-center py-[8px] px-[10px]"
            onClick={addToCustomer}
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
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <line x1="19" x2="19" y1="8" y2="14" />
                <line x1="16" x2="22" y1="11" y2="11" />
              </svg>
            </div>
            <div className="text-[14px]">
              {t('move_add_to_group', 'Move / add to group')}
            </div>
          </div>
          <div
            className="flex gap-[12px] items-center py-[8px] px-[10px]"
            onClick={editTimeTable}
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
                <line x1="10" x2="14" y1="2" y2="2" />
                <line x1="12" x2="15" y1="14" y2="11" />
                <circle cx="12" cy="14" r="8" />
              </svg>
            </div>
            <div className="text-[14px]">
              {t('edit_time_slots', 'Edit Time Slots')}
            </div>
          </div>
          {canEnable && (
            <div
              className="flex gap-[12px] items-center py-[8px] px-[10px]"
              onClick={enableChannel}
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
                  <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76" />
                  <path d="m9 12 2 2 4-4" />
                </svg>
              </div>
              <div className="text-[14px]">
                {t('enable_channel', 'Enable Channel')}
              </div>
            </div>
          )}

          {canDisable && (
            <div
              className="flex gap-[12px] items-center py-[8px] px-[10px]"
              onClick={disableChannel}
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
                  <circle cx="12" cy="12" r="10" />
                  <path d="m4.9 4.9 14.2 14.2" />
                </svg>
              </div>
              <div className="text-[14px]">
                {t('disable_channel', 'Disable Channel')}
              </div>
            </div>
          )}

          <div
            className="flex gap-[12px] items-center py-[8px] px-[10px]"
            onClick={deleteChannel}
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
                className="text-red-400"
              >
                <path d="M3 6h18" />
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
              </svg>
            </div>
            <div className="text-[14px]">{t('delete', 'Delete')}</div>
          </div>
        </div>
      )}
    </div>
  );
};
