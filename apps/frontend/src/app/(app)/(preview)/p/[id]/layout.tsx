import { ReactNode } from 'react';
import { PreviewWrapper } from '@gitroom/frontend/components/preview/preview.wrapper';

export default async function AppLayout({ children }: { children: ReactNode }) {
  return (
    // kit canvas token (theme-aware; anonymous visitors get the dark default
    // from the (app) layout mode cookie, logged-in users their own mode)
    <div className="bg-newBgColor text-newTextColor min-h-screen">
      <PreviewWrapper>{children}</PreviewWrapper>
    </div>
  );
}
