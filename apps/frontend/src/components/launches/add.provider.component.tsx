'use client';

import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import React, { FC, useCallback, useMemo } from 'react';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { Input } from '@gitroom/react/form/input';
import { FieldValues, FormProvider, useForm } from 'react-hook-form';
import { Button } from '@gitroom/react/form/button';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { ApiKeyDto } from '@gitroom/nestjs-libraries/dtos/integrations/api.key.dto';
import { useRouter } from 'next/navigation';
import { TopTitle } from '@gitroom/frontend/components/launches/helpers/top.title.component';
import { useVariables } from '@gitroom/react/helpers/variable.context';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { object, string } from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
import { web3List } from '@gitroom/frontend/components/launches/web3/web3.list';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import clsx from 'clsx';
import copy from 'copy-to-clipboard';
import { capitalize } from 'lodash';
import { ModalCloseButton } from '@gitroom/frontend/components/cuesoft/modal/modal-close-button';
const resolver = classValidatorResolver(ApiKeyDto);

export const useAddProvider = (
  update?: () => void,
  invite?: boolean,
  onOpen?: () => void
) => {
  const modal = useModals();
  const fetch = useFetch();
  const t = useT();
  return useCallback(async () => {
    const data = await (await fetch('/integrations')).json();
    // the Channels manage overlay (launches.component, z-500) sits ABOVE the
    // modal-store layer this catalog opens in; the opener must dismiss it
    // first or the catalog renders buried underneath (user report)
    onOpen?.();
    modal.openModal({
      title: t('add_channel', 'Connect Channel'),
      withCloseButton: true,
      children: (
        <AddProviderComponent invite={!!invite} update={update} {...data} />
      ),
    });
  }, [onOpen]);
};
export const AddProviderButton: FC<{
  update?: () => void;
  /** fired right before the catalog modal opens, so a containing overlay
      (the Channels manage dialog) can dismiss itself */
  onOpen?: () => void;
}> = (props) => {
  const { update, onOpen } = props;
  const add = useAddProvider(update, false, onOpen);
  const invite = useAddProvider(update, true, onOpen);
  const t = useT();

  return (
    <div className="flex group-[.sidebar]:block gap-[8px]">
      <button
        className="flex-1 group-[.sidebar]:w-[100%] group-[.sidebar]:flex-none text-btnText bg-btnSimple h-[44px] pt-[12px] pb-[14px] ps-[16px] pe-[20px] justify-center items-center flex rounded-[8px] gap-[8px]"
        onClick={add}
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
            <path d="M2 8V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6" />
            <path d="M2 12a9 9 0 0 1 8 8" />
            <path d="M2 16a5 5 0 0 1 4 4" />
            <path d="M2 20h.01" />
          </svg>
        </div>
        <div className="text-start text-[14px] group-[.sidebar]:hidden">
          {t('add_channel', 'Connect Channel')}
        </div>
      </button>
      <button
        onClick={invite}
        data-tooltip-id="tooltip"
        data-tooltip-content={t(
          'invite_link',
          'Send Invite Link to a customer to add channel'
        )}
        className="group-[.sidebar]:hidden min-h-[44px] min-w-[44px] bg-btnSimple justify-center items-center flex rounded-[8px] cursor-pointer"
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
        >
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
      </button>
    </div>
  );
};

export const UrlModal: FC<{
  gotoUrl(url: string): void;
  isMobile?: boolean;
}> = (props) => {
  const { gotoUrl, isMobile } = props;
  const modals = useModals();
  const methods = useForm({
    mode: 'onChange',
  });

  const t = useT();

  const submit = useCallback(async (data: FieldValues) => {
    gotoUrl(data.url);
  }, []);
  return (
    // Desktop: the new-modal shell already draws the 16-radius card + title
    // ('Connect Channel URL'), so no self-chrome here. The isMobile path opens
    // with removeLayout/fullScreen (no shell card), so it keeps its own.
    <div
      className={clsx(
        isMobile &&
          'rounded-[12px] border border-newTableBorder bg-newBgColorInner px-[16px] pb-[16px]',
        'relative'
      )}
    >
      {isMobile && <TopTitle title={`Connect Channel URL`} />}
      {isMobile && <ModalCloseButton onClick={() => modals.closeAll()} />}
      <FormProvider {...methods}>
        <form
          className="gap-[8px] flex flex-col"
          onSubmit={methods.handleSubmit(submit)}
        >
          <div className="pt-[10px]">
            <Input label="URL" name="url" />
          </div>
          <div>
            <Button type="submit">{t('connect', 'Connect')}</Button>
          </div>
        </form>
      </FormProvider>
    </div>
  );
};
export const CustomVariables: FC<{
  variables: Array<{
    key: string;
    label: string;
    defaultValue?: string;
    validation: string;
    type: 'text' | 'password';
    hint?: string;
  }>;
  close?: () => void;
  identifier: string;
  gotoUrl(url: string): void;
  onboarding?: boolean;
}> = (props) => {
  const { close, gotoUrl, identifier, variables, onboarding } = props;
  const fetch = useFetch();
  const modals = useModals();
  const schema = useMemo(() => {
    return object({
      ...variables.reduce((aIcc, item) => {
        const splitter = item.validation.split('/');
        const regex = new RegExp(
          splitter.slice(1, -1).join('/'),
          splitter.pop()
        );
        return {
          ...aIcc,
          [item.key]: string()
            .matches(regex, `${item.label} is invalid`)
            .required(),
        };
      }, {}),
    });
  }, [variables]);
  const methods = useForm({
    mode: 'onChange',
    resolver: yupResolver(schema),
    values: variables.reduce(
      (acc, item) => ({
        ...acc,
        ...(item.defaultValue
          ? {
              [item.key]: item.defaultValue,
            }
          : {}),
      }),
      {}
    ),
  });
  const submit = useCallback(
    async (data: FieldValues) => {
      const { url } = await (
        await fetch(
          `/integrations/social/${identifier}${
            onboarding ? '?onboarding=true' : ''
          }`
        )
      ).json();
      modals.closeAll();
      gotoUrl(
        `/integrations/social/${identifier}?state=${url}&code=${Buffer.from(
          JSON.stringify(data)
        ).toString('base64')}${onboarding ? '&onboarding=true' : ''}`
      );
    },
    [variables, onboarding]
  );

  const t = useT();

  return (
    <div className="relative">
      <FormProvider {...methods}>
        <form
          className="gap-[8px] flex flex-col pt-[10px]"
          onSubmit={methods.handleSubmit(submit)}
        >
          {variables.map((variable) => (
            <div key={variable.key}>
              {variable.hint ? (
                <div className="flex flex-col gap-[6px]">
                  <div className="text-[14px] flex items-center gap-[6px]">
                    <span>{variable.label}</span>
                    <span
                      data-tooltip-id="tooltip"
                      data-tooltip-content={variable.hint}
                      className="w-[16px] h-[16px] rounded-full border border-newTextColor/60 text-newTextColor/60 flex items-center justify-center text-[11px] leading-none cursor-help select-none"
                    >
                      i
                    </span>
                  </div>
                  <Input
                    label=""
                    name={variable.key}
                    type={variable.type == 'text' ? 'text' : 'password'}
                  />
                </div>
              ) : (
                <Input
                  label={variable.label}
                  name={variable.key}
                  type={variable.type == 'text' ? 'text' : 'password'}
                />
              )}
            </div>
          ))}
          <div>
            <Button type="submit">{t('connect', 'Connect')}</Button>
          </div>
        </form>
      </FormProvider>
    </div>
  );
};
const ExtensionNotFound: FC = () => {
  const modals = useModals();
  const t = useT();
  return (
    <div className="flex flex-col gap-[16px] pt-[8px]">
      <p className="text-[14px] text-textItemBlur">
        {t(
          'extension_not_available',
          'The Postiz browser extension is not installed. You need to install it before connecting this channel.'
        )}
      </p>
      <div className="flex gap-[10px]">
        <Button
          type="button"
          className="flex-1"
          onClick={() => {
            window.open(
              'https://chromewebstore.google.com/detail/postiz/cidhffagahknaeodkplfbcpfeielnkjl?hl=en',
              '_blank'
            );
            modals.closeCurrent();
          }}
        >
          {t('install_extension', 'Install Extension')}
        </Button>
        <Button
          type="button"
          secondary={true}
          className="flex-1"
          onClick={() => modals.closeCurrent()}
        >
          {t('cancel', 'Cancel')}
        </Button>
      </div>
    </div>
  );
};

const ChromeExtensionWarning: FC<{
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ onConfirm, onCancel }) => {
  const modals = useModals();
  const t = useT();
  return (
    <div className="flex flex-col gap-[16px] pt-[8px]">
      <p className="text-[14px] text-textItemBlur">
        {t(
          'chrome_extension_warning_intro',
          'This channel connects via the browser extension. Please be aware of the following:'
        )}
      </p>
      <ul className="flex flex-col gap-[8px] list-disc ps-[20px] text-[14px] text-textItemBlur">
        <li>
          {t(
            'chrome_extension_warning_tos',
            'Using a browser extension to interact with a platform may violate its terms of service and could result in your account being suspended or banned.'
          )}
        </li>
        <li>
          {t(
            'chrome_extension_warning_unstable',
            'This method is not as reliable as native integrations and may experience random disconnections.'
          )}
        </li>
        <li>
          {t(
            'chrome_extension_warning_reconnect',
            'You may need to reconnect periodically if the session expires.'
          )}
        </li>
        <li>
          We will store your cookies securely to facilitate the connection.
        </li>
        <li>
          Postiz does not take responsibility for any issues arising or account
          termination due to the use of this method.
        </li>
      </ul>
      <div className="flex gap-[10px] mt-[8px]">
        <Button
          type="button"
          className="flex-1"
          onClick={() => {
            modals.closeCurrent();
            onConfirm();
          }}
        >
          {t('i_understand_continue', 'I understand, continue')}
        </Button>
        <Button
          type="button"
          secondary={true}
          className="flex-1"
          onClick={() => {
            modals.closeCurrent();
            onCancel();
          }}
        >
          {t('cancel', 'Cancel')}
        </Button>
      </div>
    </div>
  );
};

export const AddProviderComponent: FC<{
  social: Array<{
    identifier: string;
    name: string;
    toolTip?: string;
    isExternal: boolean;
    isWeb3: boolean;
    isChromeExtension?: boolean;
    extensionCookies?: Array<{
      name: string;
      domain: string;
    }>;
    customFields?: Array<{
      key: string;
      label: string;
      validation: string;
      type: 'text' | 'password';
      hint?: string;
    }>;
  }>;
  article: Array<{
    identifier: string;
    name: string;
  }>;
  invite: boolean;
  update?: () => void;
  onboarding?: boolean;
  isMobile?: boolean;
}> = (props) => {
  const { update, social, article, onboarding, isMobile } = props;
  const { isGeneral, extensionId } = useVariables();
  const toaster = useToaster();
  const router = useRouter();
  const fetch = useFetch();
  const modal = useModals();
  const getSocialLink = useCallback(
    (
        invite: boolean,
        identifier: string,
        isExternal: boolean,
        isWeb3: boolean,
        isChromeExtension?: boolean,
        customFields?: Array<{
          key: string;
          label: string;
          validation: string;
          defaultValue?: string;
          type: 'text' | 'password';
          hint?: string;
        }>
      ) =>
      async () => {
        const onboardingParam = onboarding ? 'onboarding=true' : '';
        const openWeb3 = async () => {
          const { component: Web3Providers } = web3List.find(
            (item) => item.identifier === identifier
          )!;
          const { url } = await (
            await fetch(
              `/integrations/social/${identifier}${
                onboarding ? '?onboarding=true' : ''
              }`
            )
          ).json();
          modal.openModal({
            title: `Add ${capitalize(identifier)}`,
            withCloseButton: true,
            ...(isMobile ? { removeLayout: true, fullScreen: true } : {}),
            classNames: {
              modal: 'text-newTextColor',
            },
            children: (
              <div
                {...(isMobile ? { className: 'h-full bg-black p-[20px]' } : {})}
              >
                <Web3Providers
                  onComplete={(code, newState) => {
                    window.location.href = `/integrations/social/${identifier}?code=${code}&state=${newState}${
                      onboarding ? '&onboarding=true' : ''
                    }`;
                  }}
                  nonce={url}
                />
              </div>
            ),
          });
          return;
        };
        const gotoIntegration = async (externalUrl?: string) => {
          // Mobile WebView: reuse the existing `externalUrl` param to
          // carry the `postiz://` deep link so the backend redirects
          // back to the iOS/Android app after OAuth completes, instead
          // of the default web redirect.
          const params = [
            `externalUrl=${encodeURIComponent(externalUrl)}`,
            onboardingParam,
            isMobile
              ? `redirectUrl=${encodeURIComponent('postiz://integrations')}`
              : '',
          ]
            .filter(Boolean)
            .join('&');
          const { url, err } = await (
            await fetch(
              `/integrations/social/${identifier}${params ? `?${params}` : ''}`
            )
          ).json();
          if (err) {
            toaster.show(
              t(
                'could_not_connect_to_platform',
                'Could not connect to the platform'
              ),
              'warning'
            );
            return;
          }

          if (invite) {
            toaster.show(
              'Invite link copied to clipboard, link will be available for 1 hour',
              'success'
            );
            modal.closeAll();
            copy(url);
            return;
          }

          if (isMobile) {
            // In the mobile WebView the OAuth provider (Google, Facebook,
            // etc.) typically refuses in-WebView sign-in. Post the URL
            // out to React Native so it can open the system browser;
            // `window.open`/`location.href` aren't reliable here because
            // RN WebView doesn't always route them through the native
            // navigation intercept. The backend redirects back to the
            // app via `postiz://` once OAuth completes.
            const rn = (window as any).ReactNativeWebView;
            if (rn && typeof rn.postMessage === 'function') {
              rn.postMessage(JSON.stringify({ type: 'open-external', url }));
              return;
            }
            window.open(url, '_blank');
            return;
          }

          window.location.href = url;
        };
        if (isWeb3) {
          openWeb3();
          return;
        }
        if (isChromeExtension) {
          const confirmed = await new Promise<boolean>((resolve) => {
            modal.openModal({
              title: t('chrome_extension_notice', 'Browser Extension Notice'),
              withCloseButton: true,
              onClose: () => resolve(false),
              children: (
                <ChromeExtensionWarning
                  onConfirm={() => {
                    resolve(true);
                  }}
                  onCancel={() => {
                    resolve(false);
                  }}
                />
              ),
            });
          });
          if (!confirmed) {
            return;
          }
          if (!extensionId || !chrome?.runtime?.sendMessage) {
            modal.openModal({
              title: t('extension_not_available_title', 'Extension Not Found'),
              withCloseButton: true,
              children: <ExtensionNotFound />,
            });
            return;
          }
          try {
            await new Promise<void>((resolve, reject) => {
              chrome.runtime.sendMessage(
                extensionId,
                { type: 'PING' },
                (response: any) => {
                  if (chrome.runtime.lastError || !response?.status) {
                    reject(new Error('Extension not reachable'));
                  } else {
                    resolve();
                  }
                }
              );
            });
          } catch {
            toaster.show(
              t(
                'extension_not_installed',
                'Postiz browser extension is not installed or not reachable.'
              ),
              'warning'
            );
            return;
          }
          try {
            const cookieResponse = await new Promise<any>((resolve, reject) => {
              chrome.runtime.sendMessage(
                extensionId,
                { type: 'GET_COOKIES', provider: identifier },
                (response: any) => {
                  if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                  } else {
                    resolve(response);
                  }
                }
              );
            });
            if (!cookieResponse.success) {
              toaster.show(
                cookieResponse.error ||
                  t(
                    'extension_cookies_missing',
                    'Could not get cookies. Please log in to the platform first.'
                  ),
                'warning'
              );
              return;
            }
            const { url } = await (
              await fetch(
                `/integrations/social/${identifier}${
                  onboarding ? '?onboarding=true' : ''
                }`
              )
            ).json();
            modal.closeAll();
            window.location.href = `/integrations/social/${identifier}?state=${url}&code=${Buffer.from(
              JSON.stringify(cookieResponse.cookies)
            ).toString('base64')}${onboarding ? '&onboarding=true' : ''}`;
          } catch {
            toaster.show(
              t(
                'extension_communication_error',
                'Failed to communicate with the browser extension.'
              ),
              'warning'
            );
          }
          return;
        }
        if (isExternal) {
          modal.openModal({
            title: 'Connect Channel URL',
            withCloseButton: true,
            ...(isMobile ? { removeLayout: true, fullScreen: true } : {}),
            classNames: {
              modal: 'text-newTextColor',
            },
            children: (
              <UrlModal gotoUrl={gotoIntegration} isMobile={isMobile} />
            ),
          });
          return;
        }
        if (customFields) {
          modal.openModal({
            title: t('add_provider_title', 'Connect Channel'),
            withCloseButton: true,
            ...(isMobile ? { removeLayout: true, fullScreen: true } : {}),
            classNames: {
              modal: 'text-newTextColor',
            },
            children: (
              <div
                {...(isMobile ? { className: 'h-full bg-black p-[20px]' } : {})}
              >
                <CustomVariables
                  identifier={identifier}
                  gotoUrl={(url: string) => router.push(url)}
                  variables={customFields}
                  onboarding={onboarding}
                />
              </div>
            ),
          });
          return;
        }
        await gotoIntegration();
      },
    [onboarding]
  );

  const t = useT();

  return (
    <div className="w-full flex flex-col gap-[20px] relative">
      <div className="flex flex-col">
        <div
          className={clsx(
            isMobile && 'gap-[20px] flex flex-col',
            // the column count was fixed, so a phone still got 5 (or 9)
            // columns and every platform tile was crushed
            !isMobile &&
              'grid grid-cols-5 gap-[10px] justify-items-center justify-center phone:grid-cols-2',
            isMobile ? {} : onboarding ? 'grid-cols-9 phone:grid-cols-2' : 'grid-cols-5 phone:grid-cols-2'
          )}
        >
          {social
            .filter((item) => {
              if (!props.invite) {
                return true;
              }

              return (
                !item.isExternal &&
                !item.isWeb3 &&
                !item.isChromeExtension &&
                !item.customFields
              );
            })
            .map((item) => (
              <div
                key={item.identifier}
                onClick={getSocialLink(
                  props.invite,
                  item.identifier,
                  item.isExternal,
                  item.isWeb3,
                  item.isChromeExtension,
                  item.customFields
                )}
                {...(!!item.toolTip
                  ? {
                      'data-tooltip-id': 'tooltip',
                      'data-tooltip-content': item.toolTip,
                    }
                  : {})}
                className={clsx(
                  isMobile
                    ? 'flex-row h-[72px] p-[16px]'
                    : 'flex-col p-[10px] h-[100px] justify-center',
                  // Buffer replica: platform tiles are elevated cards — radius
                  // 12 + hairline border, white-alpha hover fill (both themes)
                  'w-full text-[14px] rounded-[12px] bg-newBgColorInner border border-newTableBorder hover:bg-boxHover transition-colors text-newTextColor relative items-center flex gap-[10px] cursor-pointer'
                )}
              >
                <div>
                  {item.identifier === 'youtube' ? (
                    <img src={`/icons/platforms/youtube.svg`} />
                  ) : (
                    <img
                      className={clsx(
                        'w-[32px] h-[32px]',
                        item.identifier !== 'google_my_business' &&
                          'rounded-full'
                      )}
                      src={`/icons/platforms/${item.identifier}.png`}
                    />
                  )}
                </div>
                <div
                  className={clsx(
                    isMobile ? '' : 'whitespace-pre-wrap',
                    'text-center'
                  )}
                >
                  {item.name}
                  {!!item.toolTip && !isMobile && (
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
                      className="absolute top-[10px] end-[10px]"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                      <path d="M12 17h.01" />
                    </svg>
                  )}
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};
