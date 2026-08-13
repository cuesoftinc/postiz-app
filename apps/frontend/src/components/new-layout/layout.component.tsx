'use client';

import React, { ReactNode, useCallback } from 'react';
import { Sidebar } from '@gitroom/frontend/components/new-layout/sidebar';

import clsx from 'clsx';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useVariables } from '@gitroom/react/helpers/variable.context';
import { usePathname, useSearchParams } from 'next/navigation';
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
import { MantineProvider } from '@mantine/core';
import { MantineWrapper } from '@gitroom/react/helpers/mantine.wrapper';
import { Impersonate } from '@gitroom/frontend/components/layout/impersonate';
import { AnnouncementBanner } from '@gitroom/frontend/components/layout/announcement.banner';
import { Title } from '@gitroom/frontend/components/layout/title';
import { PreConditionComponent } from '@gitroom/frontend/components/layout/pre-condition.component';
import { FirstBillingComponent } from '@gitroom/frontend/components/billing/first.billing.component';
import { TrialTracker } from '@gitroom/frontend/components/layout/gtm.component';
import { StreakComponent } from '@gitroom/frontend/components/layout/streak.component';

export const LayoutComponent = ({ children }: { children: ReactNode }) => {
  const fetch = useFetch();

  const { backendUrl, billingEnabled, isGeneral } = useVariables();

  const searchParams = useSearchParams();
  const pathname = usePathname();
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

  // Phone surfaces must not stack (see filters.tsx): the drawer announces
  // itself on 'cs:surface-open' so open bottom sheets dismiss, and yields
  // when any other surface (sheet, modal) announces.
  React.useEffect(() => {
    const onSurface = (e: Event) => {
      if ((e as CustomEvent).detail !== 'drawer') setDrawerOpen(false);
    };
    window.addEventListener('cs:surface-open', onSurface);
    return () => window.removeEventListener('cs:surface-open', onSurface);
  }, []);

  if (!user) return null;

  return (
    <ContextWrapper user={user}>
      <CopilotKit
        credentials="include"
        runtimeUrl={backendUrl + '/copilot/chat'}
        showDevConsole={false}
      >
        {/* Mantine v5 falls back to DEFAULT_THEME when no provider is mounted,
            and that theme's fontFamily is an `-apple-system` stack which
            `theme.fn.fontStyles()` stamps onto the composer date picker's month
            table, day numbers and time input (@mantine/dates Month/Day/
            TimeInputBase) plus the Autocomplete input, so those rendered in the
            system font instead of Inter. Nothing was mounting a provider:
            `MantineWrapper` below is a misnamed ModalManager, not a
            MantineProvider, which is why grepping for one came up empty.

            `fontFamily: 'inherit'` is the whole override. fontStyles() returns
            `theme.fontFamily || 'sans-serif'` verbatim, so the affected nodes
            now inherit Inter from the app shell's font-sans. Everything else
            stays on DEFAULT_THEME exactly as before, and the provider's
            withGlobalStyles / withNormalizeCSS / withCSSVariables all default
            to false, so it injects no global CSS that could fight global.scss.
            headings.fontFamily is deliberately left alone: only Title and
            TypographyStylesProvider read it and neither is used here. It wraps
            MantineWrapper so the modal layer (where the picker lives) is
            covered too. */}
        <MantineProvider theme={{ fontFamily: 'inherit' }}>
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
                  // Buffer card geometry: 8px top/right/bottom page margins, the
                  // card starts flush against the 240px sidebar region (ps-0 —
                  // the sidebar carries its own inner padding). Phone: the card
                  // is full-bleed on the canvas, so no page padding at all.
                  'flex flex-col min-w-screen text-newTextColor pt-[8px] pe-[8px] pb-[8px] ps-0 font-sans phone:p-0',
                  // /agents is an app frame, not a document: the window never
                  // scrolls — the chat transcript and the sessions rail scroll
                  // inside (header, composer box and rail stay fixed). Desktop
                  // only: on phone the rail stacks above the chat, so the page
                  // keeps its natural document flow there.
                  (pathname || '').startsWith('/agents')
                    ? 'h-dvh phone:h-auto phone:min-h-screen'
                    : 'min-h-screen'
                )}
              >
                {/* Admin tool renders as a fixed bottom-center pill (Buffer has
                    no top strip) — it reserves no flow height on any breakpoint */}
                {user?.admin && <Impersonate />}
                {user.tier === 'FREE' && isGeneral && billingEnabled ? (
                  <FirstBillingComponent />
                ) : (
                  <>
                    {/* Phone app bar — sits ON the page canvas (Buffer: cream
                        bg, 56px tall, hairline at y=56, white card below):
                        ☰ 40×40 with a presence dot + logo lockup + streak as
                        the only right-side element (no bell, no separators) */}
                    {/* ps 8 keeps the hamburger's icon at Buffer's optical inset
                        (icon centers inside the 40px hit box); pe 16 gives the
                        streak chip real edge clearance (user report: badge sat
                        nearly flush with the screen edge) */}
                    <div className="hidden phone:flex h-[56px] items-center gap-[10px] ps-[8px] pe-[16px] border-b border-newBgLineColor">
                      <button
                        type="button"
                        aria-label={drawerOpen ? 'Close menu' : 'Menu'}
                        aria-expanded={drawerOpen}
                        onClick={() => {
                          const next = !drawerOpen;
                          if (next) {
                            window.dispatchEvent(
                              new CustomEvent('cs:surface-open', {
                                detail: 'drawer',
                              })
                            );
                          }
                          setDrawerOpen(next);
                        }}
                        data-cs
                        className="relative flex w-[40px] h-[40px] items-center justify-center rounded-[8px] hover:bg-boxHover transition-colors duration-150"
                      >
                        {drawerOpen ? (
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
                            <path d="M18 6 6 18" />
                            <path d="m6 6 12 12" />
                          </svg>
                        ) : (
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
                            <path d="M4 5h16" />
                            <path d="M4 12h16" />
                            <path d="M4 19h16" />
                          </svg>
                        )}
                        {/* presence dot. Buffer pins it riding the hamburger
                            GLYPH's top-end line — measured (32..39, 16..23) at
                            390 = an 8px inset from the 40px button's top/end
                            edges — not floating at the button's top-left (the
                            old 4px top/start inset landed in the button's empty
                            padding and read as a stray dot at the viewport
                            corner). Canvas-colored ring lifts it off the glyph. */}
                        <span className="absolute top-[8px] end-[8px] w-[8px] h-[8px] rounded-full bg-btnPrimary border-[1.5px] border-primary" />
                      </button>
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
                      {/* brand rule: lowercase "cuesoft" in Fustat */}
                      <span
                        data-cs
                        className="[font-family:var(--font-fustat)] text-[20px] font-[700] text-newTextColor"
                      >
                        cuesoft
                      </span>
                      <div className="flex-1" />
                      <StreakComponent />
                    </div>
                    {/* Buffer mobile (user-verified): the menu expands IN-FLOW
                        under the app bar and pushes the page down — no overlay,
                        the content below stays interactive. */}
                    {drawerOpen && (
                      <div
                        className="hidden phone:block bg-newBgColorInner px-[12px] pb-[12px] border-b border-newBgLineColor"
                        onClickCapture={(e) => {
                          if ((e.target as HTMLElement).closest('a')) {
                            setDrawerOpen(false);
                          }
                        }}
                      >
                        <Sidebar inDrawer />
                      </div>
                    )}
                    <AnnouncementBanner />
                    {/* min-h-0 through this chain lets the /agents app frame
                        clamp to the viewport; on document-flow pages it is
                        inert (it only lowers the minimum, never the size) */}
                    <div className="flex-1 flex min-h-0">
                      <Support />
                      {/* Desktop nav is the Buffer-replica 240px sidebar (flat on
                          the page bg, no border); it hides itself on phone. */}
                      <Sidebar />
                      {/* Buffer card: white, r12, 1px hairline border, flush
                          against the sidebar (no gap). Phone: full-bleed — edge
                          hairlines only, small top radius, runs to the bottom. */}
                      <div className="flex-1 min-h-0 bg-newBgLineColor rounded-[12px] border border-newTableBorder overflow-hidden flex flex-col gap-[1px] blurMe phone:rounded-none phone:rounded-t-[8px] phone:border-t-0">
                        {/* 64px desktop-only top bar — now just the page Title.
                            The utility cluster (bell, theme, language, extension,
                            feedback, org switch) moved into the sidebar footer so
                            it stays reachable on phone too (the sidebar renders
                            inside the drawer). /schedule (and /launches, kept for
                            the redirect moment) and /third-party carry
                            their own page headers, and on /settings the settings
                            rail carries the title — the bar would be an empty
                            duplicate strip on those routes, so they are excluded;
                            every other route keeps it for the Title. */}
                        {![
                          '/launches',
                          '/schedule',
                          '/settings',
                          '/third-party',
                          '/analytics',
                          '/agents',
                          '/media',
                          '/content',
                          '/plugs',
                        ].some((p) => (pathname || '').startsWith(p)) && (
                          <div className="flex bg-newBgColorInner h-[64px] px-[20px] items-center phone:hidden">
                            {/* page title: display face 20px/400 (spec §Page
                                header); data-cs holds the exact size (bar is
                                phone:hidden, so no phone ladder concerns) */}
                            <div
                              data-cs
                              className="text-[20px] font-display font-[400] flex flex-1"
                            >
                              <Title />
                            </div>
                          </div>
                        )}
                        {/* stacks on a phone — a side panel plus content does not
                            fit side by side at 390px */}
                        <div className="flex flex-1 min-h-0 gap-[1px] phone:flex-col">
                          {children}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </CheckPayment>
          </MantineWrapper>
        </MantineProvider>
      </CopilotKit>
    </ContextWrapper>
  );
};
