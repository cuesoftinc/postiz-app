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
import { LanguageComponent } from '@gitroom/frontend/components/layout/language.component';
import { ChromeExtensionComponent } from '@gitroom/frontend/components/layout/chrome.extension.component';
import NotificationComponent from '@gitroom/frontend/components/notifications/notification.component';
import { OrganizationSelector } from '@gitroom/frontend/components/layout/organization.selector';
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

  // Phone nav: a hamburger opens the sidebar as a drawer. Spec §Mapping still
  // says the bottom tab bar stays — see the arbitration note at the drawer.
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
                    <div className="flex-1 bg-newBgLineColor rounded-[12px] overflow-hidden flex flex-col gap-[1px] blurMe">
                      {/* 64px Buffer-height top bar; items-center keeps the
                          icon cluster (fixed-height icons + 20px separators)
                          vertically centered without per-item tweaks */}
                      <div className="flex bg-newBgColorInner h-[64px] px-[20px] items-center phone:px-[12px] phone:gap-[10px]">
                        <button
                          type="button"
                          aria-label={drawerOpen ? 'Close menu' : 'Menu'}
                          aria-expanded={drawerOpen}
                          onClick={() => setDrawerOpen((v) => !v)}
                          className="hidden phone:flex w-[36px] h-[36px] items-center justify-center rounded-[8px] hover:bg-boxHover"
                        >
                          {drawerOpen ? (
                            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                            </svg>
                          ) : (
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                            </svg>
                          )}
                        </button>
                        {/* page title: display face 20px/400 (spec §Page
                            header) — the ladder rescales text-[24px] to 20px */}
                        {/* Buffer mobile app bar shows the LOGO; the page
                            title lives in the content header row below */}
                        <div className="hidden phone:block">
                          <img
                            src="/cuesoft-mark-white.png"
                            alt="Cuesoft"
                            width={24}
                            height={24}
                            className="hidden dark:block object-contain"
                          />
                          <img
                            src="/cuesoft-mark-primary.png"
                            alt="Cuesoft"
                            width={24}
                            height={24}
                            className="block dark:hidden object-contain"
                          />
                        </div>
                        <div className="text-[24px] font-display font-[400] flex flex-1 phone:hidden">
                          <Title />
                        </div>
                        <div className="flex-1 hidden phone:block" />
                        {/* StreakComponent moved to the sidebar logo row
                            (spec §Sidebar row 1: logo left, streak right) */}
                        <div className="flex gap-[20px] text-textItemBlur">
                          <OrganizationSelector />
                          <div className="hover:text-newTextColor phone:hidden">
                            <ModeComponent />
                          </div>
                          <div className="w-[1px] h-[20px] bg-blockSeparator" />
                          <span className="phone:hidden"><LanguageComponent /></span>
                          <ChromeExtensionComponent />
                          <div className="w-[1px] h-[20px] bg-blockSeparator" />
                          <AttachToFeedbackIcon />
                          <NotificationComponent />
                        </div>
                      </div>
                      {/* Buffer mobile (user-verified): the menu expands
                          IN-FLOW under the app bar and pushes the page down —
                          no overlay, the content below stays interactive. */}
                      {drawerOpen && (
                        <div
                          className="hidden phone:block bg-newBgColorInner px-[12px] pb-[12px]"
                          onClickCapture={(e) => {
                            if ((e.target as HTMLElement).closest('a')) {
                              setDrawerOpen(false);
                            }
                          }}
                        >
                          <Sidebar inDrawer />
                        </div>
                      )}
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
