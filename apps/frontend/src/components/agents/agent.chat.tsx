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
        className="trz agent bg-newBgColorInner flex flex-col gap-[15px] transition-all flex-1 items-center relative phone:min-h-[65dvh]"
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
              // new key: 'agent_welcome_message' is pinned to the old Postiz
              // copy in every locale's translation.json — a fresh key falls
              // back to this string
              initial: t('cuesoft_agent_welcome_message', `Hello, I am your Cuesoft agent 🙌🏻.

I can schedule one post or many across your channels, and generate pictures and videos to go with them.

Pick the channels you want to post to from the bar above.

Your previous conversations live in the panel on the right.

You can also use me as an MCP server — see Settings > Public API.
`),
            }}
            UserMessage={Message}
            Input={NewInput}
          />
        </div>
      </div>
    </CopilotKit>
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
        return `<img src="${p1.trim()}" class="h-[150px] w-[150px] max-w-full border border-newBgColorInner" />`;
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
      className="copilotKitMessage copilotKitUserMessage min-w-[300px]"
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
  const modals = useModals();

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
    <div onClick={() => respond('continue')}>
      Opening manually ${JSON.stringify(args)}
    </div>
  );
};
