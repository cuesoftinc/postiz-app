'use client';

import { useState, useCallback } from 'react';
import { useSWRConfig } from 'swr';
import { useUser } from '../layout/user.context';
import copy from 'copy-to-clipboard';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { useVariables } from '@gitroom/react/helpers/variable.context';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useDecisionModal } from '@gitroom/frontend/components/layout/new-modal';
import { DeveloperComponent } from '@gitroom/frontend/components/developer/developer.component';
import clsx from 'clsx';

const mcpClients = [
  'Claude Code',
  'Cursor',
  'VS Code / Copilot',
  'Windsurf',
  'Amp',
  'Codex',
  'Gemini CLI',
  'Warp',
] as const;

type McpClient = (typeof mcpClients)[number];

const getMcpConfig = (
  client: McpClient,
  method: 'header' | 'path',
  mcpBase: string,
  apiKey: string
): { config: string; hint: string } => {
  const urlWithKey = `${mcpBase}/mcp/${apiKey}`;
  const urlBase = `${mcpBase}/mcp`;
  const bearer = `Bearer ${apiKey}`;

  const json = (obj: object) => JSON.stringify(obj, null, 2);

  if (method === 'path') {
    switch (client) {
      case 'Claude Code':
        return {
          config: `claude mcp add postiz --transport http "${urlWithKey}"`,
          hint: 'Run this command in your terminal.',
        };
      case 'Cursor':
        return {
          config: json({ mcpServers: { postiz: { url: urlWithKey } } }),
          hint: 'Add to .cursor/mcp.json in your project root.',
        };
      case 'VS Code / Copilot':
        return {
          config: json({
            servers: { postiz: { type: 'http', url: urlWithKey } },
          }),
          hint: 'Add to .vscode/mcp.json in your project root.',
        };
      case 'Windsurf':
        return {
          config: json({
            mcpServers: { postiz: { serverUrl: urlWithKey } },
          }),
          hint: 'Add to ~/.codeium/windsurf/mcp_config.json',
        };
      case 'Amp':
        return {
          config: `amp mcp add postiz ${urlWithKey}`,
          hint: 'Run this command in your terminal.',
        };
      case 'Codex':
        return {
          config: `# ~/.codex/config.toml\n\n[mcp_servers.postiz]\nurl = "${urlWithKey}"`,
          hint: 'Add to ~/.codex/config.toml',
        };
      case 'Gemini CLI':
        return {
          config: json({ mcpServers: { postiz: { url: urlWithKey } } }),
          hint: 'Add to ~/.gemini/settings.json',
        };
      case 'Warp':
        return {
          config: json({ postiz: { url: urlWithKey } }),
          hint: 'Settings > MCP Servers > + Add, then paste this config.',
        };
    }
  }

  switch (client) {
    case 'Claude Code':
      return {
        config: `claude mcp add --transport http postiz ${urlBase} --header "Authorization: ${bearer}"`,
        hint: 'Run this command in your terminal.',
      };
    case 'Cursor':
      return {
        config: json({
          mcpServers: {
            postiz: { url: urlBase, headers: { Authorization: bearer } },
          },
        }),
        hint: 'Add to .cursor/mcp.json in your project root.',
      };
    case 'VS Code / Copilot':
      return {
        config: json({
          servers: {
            postiz: {
              type: 'http',
              url: urlBase,
              headers: { Authorization: bearer },
            },
          },
        }),
        hint: 'Add to .vscode/mcp.json in your project root.',
      };
    case 'Windsurf':
      return {
        config: json({
          mcpServers: {
            postiz: {
              serverUrl: urlBase,
              headers: { Authorization: bearer },
            },
          },
        }),
        hint: 'Add to ~/.codeium/windsurf/mcp_config.json',
      };
    case 'Amp':
      return {
        config: json({
          'amp.mcpServers': {
            postiz: { url: urlBase, headers: { Authorization: bearer } },
          },
        }),
        hint: 'Add to your Amp settings.json',
      };
    case 'Codex':
      return {
        config: `# ~/.codex/config.toml\n\n[mcp_servers.postiz]\nurl = "${urlBase}"\nhttp_headers = { "Authorization" = "${bearer}" }`,
        hint: 'Add to ~/.codex/config.toml',
      };
    case 'Gemini CLI':
      return {
        config: json({
          mcpServers: {
            postiz: { url: urlBase, headers: { Authorization: bearer } },
          },
        }),
        hint: 'Add to ~/.gemini/settings.json',
      };
    case 'Warp':
      return {
        config: json({
          postiz: { url: urlBase, headers: { Authorization: bearer } },
        }),
        hint: 'Settings > MCP Servers > + Add, then paste this config.',
      };
  }
};

const CopyButton = ({
  text,
  label,
}: {
  text: string;
  label: string;
}) => {
  const toaster = useToaster();
  return (
    <button
      type="button"
      onClick={() => {
        copy(text);
        toaster.show(`${label} copied to clipboard`, 'success');
      }}
      className="cursor-pointer px-[16px] h-[36px] phone:h-[44px] bg-btnSimple hover:bg-boxHover transition-colors rounded-[6px] text-[13px] font-[550] flex items-center gap-[6px] shrink-0"
    >
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
        <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
        <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
      </svg>
      {label}
    </button>
  );
};

const McpSection = ({
  user,
  mcpBase,
}: {
  user: { publicApi: string };
  mcpBase: string;
}) => {
  const t = useT();
  const [activeClient, setActiveClient] = useState<McpClient>('Claude Code');
  const [method, setMethod] = useState<'header' | 'path'>('header');
  const [revealed, setRevealed] = useState(false);

  const { config, hint } = getMcpConfig(
    activeClient,
    method,
    mcpBase,
    user.publicApi
  );

  const remoteUrl = `${mcpBase}/mcp/${user.publicApi}`;
  const cliUrl = `${mcpBase}/mcp`;

  const maskedConfig = revealed
    ? config
    : config.replace(new RegExp(user.publicApi.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '*'.repeat(user.publicApi.length));

  const maskedRemoteUrl = revealed
    ? remoteUrl
    : remoteUrl.replace(user.publicApi, '*'.repeat(user.publicApi.length));

  return (
    <div className="bg-newBgColorInner rounded-[12px] border border-newBorder overflow-hidden">
      <div className="bg-newBgColorInner px-[20px] py-[14px] border-b border-newBorder flex items-start justify-between gap-[12px] phone:flex-col phone:items-stretch phone:gap-[10px]">
        <div>
          <div className="text-[13px] font-[500] text-newTextColor/60">
            {t('mcp_client_configuration', 'MCP Client Configuration')}
          </div>
          <div className="text-[13px] text-textItemBlur mt-[2px]">
            {t(
              'connect_your_mcp_client_to_postiz_to_schedule_your_posts_faster',
              'Connect Postiz MCP server to your client (Http streaming) to schedule your posts faster.'
            )}
          </div>
        </div>
        <div className="flex gap-[6px] shrink-0 pt-[2px] phone:flex-wrap phone:pt-0">
          <a
            className="cursor-pointer px-[16px] h-[36px] phone:h-[44px] bg-btnPrimary hover:bg-[#a9e662] transition-colors rounded-[6px] text-[13px] font-[550] flex items-center gap-[6px] shrink-0"
            href="https://docs.postiz.com/mcp/introduction"
            target="_blank"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></svg>
            {t('read_the_docs', 'Docs')}
          </a>
        </div>
      </div>
      <div className="p-[20px] flex flex-col gap-[16px]">
        <div className="flex flex-col gap-[6px]">
          <div className="text-[13px] font-[550] text-textItemBlur">
            {t('auth_method', 'Authentication')}
          </div>
          <div className="flex flex-wrap gap-[6px]">
            {(['header', 'path'] as const).map((m) => (
              <button
                key={m}
                type="button"
                className={clsx(
                  // phone: the label may need two lines (the auth-method pair
                  // carries the longest strings on the page), so the height
                  // floor replaces the fixed 36 instead of clipping the text.
                  'cursor-pointer px-[14px] h-[36px] text-[13px] font-[500] rounded-[8px] border transition-colors phone:h-auto phone:min-h-[44px] phone:py-[10px]',
                  method === m
                    ? 'bg-boxFocused border-transparent text-textItemFocused'
                    : 'border-newTableBorder text-textItemBlur hover:bg-newTableBorder hover:text-newTextColor'
                )}
                onClick={() => setMethod(m)}
              >
                {m === 'header'
                  ? t('cli_claude_code_codex', 'CLI (Claude Code / Codex)')
                  : t('remote_servers', 'Remote servers (ChatGPT, Claude)')}
              </button>
            ))}
          </div>
        </div>
        {method === 'header' && (
          <div className="flex flex-col gap-[6px]">
            <div className="text-[13px] font-[550] text-textItemBlur">
              {t('mcp_client', 'Client')}
            </div>
            <div className="flex flex-wrap gap-[6px]">
              {mcpClients.map((client) => (
                <button
                  key={client}
                  type="button"
                  className={clsx(
                    'cursor-pointer px-[14px] h-[36px] text-[13px] font-[500] rounded-[8px] border transition-colors phone:h-auto phone:min-h-[44px] phone:py-[10px]',
                    activeClient === client
                      ? 'bg-boxFocused border-transparent text-textItemFocused'
                      : 'border-newTableBorder text-textItemBlur hover:bg-newTableBorder hover:text-newTextColor'
                  )}
                  onClick={() => setActiveClient(client)}
                >
                  {client}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="flex flex-col gap-[8px]">
          <div className="text-[12px] text-textItemBlur font-[500]">
            {method === 'header'
              ? hint
              : t(
                  'remote_server_url_hint',
                  'Paste this URL into your remote MCP client (ChatGPT, Claude, etc.).'
                )}
          </div>
          <pre className="bg-newBgColor border border-newBorder rounded-[8px] p-[16px] text-[13px] whitespace-pre-wrap break-all overflow-x-auto leading-[1.6]">
            {method === 'header' ? maskedConfig : maskedRemoteUrl}
          </pre>
          <div className="flex flex-wrap gap-[8px]">
            <button
              type="button"
              onClick={() => setRevealed(!revealed)}
              className="cursor-pointer px-[16px] h-[36px] phone:h-[44px] bg-btnSimple hover:bg-boxHover transition-colors rounded-[6px] text-[13px] font-[550] flex items-center gap-[6px] shrink-0"
            >
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
                {revealed ? (
                  <>
                    <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" />
                    <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" />
                    <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" />
                    <path d="m2 2 20 20" />
                  </>
                ) : (
                  <>
                    <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
                    <circle cx="12" cy="12" r="3" />
                  </>
                )}
              </svg>
              {revealed ? t('hide', 'Hide') : t('reveal', 'Reveal')}
            </button>
            <CopyButton
              text={method === 'header' ? config : remoteUrl}
              label={t('copy', 'Copy')}
            />
            {method === 'header' && (
              <CopyButton
                text={cliUrl}
                label={t('copy_url', 'Copy URL')}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const localCliSteps = [
  {
    label: 'Install the CLI',
    code: 'npm install -g postiz',
  },
  {
    label: 'Run: postiz auth:login',
    code: 'postiz auth:login',
  },
  {
    label: 'Install the Postiz skill for your AI agent',
    code: 'npx skills add gitroomhq/postiz-agent',
  },
] as const;

const ciCliSteps = [
  {
    label: 'Install the CLI',
    code: 'npm install -g postiz',
  },
  {
    label: 'Set your API key as an environment variable',
    code: 'export POSTIZ_API_KEY="{API_KEY}"',
  },
  {
    label: 'Install the Postiz skill for your AI agent',
    code: 'npx skills add gitroomhq/postiz-agent',
  },
] as const;

const CliSection = ({ apiKey }: { apiKey: string }) => {
  const t = useT();
  const [mode, setMode] = useState<'local' | 'ci'>('local');
  const [revealed, setRevealed] = useState(false);

  const steps =
    mode === 'local'
      ? localCliSteps.map((step) => ({ ...step }))
      : ciCliSteps.map((step) => ({
          ...step,
          code: step.code.replace('{API_KEY}', apiKey),
        }));

  const displaySteps =
    mode === 'ci' && !revealed
      ? steps.map((step) => ({
          ...step,
          code: step.code.replace(
            new RegExp(apiKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
            '*'.repeat(apiKey.length)
          ),
        }))
      : steps;

  return (
    <div className="bg-newBgColorInner rounded-[12px] border border-newBorder overflow-hidden">
      <div className="bg-newBgColorInner px-[20px] py-[14px] border-b border-newBorder flex items-start justify-between gap-[12px] phone:flex-col phone:items-stretch phone:gap-[10px]">
        <div>
          <div className="text-[13px] font-[500] text-newTextColor/60">
            {t('cli_and_skills', 'CLI & AI Skills')}
          </div>
          <div className="text-[13px] text-textItemBlur mt-[2px]">
            {t(
              'cli_description',
              'Use the Postiz CLI to automate posting from your terminal, or install the skill to let your AI agent schedule posts for you.'
            )}
          </div>
        </div>
        <div className="flex gap-[6px] shrink-0 pt-[2px] phone:flex-wrap phone:pt-0">
          <a
            className="cursor-pointer px-[16px] h-[36px] phone:h-[44px] bg-btnPrimary hover:bg-[#a9e662] transition-colors rounded-[6px] text-[13px] font-[550] flex items-center gap-[6px] shrink-0"
            href="https://docs.postiz.com/cli/introduction"
            target="_blank"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></svg>
            {t('read_the_docs', 'Docs')}
          </a>
        </div>
      </div>
      <div className="p-[20px] flex flex-col gap-[16px]">
        <div className="flex flex-wrap gap-[6px]">
          {(['local', 'ci'] as const).map((m) => (
            <button
              key={m}
              type="button"
              className={clsx(
                'cursor-pointer px-[14px] h-[36px] text-[13px] font-[500] rounded-[8px] border transition-colors phone:h-auto phone:min-h-[44px] phone:py-[10px]',
                mode === m
                  ? 'bg-boxFocused border-transparent text-textItemFocused'
                  : 'border-newTableBorder text-textItemBlur hover:bg-newTableBorder hover:text-newTextColor'
              )}
              onClick={() => setMode(m)}
            >
              {m === 'local'
                ? t('locally', 'Locally')
                : t('ci_remote_servers', 'CI / Remote servers')}
            </button>
          ))}
        </div>
        {displaySteps.map((step, i) => (
          <div key={i} className="flex flex-col gap-[6px]">
            <div className="text-[13px] font-[550] text-textItemBlur">
              {i + 1}. {step.label}
            </div>
            <pre className="bg-newBgColor border border-newBorder rounded-[8px] p-[16px] text-[13px] whitespace-pre-wrap break-all overflow-x-auto leading-[1.6]">
              {step.code}
            </pre>
          </div>
        ))}
        <div className="flex flex-wrap gap-[8px]">
          {mode === 'ci' && (
            <button
              type="button"
              onClick={() => setRevealed(!revealed)}
              className="cursor-pointer px-[16px] h-[36px] phone:h-[44px] bg-btnSimple hover:bg-boxHover transition-colors rounded-[6px] text-[13px] font-[550] flex items-center gap-[6px] shrink-0"
            >
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
                {revealed ? (
                  <>
                    <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" />
                    <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" />
                    <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" />
                    <path d="m2 2 20 20" />
                  </>
                ) : (
                  <>
                    <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
                    <circle cx="12" cy="12" r="3" />
                  </>
                )}
              </svg>
              {revealed ? t('hide', 'Hide') : t('reveal', 'Reveal')}
            </button>
          )}
          <CopyButton
            text={steps.map((s) => s.code).join(' && ')}
            label={t('copy_all', 'Copy All')}
          />
        </div>
      </div>
    </div>
  );
};

const PublicApiContent = () => {
  const user = useUser();
  const { backendUrl, frontEndUrl, mcpUrl } = useVariables();
  const toaster = useToaster();
  const fetch = useFetch();
  const decision = useDecisionModal();
  const { mutate } = useSWRConfig();
  const [reveal, setReveal] = useState(false);
  const t = useT();

  const rotateKey = useCallback(async () => {
    const approved = await decision.open({
      title: t('rotate_api_key', 'Rotate API Key?'),
      description: t(
        'rotate_api_key_description',
        'This will generate a new API key and invalidate the current one. Any integrations using the old key will stop working.'
      ),
      approveLabel: t('rotate', 'Rotate'),
      cancelLabel: t('cancel', 'Cancel'),
    });
    if (!approved) return;
    await fetch('/user/api-key/rotate', { method: 'POST' });
    await mutate('/user/self');
    setReveal(false);
    toaster.show(
      t('api_key_rotated', 'API Key rotated successfully'),
      'success'
    );
  }, [decision, fetch, mutate, toaster]);

  if (!user || !user.publicApi) {
    return null;
  }

  const mcpBase = mcpUrl || backendUrl;

  return (
    <div className="flex flex-col gap-[40px]">
      <div className="text-[14px] text-newTextColor leading-[1.7]">
        {t(
          'api_auth_note_line1',
          'Use your API Key to automate your own account.'
        )}
        <br />
        {t(
          'api_auth_note_line2',
          'If you are building a product that schedules posts on behalf of other Postiz users,'
        )}
        <br />
        {t(
          'api_auth_note_line3',
          'create an OAuth App under the "Apps" tab. Your users will authorize your app via OAuth2,'
        )}
        <br />
        {t(
          'api_auth_note_line4',
          'and you will receive a pos_ prefixed token that works with the API, MCP, and CLI, just like an API Key.'
        )}
      </div>
      <div className="bg-newBgColorInner rounded-[12px] border border-newBorder overflow-hidden">
        <div className="bg-newBgColorInner px-[20px] py-[14px] border-b border-newBorder flex items-start justify-between gap-[12px] phone:flex-col phone:items-stretch phone:gap-[10px]">
          <div>
            <div className="text-[13px] font-[500] text-newTextColor/60">
              {t('api_key', 'API Key')}
            </div>
            <div className="text-[13px] text-textItemBlur mt-[2px]">
              {t(
                'use_postiz_api_to_integrate_with_your_tools',
                'Use Postiz API to integrate with your tools.'
              )}
            </div>
          </div>
          <div className="flex gap-[6px] shrink-0 pt-[2px] phone:flex-wrap phone:pt-0">
            <a
              className="cursor-pointer px-[16px] h-[36px] phone:h-[44px] bg-btnPrimary hover:bg-[#a9e662] transition-colors rounded-[6px] text-[13px] font-[550] flex items-center gap-[6px] shrink-0"
              href="https://docs.postiz.com/public-api"
              target="_blank"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></svg>
            {t('read_the_docs', 'Docs')}
            </a>
            <a
              className="cursor-pointer px-[16px] h-[36px] phone:h-[44px] bg-btnPrimary hover:bg-[#a9e662] transition-colors rounded-[6px] text-[13px] font-[550] flex items-center gap-[6px] shrink-0"
              href="https://www.npmjs.com/package/n8n-nodes-postiz"
              target="_blank"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></svg>
              {t('n8n_node', 'N8N Node')}
            </a>
          </div>
        </div>
        <div className="p-[20px] flex flex-col gap-[16px]">
          <div className="bg-newBgColor border border-newBorder rounded-[8px] px-[16px] h-[44px] flex items-center overflow-hidden">
            <code className="text-[14px] flex-1 truncate">
              {reveal ? (
                user.publicApi
              ) : (
                <span className="flex items-center">
                  <span className="blur-xs select-none">
                    {user.publicApi.slice(0, -5)}
                  </span>
                  <span>{user.publicApi.slice(-5)}</span>
                </span>
              )}
            </code>
          </div>
          {/* Reveal / Copy / Rotate Key / Open Wizard: four fixed-width
              buttons measure ~560px, so as a single nowrap row they set the
              settings pane's min-content width and dragged the whole card
              (and with it the settings tab strip) past a 402px viewport.
              flex-wrap + shrink-0 on each button lets the row fall onto as
              many lines as it needs; nothing shrinks, nothing clips. */}
          <div className="flex flex-wrap gap-[8px]">
            <button
              type="button"
              onClick={() => setReveal(!reveal)}
              className="cursor-pointer px-[16px] h-[36px] phone:h-[44px] bg-btnSimple hover:bg-boxHover transition-colors rounded-[6px] text-[13px] font-[550] flex items-center gap-[6px] shrink-0"
            >
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
                {reveal ? (
                  <>
                    <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" />
                    <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" />
                    <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" />
                    <path d="m2 2 20 20" />
                  </>
                ) : (
                  <>
                    <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
                    <circle cx="12" cy="12" r="3" />
                  </>
                )}
              </svg>
              {reveal ? t('hide', 'Hide') : t('reveal', 'Reveal')}
            </button>
            <CopyButton text={user.publicApi} label={t('copy', 'Copy')} />
            <button
              type="button"
              onClick={rotateKey}
              className="cursor-pointer px-[16px] h-[36px] phone:h-[44px] bg-btnSimple hover:bg-boxHover transition-colors rounded-[6px] text-[13px] font-[550] flex items-center gap-[6px] shrink-0"
            >
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
                <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                <path d="M21 3v5h-5" />
                <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                <path d="M8 16H3v5" />
              </svg>
              {t('rotate_key', 'Rotate Key')}
            </button>
            <button
              type="button"
              data-tooltip-id="tooltip"
              data-tooltip-content={t(
                'payload_wizard_description',
                'Building a POST request to /posts can be complex. Use the wizard to schedule a post with the UI, then copy the generated payload.'
              )}
              onClick={() =>
                window.open(`${frontEndUrl}/modal/dark/all`, '_blank')
              }
              className="cursor-pointer px-[16px] h-[36px] phone:h-[44px] bg-btnSimple hover:bg-boxHover transition-colors rounded-[6px] text-[13px] font-[550] flex items-center gap-[6px] shrink-0"
            >
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
                <path d="M15 3h6v6" />
                <path d="M10 14 21 3" />
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              </svg>
              {t('open_wizard', 'Open Wizard')}
            </button>
          </div>
        </div>
      </div>

      <CliSection apiKey={user.publicApi} />

      <McpSection user={user} mcpBase={mcpBase} />
    </div>
  );
};

export const PublicComponent = () => {
  const t = useT();
  const [subTab, setSubTab] = useState<'api' | 'developer'>('api');

  return (
    <div className="flex flex-col gap-[20px]">
      <div className="flex flex-col">
        {/* settings pattern (same as Signatures): display-face title + muted 14
            helper. data-cs keeps the desktop ladder off the title size. */}
        <h3 data-cs className="text-[20px] font-[400] font-display">
          {t('developers', 'Developers')}
        </h3>
        <div className="text-[14px] text-textItemBlur mt-[4px]">
          {t(
            'build_on_postiz_with_the_api_cli_and_mcp_server',
            'Build on Postiz with the API, CLI, and MCP server.'
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-[6px]">
        {(['api', 'developer'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            className={clsx(
              'cursor-pointer px-[16px] h-[36px] text-[14px] font-[500] rounded-[8px] border transition-colors phone:h-[44px]',
              subTab === tab
                ? 'bg-boxFocused border-transparent text-textItemFocused'
                : 'border-newTableBorder text-textItemBlur hover:bg-newTableBorder hover:text-newTextColor'
            )}
            onClick={() => setSubTab(tab)}
          >
            {tab === 'api'
              ? t('access', 'Access')
              : t('apps', 'Apps')}
          </button>
        ))}
      </div>
      {subTab === 'api' && <PublicApiContent />}
      {subTab === 'developer' && <DeveloperComponent />}
    </div>
  );
};
