'use client';

import React, {
  FC,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { CopilotChat, CopilotKitCSSProperties } from '@copilotkit/react-ui';
import {
  InputProps,
  UserMessageProps,
} from '@copilotkit/react-ui/dist/components/chat/props';
import { Input } from '@gitroom/frontend/components/agents/agent.input';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import {
  CopilotKit,
  useCopilotAction,
  useCopilotMessagesContext,
} from '@copilotkit/react-core';
import {
  MediaPortal,
  PropertiesContext,
} from '@gitroom/frontend/components/agents/agent';
import { useVariables } from '@gitroom/react/helpers/variable.context';
import { useParams } from 'next/navigation';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import {
  Message as CopilotMessage,
  TextMessage,
} from '@copilotkit/runtime-client-gql';
import { AddEditModal } from '@gitroom/frontend/components/new-launch/add.edit.modal';
import dayjs from 'dayjs';
import { makeId } from '@gitroom/nestjs-libraries/services/make.is';
import { ExistingDataContextProvider } from '@gitroom/frontend/components/launches/helpers/use.existing.data';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { hasExtension } from '@gitroom/helpers/utils/has.extension';
import { useUser } from '@gitroom/frontend/components/layout/user.context';
import clsx from 'clsx';
import './agent.styles.scss';

export const AgentChat: FC = () => {
  const { backendUrl } = useVariables();
  const params = useParams<{ id: string }>();
  const { properties } = useContext(PropertiesContext);
  const t = useT();
  const user = useUser();
  // `admin` rides on /user/self and survives ContextWrapper's spread, but the
  // context type only declares the Prisma columns — same reason
  // layout.component.tsx reads it off the raw SWR value
  const isAdmin = !!(user as any)?.admin;

  return (
    <CopilotKit
      {...(params.id === 'new' ? {} : { threadId: params.id })}
      credentials="include"
      runtimeUrl={backendUrl + '/copilot/agent'}
      showDevConsole={false}
      agent="postiz"
      properties={{
        integrations: properties,
      }}
    >
      <Hooks />
      <LoadMessages id={params.id} />
      <div
        style={
          {
            // full CopilotKit token set mapped to the system tokens. User
            // bubble = boxFocused (lime wash) + textItemFocused ink — an
            // explicit pair, so CopilotKit's own prefers-color-scheme
            // contrast guess never applies. background-color previously
            // pointed at --new-bg-color, a token that does not exist
            // (--new-bgColor is the real name) and resolved to nothing.
            '--copilot-kit-primary-color': 'var(--new-boxFocused)',
            '--copilot-kit-contrast-color': 'var(--new-textItemFocused)',
            '--copilot-kit-background-color': 'var(--new-bgColorInner)',
            '--copilot-kit-input-background-color': 'var(--new-bgColorInner)',
            '--copilot-kit-secondary-color': 'var(--new-table-header)',
            '--copilot-kit-secondary-contrast-color':
              'rgb(var(--new-textColor))',
            '--copilot-kit-separator-color': 'var(--new-table-border)',
            '--copilot-kit-muted-color': 'var(--new-textItemBlur)',
          } as CopilotKitCSSProperties
        }
        // phone: the absolute pane contributes zero height once the page
        // stacks — the min-height here is what keeps the chat usable at 390
        className="trz agent bg-newBgColorInner flex flex-col transition-all flex-1 items-center relative phone:min-h-[65dvh]"
      >
        {/* admin: the fixed bottom-center admin pill needs dead space under
            the input (S6) */}
        <div
          className={clsx(
            'absolute left-0 w-full h-full',
            isAdmin ? 'pb-[56px]' : 'pb-[20px]'
          )}
        >
          <CopilotChat
            className="w-full h-full"
            labels={{
              title: t('your_assistant', 'Your Assistant'),
              // the library default placeholder is untranslated English with
              // a three-dot ellipsis; the Content composer localizes via useT
              placeholder: t('agent_chat_placeholder', 'Ask your assistant…'),
              // the remaining strings this pane renders would otherwise stay
              // the library's raw English defaults (the error one with a
              // leading emoji): the regenerate/copy tooltips on every
              // assistant message, the stop button, the copy confirmation,
              // and the error line
              regenerateResponse: t(
                'regenerate_response',
                'Regenerate response'
              ),
              copyToClipboard: t('copy_to_clipboard', 'Copy to clipboard'),
              stopGenerating: t('stop_generating', 'Stop generating'),
              copied: t('copied', 'Copied!'),
              error: t(
                'agent_chat_error',
                'Something went wrong. Please try again.'
              ),
            }}
            icons={{
              // the Content composer's send glyph (16px stroke-2.2
              // arrow-right, content-chat.component.tsx) — the library
              // default is a stroke-1.5 arrow-UP, a different glyph inside
              // the "same" 32px lime square
              sendIcon: (
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m5 12 14 0" />
                  <path d="m13 6 6 6-6 6" />
                </svg>
              ),
            }}
            UserMessage={Message}
            Input={NewInput}
          />
        </div>
        {/* the Cuesoft greeting used to ride in as labels.initial — a fake
            assistant bubble. It is now the same empty-state shell the Content
            pane uses (64px circle + glyph + 16/600 heading + muted subline),
            gated on the real message list AND on thread identity: for
            /agents/<id> the history loads asynchronously in LoadMessages, so
            the context is transiently empty over an existing thread — only a
            brand-new thread ('new') may show the welcome. */}
        {params.id === 'new' && <EmptyState isAdmin={isAdmin} />}
      </div>
    </CopilotKit>
  );
};

/** The shared empty-state pattern (content-chat.component.tsx renders the
 *  identical shell): 64px bg-newTextColor/5 circle, 24px muted stroke-2.2
 *  glyph, 16/600 heading, 14px muted subline. `labels.initial` messages are
 *  display-only and never enter the messages context, so dropping the label
 *  and gating on the context is behavior-neutral. The bottom padding keeps
 *  the shell optically centered over the message area (composer ~74px plus
 *  the pane's 56/20px admin-pill clearance). */
const EmptyState: FC<{ isAdmin: boolean }> = ({ isAdmin }) => {
  const { messages } = useCopilotMessagesContext();
  const t = useT();
  if (messages.length) return null;
  return (
    <div
      data-cs
      className={clsx(
        'absolute inset-0 z-[2] pointer-events-none flex flex-col items-center justify-center gap-[12px] text-center px-[24px]',
        isAdmin ? 'pb-[130px]' : 'pb-[94px]'
      )}
    >
      <div className="w-[64px] h-[64px] rounded-full bg-newTextColor/5 flex items-center justify-center">
        {/* sparkle — the same glyph as the page-header chip */}
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-newTextColor/60"
        >
          <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
          <path d="M20 3v4" />
          <path d="M22 5h-4" />
        </svg>
      </div>
      <div className="text-[16px] font-[600] text-newTextColor">
        {t('cuesoft_agent_welcome_title', 'Hello, I am your Cuesoft agent 🙌🏻')}
      </div>
      <div className="text-[14px] text-newTextColor/60 max-w-[420px] whitespace-pre-line">
        {t(
          'cuesoft_agent_welcome_description',
          `I can schedule one post or many across your channels, and generate pictures and videos to go with them.

Pick the channels you want to post to from the bar above. Your previous conversations live in the panel on the right.

You can also use me as an MCP server: see Settings > Public API.`
        )}
      </div>
    </div>
  );
};

const LoadMessages: FC<{ id: string }> = ({ id }) => {
  const { messages, setMessages } = useCopilotMessagesContext();
  const fetch = useFetch();
  const currentId = useRef<string | null>(null);
  const loaded = useRef<{ id: string; messages: CopilotMessage[] } | null>(
    null
  );

  const loadMessages = useCallback(async (idToSet: string) => {
    const data = await (await fetch(`/copilot/${idToSet}/list`)).json();
    const list = data.messages.map((p: any) => {
      return new TextMessage({
        content: p.content.content,
        role: p.role,
      });
    });

    if (currentId.current !== idToSet) {
      return;
    }

    loaded.current = { id: idToSet, messages: list };
    setMessages(list);
  }, []);

  useEffect(() => {
    currentId.current = id;
    if (id === 'new') {
      loaded.current = { id, messages: [] };
      setMessages([]);
      return;
    }
    loaded.current = null;
    loadMessages(id);
  }, [id]);

  // CopilotKit resolves loadAgentState to an empty list for Mastra local agents
  // and can clobber the messages we hold, depending on which request resolves last
  useEffect(() => {
    if (loaded.current?.id !== id) {
      return;
    }

    if (messages.length) {
      loaded.current.messages = messages;
      return;
    }

    if (loaded.current.messages.length) {
      setMessages(loaded.current.messages);
    }
  }, [messages, id]);

  return null;
};

const Message: FC<UserMessageProps> = (props) => {
  const convertContentToImagesAndVideo = useMemo(() => {
    return (props.message?.content || '')
      .replace(/Video: (http.*mp4\n)/g, (match, p1) => {
        return `<video controls class="h-[150px] w-[150px] rounded-[8px] mb-[10px]"><source src="${p1.trim()}" type="video/mp4">Your browser does not support the video tag.</video>`;
      })
      .replace(/Image: (http.*\n)/g, (match, p1) => {
        return `<img src="${p1.trim()}" class="h-[150px] w-[150px] max-w-full rounded-[8px] border border-newTableBorder" />`;
      })
      .replace(/\[\-\-Media\-\-\](.*)\[\-\-Media\-\-\]/g, (match, p1) => {
        return `<div class="flex justify-center mt-[20px]">${p1}</div>`;
      })
      .replace(
        /(\[--integrations--\][\s\S]*?\[--integrations--\])/g,
        (match, p1) => {
          return ``;
        }
      );
  }, [props.message?.content]);
  return (
    <div
      // no min-width: the Content pane's user bubble hugs its text, so this
      // one does too (converged bubble metrics live in agent.styles.scss)
      className="copilotKitMessage copilotKitUserMessage"
      dangerouslySetInnerHTML={{ __html: convertContentToImagesAndVideo }}
    />
  );
};
const NewInput: FC<InputProps> = (props) => {
  const [media, setMedia] = useState([] as { path: string; id: string }[]);
  const [value, setValue] = useState('');
  const { properties } = useContext(PropertiesContext);
  return (
    <>
      <MediaPortal
        value={value}
        media={media}
        setMedia={(e) => setMedia(e.target.value)}
      />
      <Input
        {...props}
        onChange={setValue}
        onSend={(text) => {
          const send = props.onSend(
            text +
              (media.length > 0
                ? '\n[--Media--]' +
                  media
                    .map((m) =>
                      hasExtension(m.path, 'mp4')
                        ? `Video: ${m.path}`
                        : `Image: ${m.path}`
                    )
                    .join('\n') +
                  '\n[--Media--]'
                : '') +
              `
${
  properties.length
    ? `[--integrations--]
Use the following social media platforms: ${JSON.stringify(
        properties.map((p) => ({
          id: p.id,
          platform: p.identifier,
          profilePicture: p.picture,
          additionalSettings: p.additionalSettings,
        }))
      )}
[--integrations--]`
    : ``
}`
          );
          setValue('');
          setMedia([]);
          return send;
        }}
      />
    </>
  );
};

export const Hooks: FC = () => {
  useCopilotAction({
    name: 'manualPosting',
    description:
      'This tool should be triggered when the user wants to manually add the generated post',
    parameters: [
      {
        name: 'list',
        type: 'object[]',
        description:
          'list of posts to schedule to different social media (integration ids)',
        attributes: [
          {
            name: 'integrationId',
            type: 'string',
            description: 'The integration id',
          },
          {
            name: 'date',
            type: 'string',
            description: 'UTC date of the scheduled post',
          },
          {
            name: 'settings',
            type: 'object',
            description: 'Settings for the integration [input:settings]',
          },
          {
            name: 'posts',
            type: 'object[]',
            description: 'list of posts / comments (one under another)',
            attributes: [
              {
                name: 'content',
                type: 'string',
                description: 'the content of the post',
              },
              {
                name: 'attachments',
                type: 'object[]',
                description: 'list of attachments',
                attributes: [
                  {
                    name: 'id',
                    type: 'string',
                    description: 'id of the attachment',
                  },
                  {
                    name: 'path',
                    type: 'string',
                    description: 'url of the attachment',
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
    renderAndWaitForResponse: ({ args, status, respond }) => {
      if (status === 'executing') {
        return <OpenModal args={args} respond={respond} />;
      }

      return null;
    },
  });
  return null;
};

const OpenModal: FC<{
  respond: (value: any) => void;
  args: {
    list: {
      integrationId: string;
      date: string;
      settings?: Record<string, any>;
      posts: { content: string; attachments: { id: string; path: string }[] }[];
    }[];
  };
}> = ({ args, respond }) => {
  const modals = useModals();
  const t = useT();
  const { properties } = useContext(PropertiesContext);
  const startModal = useCallback(async () => {
    for (const integration of args.list) {
      await new Promise((res) => {
        const group = makeId(10);
        modals.openModal({
          id: 'add-edit-modal',
          closeOnClickOutside: false,
          removeLayout: true,
          closeOnEscape: false,
          withCloseButton: false,
          askClose: true,
          size: '80%',
          title: ``,
          classNames: {
            modal: 'w-[100%] max-w-[1400px] text-textColor',
          },
          children: (
            <ExistingDataContextProvider
              value={{
                group,
                integration: integration.integrationId,
                integrationPicture:
                  properties.find((p) => p.id === integration.integrationId)
                    ?.picture || '',
                settings: integration.settings || {},
                posts: integration.posts.map((p) => ({
                  approvedSubmitForOrder: 'NO',
                  content: p.content,
                  createdAt: new Date().toISOString(),
                  state: 'DRAFT',
                  id: makeId(10),
                  settings: JSON.stringify(integration.settings || {}),
                  group,
                  integrationId: integration.integrationId,
                  integration: properties.find(
                    (p) => p.id === integration.integrationId
                  ),
                  publishDate: dayjs.utc(integration.date).toISOString(),
                  image: p.attachments.map((a) => ({
                    id: a.id,
                    path: a.path,
                  })),
                })),
              }}
            >
              <AddEditModal
                date={dayjs.utc(integration.date)}
                allIntegrations={properties}
                integrations={properties.filter(
                  (p) => p.id === integration.integrationId
                )}
                onlyValues={integration.posts.map((p) => ({
                  content: p.content,
                  id: makeId(10),
                  settings: integration.settings || {},
                  image: p.attachments.map((a) => ({
                    id: a.id,
                    path: a.path,
                  })),
                }))}
                reopenModal={() => {}}
                mutate={() => res(true)}
              />
            </ExistingDataContextProvider>
          ),
        });
      });
    }

    respond('User scheduled all the posts');
  }, [args, respond, properties]);

  useEffect(() => {
    startModal();
  }, []);
  return (
    // quiet status line while the modal runs — the old text evaluated
    // {JSON.stringify(args)} as JSX and dumped the raw args payload into the
    // chat; the click-through respond('continue') escape hatch is preserved
    <div onClick={() => respond('continue')}>
      {t('opening_post_editor', 'Opening the post editor')}
    </div>
  );
};
