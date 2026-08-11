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
import { ContentChatComponent } from '@gitroom/frontend/components/content-agent/content-chat.component';
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
import { supportEmitter } from '@gitroom/frontend/components/layout/support';

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
  // Phone-only preview overlay (Buffer phone composer): its own state so the
  // phone sheet opens editor-first while the desktop pane keeps default-ON.
  // Same rule as showPreview: visual only, the pane is never unmounted.
  const [showPreviewPhone, setShowPreviewPhone] = useState(false);
  // Assistant slide-over (Claude Code bridge; replaced the stock CopilotKit
  // popup, whose transparent panel let the composer bleed through). Visual
  // only: the pane stays mounted so the bridge session survives toggling.
  const [showAssistant, setShowAssistant] = useState(false);
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

  // Buffer parity r2 — the floating support launcher (Chatbase/Discord) must
  // never sit over the composer footer CTA. Hide it for the modal's lifetime.
  useEffect(() => {
    supportEmitter.emit('change', false);
    return () => {
      supportEmitter.emit('change', true);
    };
  }, []);

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
            modal: 'w-[100%] bg-transparent text-newTextColor',
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
    <div
      id="cs-composer-shell"
      className="w-full h-full flex-1 p-[40px] phone:p-0 flex justify-center items-center relative phone:max-w-full phone:overflow-x-hidden"
    >
      {/* Buffer Create Post scoped skin: the legacy chip row + the footer
          controls live in files outside this rebuild's ownership (media/**,
          launches/*), so their convergence — 32px/r8 legacy chips, the 32px
          r8 tags chip, and the 40px split date control — is applied here,
          keyed on wrapper ids. Attribute selectors dodge the
          bracket-escaping of arbitrary Tailwind classes. */}
      <style>
        {`
          /* :not([class*="bg-[#FF"]) exempts the char-counter chip: this
             quiet-chip restyle was stripping its invalid-state red fill
             with !important, leaving white icon/text on a light surface
             (user report; the icon color itself was never the bug) */
          #cs-composer [class*="h-[30px]"][class*="rounded-[6px]"]:not([class*="bg-[#FF"]) {
            height: 32px !important;
            border-radius: 8px !important;
            background: transparent !important;
            border: 1px solid var(--new-table-border);
          }
          #cs-composer [class*="h-[30px]"][class*="rounded-[6px]"]:not([class*="bg-[#FF"]):hover {
            background: var(--new-table-header) !important;
          }
          #cs-composer [class*="w-[30px]"][class*="rounded-[6px]"] {
            width: 32px !important;
          }
          #cs-tags-chip > div {
            height: 32px !important;
            border-radius: 8px !important;
            border-color: var(--new-table-border) !important;
            font-size: 14px !important;
            font-weight: 500 !important;
            color: rgb(var(--new-textColor)) !important;
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
             in the header it must drop DOWN instead. Chrome follows the
             Buffer popover family: ~195px, padding 12px 8px, r12 hairline. */
          #cs-tags-chip [class*="z-[300]"] {
            bottom: auto !important;
            top: calc(100% + 8px) !important;
            transform: none !important;
            border-radius: 12px;
            border: 1px solid var(--new-table-border);
            width: 195px;
            padding: 12px 8px;
          }
          /* popover rows: 32px tall at 14/500 (the row's own py-8/px-20 and
             -mx-12 were cut for the old 12px-uniform container padding) */
          #cs-tags-chip [class*="z-[300]"] > [class*="min-h-[40px]"] {
            min-height: 32px !important;
            padding: 4px 12px !important;
            margin-inline: -8px !important;
            font-size: 14px;
            font-weight: 500;
          }
          #cs-datetime > div,
          #cs-repeat > div {
            height: 40px !important;
            font-size: 14px !important;
            font-weight: 500 !important;
            color: rgb(var(--new-textColor)) !important;
            flex: 0 1 auto !important;
          }
          #cs-repeat > div {
            border-radius: 12px !important;
            border-color: var(--new-table-border) !important;
          }
          /* Buffer split button: this restyles the existing DatePicker
             trigger (launches/helpers, outside this rebuild's file list) into
             the LEFT segment — start-only r12, px 12/8, 14/500 ink, hairline.
             The chevron segment and the lime primary are JSX below, attached
             in one control; only the outer corners carry the r12. */
          #cs-datetime > div {
            border-color: var(--new-table-border) !important;
            border-start-start-radius: 12px !important;
            border-end-start-radius: 12px !important;
            border-start-end-radius: 0 !important;
            border-end-end-radius: 0 !important;
            padding-inline: 12px 8px !important;
            cursor: pointer;
          }
          #cs-datetime > div:hover {
            background: var(--new-table-header);
          }
          /* Measured Buffer desktop leftovers (light theme only — dark stays
             untouched): date-picker popover day-cell hover = #e6e5e2 wash
             (newTableHeader is #f4f3f0, visibly lighter, so the raw hex);
             composer text-input hover border darkens to #8a8a88 (Buffer's
             --color-border-neutral). Hover only: the :not() guards keep
             focus on border-forth, and the selected day keeps its
             !bg-boxFocused lime (that rule is !important, this one is not).
             Day cells are the only nodes carrying BOTH hover:bg-boxHover and
             rounded-[6px] (header controls lack the radius, the time input
             lacks the hover class). */
          .light #cs-datetime [class*="hover:bg-boxHover"][class*="rounded-[6px]"]:hover {
            background-color: #e6e5e2;
          }
          .light #cs-composer [class*="focus-within:border-forth"]:not(:focus-within):hover,
          .light #cs-composer input[class*="border-newTableBorder"]:not(:focus):hover,
          .light #cs-composer textarea[class*="border-newTableBorder"]:not(:focus):hover {
            border-color: #8a8a88;
          }
          /* ≤1100px (tablet): Buffer's composer is a full-viewport sheet — no
             radius, fills the window. The max-[1100px]: arbitrary variant does
             NOT compile against this project's object-based screens config
             (Tailwind 3.4 drops min-*/max-* with raw screens — verified), so
             the full-bleed lives here instead. */
          @media (max-width: 1100px) {
            #cs-composer-shell {
              padding: 0 !important;
            }
            #cs-composer {
              border-radius: 0 !important;
              width: 100%;
              height: 100%;
              max-width: none;
              max-height: none;
              box-shadow: none;
            }
          }
        `}
      </style>
      {/* Buffer dialog geometry: fixed 1100px wide, capped at 813px tall
          (64 header + 675 body + 72 footer + 2 separators), centered in the
          viewport-minus-80 shell. Edge = layered hairline shadow (ring +
          1px ambient), not a heavy drop shadow. */}
      <div
        id="cs-composer"
        className="relative flex w-full max-w-[1100px] phone:min-w-0 phone:max-w-[100vw] h-full max-h-[813px] bg-newBgColorInner rounded-[16px] phone:rounded-none flex-col shadow-[0_0_0_1px_rgba(0,0,0,0.08),0_1px_1px_rgba(0,0,0,0.02)]"
      >
        {/* HEADER — spans the full modal width above both panes. Title is
            18px/500 Inter, the BODY face — measured on Buffer's composer
            (data-cs keeps the ladder off text-[18px]); beside it the existing
            tags control restyled as the Buffer chip. */}
        {/* NO phone:overflow-x-hidden here (the shell keeps the viewport
            guard): the tags popover drops BELOW this row (scoped CSS above),
            and overflow-x:hidden forces overflow-y:auto, so the panel was
            clipped at the header's box and read as buried under the content.
            min-w-0 on the tags chip keeps the row itself shrinkable. */}
        <div className="min-h-[64px] border-b border-newTableBorder flex items-center gap-[12px] ps-[32px] pe-[24px] phone:ps-[16px] phone:pe-[16px] phone:max-w-full">
          <div
            data-cs
            className="text-[18px] font-[500] leading-[22.5px] text-newTextColor whitespace-nowrap"
          >
            {t('create_post_title', 'Create Post')}
          </div>
          {/* phone: the API/creation badge is a dev-facing nicety Buffer has
              no equivalent for, and it is exactly the width that pushed the
              header row past the viewport with a selected tag */}
          <div className="phone:hidden flex">
            <CreationMethodBadge
              creationMethod={existingData?.posts?.[0]?.creationMethod}
              size="sm"
            />
          </div>
          {/* phone: hard cap the chip so a selected tag pill + chevron can
              never widen the header row past the viewport (the row's
              overflow guard was deliberately removed to unclip the
              dropdown). The chip's inner min-w-0 chain truncates the tag
              label instead; the dropdown is absolute, so the cap does not
              clip it. */}
          {!dummy && (
            <div
              id="cs-tags-chip"
              className="flex items-center min-w-0 phone:max-w-[140px]"
            >
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
          {/* Assistant ghost toggle: same quiet-control anatomy as Preview
              (32px, 14/500, hover wash; lime boxFocused pair while the pane
              is open). Opens the Claude Code bridge slide-over below. */}
          <button
            type="button"
            data-cs
            onClick={() => setShowAssistant(!showAssistant)}
            className={clsx(
              'h-[32px] px-[12px] rounded-[8px] flex items-center gap-[6px] text-[14px] font-[500] transition-colors shrink-0',
              showAssistant
                ? 'bg-boxFocused text-textItemFocused'
                : 'text-textItemBlur hover:bg-newTableHeader'
            )}
          >
            {/* sparkle: the assistant glyph the bridge chat pane uses */}
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
              <path d="M20 3v4" />
              <path d="M22 5h-4" />
            </svg>
            {/* Buffer's phone header shows glyph-only controls */}
            <span className="phone:hidden">{t('assistant', 'Assistant')}</span>
          </button>
          {/* Buffer header quiet control: 32px, 14/500, muted ink + hover
              wash (borderless); active keeps the lime boxFocused pair
              (Buffer uses light sage; buttons-only lime stays per kit). */}
          <button
            type="button"
            data-cs
            onClick={() => {
              // 767px = the `phone` screen. At phone the toggle drives the
              // full-width in-modal overlay; desktop keeps its own pane state.
              if (window.matchMedia('(max-width: 767px)').matches) {
                setShowPreviewPhone(!showPreviewPhone);
                return;
              }
              setShowPreview(!showPreview);
            }}
            className={clsx(
              'h-[32px] px-[12px] rounded-[8px] flex items-center gap-[6px] text-[14px] font-[500] transition-colors shrink-0',
              showPreview
                ? 'bg-boxFocused text-textItemFocused'
                : 'text-textItemBlur hover:bg-newTableHeader',
              // phone: overrides sit later in the cascade than the desktop
              // pair above, so inside the media query they win
              showPreviewPhone
                ? 'phone:bg-boxFocused phone:text-textItemFocused'
                : 'phone:bg-transparent phone:text-textItemBlur'
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
            {/* Buffer's phone header shows glyph-only controls */}
            <span className="phone:hidden">{t('preview', 'Preview')}</span>
          </button>
          <div
            data-cs
            onClick={askClose}
            className="cursor-pointer flex items-center justify-center w-[32px] h-[32px] rounded-[8px] hover:bg-newTableHeader transition-colors shrink-0"
          >
            <CloseIcon className="text-textItemBlur" />
          </div>
        </div>
        <div className="flex-1 flex">
          {/* phone: the editor owns the full width — the fixed 420px preview
              pane collapsed it to 1px (editor-first, like Buffer mobile).
              While the phone preview overlay is on, the editor column hides
              (display only — its state and refs stay mounted). */}
          <div
            className={clsx(
              'flex flex-col flex-1 min-w-0',
              showPreviewPhone && 'phone:hidden'
            )}
          >
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
                    <div className="flex-1 text-[14px] font-[550] text-newTextColor">
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
                      'text-[14px] text-newTextColor font-[500] relative'
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
              inside) when the header Preview toggle is off. At phone the SAME
              mounted pane becomes the full-width overlay when its toggle is
              on: `phone:flex` is emitted after base `hidden` in the compiled
              cascade, so it wins inside the media query. */}
          <div
            className={clsx(
              'w-[379px] flex flex-col bg-newTableHeader border-s border-newTableBorder',
              !showPreview && 'hidden',
              showPreviewPhone
                ? 'phone:flex phone:w-full phone:border-s-0'
                : 'phone:hidden'
            )}
          >
            {/* Preview header: 60px band, padding 16/32/12/32, H2 16px/20px
                500. Buffer titles it "{channel} Preview"; ours is
                multi-channel so the static title stays. */}
            <div className="min-h-[60px] pt-[16px] pb-[12px] ps-[32px] pe-[32px] phone:ps-[16px] phone:pe-[16px] flex items-center gap-[8px] text-[16px] leading-[20px] font-[500] text-newTextColor">
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
        {/* FOOTER — full width, hairline top, 72px. Left keeps the repeat
            control (and delete when editing); right = "Save Draft" ghost +
            ONE attached split control (date label segment + chevron segment,
            both open the picker + the lime submit), r12 on the outer corners
            only. Footer family: h-40.
            Wraps on phone so nothing runs past the viewport. */}
        <div className="select-none min-h-[72px] py-[12px] px-[24px] phone:px-[12px] border-t border-newTableBorder flex flex-wrap items-center gap-[8px]">
          <div className="flex-1 flex flex-wrap items-center gap-[8px]">
            {/* quiet 40px skin for the repeat control (its class strings live
                in launches/*, outside this rebuild's file list — see the
                #cs-repeat scoped style above) */}
            {!dummy && (
              <div id="cs-repeat" className="contents">
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
            {/* Save Draft ghost: 40px, r8, 14/500 (Buffer 101x40) */}
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
                  {t('save_draft', 'Save Draft')}
                </div>
              </button>
            )}
            {/* Buffer ATTACHED split control (one control, r12 outer corners
                only): date label segment = the existing DatePicker trigger
                (scoped-CSS-reshaped above; opens the picker) + the chevron
                segment (same action, forwarded as a click on the trigger so
                the picker state, popover and click-outside logic stay
                untouched) + the lime primary segment. */}
            <div className="flex items-stretch">
              <div id="cs-datetime" className="flex items-stretch">
                <DatePicker onChange={setDate} date={date} />
                <button
                  type="button"
                  data-cs
                  aria-label={t('pick_date_and_time', 'Pick date and time')}
                  onClick={(e) => {
                    (
                      e.currentTarget.parentElement
                        ?.firstElementChild as HTMLElement | null
                    )?.click();
                  }}
                  className="h-[40px] w-[32px] shrink-0 cursor-pointer flex items-center justify-center border border-s-0 border-newTableBorder rounded-none text-newTextColor hover:bg-newTableHeader transition-colors"
                >
                  <ChevronDownIcon className="text-newTextColor" />
                </button>
              </div>
              {/* Primary submits: lime h-40, attached as the split's end
                  segment (r12 end corners only), 500 weight — data-cs opts
                  them out of the global h-[40px]->32 ladder. Ink comes from
                  the global bg-btnPrimary black-ink rule; text-black
                  restates it. */}
              {addEditSets && (
                <button
                  data-cs
                  className="text-[14px] font-[500] btnSub disabled:cursor-not-allowed disabled:opacity-80 outline-none gap-[8px] flex justify-center items-center h-[40px] rounded-s-none rounded-e-[12px] bg-btnPrimary text-black px-[16px] focus-visible:ring-2 focus-visible:ring-forth"
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
                    className="relative btnSub disabled:cursor-not-allowed disabled:opacity-80 outline-none gap-[8px] flex justify-center items-center h-[40px] rounded-s-none rounded-e-[12px] bg-btnPrimary text-black px-[16px] focus-visible:ring-2 focus-visible:ring-forth"
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
                    {/* Buffer shortens the footer primary at phone
                        ("Customize"); same swap here — full label on
                        desktop, short one at phone. */}
                    <span className="phone:hidden">
                      {selectedIntegrations.length === 0
                        ? t('check_circles_above', 'Check the circles above')
                        : dummy
                        ? t('create_output', 'Create output')
                        : !existingData?.integration
                        ? t('add_to_calendar', 'Add to calendar')
                        : existingData?.posts?.[0]?.state === 'DRAFT'
                        ? t('schedule', 'Schedule')
                        : t('update', 'Update')}
                    </span>
                    <span className="hidden phone:inline">
                      {selectedIntegrations.length === 0
                        ? t('check_circles_above_short', 'Pick channels')
                        : dummy
                        ? t('create_output_short', 'Create')
                        : !existingData?.integration
                        ? t('add_to_calendar_short', 'Schedule')
                        : existingData?.posts?.[0]?.state === 'DRAFT'
                        ? t('schedule', 'Schedule')
                        : t('update', 'Update')}
                    </span>
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
                      className="rounded-[12px] bg-btnPrimary text-black h-[40px] w-full flex justify-center items-center text-[14px] font-[500] post-now"
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
        {/* ASSISTANT SLIDE-OVER: Claude Code bridge chat about THE POST
            BEING COMPOSED (replaces the stock CopilotPopup, whose
            transparent panel let the globe tab/editor bleed through).
            Absolutely positioned over the composer, so the 1100px two-pane
            geometry and its min-w-0 chains never see it. Mounted for the
            modal's lifetime (hidden when closed) so the bridge session
            survives toggling. */}
        <AssistantPane
          open={showAssistant}
          onClose={() => setShowAssistant(false)}
        />
      </div>
    </div>
  );
};

/** Editor values are HTML; the bridge prefix wants plain text. Block/br
 *  boundaries become newlines so a thread reads as separate lines. */
const stripHtml = (html: string) =>
  html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();

/** Assistant slide-over: hosts the Claude Code bridge chat ('assistant'
 *  profile) with a context prefix built from the LIVE composer state
 *  (useLaunchStore), so the session's first bridge turn knows exactly which
 *  post is on screen. Desktop: 380px right pane, full modal height, OPAQUE
 *  bg-newBgColorInner; phone: full-screen sheet (the composer is already
 *  full-viewport at <=1100px, so absolute inset-0 covers the screen without
 *  position:fixed, which the modal layer above us could break with
 *  transforms).
 *  z-[560] = the in-modal-popovers band of the canonical z scale
 *  (global.scss), above mention/tippy 550, so no composer chrome bleeds
 *  through the pane (the bug the stock CopilotKit popup had). */
const AssistantPane: FC<{ open: boolean; onClose: () => void }> = ({
  open,
  onClose,
}) => {
  const t = useT();
  const existingData = useExistingData();
  const { global, internal, current, selectedIntegrations, date } =
    useLaunchStore(
      useShallow((state) => ({
        global: state.global,
        internal: state.internal,
        current: state.current,
        selectedIntegrations: state.selectedIntegrations,
        date: state.date,
      }))
    );

  const contextPrefix = useMemo(() => {
    // the text the user is looking at: the active channel tab's own values
    // when it split off the global stack, else the global editor values
    const values =
      (current !== 'global' &&
        internal.find((p) => p.integration.id === current)
          ?.integrationValue) ||
      global;
    const raw = stripHtml(
      (values || []).map((v) => v?.content || '').join('\n\n')
    );
    const text = raw.slice(0, 2000);
    const channels = selectedIntegrations
      .map((p) => `${p.integration.name} (${p.integration.identifier})`)
      .join(', ');
    return [
      'You are helping the user WRITE the content of this specific Postiz post: the composer is open right now and your job is formulation. Draft captions, hooks, platform-fitted variants for the selected channels, hashtags and first-comment copy in the Cuesoft brand voice from the content brief. Always answer with ready-to-paste copy blocks and keep iterating with the user. Do NOT schedule anything, do NOT run pipeline or build scripts, and do NOT edit repo files in this conversation; this chat is for writing this one post.',
      `Channels: ${channels || 'none selected yet'}`,
      `Scheduled for: ${date.format('YYYY-MM-DD HH:mm')}`,
      ...(existingData?.group
        ? [`Editing existing post id: ${existingData.group}`]
        : []),
      `Current draft text (HTML stripped${
        raw.length > 2000 ? ', truncated to 2000 chars' : ''
      }):`,
      text || '(empty)',
    ].join('\n');
  }, [
    global,
    internal,
    current,
    selectedIntegrations,
    date,
    existingData?.group,
  ]);

  return (
    <div
      className={clsx(
        // rounded-e matches the modal's r16 corners (#cs-composer has no
        // overflow-hidden to clip square ones); hidden (not unmounted) so
        // the bridge session survives toggling
        'absolute inset-y-0 end-0 z-[560] w-[380px] max-w-full flex flex-col bg-newBgColorInner border-s border-newTableBorder rounded-e-[16px] phone:inset-0 phone:w-full phone:border-s-0 phone:rounded-none',
        !open && 'hidden'
      )}
    >
      <div className="min-h-[56px] px-[16px] border-b border-newTableBorder flex items-center gap-[8px] shrink-0">
        <div
          data-cs
          className="flex-1 text-[16px] font-[550] text-newTextColor"
        >
          {t('post_assistant', 'Ace')}
        </div>
        <div
          data-cs
          onClick={onClose}
          className="cursor-pointer flex items-center justify-center w-[32px] h-[32px] rounded-[8px] hover:bg-newTableHeader transition-colors shrink-0"
        >
          <CloseIcon className="text-textItemBlur" />
        </div>
      </div>
      {/* 'post' = the content profile's prompt and fence (formulation, primed
          on brand voice and the content brief) but on the bridge's fast model;
          the assistant profile is the schedule operator and cannot create */}
      <ContentChatComponent
        profile="post"
        contextPrefix={contextPrefix}
        emptyTitle={t('post_assistant_title', 'Write this post with Ace')}
        emptyHint={t(
          'post_assistant_hint',
          'It knows your draft, selected channels and schedule time. Try "Give me three hooks", "Write the LinkedIn version" or "Add hashtags and a first comment".'
        )}
        inputPlaceholder={t(
          'post_assistant_placeholder',
          'Ask for hooks, captions, variants…'
        )}
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
