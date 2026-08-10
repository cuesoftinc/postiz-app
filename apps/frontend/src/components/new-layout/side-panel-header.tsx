'use client';

/**
 * The header row (title + collapse chevron), the collapse-cookie boilerplate,
 * and the version footer of the channels/integrations side panel — the JSX
 * sibling of `side-panel.ts`, which owns the root/pane class strings.
 *
 * Before this file the ~26-line h2+chevron block and the
 * `useCookie('collapseMenu', '0')` ternary-toggle were copy-pasted into five
 * files (launches, agents, plugs, platform-analytics, third-parties): every
 * mobile fix had to land five times, and the copies drifted (agent.tsx grew a
 * compensating `mb-[15px]`/`-mt-3` pair that left its chevron riding ~3px
 * high). The class strings below are verbatim from those copies — pixel
 * parity, including how the global.scss size ladder rescales the unprefixed
 * `text-[20px]`/`h-[24px]` values.
 *
 * Two invariants global.scss depends on:
 *  - the header wrapper keeps the literal `flex items-center` classes as a
 *    direct child in the same DOM position — the phone rules match on it
 *    structurally (`... > .flex.items-center:not([class*="group/profile"])`).
 *    It also stamps `data-side-panel-header` as a stable hook, same pattern as
 *    the root's `data-side-panel`.
 *  - `SidePanelVersion` keeps the `mt-[5px] text-center flex flex-col` string
 *    (global.scss's phone rule currently keys on it) and stamps
 *    `data-side-panel-footer` so that fragile class-string selector can be
 *    migrated to the attribute.
 *
 * Deliberately NOT here: the panel root/pane class strings. They genuinely
 * differ per page (absolute vs flow shape, agent's `.trz` GPU hint, bg
 * placement) and stay at the call sites with `side-panel.ts`.
 */

import { FC, ReactNode, useCallback } from 'react';
import clsx from 'clsx';
import useCookie from 'react-use-cookie';
import { capitalize } from 'lodash';
import { useUser } from '@gitroom/frontend/components/layout/user.context';
import { useVariables } from '@gitroom/react/helpers/variable.context';

/**
 * Wraps the `useCookie('collapseMenu', '0')` boilerplate shared by all five
 * panels. `collapsed` feeds `sidePanelRoot(...)`, `toggle` feeds the chevron;
 * the raw `collapseMenu` string stays available for call sites that branch on
 * it directly (e.g. launches' empty state checks `collapseMenu === '0'`).
 */
export const useSidePanelCollapse = (): {
  collapsed: boolean;
  toggle: () => void;
  collapseMenu: string;
} => {
  const [collapseMenu, setCollapseMenu] = useCookie('collapseMenu', '0');
  const toggle = useCallback(
    () => setCollapseMenu(collapseMenu === '1' ? '0' : '1'),
    [collapseMenu, setCollapseMenu]
  );
  return { collapsed: collapseMenu === '1', toggle, collapseMenu };
};

/**
 * The 24x24 collapse/expand chevron button. Markup is verbatim from the five
 * copies (byte-identical in all of them): when the panel is collapsed the
 * `group sidebar` root rotates it 180deg and centers it.
 */
export const SidePanelChevron: FC<{
  onClick: () => void;
  className?: string;
}> = ({ onClick, className }) => (
  <div
    onClick={onClick}
    className={clsx(
      'group-[.sidebar]:rotate-[180deg] group-[.sidebar]:mx-auto text-btnText bg-btnSimple rounded-[6px] w-[24px] h-[24px] flex items-center justify-center cursor-pointer select-none',
      className
    )}
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m15 18-6-6 6-6" />
    </svg>
  </div>
);

/**
 * The panel header row: per-page title (the one intentional per-context
 * difference — channels / select_channels / integrations) + collapse chevron.
 * The title hides when collapsed; the chevron stays.
 */
export const SidePanelHeader: FC<{
  title: ReactNode;
  onToggle: () => void;
  className?: string;
}> = ({ title, onToggle, className }) => (
  <div data-side-panel-header className={clsx('flex items-center', className)}>
    <h2 className="group-[.sidebar]:hidden flex-1 text-[20px] font-[500]">
      {title}
    </h2>
    <SidePanelChevron onClick={onToggle} />
  </div>
);

/**
 * The "{Tier} tier" + NEXT_PUBLIC_VERSION footer at the bottom of the
 * Launches panel (the only page that renders it), moved here verbatim.
 * `data-side-panel-footer` is the stable hook for global.scss's phone rule
 * to hide it, replacing the `[class*="mt-[5px]"].text-center.flex.flex-col`
 * class-string selector.
 */
export const SidePanelVersion: FC = () => {
  const user = useUser();
  const { billingEnabled } = useVariables();
  return (
    <div data-side-panel-footer className="mt-[5px] text-center flex flex-col">
      {billingEnabled && user?.isLifetime && (
        <div>{capitalize(user?.tier?.current || '')} tier</div>
      )}
      <div>
        {process.env.NEXT_PUBLIC_VERSION ? process.env.NEXT_PUBLIC_VERSION : ''}
      </div>
    </div>
  );
};
