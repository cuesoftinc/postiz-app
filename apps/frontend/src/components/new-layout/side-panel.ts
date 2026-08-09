/**
 * The channels/integrations side panel that Launches, Agents, Plugs, Analytics
 * and Third-parties all render to the left of their content.
 *
 * It exists here because the same markup was copy-pasted into five files, and
 * the mobile treatment has to be identical in all of them. Every one of those
 * copies also carries `data-side-panel`, which is the stable hook global.scss
 * uses instead of guessing at Tailwind class strings: collapsing the panel
 * *swaps* `w-[260px]` for `group sidebar w-[100px]`, so any selector keyed off
 * the width silently stopped matching the moment the user collapsed it. That is
 * exactly how the "Channels" heading ended up drawn underneath the toolbar.
 *
 * Two shapes exist upstream:
 *  - `absolute`: the panel is a `relative` box whose content is an absolutely
 *    positioned, independently scrolling pane (Launches, Agents).
 *  - `flow`:     the panel *is* the content box (Plugs, Analytics, Third-party).
 */

/**
 * Panel root. Full width on a phone — there is no room for a side rail.
 *
 * 224px rather than upstream's 260px: part of the Buffer calibration, and it
 * used to be a `width: 224px !important` in global.scss keyed on `w-[260px]`.
 * That `!important` outranked the `phone:w-full` here, so the panel stayed
 * 224px wide inside a 402px phone with a dead gutter beside it. Owning the
 * number here is what lets the responsive variant work at all.
 */
export const sidePanelRoot = (collapsed: boolean) =>
  collapsed
    ? 'group sidebar w-[100px] phone:w-full phone:h-auto'
    : 'w-[224px] min-w-[224px] phone:w-full phone:min-w-0 phone:h-auto';

/**
 * The absolutely-positioned inner pane of the `absolute` shape. It must go back
 * into flow on a phone: while it is absolute its parent has height 0, so the
 * panel contributes nothing to the stacked layout and the next section draws
 * straight over it.
 */
export const sidePanelPane =
  'phone:static phone:h-auto phone:max-h-none phone:overflow-visible phone:p-[12px]';
