'use client';

import { MediaBox } from '@gitroom/frontend/components/media/media.component';
import { PageShell } from '@gitroom/frontend/components/new-layout/page-header';

export const MediaLayoutComponent = () => {
  return (
    // ONE shared page container (new-layout/page-header.tsx PageShell) — the
    // /launches pane rhythm replaces the old p-[20px]/transition-all wrapper.
    // MediaBox renders the shared PageHeader inside (standalone only).
    <PageShell>
      <MediaBox setMedia={() => {}} closeModal={() => {}} standalone={true} />
    </PageShell>
  );
};
