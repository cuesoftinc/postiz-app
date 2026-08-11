import {
  Logger,
  Controller,
  Delete,
  Get,
  Post,
  Req,
  Res,
  Query,
  Param,
} from '@nestjs/common';
import { GetUserFromRequest } from '@gitroom/nestjs-libraries/user/user.from.request';
import { User } from '@prisma/client';
import {
  CopilotRuntime,
  OpenAIAdapter,
  copilotRuntimeNodeHttpEndpoint,
  copilotRuntimeNextJSAppRouterEndpoint,
} from '@copilotkit/runtime';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { Organization } from '@prisma/client';
import { SubscriptionService } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/subscription.service';
import { MastraAgent } from '@ag-ui/mastra';
import { MastraService } from '@gitroom/nestjs-libraries/chat/mastra.service';
import { Request, Response } from 'express';
import { RequestContext } from '@mastra/core/di';
import { CheckPolicies } from '@gitroom/backend/services/auth/permissions/permissions.ability';
import { AuthorizationActions, Sections } from '@gitroom/backend/services/auth/permissions/permission.exception.class';

export type ChannelsContext = {
  integrations: string;
  organization: string;
  ui: string;
};

@Controller('/copilot')
export class CopilotController {
  constructor(
    private _subscriptionService: SubscriptionService,
    private _mastraService: MastraService
  ) {}
  // Claude Code content bridge (user-approved web surface, ADMIN-ONLY):
  // pipes the SSE stream from the loopback bridge on the host — see
  // design-system postiz/bridge/README.md. The spawned sessions are
  // read-only (Read/Grep/Glob) against the design-system repo.
  @Post('/content-chat')
  async contentChat(
    @Req() req: Request,
    @Res() res: Response,
    @GetUserFromRequest() user: User
  ) {
    const bridgeUrl =
      process.env.CONTENT_BRIDGE_URL || 'http://host.docker.internal:6299';
    res.setHeader('content-type', 'text/event-stream');
    res.setHeader('cache-control', 'no-cache');
    (res as any).flushHeaders?.();
    const emitError = (message: string) => {
      try {
        res.write(`data: ${JSON.stringify({ type: 'error', message })}\n\n`);
      } catch {}
    };
    const controller = new AbortController();
    req.on('close', () => controller.abort());
    try {
      const upstream = await fetch(`${bridgeUrl}/chat`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(process.env.CONTENT_BRIDGE_TOKEN
            ? { 'x-bridge-token': process.env.CONTENT_BRIDGE_TOKEN }
            : {}),
        },
        body: JSON.stringify({
          message: String((req.body as any)?.message || '').slice(0, 8000),
          sessionId:
            typeof (req.body as any)?.sessionId === 'string'
              ? (req.body as any).sessionId
              : undefined,
          // one bridge profile per chat surface (assistant/content tabs +
          // the composer's 'post'); anything unexpected falls back to the
          // content default rather than erroring
          profile: ['assistant', 'post'].includes((req.body as any)?.profile)
            ? (req.body as any).profile
            : 'content',
        }),
        signal: controller.signal,
      });
      if (!upstream.ok || !upstream.body) {
        emitError('Content bridge is offline');
        return res.end();
      }
      const reader = (upstream.body as any).getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(Buffer.from(value));
      }
    } catch {
      emitError('Content bridge is offline');
    }
    return res.end();
  }

  // Bridge session index (open to every org user by the owner's decision:
  // this is an internal tool; the auth middleware already scopes it): the
  // sessions rail lists and prunes the per-profile session entries the
  // bridge keeps in postiz/bridge/sessions.json. Plain JSON passthrough;
  // any failure collapses to the same offline error shape the chat uses.
  @Get('/content-sessions')
  async contentSessions(
    @GetUserFromRequest() user: User,
    @Query('profile') profile?: string
  ) {
    const bridgeUrl =
      process.env.CONTENT_BRIDGE_URL || 'http://host.docker.internal:6299';
    const query = ['assistant', 'content', 'post'].includes(profile || '')
      ? `?profile=${profile}`
      : '';
    try {
      const upstream = await fetch(`${bridgeUrl}/sessions${query}`, {
        headers: {
          ...(process.env.CONTENT_BRIDGE_TOKEN
            ? { 'x-bridge-token': process.env.CONTENT_BRIDGE_TOKEN }
            : {}),
        },
      });
      if (!upstream.ok) {
        return { error: 'Content bridge is offline' };
      }
      return await upstream.json();
    } catch {
      return { error: 'Content bridge is offline' };
    }
  }

  @Delete('/content-sessions/:id')
  async deleteContentSession(
    @GetUserFromRequest() user: User,
    @Param('id') id: string
  ) {
    const bridgeUrl =
      process.env.CONTENT_BRIDGE_URL || 'http://host.docker.internal:6299';
    try {
      const upstream = await fetch(
        `${bridgeUrl}/sessions/${encodeURIComponent(id)}`,
        {
          method: 'DELETE',
          headers: {
            ...(process.env.CONTENT_BRIDGE_TOKEN
              ? { 'x-bridge-token': process.env.CONTENT_BRIDGE_TOKEN }
              : {}),
          },
        }
      );
      if (!upstream.ok) {
        return { error: 'Content bridge is offline' };
      }
      try {
        return await upstream.json();
      } catch {
        return {};
      }
    } catch {
      return { error: 'Content bridge is offline' };
    }
  }

  @Post('/chat')
  chatAgent(@Req() req: Request, @Res() res: Response) {
    if (
      process.env.OPENAI_API_KEY === undefined ||
      process.env.OPENAI_API_KEY === ''
    ) {
      Logger.warn('OpenAI API key not set, chat functionality will not work');
      return;
    }

    const copilotRuntimeHandler = copilotRuntimeNodeHttpEndpoint({
      endpoint: '/copilot/chat',
      runtime: new CopilotRuntime(),
      serviceAdapter: new OpenAIAdapter({
        model: 'gpt-4.1',
      }),
    });

    return copilotRuntimeHandler(req, res);
  }

  @Post('/agent')
  @CheckPolicies([AuthorizationActions.Create, Sections.AI])
  async agent(
    @Req() req: Request,
    @Res() res: Response,
    @GetOrgFromRequest() organization: Organization
  ) {
    if (
      process.env.OPENAI_API_KEY === undefined ||
      process.env.OPENAI_API_KEY === ''
    ) {
      Logger.warn('OpenAI API key not set, chat functionality will not work');
      return;
    }
    const mastra = await this._mastraService.mastra();
    const requestContext = new RequestContext<ChannelsContext>();
    requestContext.set(
      'integrations',
      req?.body?.variables?.properties?.integrations || []
    );

    requestContext.set('organization', JSON.stringify(organization));
    requestContext.set('ui', 'true');

    const agents = MastraAgent.getLocalAgents({
      resourceId: organization.id,
      mastra,
      requestContext: requestContext as any,
    });

    const runtime = new CopilotRuntime({
      agents,
    });

    const copilotRuntimeHandler = copilotRuntimeNextJSAppRouterEndpoint({
      endpoint: '/copilot/agent',
      runtime,
      // properties: req.body.variables.properties,
      serviceAdapter: new OpenAIAdapter({
        model: 'gpt-4.1',
      }),
    });

    return copilotRuntimeHandler.handleRequest(req, res);
  }

  @Get('/credits')
  calculateCredits(
    @GetOrgFromRequest() organization: Organization,
    @Query('type') type: 'ai_images' | 'ai_videos'
  ) {
    return this._subscriptionService.checkCredits(
      organization,
      type || 'ai_images'
    );
  }

  @Get('/:thread/list')
  @CheckPolicies([AuthorizationActions.Create, Sections.AI])
  async getMessagesList(
    @GetOrgFromRequest() organization: Organization,
    @Param('thread') threadId: string
  ): Promise<any> {
    const mastra = await this._mastraService.mastra();
    const memory = await mastra.getAgent('postiz').getMemory();
    try {
      return await memory.recall({
        resourceId: organization.id,
        threadId,
      });
    } catch (err) {
      Logger.warn(`Could not recall messages for thread ${threadId}: ${err}`);
      return { messages: [] };
    }
  }

  @Get('/list')
  @CheckPolicies([AuthorizationActions.Create, Sections.AI])
  async getList(@GetOrgFromRequest() organization: Organization) {
    const mastra = await this._mastraService.mastra();
    const memory = await mastra.getAgent('postiz').getMemory();
    const list = await memory.listThreads({
      filter: { resourceId: organization.id },
      perPage: 100000,
      page: 0,
      orderBy: { field: 'createdAt', direction: 'DESC' },
    });

    return {
      threads: list.threads.map((p) => ({
        id: p.id,
        title: p.title,
      })),
    };
  }
}
