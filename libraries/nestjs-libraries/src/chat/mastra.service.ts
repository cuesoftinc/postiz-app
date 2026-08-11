import { Mastra } from '@mastra/core/mastra';
import { ConsoleLogger } from '@mastra/core/logger';
import { NoOpObservability } from '@mastra/core/observability';
import { pStore } from '@gitroom/nestjs-libraries/chat/mastra.store';
import { Injectable } from '@nestjs/common';
import { LoadToolsService } from '@gitroom/nestjs-libraries/chat/load.tools.service';

@Injectable()
export class MastraService {
  static mastra: Mastra;
  constructor(private _loadToolsService: LoadToolsService) {}
  async mastra() {
    MastraService.mastra =
      MastraService.mastra ||
      new Mastra({
        storage: pStore,
        // AI-span telemetry OFF (2026-08-11): the default exporter persists a
        // span per LLM/tool call to mastra_ai_spans AND re-syncs that table's
        // schema on every boot — Postgres counts dropped columns toward its
        // hard 1600-column cap, so the repeated ALTERs eventually crash-loop
        // the backend (error 54011; it took prod down today). Nothing reads
        // the spans; threads/messages/memory tables are unaffected.
        observability: new NoOpObservability(),
        agents: {
          postiz: await this._loadToolsService.agent(),
        },
        logger: new ConsoleLogger({
          level: 'info',
        }),
      });

    return MastraService.mastra;
  }
}
