'use client';

import { FC, HTMLAttributes, MouseEventHandler, ReactNode, Ref } from 'react';
import clsx from 'clsx';
import { SVGLine } from '@gitroom/frontend/components/launches/launches.component';
import {
  ChannelAvatar,
  ChannelAvatarProps,
} from '@gitroom/frontend/components/new-layout/channel-avatar';

/**
 * One row of a channels side panel: the SVGLine hover accent hanging into the
 * panel padding, a ChannelAvatar, the ellipsized channel name, and an optional
 * trailing control (launches' settings Menu, third-party's delete kebab).
 *
 * ADOPTION: 1 of the 5 target call sites, as of 2026-08-13. The only importer
 * is `third-parties/third-party.component.tsx:206`. Of the other four the
 * agents copy is gone (7ce47dff replaced that panel with the avatar toggle
 * bar in agents/agent.tsx `AgentList`), and launches, analytics and plugs
 * never migrated - launches.component.tsx:297 still hand-rolls the row as a
 * card, and analytics/plugs moved to the shared channels dropdown instead.
 * So this is a real primitive with one adopter, not the converged row.
 *
 * NAME COLLISION - `new-layout/sidebar.tsx:313` declares its OWN local
 * `const ChannelRow`, a different component (sidebar channel link with
 * scheduled counts and hover actions), used at sidebar.tsx:607 and :697, in
 * THIS SAME DIRECTORY. Nothing breaks today because the sidebar's is
 * module-local and never imported, but the two are trivially confusable in
 * review and in grep output - `grep -rn ChannelRow` returns both and neither
 * name says which. Renaming this export to `ChannelPanelRow` (or the
 * sidebar's to `SidebarChannelRow`) is the fix; it was NOT done here because
 * the consumer, third-party.component.tsx, is outside this change's file
 * ownership. Recorded as a handoff, not a defect to work around.
 *
 * The same ~50-line block was copy-pasted into launches, agents, analytics,
 * plugs and third-party and drifted five ways. Where this component and a
 * copy disagree, the difference is a sanctioned normalization:
 *  - row gap is 12px (plugs had drifted to 8; third-party keeps 8 by design
 *    via the `gap` prop) and the inner accent↔avatar gap is 6px everywhere;
 *  - the red attention dot sits at start-[5px] top-[5px] (agents/analytics/
 *    plugs had drifted to start-0 -top-[5px]);
 *  - the accent holder always hangs by -ms-[12px] (third-party's copy was
 *    missing it, so its accent ate layout space instead);
 *  - youtube rows get the svg badge everywhere (via ChannelAvatar).
 * Everything else is pixel parity with the copies, including the inert bits
 * they shared (the overlay's cursor-pointer even with no handler attached);
 * the copies' inert `rounded-full` on the avatar cluster was dropped — the
 * cluster has no background or overflow for it to act on.
 */

export interface ChannelRowIntegration {
  id: string;
  name: string;
  identifier: string;
  picture?: string;
  disabled?: boolean;
  inBetweenSteps?: boolean;
  refreshNeeded?: boolean;
}

type DivProps = HTMLAttributes<HTMLDivElement> & { ref?: Ref<HTMLDivElement> };

export interface ChannelRowProps {
  integration: ChannelRowIntegration;
  /** Click on the whole row (select/toggle). */
  onClick?: MouseEventHandler<HTMLDivElement>;
  /**
   * The unselected/non-current treatment:
   * 'opacity-20 hover:opacity-100 cursor-pointer'. Rows that are clickable
   * even when NOT dimmed (agents' toggle list) add 'cursor-pointer' via
   * `className` themselves.
   */
  dimmed?: boolean;
  /**
   * Click on the red-'!' attention overlay (reconnect / continue setup). The
   * overlay itself shows whenever the integration has inBetweenSteps or
   * refreshNeeded — with no handler it is inert, exactly like the copies in
   * agents/analytics/plugs (their toaster lives on the row onClick instead).
   */
  onAttentionClick?: MouseEventHandler<HTMLDivElement>;
  /** Rendered after the name: launches' Menu, third-party's kebab. */
  trailing?: ReactNode;
  /**
   * Full render override for the avatar cluster content — third-party swaps
   * in its round, badge-less service icon:
   *   avatar={<ChannelAvatar picture={`/icons/third-party/${p.identifier}.png`}
   *     fallback={`/icons/third-party/${p.identifier}.png`}
   *     identifier={p.identifier} name={p.title}
   *     size={32} shape="round" showBadge={false} />}
   */
  avatar?: ReactNode;
  /**
   * Prop overrides merged into the default ChannelAvatar (launches passes
   * fallback='placeholder' and className='min-w-[36px] min-h-[36px]').
   * Do not pass `disabled` here — the row already dims the whole cluster.
   */
  avatarProps?: Partial<ChannelAvatarProps>;
  /** Row gap in px. 12 is the standard; third-party keeps 8. Default 12. */
  gap?: 8 | 12;
  /**
   * justify-center on the row. Only visible when the panel is collapsed (the
   * name hides and the avatar centers in the rail). agents/analytics/plugs
   * have it; launches and third-party historically do not. Default true.
   */
  center?: boolean;
  /** rounded-e-[8px] on the hover background. third-party's copy never had
   *  it, so it opts out. Default true. */
  roundedEnd?: boolean;
  /**
   * Cuesoft mobile patch (fork): inside a phone:flex-row scroll container the
   * row becomes a bordered horizontal chip instead of a full-width line —
   * a vertical channel list eats the whole screen on a phone. The container
   * keeps its phone:flex-row/overflow classes.
   *
   * NO CALLER as of 2026-08-13. This prop was written for the agents channel
   * panel, and that panel no longer exists (7ce47dff swapped it for the
   * avatar toggle bar), so the "Used by the agents panel" it used to claim is
   * false. Kept because the phone-chip treatment is still the right answer for
   * any future horizontal channel strip and costs one clsx branch.
   */
  phoneChip?: boolean;
  /** data-tooltip content applied to BOTH the avatar cluster and the name
   *  (third-party shows the integration title on either). */
  tooltip?: string;
  /** Extra row classes: launches adds 'bg-newBgColorInner transition-all',
   *  agents adds 'cursor-pointer' for its always-toggleable rows. */
  className?: string;
  /** Attributes for the name div — launches' drag handle ref/role and its
   *  conditional tooltips go here. */
  nameProps?: DivProps;
  /** Attributes for the row root — launches' dragPreview ref and collapsed /
   *  reconnect tooltips go here. An onClick here wins over `onClick`. */
  rootProps?: DivProps;
}

/** Literal class strings so the Tailwind scanner sees them. */
const ROW_GAP: Record<8 | 12, string> = {
  8: 'gap-[8px]',
  12: 'gap-[12px]',
};

export const ChannelRow: FC<ChannelRowProps> = (props) => {
  const {
    integration,
    onClick,
    dimmed = false,
    onAttentionClick,
    trailing,
    avatar,
    avatarProps,
    gap = 12,
    center = true,
    roundedEnd = true,
    phoneChip = false,
    tooltip,
    className,
    nameProps,
    rootProps,
  } = props;

  const needsAttention = !!(
    integration.inBetweenSteps || integration.refreshNeeded
  );
  const tooltipAttrs = tooltip
    ? ({
        'data-tooltip-id': 'tooltip',
        'data-tooltip-content': tooltip,
      } as const)
    : {};

  return (
    <div
      onClick={onClick}
      {...rootProps}
      className={clsx(
        'flex items-center group/profile hover:bg-boxHover',
        ROW_GAP[gap],
        center && 'justify-center',
        roundedEnd && 'rounded-e-[8px]',
        dimmed && 'opacity-20 hover:opacity-100 cursor-pointer',
        phoneChip &&
          'phone:flex-none phone:w-auto phone:px-[10px] phone:py-[6px] phone:rounded-[8px] phone:whitespace-nowrap phone:border phone:border-newBorder',
        className,
        rootProps?.className
      )}
    >
      <div
        {...tooltipAttrs}
        className={clsx(
          'relative gap-[6px] flex justify-center items-center',
          integration.disabled && 'opacity-50'
        )}
      >
        {/* The hover accent. -ms-[12px] hangs it into the panel's padding so
            it takes no layout space of its own. */}
        <div className="h-full w-[4px] -ms-[12px] rounded-s-[3px] opacity-0 group-hover/profile:opacity-100 transition-opacity">
          <SVGLine />
        </div>
        {needsAttention && (
          <div
            className="absolute start-0 top-0 w-[39px] h-[46px] cursor-pointer"
            onClick={onAttentionClick}
          >
            <div className="bg-red-500 w-[15px] h-[15px] rounded-full start-[5px] top-[5px] absolute z-[20] text-[10px] flex justify-center items-center">
              !
            </div>
            <div className="bg-primary/60 w-[39px] h-[46px] start-0 top-0 absolute rounded-full z-[10]" />
          </div>
        )}
        {avatar ?? (
          <ChannelAvatar
            picture={integration.picture}
            identifier={integration.identifier}
            {...avatarProps}
          />
        )}
      </div>
      <div
        {...tooltipAttrs}
        {...nameProps}
        className={clsx(
          'group-[.sidebar]:hidden flex-1 whitespace-nowrap text-ellipsis overflow-hidden',
          integration.disabled && 'opacity-50',
          nameProps?.className
        )}
      >
        {integration.name}
      </div>
      {trailing}
    </div>
  );
};
