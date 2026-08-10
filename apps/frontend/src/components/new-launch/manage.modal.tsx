'use client';

import React, {
  FC,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AddEditModalProps } from '@gitroom/frontend/components/new-launch/add.edit.modal';
import clsx from 'clsx';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { PicksSocialsComponent } from '@gitroom/frontend/components/new-launch/picks.socials.component';
import { EditorWrapper } from '@gitroom/frontend/components/new-launch/editor';
import { SelectCurrent } from '@gitroom/frontend/components/new-launch/select.current';
import { ShowAllProviders } from '@gitroom/frontend/components/new-launch/providers/show.all.providers';
import { useExistingData } from '@gitroom/frontend/components/launches/helpers/use.existing.data';
import { useLaunchStore } from '@gitroom/frontend/components/new-launch/store';
import { DatePicker } from '@gitroom/frontend/components/launches/helpers/date.picker';
import { useShallow } from 'zustand/react/shallow';
import { RepeatComponent } from '@gitroom/frontend/components/launches/repeat.component';
import { TagsComponent } from '@gitroom/frontend/components/launches/tags.component';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { deleteDialog } from '@gitroom/react/helpers/delete.dialog';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { makeId } from '@gitroom/nestjs-libraries/services/make.is';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import { capitalize } from 'lodash';
import { SelectCustomer } from '@gitroom/frontend/components/launches/select.customer';
import { CopilotPopup } from '@copilotkit/react-ui';
import { DummyCodeComponent } from '@gitroom/frontend/components/new-launch/dummy.code.component';
import { CreationMethodBadge } from '@gitroom/frontend/components/launches/creation.method.badge';
import {
  SettingsIcon,
  ChevronDownIcon,
  CloseIcon,
  TrashIcon,
  DropdownArrowSmallIcon,
} from '@gitroom/frontend/components/ui/icons';
import { useHasScroll } from '@gitroom/frontend/components/ui/is.scroll.hook';
import { useShortlinkPreference } from '@gitroom/frontend/components/settings/shortlink-preference.component';
import dayjs from 'dayjs';
import { Button } from '@gitroom/react/form/button';
import { ModalFooter } from '@gitroom/frontend/components/cuesoft/modal/modal-footer';

export const ManageModal: FC<AddEditModalProps> = (props) => {
  const t = useT();
  const fetch = useFetch();
  const ref = useRef(null);
  const existingData = useExistingData();
  const [loading, setLoading] = useState(false);
  const toaster = useToaster();
  const modal = useModals();
  const [showSettings, setShowSettings] = useState(false);
  // Buffer's header Preview toggle. Visual only: the pane is display-hidden,
  // never unmounted — ShowAllProviders holds the provider refs the submit
  // flow validates through, so it must stay mounted.
  const [showPreview, setShowPreview] = useState(true);
  const { data: shortlinkPreferenceData } = useShortlinkPreference();

  const { addEditSets, mutate, customClose, dummy } = props;

  const {
    selectedIntegrations,
    hide,
    date,
    setDate,
    repeater,
    setRepeater,
    tags,
    setTags,
    integrations,
    setSelectedIntegrations,
    locked,
    current,
    activateExitButton,
    setHide,
  } = useLaunchStore(
    useShallow((state) => ({
      hide: state.hide,
      setHide: state.setHide,
      date: state.date,
      setDate: state.setDate,
      current: state.current,
      repeater: state.repeater,
      setRepeater: state.setRepeater,
      tags: state.tags,
      setTags: state.setTags,
      selectedIntegrations: state.selectedIntegrations,
      integrations: state.integrations,
      setSelectedIntegrations: state.setSelectedIntegrations,
      locked: state.locked,
      activateExitButton: state.activateExitButton,
    }))
  );

  useEffect(() => {
    if (hide) {
      setHide(false);
    }
  }, [hide]);

  const currentIntegrationText = useMemo(() => {
    if (current === 'global') {
      return (
        <div className="flex items-center gap-[10px]">
          <div className="relative">
            <SettingsIcon size={15} className="text-newTextColor" />
          </div>
          <div>Settings</div>
        </div>
      );
    }

    const currentIntegration = integrations.find((p) => p.id === current)!;

    return (
      <div className="flex items-center gap-[10px]">
        <div className="relative">
          <img
            src={`/icons/platforms/${currentIntegration.identifier}.png`}
            className="w-[20px] h-[20px] rounded-[4px]"
            alt={currentIntegration.identifier}
          />
          <SettingsIcon
            size={15}
            className="text-newTextColor absolute -end-[5px] -bottom-[5px]"
          />
        </div>
        <div>
          {currentIntegration.name} {t('channel_settings', 'Settings')}
        </div>
      </div>
    );
  }, [current]);

  const changeCustomer = useCallback(
    (customer: string) => {
      const neededIntegrations = integrations.filter(
        (p) => p?.customer?.id === customer
      );
      setSelectedIntegrations(
        neededIntegrations.map((p) => ({
          settings: {},
          selectedIntegrations: p,
        }))
      );
    },
    [integrations]
  );

  const askClose = useCallback(async () => {
    if (!activateExitButton || dummy) {
      return;
    }

    if (
      await deleteDialog(
        t(
          'are_you_sure_you_want_to_close_this_modal_all_data_will_be_lost',
          'Are you sure you want to close this modal? (all data will be lost)'
        ),
        t('yes_close_it', 'Yes, close it!')
      )
    ) {
      if (customClose) {
        customClose();
        return;
      }
      modal.closeAll();
    }
  }, [activateExitButton, dummy]);

  const deletePost = useCallback(async () => {
    setLoading(true);
    if (
      !(await deleteDialog(
        t(
          'are_you_sure_you_want_to_delete_post',
          'Are you sure you want to delete this post?'
        ),
        t('yes_delete_it', 'Yes, delete it!')
      ))
    ) {
      setLoading(false);
      return;
    }
    await fetch(`/posts/${existingData.group}`, {
      method: 'DELETE',
    });
    mutate();
    modal.closeAll();
    return;
  }, [existingData, mutate, modal]);

  const schedule = useCallback(
    (type: 'draft' | 'now' | 'schedule' | 'update') => async () => {
      if (
        (type === 'now' || type === 'schedule') &&
        (existingData?.posts?.[0]?.state === 'PUBLISHED' ||
          (existingData?.posts?.[0]?.state === 'QUEUE' &&
            dayjs().isAfter(date.utc())))
      ) {
        const whatToDo = await new Promise((resolve) => {
          modal.openModal({
            title: t('what_do_you_want_to_do', 'What do you want to do?'),
            children: (
              <div className="flex flex-col">
                <div className="text-[20px]">
                  {t(
                    'post_already_published_what_to_do',
                    'This post was already published, what do you want to do?'
                  )}
                </div>
                <ModalFooter align="stretch">
                  <Button type="button" onClick={() => resolve('update')}>
                    {t(
                      'just_update_the_post_details',
                      'Just update the post details'
                    )}
                  </Button>
                  <Button type="button" onClick={() => resolve('republish')}>
                    {t('republish_the_post', 'Republish the post')}
                  </Button>
                </ModalFooter>
              </div>
            ),
          });
        });

        if (whatToDo === 'update') {
          type = 'update';
        }
      }

      setLoading(true);

      // Pull the local values to build the payload, but rely on the server
      // (`/posts/valid`) for the actual validation — checkValidity now lives
      // server-side so it can't be bypassed.
      const allValues = await ref.current.getAllValues();

      const integrationById = (id: string) =>
        selectedIntegrations.find((p) => p.integration.id === id);

      const group = existingData.group || makeId(10);

      const posts = allValues.map((post: any) => ({
        integration: {
          id: post.id,
        },
        group,
        settings: { ...(post.settings || {}) },
        value: post.values.map((value: any) => ({
          ...(value.id ? { id: value.id } : {}),
          content: value.content,
          delay: value.delay || 0,
          image:
            (value?.media || []).map(
              ({ id, path, alt, thumbnail, thumbnailTimestamp }: any) => ({
                id,
                path,
                alt,
                thumbnail,
                thumbnailTimestamp,
              })
            ) || [],
        })),
      }));

      if (!dummy) {
        const checkAllValid = await (
          await fetch('/posts/valid', {
            method: 'POST',
            body: JSON.stringify({ type, posts }),
          })
        ).json();

        const focus = (id: string, where: 'fix' | 'preview') => {
          integrationById(id)?.ref?.current?.[where]?.();
        };

        const notEnoughChars = checkAllValid.filter((p: any) => p.emptyContent);

        for (const item of notEnoughChars) {
          toaster.show(
            `${capitalize(item.identifier.split('-')[0])} (${item.name}):` +
              ' ' +
              t(
                'post_needs_content_or_image',
                'Your post should have at least one character or one image.'
              ),
            'warning'
          );
          setLoading(false);
          focus(item.id, 'preview');
          return;
        }

        if (type !== 'draft') {
          for (const item of checkAllValid) {
            if (item.valid === false) {
              toaster.show(
                `${capitalize(item.identifier.split('-')[0])} (${item.name}): ${
                  item.settingsError ||
                  t('please_fix_your_settings', 'Please fix your settings')
                }`,
                'warning'
              );
              focus(item.id, 'fix');
              setLoading(false);
              setShowSettings(true);
              return;
            }

            if (item.errors !== true) {
              toaster.show(
                `${capitalize(item.identifier.split('-')[0])} (${item.name}): ${
                  item.errors
                }`,
                'warning'
              );
              focus(item.id, 'preview');
              setLoading(false);
              setShowSettings(false);
              return;
            }

            if (item.tooLong) {
              toaster.show(
                `${item.name} (${item.identifier}) ${t(
                  'post_is_too_long',
                  'post is too long, please fix it'
                )}`,
                'warning'
              );
              focus(item.id, 'preview');
              setLoading(false);
              return;
            }
          }
        }
      }

      const shortlinkPreference = shortlinkPreferenceData?.shortlink || 'ASK';

      let shortLink = false;

      if (!dummy && shortlinkPreference !== 'NO') {
        const shortLinkUrl = await (
          await fetch('/posts/should-shortlink', {
            method: 'POST',
            body: JSON.stringify({
              messages: allValues
                // platforms that remove links won't keep shortlinks either
                .filter(
                  (p: any) => !integrationById(p.id)?.integration?.stripLinks
                )
                .flatMap((p: any) => p.values.flatMap((a: any) => a.content)),
            }),
          })
        ).json();

        if (shortLinkUrl.ask) {
          if (shortlinkPreference === 'YES') {
            // Automatically shortlink without asking
            shortLink = true;
          } else {
            // ASK: Show the dialog
            shortLink = await deleteDialog(
              t(
                'shortlink_urls_question',
                'Do you want to shortlink the URLs? it will let you get statistics over clicks'
              ),
              t('yes_shortlink_it', 'Yes, shortlink it!'),
              undefined,
              t('no_original_urls', 'No, original URLs')
            );
          }
        }
      }

      const data = {
        type,
        ...(repeater ? { inter: repeater } : {}),
        tags,
        shortLink,
        date: date.utc().format('YYYY-MM-DDTHH:mm:ss'),
        posts,
      };

      if (dummy) {
        modal.openModal({
          title: '',
          children: <DummyCodeComponent code={data} />,
          classNames: {
            modal: 'w-[100%] bg-transparent text-textColor',
          },
          size: '100%',
          withCloseButton: false,
          closeOnEscape: true,
          closeOnClickOutside: true,
        });

        setLoading(false);
      }

      if (!dummy) {
        addEditSets
          ? addEditSets(data)
          : await fetch('/posts', {
              method: 'POST',
              body: JSON.stringify(data),
            });

        if (!addEditSets) {
          mutate();
          toaster.show(
            !existingData.integration
              ? t('added_successfully', 'Added successfully')
              : t('updated_successfully', 'Updated successfully')
          );
        }
        if (customClose) {
          setTimeout(() => {
            customClose();
          }, 2000);
        }

        if (!addEditSets) {
          modal.closeAll();
        }
      }
    },
    [ref, repeater, tags, date, addEditSets, dummy, shortlinkPreferenceData]
  );

  return (
    <div className="w-full h-full flex-1 p-[40px] phone:p-0 flex relative">
      {/* Buffer Create Post scoped skin: the legacy chip row + the footer
          controls live in files outside this rebuild's ownership (media/**,
          launches/*), so their convergence to 32px/r8 hairline chips and the
          40px quiet footer buttons is applied here, keyed on wrapper ids.
          Attribute selectors dodge the bracket-escaping of arbitrary
          Tailwind classes. */}
      <style>
        {`
          #cs-composer [class*="h-[30px]"][class*="rounded-[6px]"] {
            height: 32px !important;
            border-radius: 8px !important;
            background: transparent !important;
            border: 1px solid var(--new-table-border);
          }
          #cs-composer [class*="h-[30px]"][class*="rounded-[6px]"]:hover {
            background: var(--new-table-header) !important;
          }
          #cs-composer [class*="w-[30px]"][class*="rounded-[6px]"] {
            width: 32px !important;
          }
          #cs-tags-chip > div {
            height: 32px !important;
            border-radius: 8px !important;
            font-size: 14px !important;
            font-weight: 500 !important;
          }
          #cs-tags-chip > div > div:first-child {
            padding-inline: 12px;
            gap: 6px;
          }
          #cs-tags-chip > div [class*="rounded-[4px]"] {
            height: 22px !important;
            align-self: center;
          }
          /* the tags popover ships bottom-anchored (it lived in the footer);
             in the header it must drop DOWN instead */
          #cs-tags-chip [class*="z-[300]"] {
            bottom: auto !important;
            top: calc(100% + 8px) !important;
            transform: none !important;
            border-radius: 12px;
            border: 1px solid var(--new-table-border);
          }
          #cs-datetime > div,
          #cs-repeat > div {
            height: 40px !important;
            font-size: 14px !important;
            font-weight: 500 !important;
            flex: 0 1 auto !important;
          }
          #cs-datetime > div {
            border-color: var(--new-table-border) !important;
          }
        `}
      </style>
      <div
        id="cs-composer"
        className="flex flex-1 bg-newBgColorInner rounded-[16px] phone:rounded-none flex-col"
      >
        {/* HEADER — spans the full modal width above both panes. Title is
            20px/400 Plus Jakarta (data-cs keeps the ladder off text-[20px]);
            beside it the existing tags control restyled as the Buffer chip. */}
        <div className="min-h-[64px] border-b border-newTableBorder flex items-center gap-[12px] px-[24px] phone:px-[16px]">
          <div
            data-cs
            className="text-[20px] font-display font-[400] text-newTextColor whitespace-nowrap"
          >
            {t('create_post_title', 'Create Post')}
          </div>
          <CreationMethodBadge
            creationMethod={existingData?.posts?.[0]?.creationMethod}
            size="sm"
          />
          {!dummy && (
            <div id="cs-tags-chip" className="flex items-center">
              <TagsComponent
                name="tags"
                label={t('tags', 'Tags')}
                initial={tags}
                onChange={(e) => {
                  setTags(e.target.value);
                }}
              />
            </div>
          )}
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => setShowPreview(!showPreview)}
            className={clsx(
              'phone:hidden h-[32px] px-[12px] rounded-[8px] flex items-center gap-[6px] text-[14px] font-[500] transition-colors',
              showPreview
                ? 'bg-boxFocused text-textItemFocused'
                : 'border border-newTableBorder text-newTextColor hover:bg-newTableHeader'
            )}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            {t('preview', 'Preview')}
          </button>
          <div
            onClick={askClose}
            className="cursor-pointer flex items-center justify-center w-[32px] h-[32px] rounded-[8px] hover:bg-newTextColor/10 transition-colors"
          >
            <CloseIcon className="text-newTextColor/60" />
          </div>
        </div>
        <div className="flex-1 flex">
          {/* phone: the editor owns the full width — the fixed 420px preview
              pane collapsed it to 1px (editor-first, like Buffer mobile) */}
          <div className="flex flex-col flex-1 min-w-0">
            <div className="flex-1 flex flex-col gap-[16px]">
              <div
                className={clsx('flex-1 relative', showSettings && 'hidden')}
              >
                <div
                  id="social-content"
                  className="gap-[16px] flex flex-col pe-[16px] pt-[12px] ps-[24px] phone:ps-[16px] phone:pe-[8px] absolute top-0 left-0 w-full h-full overflow-x-hidden overflow-y-scroll scrollbar scrollbar-thumb-newColColor scrollbar-track-newBgColorInner"
                >
                  {/* CHANNELS ROW — 40px r10 avatar tiles (restyled in
                      picks.socials.component) + the existing customer picker */}
                  <div className="flex w-full py-[12px] phone:py-[4px]">
                    <div className="flex flex-1">
                      <PicksSocialsComponent toolTip={true} />
                    </div>
                    <div>
                      {!dummy && (
                        <SelectCustomer
                          onChange={changeCustomer}
                          integrations={integrations}
                        />
                      )}
                    </div>
                  </div>
                  <div className="flex flex-1 gap-[6px] flex-col">
                    <div>{!existingData.integration && <SelectCurrent />}</div>
                    {/* EDITOR AREA — one r12 hairline container around the
                        existing per-platform editor stack. No overflow-hidden:
                        the emoji/mention/delay popovers position out of it. */}
                    <div className="flex-1 flex rounded-[12px] border border-newTableBorder">
                      {!hide && <EditorWrapper totalPosts={1} value="" />}
                    </div>
                    <div
                      id="social-empty"
                      className={clsx(
                        'pb-[16px]'
                        // current !== 'global' && 'hidden'
                      )}
                    />
                  </div>
                </div>
              </div>
              <div
                id="wrapper-settings"
                className={clsx(
                  'pb-[16px] px-[16px] select-none',
                  showSettings && 'flex-1 flex pt-[16px]',
                  current === 'global' && 'hidden'
                )}
              >
                <div className="flex-1 flex flex-col rounded-[8px] gap-[12px] overflow-hidden bg-newSettings">
                  <div
                    onClick={() => setShowSettings(!showSettings)}
                    className={clsx(
                      'bg-newTextColor/10 rounded-[8px] flex items-center gap-[8px] cursor-pointer p-[12px]',
                      showSettings ? '!rounded-b-none' : ''
                    )}
                  >
                    <div className="flex-1 text-[14px] font-[600] text-newTextColor">
                      {currentIntegrationText}
                    </div>
                    <div>
                      <ChevronDownIcon
                        rotated={showSettings}
                        className="text-newTextColor"
                      />
                    </div>
                  </div>
                  <div
                    className={clsx(
                      !showSettings ? 'hidden' : 'flex-1',
                      'text-[14px] text-textColor font-[500] relative'
                    )}
                  >
                    <div className="absolute left-0 top-0 w-full h-full flex flex-col overflow-x-hidden overflow-y-auto scrollbar scrollbar-thumb-newBgColorInner scrollbar-track-newColColor">
                      <div
                        id="social-settings"
                        className="flex flex-col gap-[20px] bg-newBgColor"
                      />
                    </div>
                  </div>
                  <style>
                    {`#social-settings [data-id="${current}"] {display: block !important;}`}
                  </style>
                </div>
              </div>
            </div>
          </div>
          {/* PREVIEW PANE — newTableHeader wash, hairline divider. Hidden
              (never unmounted — submit validates through the provider refs
              inside) when the header Preview toggle is off. */}
          <div
            className={clsx(
              'w-[420px] flex flex-col phone:hidden bg-newTableHeader border-s border-newTableBorder',
              !showPreview && 'hidden'
            )}
          >
            <div className="pt-[16px] px-[16px] flex items-center gap-[8px] text-[16px] font-[600] text-newTextColor">
              <div>{t('post_preview', 'Post Previews')}</div>
              <div
                data-tooltip-id="tooltip"
                data-tooltip-content={t(
                  'post_preview_tooltip',
                  'Previews are approximations and may differ from the published post'
                )}
                className="text-newTextColor/60 flex items-center"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4" />
                  <path d="M12 8h.01" />
                </svg>
              </div>
            </div>
            <div className="flex-1 relative">
              <Scrollable
                scrollClasses="!pe-[16px]"
                className="absolute top-0 p-[16px] pe-[8px] left-0 w-full h-full overflow-x-hidden overflow-y-scroll scrollbar scrollbar-thumb-newColColor scrollbar-track-newTableHeader"
              >
                <ShowAllProviders ref={ref} />
              </Scrollable>
            </div>
          </div>
        </div>
        {/* FOOTER — full width, hairline top, ~64px. Left keeps the repeat
            control (and delete when editing); right = the existing date/time
            selector as a quiet 40px hairline button + the lime submit.
            Wraps on phone so nothing runs past the viewport. */}
        <div className="select-none min-h-[64px] py-[12px] px-[24px] phone:px-[12px] border-t border-newTableBorder flex flex-wrap items-center gap-[8px]">
          <div className="flex-1 flex flex-wrap items-center gap-[8px]">
            {/* quiet 40px skin for the repeat control (its class strings live
                in launches/*, outside this rebuild's file list — see the
                #cs-repeat scoped style above) */}
            {!dummy && (
              <div id="cs-repeat" className="contents [&>div]:rounded-[8px]">
                <RepeatComponent repeat={repeater} onChange={setRepeater} />
              </div>
            )}
            {existingData?.integration && (
              <button
                onClick={deletePost}
                className="cursor-pointer flex text-[#FF3F3F] gap-[8px] items-center text-[14px] font-[500]"
              >
                <div>
                  <TrashIcon />
                </div>
                <div>{t('delete_post', 'Delete Post')}</div>
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-end phone:justify-start gap-[8px]">
            <div id="cs-datetime" className="contents [&>div]:rounded-[8px]">
              <DatePicker onChange={setDate} date={date} />
            </div>
            {!addEditSets && (
              <button
                data-cs
                disabled={
                  selectedIntegrations.length === 0 || loading || locked
                }
                onClick={schedule('draft')}
                className="relative cursor-pointer disabled:cursor-not-allowed px-[16px] h-[40px] bg-transparent border border-newTableBorder justify-center items-center flex rounded-[8px] text-[14px] font-[500] hover:bg-newTableHeader focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forth"
              >
                {loading && (
                  <div className="absolute left-[50%] top-[50%] -translate-y-[50%] -translate-x-[50%]">
                    <div className="animate-spin h-[20px] w-[20px] border-4 border-textColor border-t-transparent rounded-full" />
                  </div>
                )}
                <div className={clsx(loading && 'invisible')}>
                  {t('save_as_draft', 'Save as Draft')}
                </div>
              </button>
            )}
            {/* Primary submits: lime h-40 r8, 500 weight — data-cs opts them
                out of the global h-[40px]->32 ladder. Ink comes from the
                global bg-btnPrimary black-ink rule; text-black restates it. */}
            {addEditSets && (
              <button
                data-cs
                className="text-[14px] font-[500] btnSub disabled:cursor-not-allowed disabled:opacity-80 outline-none gap-[8px] flex justify-center items-center h-[40px] rounded-[8px] bg-btnPrimary text-black px-[16px] focus-visible:ring-2 focus-visible:ring-forth"
                disabled={
                  selectedIntegrations.length === 0 || loading || locked
                }
                onClick={schedule('draft')}
              >
                Save Set
              </button>
            )}
            {!addEditSets && (
              <div className="group cursor-pointer relative">
                <button
                  data-cs
                  disabled={
                    selectedIntegrations.length === 0 || loading || locked
                  }
                  onClick={schedule('schedule')}
                  className="relative btnSub disabled:cursor-not-allowed disabled:opacity-80 outline-none gap-[8px] flex justify-center items-center h-[40px] rounded-[8px] bg-btnPrimary text-black px-[16px] focus-visible:ring-2 focus-visible:ring-forth"
                >
                  {loading && (
                    <div className="absolute left-[50%] top-[50%] -translate-y-[50%] -translate-x-[50%]">
                      <div className="animate-spin h-[20px] w-[20px] border-4 border-black border-t-transparent rounded-full" />
                    </div>
                  )}
                  <div
                    className={clsx(
                      'text-[14px] font-[500]',
                      loading && 'invisible'
                    )}
                  >
                    {selectedIntegrations.length === 0
                      ? t('check_circles_above', 'Check the circles above')
                      : dummy
                      ? t('create_output', 'Create output')
                      : !existingData?.integration
                      ? t('add_to_calendar', 'Add to calendar')
                      : existingData?.posts?.[0]?.state === 'DRAFT'
                      ? t('schedule', 'Schedule')
                      : t('update', 'Update')}
                  </div>
                  {!dummy && (
                    <div className="flex justify-center items-center h-[20px] w-[20px] pt-[4px] arrow-change">
                      <DropdownArrowSmallIcon className="group-hover:rotate-180" />
                    </div>
                  )}
                </button>

                {!dummy && (
                  <button
                    onClick={schedule('now')}
                    disabled={
                      selectedIntegrations.length === 0 || loading || locked
                    }
                    className="rounded-[16px] z-[300] disabled:cursor-not-allowed disabled:opacity-80 hidden group-hover:flex absolute bottom-[100%] -left-[12px] p-[12px] w-[206px] bg-newBgColorInner border border-newTableBorder shadow-menu"
                  >
                    <div
                      data-cs
                      className="rounded-[8px] bg-btnPrimary text-black h-[40px] w-full flex justify-center items-center text-[14px] font-[500] post-now"
                    >
                      {t('post_now', 'Post Now')}
                    </div>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      <CopilotPopup
        hitEscapeToClose={false}
        clickOutsideToClose={true}
        instructions={`
You are an assistant that help the user to schedule their social media posts,
Here are the things you can do:
- Add a new comment / post to the list of posts
- Delete a comment / post from the list of posts
- Add content to the comment / post
- Activate or deactivate the comment / post

Post content can be added using the addPostContentFor{num} function.
After using the addPostFor{num} it will create a new addPostContentFor{num+ 1} function.
`}
        labels={{
          title: t('your_assistant', 'Your Assistant'),
          initial: t(
            'assistant_initial_message',
            'Hi! I can help you to refine your social media posts.'
          ),
        }}
      />
    </div>
  );
};

const Scrollable: FC<{
  className: string;
  scrollClasses: string;
  children: ReactNode;
}> = ({ className, scrollClasses, children }) => {
  const ref = useRef(undefined);
  const hasScroll = useHasScroll(ref);
  return (
    <div className={clsx(className, hasScroll && scrollClasses)} ref={ref}>
      {children}
    </div>
  );
};
