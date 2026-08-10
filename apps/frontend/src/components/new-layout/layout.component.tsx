'use client';

import React, { ReactNode, useCallback } from 'react';
import { Sidebar } from '@gitroom/frontend/components/new-layout/sidebar';
const ModeComponent = dynamic(
  () => import('@gitroom/frontend/components/layout/mode.component'),
  {
    ssr: false,
  }
);

import clsx from 'clsx';
import dynamic from 'next/dynamic';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useVariables } from '@gitroom/react/helpers/variable.context';
import { useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { CheckPayment } from '@gitroom/frontend/components/layout/check.payment';
import { ToolTip } from '@gitroom/frontend/components/layout/top.tip';
import { ShowMediaBoxModal } from '@gitroom/frontend/components/media/media.component';
import { ShowLinkedinCompany } from '@gitroom/frontend/components/launches/helpers/linkedin.component';
import { MediaSettingsLayout } from '@gitroom/frontend/components/launches/helpers/media.settings.component';
import { Toaster } from '@gitroom/react/toaster/toaster';
import { ShowPostSelector } from '@gitroom/frontend/components/post-url-selector/post.url.selector';
import { NewSubscription } from '@gitroom/frontend/components/layout/new.subscription';
import { Support } from '@gitroom/frontend/components/layout/support';
import { ContinueProvider } from '@gitroom/frontend/components/layout/continue.provider';
import { ContextWrapper } from '@gitroom/frontend/components/layout/user.context';
import { CopilotKit } from '@copilotkit/react-core';
import { MantineWrapper } from '@gitroom/react/helpers/mantine.wrapper';
import { Impersonate } from '@gitroom/frontend/components/layout/impersonate';
import { AnnouncementBanner } from '@gitroom/frontend/components/layout/announcement.banner';
import { Title } from '@gitroom/frontend/components/layout/title';
import { TopMenu } from '@gitroom/frontend/components/layout/top.menu';
import { LanguageComponent } from '@gitroom/frontend/components/layout/language.component';
import { ChromeExtensionComponent } from '@gitroom/frontend/components/layout/chrome.extension.component';
import NotificationComponent from '@gitroom/frontend/components/notifications/notification.component';
import { OrganizationSelector } from '@gitroom/frontend/components/layout/organization.selector';
import { StreakComponent } from '@gitroom/frontend/components/layout/streak.component';
import { PreConditionComponent } from '@gitroom/frontend/components/layout/pre-condition.component';
import { AttachToFeedbackIcon } from '@gitroom/frontend/components/new-layout/sentry.feedback.component';
import { FirstBillingComponent } from '@gitroom/frontend/components/billing/first.billing.component';
import { TrialTracker } from '@gitroom/frontend/components/layout/gtm.component';

export const LayoutComponent = ({ children }: { children: ReactNode }) => {
  const fetch = useFetch();

  const { backendUrl, billingEnabled, isGeneral } = useVariables();

  // Feedback icon component attaches Sentry feedback to a top-bar icon when DSN is present
  const searchParams = useSearchParams();
  const load = useCallback(async (path: string) => {
    return await (await fetch(path)).json();
  }, []);
  const { data: user, mutate } = useSWR('/user/self', load, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
    refreshWhenOffline: false,
    refreshWhenHidden: false,
  });

  // Buffer's mobile pattern: no bottom tab bar — a hamburger opens the same
  // sidebar as a drawer.
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  if (!user) return null;

  return (
    <ContextWrapper user={user}>
      <CopilotKit
        credentials="include"
        runtimeUrl={backendUrl + '/copilot/chat'}
        showDevConsole={false}
      >
        <MantineWrapper>
          <ToolTip />
          <Toaster />
          <TrialTracker />
          <CheckPayment check={searchParams.get('check') || ''} mutate={mutate}>
            <ShowMediaBoxModal />
            <ShowLinkedinCompany />
            <MediaSettingsLayout />
            <ShowPostSelector />
            <PreConditionComponent />
            <NewSubscription />
            <ContinueProvider />
            <div
              className={clsx(
                'flex flex-col min-h-screen min-w-screen text-newTextColor p-[12px] font-sans'
              )}
            >
              <div>{user?.admin ? <Impersonate /> : <div />}</div>
              {user.tier === 'FREE' && isGeneral && billingEnabled ? (
                <FirstBillingComponent />
              ) : (
                <>
                  <AnnouncementBanner />
                  <div className="flex-1 flex gap-[8px]">
                    <Support />
                    {/* Desktop nav is the Buffer-replica 240px sidebar (flat on
                        the page bg, no border); it hides itself on phone. */}
                    <Sidebar />
                    {/* PHONE-ONLY from here: the old rail element survives
                        solely as the bottom tab bar (`hidden phone:flex`) — on
                        desktop the Sidebar above replaces it. The bar has to be
                        a real layout change, not a CSS override: the rail's
                        items were laying out at their natural width, which made
                        the page wider than the device, which expanded the layout
                        viewport — and once that happens every position:fixed
                        element anchors to the wider viewport and the bar itself
                        lands off-screen. */}
                    {/* Buffer mobile: the sidebar becomes a drawer. Clicking
                        any link inside closes it (capture phase — no Sidebar
                        API changes needed). */}
                    {drawerOpen && (
                      <div
                        className="hidden phone:block fixed inset-0 z-[600]"
                        onClick={() => setDrawerOpen(false)}
                      >
                        <div className="absolute inset-0 bg-black/60" />
                        <div
                          className="absolute inset-y-0 start-0 w-[280px] max-w-[85vw] bg-newBgColor overflow-y-auto p-[12px] animate-normalFadeIn"
                          onClick={(e) => e.stopPropagation()}
                          onClickCapture={(e) => {
                            if ((e.target as HTMLElement).closest('a')) {
                              setDrawerOpen(false);
                            }
                          }}
                        >
                          <Sidebar inDrawer />
                        </div>
                      </div>
                    )}
                    <div className="flex-1 bg-newBgLineColor rounded-[12px] overflow-hidden flex flex-col gap-[1px] blurMe">
                      {/* 64px Buffer-height top bar; items-center keeps the
                          icon cluster (fixed-height icons + 20px separators)
                          vertically centered without per-item tweaks */}
                      <div className="flex bg-newBgColorInner h-[64px] px-[20px] items-center phone:px-[12px] phone:gap-[10px]">
                        <button
                          type="button"
                          aria-label="Menu"
                          onClick={() => setDrawerOpen(true)}
                          className="hidden phone:flex w-[36px] h-[36px] items-center justify-center rounded-[8px] hover:bg-boxHover"
                        >
                          <svg
                            width="20"
                            height="20"
                            viewBox="0 0 20 20"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              d="M3 5h14M3 10h14M3 15h14"
                              stroke="currentColor"
                              strokeWidth="1.6"
                              strokeLinecap="round"
                            />
                          </svg>
                        </button>
                        <div className="text-[24px] font-[600] flex flex-1">
                          <Title />
                        </div>
                        <div className="flex gap-[20px] text-textItemBlur">
                          <StreakComponent />
                          <div className="w-[1px] h-[20px] bg-blockSeparator" />
                          <OrganizationSelector />
                          <div className="hover:text-newTextColor">
                            <ModeComponent />
                          </div>
                          <div className="w-[1px] h-[20px] bg-blockSeparator" />
                          <LanguageComponent />
                          <ChromeExtensionComponent />
                          <div className="w-[1px] h-[20px] bg-blockSeparator" />
                          <AttachToFeedbackIcon />
                          <NotificationComponent />
                        </div>
                      </div>
                      {/* stacks on a phone — a side panel plus content does not
                          fit side by side at 390px */}
                      <div className="flex flex-1 gap-[1px] phone:flex-col">
                        {children}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </CheckPayment>
        </MantineWrapper>
      </CopilotKit>
    </ContextWrapper>
  );
};
