export const dynamic = 'force-dynamic';
import { Metadata } from 'next';
import { ContentChatComponent } from '@gitroom/frontend/components/content-agent/content-chat.component';

export const metadata: Metadata = {
  title: 'Cuesoft Content',
  description: '',
};

export default async function Index() {
  return (
    <div
      data-cs
      className="bg-newBgColorInner flex-1 flex flex-col pt-[24px] px-[32px] pb-[20px] gap-[8px] phone:pt-[12px] phone:px-[12px] min-h-0"
    >
      <ContentChatComponent />
    </div>
  );
}
