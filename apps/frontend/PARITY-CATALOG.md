# Buffer Parity Catalog — full Postiz frontend inventory

**Purpose.** The exhaustive, user-mandated inventory of every route, page, modal, panel,
control, and feature in this Postiz fork, cross-checked against Buffer (publish.buffer.com).
This file is the loop ledger for the pixel-level Buffer replica: every user-facing surface
gets a row; a missed surface is a parity hole. Companion docs: `BUFFER-REPLICA-SPEC.md`
(measured values), the scratchpad measurement notes (`buffer-measurements-r1.md`,
`parity-gaps-r1.md`, `backlog.md`), and the `cuesoft/customizations` git log (each wave
commit documents what was measured and applied).

**Update protocol.** Every parity wave updates the Status column here (and appends a
changelog line). Statuses:

- `VERIFIED-PARITY` — measured against live Buffer and matched (or brand-mapped per the
  spec: Cuesoft lime/blue substitute Buffer green/blue, everything else Buffer neutrals).
- `NEEDS-WORK` — known divergence; the Notes column describes it.
- `NEEDS-BUFFER-MEASUREMENT` — no Buffer reference captured yet; the orchestrator measures
  these in the browser. Notes say exactly WHAT to measure.
- `POSTIZ-ONLY-KEEP` — no Buffer counterpart; intentionally kept (capability preservation
  is a hard rule). Styling still uses the Buffer-measured token system.
- `N/A-INTERNAL` — auth/oauth/admin/analytics plumbing with no Buffer analog and no
  parity relevance.

**The loop ends when no `NEEDS-WORK` or `NEEDS-BUFFER-MEASUREMENT` rows remain.**

**Changelog**
- 2026-08-10 — initial full inventory (routes + components walk; cross-checked against
  spec, waves `f3c25aa4…fc0f3cdf`, and scratchpad round-1 measurements/gap audits).

---

## 1. Routes (App Router map)

| Surface | Component/file | Status | Notes |
|---|---|---|---|
| `/launches` (Publish home) | `app/(app)/(site)/launches/page.tsx` → `launches/launches.component.tsx` | VERIFIED-PARITY | Maps to Buffer Publish; calendar/list/toolbar measured r1 |
| `/schedule`, `/schedule/list`, `/schedule/calendar`, `/schedule/calendar/[view]` aliases | `app/(app)/(site)/schedule/**` | VERIFIED-PARITY | Buffer URL-shape aliases → /launches (de6ca24f) |
| `/analytics` (Insights) | `app/(app)/(site)/analytics/page.tsx` → `platform-analytics/platform.analytics.tsx` | VERIFIED-PARITY | Measured vs buffer-insights-1440/390 + structure JSON |
| `/agents` → redirect `/agents/new` | `app/(app)/(site)/agents/page.tsx` | POSTIZ-ONLY-KEEP | No Buffer counterpart |
| `/agents/[id]` (AI agent chat) | `agents/agent.tsx` + `agents/agent.chat.tsx` | POSTIZ-ONLY-KEEP | Restyled to token system (de7f7dc3) |
| `/media` (Media library) | `app/(app)/(site)/media/page.tsx` → `new-layout/layout.media.component.tsx` | POSTIZ-ONLY-KEEP | Buffer has no media library page; chrome tokenized (de7f7dc3) |
| `/settings` | `app/(app)/(site)/settings/page.tsx` → `layout/settings.component.tsx` (SettingsPopup) | VERIFIED-PARITY | Rail + content measured vs buffer-settings-structure.json |
| `/third-party` (Integrations catalog) | `third-parties/third-party.component.tsx` | POSTIZ-ONLY-KEEP | No Buffer analog; fully tokenized in fleet (de7f7dc3) |
| `/plugs` | `plugs/plugs.tsx` | POSTIZ-ONLY-KEEP | Postiz automation plugs; no Buffer analog |
| `/billing`, `/billing/lifetime` | `billing/billing.component.tsx`, `billing/lifetime.deal.tsx` | N/A-INTERNAL | Billing disabled on the internal SSO instance; capability preserved |
| `/admin/errors`, `/admin/stats` | `admin/admin-errors.component.tsx`, `admin/admin-stats.component.tsx` | N/A-INTERNAL | Superadmin-only; restyled/skeletonized (bbe94a8c) |
| `/err` | `app/(app)/(site)/err/page.tsx` | N/A-INTERNAL | Error landing |
| `/auth/login` (+ `login-required`, `activate/[code]`, `forgot`, `forgot/[token]`) | `components/auth/**` | N/A-INTERNAL | Google SSO/OIDC only; registration disabled |
| `/oauth/authorize` | `app/(app)/oauth/authorize/page.tsx` | N/A-INTERNAL | Public-API OAuth consent; spinner tokenized (fc0f3cdf) |
| `/integrations/social/[provider]` | `launches/continue.integration.tsx` | N/A-INTERNAL | OAuth continue/redirect leg; spinner tokenized (fc0f3cdf) |
| `/p/[id]` public post preview | `app/(app)/(preview)/p/[id]` → `preview/preview.wrapper.tsx` | NEEDS-WORK | Shareable page still carries legacy tokens (`preview/comments.components.tsx`); restyle to token system |
| `(extension)/modal/[style]/[platform]` | `standalone-modal/standalone.modal.tsx`, `launches/layout.standalone.tsx` | POSTIZ-ONLY-KEEP | Chrome-extension composer host |
| `(provider)/provider`, `/provider/add`, `/provider/[p]` | `app/(app)/(provider)/**` | N/A-INTERNAL | Standalone provider-add flow |
| `/api/uploads/[[...path]]` | `app/(app)/api/uploads` | N/A-INTERNAL | Media proxy route |

## 2. App chrome & shell

| Surface | Component/file | Status | Notes |
|---|---|---|---|
| Desktop canvas + page card (cream #f7f6f3, white card, 8px margins, hairline border, flush to sidebar) | `new-layout/layout.component.tsx`, `app/colors.scss` | VERIFIED-PARITY | Measured r1; warm neutrals retune landed (beb4c215, de7f7dc3) |
| Warm token set (ink #292928, muted #5a5a59, washes #f4f3f0, grid #dddcd9, chip hairline warm 12%) | `app/colors.scss`, `tailwind.config.cjs` | VERIFIED-PARITY | Measured tokens (de7f7dc3) |
| Fonts: Inter 14 body, Plus Jakarta Sans display 20/400 titles | `tailwind.config.cjs` | VERIFIED-PARITY | Display face switched to Stolzl-alike PJS (de7f7dc3) |
| Generic 64px title bar (excluded on all self-headed routes) | `new-layout/layout.component.tsx` | VERIFIED-PARITY | Exclusion list extended in fleet |
| Route loading boundary (instant skeleton on nav) | `app/(app)/(site)/loading.tsx`, `layout/skeleton.tsx` | VERIFIED-PARITY | 77447af9 + bbe94a8c sweep |
| Phone app bar (56px on cream canvas, ☰40 w/ green dot, wordmark, streak) | `new-layout/layout.component.tsx` | VERIFIED-PARITY | Measured 390 r1 |
| Phone in-flow push-down drawer (no overlay, no drawer logo row) | `new-layout/layout.component.tsx` + `sidebar.tsx` | VERIFIED-PARITY | 5ad34c8e, 4ec118d6 |
| Phone content card full-bleed geometry | `new-layout/layout.component.tsx` | VERIFIED-PARITY | Gap fixed in wave 2/3 |
| Tablet auto-rail (sidebar → 52px icon rail at 768–1100, session expand override) | `new-layout/sidebar.tsx` | VERIFIED-PARITY | ada738e4, Buffer measured at 834 |
| Tablet nav squash / mobile list clip fixes | `new-layout/layout.component.tsx` | VERIFIED-PARITY | 82232d1c flex min-content |
| Admin/impersonation bottom-center pill + popover (no top strip) | `layout/impersonate.tsx` | VERIFIED-PARITY | beb4c215; coupon panel spinner fc0f3cdf |
| Support "?" bubble (36px, #def0ff, bottom-right) | `layout/support.tsx` | VERIFIED-PARITY | Matches measured Buffer helpcenter bubble |
| Chatbase embed launcher (position/theme vs Buffer bubble) | `layout/chatbase.component.tsx` | NEEDS-WORK | Third-party widget still renders its own dark bottom-left circle when enabled; needs CSS override or dashboard config to match the support-bubble slot |
| Announcement banner / top tip | `layout/announcement.banner.tsx`, `layout/top.tip.tsx` | POSTIZ-ONLY-KEEP | Admin-pushed announcements; shown in preview wrapper + layout |
| Dark/light mode switch | `layout/mode.component.tsx` | POSTIZ-ONLY-KEEP | Dark theme mirrors with white-alpha hairlines per spec |
| Language selector | `layout/language.component.tsx` | POSTIZ-ONLY-KEEP | i18n picker |
| RTL direction handling | `new-layout/change.dir.tsx`, `change.dir.client.tsx` | POSTIZ-ONLY-KEEP | Logical properties already used throughout |
| Toaster (toast notifications) | `libraries/react-shared-libraries/src/toaster/toaster.tsx` | NEEDS-BUFFER-MEASUREMENT | Trigger any Buffer action (e.g. save a draft): measure toast position (corner/center), surface (bg, radius, shadow), type size, icon, duration, dismiss affordance |
| Tooltips (react-tooltip surface) | app-wide `data-tooltip-id="tooltip"` | NEEDS-BUFFER-MEASUREMENT | Hover Buffer toolbar buttons: tooltip bg (dark vs white), radius, padding, font size/weight, arrow presence, delay |
| Generic modal wrapper (Mantine) | `layout/new-modal.tsx`, `new-launch/modal.wrapper.component.tsx` | NEEDS-BUFFER-MEASUREMENT | Open Buffer dialogs: backdrop color/opacity, modal radius/shadow, close-X geometry (size, position, hover), title row spacing |
| Confirm/destructive dialog (delete post, close composer) | `libraries/react-shared-libraries/src/helpers/delete.dialog.tsx` | NEEDS-BUFFER-MEASUREMENT | Delete a Buffer post: confirm dialog width, title/body type, red button geometry (h, radius, fill #), cancel style, button order |
| Modal primitives (body/footer/close button) | `cuesoft/modal/modal-body.tsx`, `modal-footer.tsx`, `modal-close-button.tsx` | VERIFIED-PARITY | Follows measured dialog specs (r12/p12 dialogs) |
| Dropdown/popover surface (r12, layered shadow stack, 32px rows) | `cuesoft/dropdown/dropdown-panel.tsx`, `use-dropdown.ts` | VERIFIED-PARITY | Measured shadow stack applied |
| Drag-and-drop file overlay | `layout/drop.files.tsx` | POSTIZ-ONLY-KEEP | Whole-window drop target for uploads |
| Payment/subscription watchers | `layout/check.payment.tsx`, `layout/new.subscription.tsx`, `new-layout/billing.after.tsx` | N/A-INTERNAL | Billing plumbing; spinners tokenized (bbe94a8c) |
| Analytics/marketing scripts | `layout/gtm.component.tsx`, `facebook.component.tsx`, `dubAnalytics.tsx`, `helpers/posthog.tsx` | N/A-INTERNAL | Script loaders |
| Sentry + feedback | `layout/sentry.component.tsx`, `new-layout/sentry.feedback.component.tsx` | N/A-INTERNAL | Error reporting |
| Context/util plumbing | `layout/user.context.tsx`, `layout.context.tsx`, `set.timezone.tsx`, `redirect.tsx`, `pre-condition.component.tsx`, `html.component.tsx`, `click.outside.tsx`, `title.tsx` | N/A-INTERNAL | No visual surface of their own |
| Chrome extension nudge | `layout/chrome.extension.component.tsx` | POSTIZ-ONLY-KEEP | Extension install affordance |

## 3. Sidebar (desktop + rail)

| Surface | Component/file | Status | Notes |
|---|---|---|---|
| Sidebar container (240px, flat on canvas, 208px rows, 16px side padding) | `new-layout/sidebar.tsx` | VERIFIED-PARITY | Measured r1 |
| Logo row: cuesoft wordmark lockup (Fustat) + mark | `new-layout/sidebar.tsx`, `new-layout/logo.tsx` | VERIFIED-PARITY | ade482ee |
| Streak indicator (outline sprout + lavender count badge) | `layout/streak.component.tsx` | VERIFIED-PARITY | Badge anatomy matches measured #e2d8ff/16px |
| Streak click behavior (what the plant opens) | `layout/streak.component.tsx` | NEEDS-BUFFER-MEASUREMENT | Click Buffer's plant icon: does it open a popover/page? Measure the panel (size, content: streak days, calendar strip, copy) |
| "+ New" pill (208×40, rounded-full, lime + black ink) | `new-layout/sidebar.tsx` | VERIFIED-PARITY | Geometry corrected in wave 2 |
| "+ New" menu popover (New Post / channels / settings entries) | `new-layout/sidebar.tsx` + `dropdown-panel.tsx` | VERIFIED-PARITY | Panel surface retuned to r12 + shadow stack |
| Nav rows (32px, r8, 16px icons, 4px gap) + trailing badge slot | `new-layout/sidebar.tsx` NavRow | VERIFIED-PARITY | Rhythm + badge slot landed |
| Publish scheduled-count badge (muted right-aligned) | `new-layout/sidebar.tsx` (sidebar-scheduled-counts SWR) | VERIFIED-PARITY | Sums /posts/list scheduled |
| Utility rows demoted below hairline (Plugs, Integrations, Settings) | `new-layout/sidebar.tsx` | VERIFIED-PARITY | Utilities-in-footer move (87488ff3) |
| "Channels" section header + hover-revealed search/gear | `new-layout/sidebar.tsx` | VERIFIED-PARITY | Hover pattern per Buffer DOM |
| Channel rows (avatar 32 + platform badge, name, resting scheduled count, hover kebab) | `new-layout/sidebar.tsx` + `new-layout/channel-row.tsx` | VERIFIED-PARITY | Count at rest, kebab on hover |
| Per-channel queue views (channel row opens its own queue) | `new-layout/sidebar.tsx` → `/launches?channel=` | VERIFIED-PARITY | a3311c74; additive nav behavior |
| Connect-more quick icons (unconnected-only, 24px full-bleed tiles, + button) | `new-layout/sidebar.tsx` | VERIFIED-PARITY | Filtered to unconnected, cap 3 |
| "Locked channels · N ›" expander | `new-layout/sidebar.tsx` | VERIFIED-PARITY | Billing-gated; hidden when N=0 |
| Channels-limit upsell card (progress dashes, Upgrade for More) | `new-layout/sidebar.tsx` | VERIFIED-PARITY | FREE-tier gated, dismissable |
| Org footer row (logo 32, org name + plan, collapse control) | `new-layout/sidebar.tsx` | VERIFIED-PARITY | panel-left-close/open glyphs split |
| Org switcher popover (click org footer) | `layout/organization.selector.tsx` | NEEDS-WORK | Mixed legacy tokens; restyle to panel surface. Also measure Buffer's org menu if one exists (see §Measure) |
| Collapse rail (52px icon rail, expand control) | `new-layout/sidebar.tsx` | VERIFIED-PARITY | b82cb93a + ada738e4 |
| Notifications bell + dropdown (in sidebar utilities) | `notifications/notification.component.tsx` | NEEDS-WORK | Bell placement fine (Postiz-only feature) but dropdown panel still mixes legacy tokens (`bg-sixth`-family); restyle rows to 32px/r6 menu spec |
| Menu item primitive | `new-layout/menu-item.tsx` | VERIFIED-PARITY | Shared row styling |
| Side panel primitives (224px calibrated width, headers, collapse) | `new-layout/side-panel.ts`, `side-panel-header.tsx` | VERIFIED-PARITY | Used by launches/plugs/analytics/third-party/agents |
| Mobile integration row variant | `new-layout/mobile.integration.tsx` | VERIFIED-PARITY | Phone drawer channel rows |

## 4. Publish — page header & toolbar

| Surface | Component/file | Status | Notes |
|---|---|---|---|
| Page header row (40×40 r10 icon chip, 20/400 display title, bookmark, right cluster) | `launches/filters.tsx` PageHeader | VERIFIED-PARITY | Rhythm 25/48/33/8/48 (de7f7dc3) |
| Bookmark "Save current view" click behavior | `launches/filters.tsx` | NEEDS-BUFFER-MEASUREMENT | Click Buffer's bookmark icon: what opens (save-view dialog? named views list?), panel geometry + fields |
| Feedback bubble button (header right) | `launches/filters.tsx` | NEEDS-BUFFER-MEASUREMENT | Click Buffer's comment/feedback icon in the header: what surface opens (feedback form? beacon?), size + fields |
| List/Calendar segmented control (white, hairline, 32px, 4px pad, 32% green active tint) | `launches/filters.tsx` | VERIFIED-PARITY | Tint + container corrected |
| "+ New Post" primary button | `launches/filters.tsx` | VERIFIED-PARITY | Lime + black ink brand slot |
| Calendar toolbar left group (‹ › adjacent 32×32, H2 16/500, Today chip, view combobox) | `launches/filters.tsx` | VERIFIED-PARITY | Measured order/geometry |
| Week-view H2 shows "August 2026" (not a date range) | `launches/filters.tsx` getDisplayText | VERIFIED-PARITY | Gap fix landed |
| View combobox menu (Week/Month only at desktop, check-left rows) | `launches/filters.tsx` | VERIFIED-PARITY | 200px r6 p8 panel |
| Channels filter dropdown (380 r12: search, Select all, 48px avatar+checkbox rows) | `launches/filters.tsx` | VERIFIED-PARITY | f67b9c9b + r1 measurements |
| All Posts select (All/Drafts/Scheduled/Sent, check-left) | `launches/filters.tsx` | VERIFIED-PARITY | aa2ce4bc |
| Tags filter dialog (256 r12: Untagged, colored pill rows, Clear all + Settings footer) | `launches/filters.tsx` | VERIFIED-PARITY | aa2ce4bc |
| No Date toggle + Undated drafts right panel (~300px, empty state) | `launches/filters.tsx` UndatedDraftsPanel | VERIFIED-PARITY | de6ca24f |
| Timezone dialog (315 r12, "City (GMT+X)" rows, pinned current) | `launches/filters.tsx` | VERIFIED-PARITY | Display-timezone read path (aa2ce4bc) |
| Filter trigger buttons (32px, transparent, full ink, 16px icons/chevrons) | `launches/filters.tsx` | VERIFIED-PARITY | Metrics converged |
| List tabs (Queue · Drafts · Approvals⚡ · Sent, count pills, ink underline on hairline track, 45px on rule) | `launches/filters.tsx` | VERIFIED-PARITY | de6ca24f + 03770f12; Approvals real since bbe94a8c |
| Per-tab count fetch (4 parallel state counts) | `launches/filters.tsx` + `calendar.context.tsx` | VERIFIED-PARITY | Includes approvals tag count |
| Phone toolbar (single row: ‹ › title, funnel, icon-only segmented) | `launches/filters.tsx` | VERIFIED-PARITY | 139cca46 |
| Phone filter bottom sheet (drag handle, scrim, drill-in rows) | `launches/filters.tsx` | VERIFIED-PARITY | Measured vs buffer-phone-filtersheet.png |
| Phone green icon-only "+" (40 r8) | `launches/filters.tsx` | VERIFIED-PARITY | 139cca46 |
| Last-view restore (list/month/week cookie) | `launches/filters.tsx` | VERIFIED-PARITY | 82563526; month default (87488ff3) |

## 5. Calendar — Month view

| Surface | Component/file | Status | Notes |
|---|---|---|---|
| Month grid (Sunday-first, uniform ~205px rows growing in flow, outer hairline, square corners) | `launches/calendar.tsx` MonthView | VERIFIED-PARITY | In-flow growth + Chrome minmax fix (de7f7dc3) |
| Weekday header row (36px white, hairline, /70 ink) | `launches/calendar.tsx` | VERIFIED-PARITY | Two-tone → white retune |
| Cell wash model (weekend/other-month/past washed; today/future white; wash month-only) | `launches/calendar.tsx` + `global.scss` | VERIFIED-PARITY | Hatching removed; flat #f4f3f0-family |
| Today marker (day number in 24px lime circle, black ink) | `launches/calendar.tsx` | VERIFIED-PARITY | Brand map of Buffer's green circle |
| Day-number three-tone ink hierarchy | `launches/calendar.tsx` | VERIFIED-PARITY | current/past/other tones |
| Month post pills (h33 r8 p4: 20px brand chip · h:mm A 13px ink · 23px r6 thumb, 8px insets) | `launches/calendar.tsx` CalendarItem | VERIFIED-PARITY | de7f7dc3 chips pass |
| Pill media thumbnails (backend `image` field) | `launches/calendar.tsx` + backend posts payload | NEEDS-WORK | Code landed (aa2ce4bc) but live deploy predates the field — verify thumbnails render after next deploy (month/week/list all gated on this) |
| Past pills never grayscale | `launches/calendar.tsx` | VERIFIED-PARITY | !grayscale removed |
| "N More" expander / "Show less" (16px chevron, 14/500 ink, left-aligned) | `launches/calendar.tsx` | VERIFIED-PARITY | Glyph + collapse retreated |
| Per-day "+" button (bordered, top-right of cell, wires existing day-click composer) | `launches/calendar.tsx` | VERIFIED-PARITY | de7f7dc3 hover + square |
| Empty-slot "+" hover ghost styling | `launches/calendar.tsx` + `global.scss` | NEEDS-BUFFER-MEASUREMENT | Hover an empty Buffer month/week slot: capture the affordance (ghost + size, fill, border, icon color) — r1 flagged "verify against a fresh capture" |
| Month fetch range includes leading/trailing grid days | `launches/calendar.context.tsx` | VERIFIED-PARITY | Visible-grid range query |
| Month auto-scroll to today's week + auto-scroll guard | `launches/calendar.tsx` | VERIFIED-PARITY | de7f7dc3 + 82563526 |
| Drag-and-drop reschedule (pill drag ghost, drop target, past-drop block) | `launches/helpers/dnd.provider.tsx`, `calendar.tsx` | NEEDS-BUFFER-MEASUREMENT | Drag a Buffer pill: measure drag ghost opacity/shadow, target-cell highlight, invalid-drop feedback |
| Duplicate post via drag/option | `launches/calendar.tsx` (existing logic) | POSTIZ-ONLY-KEEP | Capability preserved |
| Time format: always h:mm A in pills (no 24h locale gate) | `launches/calendar.tsx` | VERIFIED-PARITY | isUSCitizen gate dropped for pills |

## 6. Calendar — Week view

| Surface | Component/file | Status | Notes |
|---|---|---|---|
| Week grid (7 equal cols, no rail column, ~106px/hr rows, hairlines) | `launches/calendar.tsx` WeekView | VERIFIED-PARITY | Measured r1 |
| Hour labels (overlay col 1, every 2h, "h A" 12/500 grey) | `launches/calendar.tsx` | VERIFIED-PARITY | Converter fixed |
| Day headers ("Sunday 9" one line, 36px white; today green ink + 2px underline) | `launches/calendar.tsx` | VERIFIED-PARITY | Measured r1 |
| Past-hour flat grey wash (week stays white otherwise) | `launches/calendar.tsx` + `global.scss` | VERIFIED-PARITY | Wash month-only+past-only rule (de7f7dc3) |
| Auto-scroll to now on open | `launches/calendar.tsx` | VERIFIED-PARITY | Guard added 82563526 |
| Week cards (natural height, r10 p10: 16px chip + h:mm A 14/500, 2-line 13px snippet, 44px thumb side-by-side) | `launches/calendar.tsx` CalendarItem | VERIFIED-PARITY | de7f7dc3 |
| Week card thumbnails | backend `image` field | NEEDS-WORK | Same deploy gate as month pills |
| Sunday-first week ranges everywhere (context + filters) | `launches/calendar.context.tsx` | VERIFIED-PARITY | isoWeek → week |

## 7. Calendar — Day view & phone

| Surface | Component/file | Status | Notes |
|---|---|---|---|
| Phone 3-day rolling hour grid (~80px rows, 48px gutter, "Mon 10" headers) | `launches/calendar.tsx` DayView/WeekView machinery | VERIFIED-PARITY | Measured vs buffer-month-phone390.png |
| Desktop Day view (kept, not in the desktop combobox) | `launches/calendar.tsx` DayView | POSTIZ-ONLY-KEEP | Buffer desktop has Week/Month only; Day retained for phone + alias routes |
| Phone full-bleed calendar card | `launches/calendar.tsx` + layout | VERIFIED-PARITY | r1 phone pass |

## 8. Publish — List/Queue view

| Surface | Component/file | Status | Notes |
|---|---|---|---|
| Day group headers ("Tomorrow, August 11" 16px two-tone, 600 weekday) | `launches/calendar.tsx` ListView | VERIFIED-PARITY | Measured r1 |
| Time rail outside cards (h:mm A 14/500 ink + ⚓ Custom 12 muted) | `launches/calendar.tsx` | VERIFIED-PARITY | 87488ff3 Buffer list cards |
| Post cards ≤700px (avatar+badge header, 15px body, see-more, media right, hairline footer) | `launches/calendar.tsx` | VERIFIED-PARITY | 87488ff3 |
| "see more" content expander | `launches/calendar.tsx` | VERIFIED-PARITY | line-clamp-3 + link |
| Card footer meta ("You created this…") + actions (Publish Now quiet button, pencil, kebab) | `launches/calendar.tsx` | VERIFIED-PARITY | Publish Now real (87488ff3, drafts too in bbe94a8c) |
| Kebab dropdown contents (per-card menu) | `launches/calendar.tsx` + dropdown | NEEDS-BUFFER-MEASUREMENT | Open Buffer's card kebab in Queue AND Sent: list the exact options (Edit, Duplicate, Move to Drafts, Copy link, Delete, Share again?), row order, destructive styling, panel geometry |
| Floating comment bubble outside card top-right (32px) | `launches/calendar.tsx` → comments | VERIFIED-PARITY | Wired to per-post comments |
| Queue card labeled actions dropdown | `launches/calendar.tsx` (d408ed50) | VERIFIED-PARITY | Buffer labeled-dropdown pattern |
| List empty states per tab (64px circle + heading + subline) | `launches/calendar.tsx` | VERIFIED-PARITY | Includes approvals convention copy |
| Approvals tab feed (drafts tagged `needs-approval`, read-only tag resolve) | `launches/calendar.context.tsx` (APPROVAL_TAG_NAME) | VERIFIED-PARITY | Approvals v1 (bbe94a8c); tab pill lavender ⚡ |
| Approve action (draft → schedule behind confirm) | `launches/calendar.tsx` + `PUT /posts/:id/status` | POSTIZ-ONLY-KEEP | Buffer approvals are team-plan; ours is the tag convention — keep |
| Request-changes action (opens post comments) | `launches/calendar.tsx` | POSTIZ-ONLY-KEEP | Approvals v1 |
| Publish Now on drafts (date→now + status→schedule, confirm) | `launches/calendar.tsx` | VERIFIED-PARITY | bbe94a8c; mirrors Buffer "Publish Now" semantics |
| Pager hidden when totalPages ≤ 1 | `launches/calendar.tsx` | VERIFIED-PARITY | Per addendum |
| Page-level scroll (no nested scroll container) | `launches/calendar.tsx` | VERIFIED-PARITY | Wrapper dropped |
| Post preview modal (existing post quick view) | `launches/general.preview.component.tsx` | NEEDS-WORK | Still legacy-token styled (4 old / 0 new tokens); restyle to card/dialog spec |
| Post statistics modal (clicks/short-link stats) | `launches/statistics.tsx`, `calendar.tsx` Statistics | NEEDS-WORK | Mixed legacy tokens; also see §Measure row for Buffer sent-post stats strip |
| Sent-post per-card stats (Buffer Sent tab shows metrics under cards) | — (no equivalent yet) | NEEDS-BUFFER-MEASUREMENT | Open Buffer List → Sent: measure the stats strip on sent cards (metrics shown, icon+number style, divider) — decide mapping to our /analytics/post/:id data |
| Delete post flow | `launches/calendar.tsx` DeletePost | VERIFIED-PARITY | Behind confirm dialog (surface itself → §Measure generic dialog) |
| Set selection modal (apply a Set from calendar) | `launches/calendar.tsx` SetSelectionModal | POSTIZ-ONLY-KEEP | Sets are Postiz-only |
| Missing-release modal | `launches/missing-release.modal.tsx` | NEEDS-WORK | 2 legacy tokens; small restyle |
| Creation-method badge (API/AI-created marker on cards) | `launches/creation.method.badge.tsx` | POSTIZ-ONLY-KEEP | No Buffer counterpart |
| Merge/separate post helpers | `launches/merge.post.tsx`, `separate.post.tsx` | POSTIZ-ONLY-KEEP | Editing plumbing |

## 9. Composer (Create Post) — chrome

The composer was restyled in the first dark-theme pass (f3c25aa4) and made phone
full-width (02e62616), but it was NOT covered by the round-1 light-theme measurement
pass. Everything below marked measure = one composer session on Buffer (light, 1440 +
390) with computed styles.

| Surface | Component/file | Status | Notes |
|---|---|---|---|
| Composer entry (store hydration, existing-data load, sets/onlyValues) | `new-launch/add.edit.modal.tsx` | N/A-INTERNAL | Logic only |
| Modal shell (near-full-bleed, bg, radius, padding, backdrop) | `new-launch/manage.modal.tsx` | NEEDS-BUFFER-MEASUREMENT | Measure Buffer Create Post modal: outer size vs viewport, radius, bg, backdrop opacity, inner padding |
| Header row ("Create Post" title, Tags chip, right cluster: Templates?, AI Assistant, Preview toggle, expand, X) | `new-launch/manage.modal.tsx` | NEEDS-BUFFER-MEASUREMENT | Measure title size/weight, each header button (h, radius, icon size, label 14/500?), Preview active pill tint, control order |
| Channel avatar selector row (avatars 40 + badges, `+` tile, selected ring) | `new-launch/select.current.tsx`, `picks.socials.component.tsx` | NEEDS-BUFFER-MEASUREMENT | Measure avatar size/gap, selected state (ring? tint?), the `+` tile, disabled state, overflow behavior |
| Per-network customize tab strip (when customizing per channel) | `new-launch/select.current.tsx` + store | NEEDS-BUFFER-MEASUREMENT | In Buffer click "Customize for each network": tab strip anatomy (icon chips? underline?), per-network panel transitions |
| Global vs per-channel editor split ("Customize for each network" flow) | `new-launch/store.ts` + `manage.modal.tsx` | VERIFIED-PARITY | Functional parity (Postiz global/internal values model preserved) |
| Editor area (tiptap: placeholder, 15px body, min height) | `new-launch/editor.tsx` | NEEDS-BUFFER-MEASUREMENT | Measure "Start writing…" placeholder color/size, body line-height, editor padding, focused state |
| Editor icon row (+ media, emoji, # tags position bottom-left) | `new-launch/editor.tsx` | NEEDS-BUFFER-MEASUREMENT | Measure icon row: order, 16px?, spacing, hover fills |
| Media drag-drop zone (dashed, r8) | `new-launch/editor.tsx` + `media/media.component.tsx` MultiMediaComponent | NEEDS-BUFFER-MEASUREMENT | Measure Buffer's media zone: dashed border color/width, min height, icon + copy, drag-over state |
| Attached-media thumbnails strip in editor | `media/media.component.tsx` MultiMediaComponent | NEEDS-BUFFER-MEASUREMENT | Measure thumb size/radius, remove-X, reorder affordance, video badge |
| Bold / Underline text-style buttons (unicode styling) | `new-launch/bold.text.tsx`, `u.text.tsx` | POSTIZ-ONLY-KEEP | Unicode-trick styling; Buffer has none |
| Emoji picker | `new-launch/editor.tsx` (emoji-picker-react) | POSTIZ-ONLY-KEEP | Third-party picker themed by mode |
| Signature box (choose/insert signature) | `components/signature.tsx` SignatureBox | POSTIZ-ONLY-KEEP | Signatures are Postiz-only |
| @-Mention suggestion dropdown (per-platform mentions) | `new-launch/mention.component.tsx` | VERIFIED-PARITY | Tokenized + skeletons (fc0f3cdf); Postiz-only capability |
| AI Assistant (Copilot textarea/completions in editor) | `new-launch/editor.tsx` + CopilotKit | POSTIZ-ONLY-KEEP | Buffer's AI Assistant differs; ours preserved |
| AI image generation modal | `launches/ai.image.tsx` | NEEDS-WORK | 1 legacy token, pre-kit styling; restyle dialog to spec |
| AI video generation (modal + provider select) | `launches/ai.video.tsx`, `videos/video.wrapper.tsx`, `video.render.component.tsx`, `video.context.wrapper.tsx` | POSTIZ-ONLY-KEEP | No Buffer counterpart; check tokens during next sweep |
| AI video providers (Veo3, image-text-slides) | `videos/providers/veo3.provider.tsx`, `image-text-slides.provider.tsx` | POSTIZ-ONLY-KEEP | Provider forms |
| Post generator (AI generate posts from prompt/URL) | `launches/generator/generator.tsx` | POSTIZ-ONLY-KEEP | Postiz-only |
| Thread finisher (add-another-post in thread) | `new-launch/finisher/thread.finisher.tsx` | POSTIZ-ONLY-KEEP | Threads/multi-post trains |
| Add post button (thread segment add) | `new-launch/add.post.button.tsx` | POSTIZ-ONLY-KEEP | Thread segments |
| Delay-between-posts control | `new-launch/delay.component.tsx` | POSTIZ-ONLY-KEEP | Tokenized |
| Tags picker in composer (create/select tags) | `launches/tags.component.tsx` | VERIFIED-PARITY | Tokenized; tag colors → §Measure tags manager |
| Tags manager (create/edit tag: name + color swatches) | `launches/tags.component.tsx` TagsComponentInner | NEEDS-BUFFER-MEASUREMENT | Open Buffer Tags settings/new tag: dialog geometry, name input, color swatch grid (swatch size, palette, selected ring), save/cancel row |
| Date/time picker (schedule field) | `launches/helpers/date.picker.tsx` | NEEDS-BUFFER-MEASUREMENT | Open Buffer's schedule picker: mini-calendar geometry (cell size, today/selected states), time field, timezone hint |
| "Next Available"-style schedule dropdown / footer split | `new-launch/manage.modal.tsx` footer | NEEDS-BUFFER-MEASUREMENT | Measure Buffer footer: Create Another checkbox, "🕒 Next Available ▾" quiet button + its menu options (Custom time / Share Now / Share Next?), primary CTA (h44? r8) |
| Footer actions: Save as Draft / Add to calendar / Schedule / Update / Post Now | `new-launch/manage.modal.tsx` | VERIFIED-PARITY | All Postiz semantics preserved; geometry re-check rides the footer measurement above |
| Repeat/recurring post control | `launches/repeat.component.tsx` | POSTIZ-ONLY-KEEP | intervalInDays; no Buffer analog |
| Customer selector (agency per-customer posting) | `launches/select.customer.tsx`, `customer.modal.tsx` | POSTIZ-ONLY-KEEP | Explicitly keep |
| Post-URL selector (link a repo/release URL) | `post-url-selector/post.url.selector.tsx` | POSTIZ-ONLY-KEEP | Postiz-only |
| Web3 posting providers (Telegram/Nostr/Warpcast/Moltbook connect dialogs) | `launches/web3/**` | POSTIZ-ONLY-KEEP | Explicitly keep; wrapcaster spinner tokenized (fc0f3cdf) |
| Right "Post Previews" panel (420px: header, per-network preview, hints) | `new-launch/manage.modal.tsx` + `provider-preview/preview.provider.component.tsx` | NEEDS-BUFFER-MEASUREMENT | Measure Buffer preview rail: width, "Post Previews" type, network switcher, preview card chrome (device frame? plain card?), skeleton |
| Per-network preview renderers | `new-launch/providers/*/…preview…`, `provider-preview/**` | POSTIZ-ONLY-KEEP | Platform-accurate previews; keep all |
| Composer comments (per-post comment thread) | `launches/comments/comment.component.tsx` | VERIFIED-PARITY | Rewired to per-post endpoints + restyled (de7f7dc3); quiet bordered Add-comment (ac9b7c33) |
| Buffer comments UI reference | — | NEEDS-BUFFER-MEASUREMENT | Open a Buffer post's comment thread: panel placement (side? below?), avatar row, input geometry, timestamp style — confirm our dialog matches the pattern |
| Phone composer (editor owns full width; preview hidden) | `new-launch/manage.modal.tsx` | VERIFIED-PARITY | 02e62616 |
| Buffer phone composer reference | — | NEEDS-BUFFER-MEASUREMENT | Open Create Post at 390 on Buffer: full-screen? header/footer stacking, channel row behavior, preview access |
| Close-with-unsaved-changes confirm | `new-launch/manage.modal.tsx` | VERIFIED-PARITY | Confirm dialog flow kept |
| Editor helpers (headings, bullets, links) | `new-launch/heading.component.tsx`, `bullets.component.tsx`, `a.component.tsx` | POSTIZ-ONLY-KEEP | Long-form platforms (dev.to/Hashnode/WordPress) |
| Dummy code block (API-created posts) | `new-launch/dummy.code.component.tsx` | POSTIZ-ONLY-KEEP | Debug/code display |
| Set creation from composer (addEditSets) | `new-launch/manage.modal.tsx` + `sets/sets.tsx` | POSTIZ-ONLY-KEEP | Sets pipeline |
| Information/help popover in composer | `launches/information.component.tsx` | POSTIZ-ONLY-KEEP | Contextual help |
| Composer settings modal (per-channel Settings title row) | `launches/settings.modal.tsx` | POSTIZ-ONLY-KEEP | Wraps provider settings |
| Provider settings shared form styling (inputs/selects inside per-network tabs) | `new-launch/providers/high.order.provider.tsx` | NEEDS-BUFFER-MEASUREMENT | In Buffer per-network customize: measure any per-channel fields (Instagram first comment, Pinterest board/title, YouTube title) — input geometry, labels, helper text — as the style reference for our provider forms |

## 10. Composer — per-platform settings (all POSTIZ-ONLY-KEEP: functionality has no 1:1 Buffer counterpart; styling follows the shared form spec)

| Surface | Component/file | Status | Notes |
|---|---|---|---|
| X settings (+ premium/community options) | `new-launch/providers/x/` | POSTIZ-ONLY-KEEP | |
| LinkedIn + LinkedIn Page settings | `new-launch/providers/linkedin/` | POSTIZ-ONLY-KEEP | Shared component |
| Instagram (+ standalone) settings — collaborators, post type | `new-launch/providers/instagram/` | POSTIZ-ONLY-KEEP | Audio picker skeleton tokenized (fc0f3cdf) |
| Facebook settings | `new-launch/providers/facebook/` | POSTIZ-ONLY-KEEP | |
| YouTube settings (title, thumbnail, type) | `new-launch/providers/youtube/` | POSTIZ-ONLY-KEEP | |
| TikTok settings (privacy, duet/stitch, **auto-add music**, disclosure) | `new-launch/providers/tiktok/tiktok.provider.tsx` | POSTIZ-ONLY-KEEP | TikTok music explicitly kept |
| Pinterest settings (board, title, link) | `new-launch/providers/pinterest/` | POSTIZ-ONLY-KEEP | |
| Threads settings | `new-launch/providers/threads/` | POSTIZ-ONLY-KEEP | |
| Bluesky settings | `new-launch/providers/bluesky/` | POSTIZ-ONLY-KEEP | |
| Mastodon settings | `new-launch/providers/mastodon/` | POSTIZ-ONLY-KEEP | |
| Reddit settings (subreddit picker, flair) | `new-launch/providers/reddit/` | POSTIZ-ONLY-KEEP | Has a legacy token remnant; sweep later |
| Discord settings (channel select) | `new-launch/providers/discord/` | POSTIZ-ONLY-KEEP | |
| Slack settings (channel select) | `new-launch/providers/slack/` | POSTIZ-ONLY-KEEP | |
| Telegram settings | `new-launch/providers/telegram/` | POSTIZ-ONLY-KEEP | |
| Dev.to settings (front matter, fonts) | `new-launch/providers/devto/` | POSTIZ-ONLY-KEEP | |
| Hashnode settings | `new-launch/providers/hashnode/` | POSTIZ-ONLY-KEEP | |
| Medium settings | `new-launch/providers/medium/` | POSTIZ-ONLY-KEEP | |
| WordPress settings | `new-launch/providers/wordpress/` | POSTIZ-ONLY-KEEP | |
| Listmonk settings (newsletter) | `new-launch/providers/listmonk/` | POSTIZ-ONLY-KEEP | |
| GMB (Google Business) settings + continue flow | `new-launch/providers/gmb/`, `continue-provider/gmb/` | POSTIZ-ONLY-KEEP | |
| Dribbble settings | `new-launch/providers/dribbble/` | POSTIZ-ONLY-KEEP | |
| Kick settings | `new-launch/providers/kick/` | POSTIZ-ONLY-KEEP | |
| Twitch settings | `new-launch/providers/twitch/` | POSTIZ-ONLY-KEEP | |
| Lemmy settings | `new-launch/providers/lemmy/` | POSTIZ-ONLY-KEEP | |
| Warpcast settings | `new-launch/providers/warpcast/` | POSTIZ-ONLY-KEEP | |
| Nostr settings | `new-launch/providers/nostr/` | POSTIZ-ONLY-KEEP | |
| VK settings | `new-launch/providers/vk/` | POSTIZ-ONLY-KEEP | |
| MeWe settings | `new-launch/providers/mewe/` | POSTIZ-ONLY-KEEP | |
| Moltbook settings | `new-launch/providers/moltbook/` | POSTIZ-ONLY-KEEP | |
| Skool settings | `new-launch/providers/skool/` | POSTIZ-ONLY-KEEP | |
| Whop settings | `new-launch/providers/whop/` | POSTIZ-ONLY-KEEP | |
| Tumblr settings + continue flow | `new-launch/providers/tumblr/`, `continue-provider/tumblr/` | POSTIZ-ONLY-KEEP | |
| Continue-provider pickers (FB page, IG account, LinkedIn page, YT channel) | `new-launch/providers/continue-provider/**` | POSTIZ-ONLY-KEEP | Post-OAuth entity pickers; spinner tokenized (fc0f3cdf) |
| Show-all-providers registry / empty settings pane | `new-launch/providers/show.all.providers.tsx` | N/A-INTERNAL | Registry + Empty fallback |
| withProvider HOC (settings/preview wiring, validation focus) | `new-launch/providers/high.order.provider.tsx` | N/A-INTERNAL | Mechanism |

## 11. Channel management

| Surface | Component/file | Status | Notes |
|---|---|---|---|
| Manage-channels modal (Buffer channel cards, sub-lines, derived URL state) | `launches/launches.component.tsx` (`?manageChannels=1`) + launches panel components | VERIFIED-PARITY | 9b81699c: cards, platform+type sub-lines, gear+kebab; derived modal state survives RSC remount |
| Add-channel catalog (platform grid, API-key custom variables, URL modal) | `launches/add.provider.component.tsx` | NEEDS-BUFFER-MEASUREMENT | Open Buffer Settings→Channels→Connect Channel: measure the catalog (tile size, brand icon treatment, name+descriptor, connect CTA, search/groups) for our AddProviderComponent grid |
| Platform picker step (choose platform → variant) | `launches/helpers/pick.platform.component.tsx` | NEEDS-WORK | Mixed legacy tokens (2 old); restyle rows/tiles |
| Custom variables form (self-hosted API-key providers) | `launches/add.provider.component.tsx` CustomVariables | N/A-INTERNAL | Self-hosted-only fields |
| Channel refresh/reconnect (continue integration) | `launches/continue.integration.tsx` | VERIFIED-PARITY | Spinner tokenized (fc0f3cdf) |
| Bot picture setter (Telegram bot avatar) | `launches/bot.picture.tsx` | POSTIZ-ONLY-KEEP | |
| Internal channels selector (nostr/telegram-style internal lists) | `launches/internal.channels.tsx` | POSTIZ-ONLY-KEEP | |
| Posting-times editor (per-channel queue slots) | `launches/time.table.tsx` | NEEDS-BUFFER-MEASUREMENT | Open Buffer channel Settings→Posting Schedule: measure the day/time slot table (add-time control, per-day columns, time chips, toggle) — ours is tokenized but never compared |
| Channel groups (customers) management | `launches/launches.component.tsx` changeItemGroup + `customer.modal.tsx` | POSTIZ-ONLY-KEEP | Agency grouping; explicitly keep |
| Channel enable/disable + delete flows | launches panel menus (`launches/menu/menu.tsx`) | VERIFIED-PARITY | d408ed50 labeled dropdown |
| Integration redirect helper | `launches/integration.redirect.component.tsx` | N/A-INTERNAL | |
| Channel avatar primitive (badge overlay, presence) | `new-layout/channel-avatar.tsx` | VERIFIED-PARITY | Used sidebar/rows/dialogs |

## 12. Media library

| Surface | Component/file | Status | Notes |
|---|---|---|---|
| Page header (icon chip + "Media" + Upload primary top-right) | `media/media.component.tsx` + layout wrapper | VERIFIED-PARITY | S1 fleet fix (de7f7dc3) |
| Upload button (lime primary h32 r8) | `media/media.component.tsx` | VERIFIED-PARITY | Promoted per fleet |
| Uppy uploader (dashboard strip gated on activity, progress) | `media/new.uploader.tsx`, `media/media.component.tsx` | VERIFIED-PARITY | Idle dead-space fix |
| Media grid tiles (r8, hover-only filename chip, quiet maximize) | `media/media.component.tsx` | VERIFIED-PARITY | Fleet fixes |
| Search input (32px, capped width) | `media/media.component.tsx` | VERIFIED-PARITY | Fleet |
| Pagination (32×32 r8 pager, admin-pill clearance) | `media/media.component.tsx` Pagination | VERIFIED-PARITY | Fleet + S6 clearance |
| Empty state (64px circle + image icon) | `media/media.component.tsx` + `cuesoft/empty-state.tsx` | VERIFIED-PARITY | Violet illustration retired |
| Media picker modal (showMediaBox select-into-composer) | `media/media.component.tsx` MediaBox/ShowMediaBoxModal | VERIFIED-PARITY | Quiet variant kept in-picker |
| Insert-media toolbar (composer/agents attachment row) | `media/media.component.tsx` (b2 buttons) | VERIFIED-PARITY | 32px/r8 convergence (fleet) |
| AI image entry from media | `launches/ai.image.tsx` | NEEDS-WORK | Same dialog restyle as §9 row |
| Video generation from media (providers) | `videos/**` | POSTIZ-ONLY-KEEP | |
| Polonto design editor (Polotno canvas) | `launches/polonto.tsx`, `polonto/polonto.picture.generation.tsx` | POSTIZ-ONLY-KEEP | Third-party editor; theme wrapper only |
| Third-party media import (HeyGen video into library) | `third-parties/third-party.media-library.tsx`, `third-party.media.tsx`, `providers/heygen.provider.tsx` | POSTIZ-ONLY-KEEP | Spinner/skeleton tokenized (fc0f3cdf) |
| Agent media modal (insert media from chat) | `layout/agent.media.modal.tsx` | POSTIZ-ONLY-KEEP | |

## 13. Insights (/analytics)

| Surface | Component/file | Status | Notes |
|---|---|---|---|
| Page header (bar-chart chip + title; phone variant) | fleet header on `platform.analytics.tsx` | VERIFIED-PARITY | S1 |
| Channel rail (desktop side panel 224px) + phone chip strip | `platform.analytics.tsx` + `new-layout/channel-row.tsx` | VERIFIED-PARITY | Ghosting/geometry fixed (S5) |
| Date-range segmented (single hairline container, 24px segments, green-tint active) | `platform.analytics.tsx` | VERIFIED-PARITY | Fleet |
| Phone date-range trigger + bottom sheet | `platform.analytics.tsx` | VERIFIED-PARITY | Fleet |
| Summary section container (warm wash r12, title 16/600 + concrete date range subline) | `platform.analytics.tsx` | VERIFIED-PARITY | Fleet |
| Stat tiles (white r8 hairline 216×77, 14 muted label, 20/700 number, info-i, no chart) | `render.analytics.tsx` AnalyticsCard | VERIFIED-PARITY | Fleet + refinements (fc0f3cdf) |
| Trend indicator (stroke arrow, green/orange, ink value) | `render.analytics.tsx` | VERIFIED-PARITY | Fleet |
| Trends chart (per-day metric series) | `platform-analytics/analytics-chart.tsx` | NEEDS-BUFFER-MEASUREMENT | Buffer Insights chart: measure axis type/12px?, gridline color, line weight/color, dot markers, tooltip card, legend, empty-day handling |
| Recent posts (per-post stats via /analytics/post/:id) | `platform-analytics/recent-posts.tsx` | NEEDS-BUFFER-MEASUREMENT | Buffer "Top 5 Posts"/recent cards: 212×179 r12 per structure JSON — verify card anatomy (thumb, copy lines, metric row, Reactions/Comments segmented) against ours |
| Channels summary table | `platform-analytics/channels-summary.tsx` | NEEDS-BUFFER-MEASUREMENT | Buffer Performance/channels table: header row style, row height, number alignment, hover; verify our table matches |
| Analytics skeletons | `platform-analytics/analytics.skeletons.tsx` + `layout/skeleton.tsx` | VERIFIED-PARITY | Shared-skeleton delegation (fc0f3cdf) |
| Empty state — no channels | `platform.analytics.tsx` | VERIFIED-PARITY | Circle+icon pattern (S2) |
| Refresh-needed state | `render.analytics.tsx` | VERIFIED-PARITY | S2 |
| Sections self-hide without data | insights components | VERIFIED-PARITY | fc0f3cdf |
| Legacy star/fork analytics (GitHub stars) | `components/analytics/**` | N/A-INTERNAL | Unrouted dead code in this fork; do not restyle |

## 14. Agents chat (+ content chat)

| Surface | Component/file | Status | Notes |
|---|---|---|---|
| Page header (sparkle chip + title + New chat primary; phone icon-only) | `agents/agent.tsx` | VERIFIED-PARITY | S1 fleet |
| Threads rail ("Chats" header, 32px r8 rows, collapse, empty state) | `agents/agent.tsx` | VERIFIED-PARITY | Fleet; sidePanelRoot width calibrated |
| Channel toggle bar (composer-style avatar toggles, 40px, ring on-state) | `agents/agent.tsx` AgentList | VERIFIED-PARITY | 7ce47dff + S5 sizing |
| Chat pane (CopilotKit: Inter inherit, tokened bubbles/input, r12 input) | `agents/agent.chat.tsx`, `agent.styles.scss` | VERIFIED-PARITY | Fleet token pass |
| Welcome copy (Cuesoft agent, correct directions) | `agents/agent.chat.tsx` | VERIFIED-PARITY | S3 rewrite |
| Insert media portal + attachments row | `agents/agent.tsx` MediaPortal + media b2 row | VERIFIED-PARITY | 32px/r8 convergence |
| Phone stacking (chat + rail columns) | `agents/agent.tsx` | VERIFIED-PARITY | Fleet phone:flex-col |
| Admin pill clearance over input | `agents/agent.chat.tsx` | VERIFIED-PARITY | S6 |
| Auto-resizing textarea / input primitives | `agents/agent.textarea.tsx`, `agent.input.tsx` | POSTIZ-ONLY-KEEP | |
| Whole surface (no Buffer counterpart) | `agents/**` | POSTIZ-ONLY-KEEP | Buffer has no agent chat; internal-consistency styling only |
| NEW content chat (this wave) | in-flight — not yet in tree | NEEDS-WORK | Being built by a parallel agent this wave (with Approvals/Publish Now, which already landed in bbe94a8c). When it lands: add rows for its pane, entry point, and any new chrome; style with tokens; no Buffer counterpart expected → will become POSTIZ-ONLY-KEEP |

## 15. Settings

| Surface | Component/file | Status | Notes |
|---|---|---|---|
| Settings shell (generic title bar removed; rail carries title) | `layout.component.tsx` exclusion + `layout/settings.component.tsx` | VERIFIED-PARITY | Fleet S1 exception |
| Rail (260px, icon 16 + 14px rows, r8, active fill; grouped) | `layout/settings.component.tsx` | VERIFIED-PARITY | Row geometry per Buffer rail |
| Rail logout row ('Cuesoft' copy, quiet style) | `layout/logout.component.tsx` | VERIFIED-PARITY | S3 brand fix (de7f7dc3) |
| Content column (max-w constraint, centered) | `layout/settings.component.tsx` | VERIFIED-PARITY | Fleet |
| Phone sub-nav (drill-down vs chip strip) | `layout/settings.component.tsx` + `global.scss` | VERIFIED-PARITY | Fleet phone pass |
| Global Settings: profile (name, bio, avatar via media box) | `settings/global.settings.tsx` | VERIFIED-PARITY | H1 20/400 per structure JSON |
| Date metrics preference (select w/ capped width) | `settings/metric.component.tsx` | VERIFIED-PARITY | Fleet |
| Email notifications toggles | `settings/email-notifications.component.tsx` | VERIFIED-PARITY | Toggle 43×24 spec landed (slider.tsx) |
| Buffer Notifications settings page reference | — | NEEDS-BUFFER-MEASUREMENT | Open Buffer Settings→Notifications: section grouping, per-row copy pattern (bold lead + muted sub), toggle placement — confirm our email-notifications grouping matches |
| Shortlink preference (row stacks on phone) | `settings/shortlink-preference.component.tsx` | VERIFIED-PARITY | Fleet |
| Toggle switch primitive (43×24 r999, check glyph) | `libraries/react-shared-libraries/src/form/slider.tsx` | VERIFIED-PARITY | Measured vs Buffer toggle crops |
| Teams (invite link, member/invite tables, roles, remove) | `settings/teams.component.tsx`, `cuesoft/dropdown/user-search-dropdown.tsx` | NEEDS-BUFFER-MEASUREMENT | Open Buffer Settings→Team: member row anatomy (avatar, name/email, role select, kebab), invite CTA, pending section — style reference for our table |
| Webhooks (list + add/edit modal + integrations picker) | `webhooks/webhooks.tsx` | POSTIZ-ONLY-KEEP | Tokenized (settings-table) |
| Autopost (RSS auto-posting list + editor modal) | `autopost/autopost.tsx` | POSTIZ-ONLY-KEEP | |
| Sets (channel/content sets list + editor) | `sets/sets.tsx` | POSTIZ-ONLY-KEEP | |
| Signatures (list + editor, default flag) | `settings/signatures.component.tsx` | POSTIZ-ONLY-KEEP | |
| Developers / Public API (key reveal/regenerate) | `public-api/public.component.tsx`, `developer/developer.component.tsx`, `developer.icon.component.tsx` | POSTIZ-ONLY-KEEP | |
| Approved apps (OAuth grants list + revoke) | `approved-apps/approved-apps.component.tsx` | POSTIZ-ONLY-KEEP | |
| GitHub settings component | `settings/github.component.tsx` | N/A-INTERNAL | Legacy Gitroom leftover; verify unreachable |
| Settings gear entry (sidebar utility) | `layout/settings.component.tsx` SettingsComponent | VERIFIED-PARITY | FREE-tier modal fallback preserved |

## 16. Third-party & Plugs

| Surface | Component/file | Status | Notes |
|---|---|---|---|
| Third-party page header + section labels | `third-parties/third-party.component.tsx` | VERIFIED-PARITY | Fleet: header, eyebrow → sentence case |
| Catalog cards (quiet Add CTA, 1-col phone) | `third-parties/third-party.list.component.tsx` | VERIFIED-PARITY | Fleet |
| Connected rows (avatar 40, bold name, sub-line, kebab menu) | `third-parties/third-party.component.tsx` | VERIFIED-PARITY | Fleet; kebab menu on panel surface |
| API-key connect modal + function wrapper | `third-parties/third-party.function.tsx`, `third-party.wrapper.tsx` | POSTIZ-ONLY-KEEP | |
| HeyGen provider UI (avatar/voice pickers, generate) | `third-parties/providers/heygen.provider.tsx` | POSTIZ-ONLY-KEEP | Skeleton tokenized (fc0f3cdf) |
| Media slider picker | `third-parties/slider.component.tsx` | POSTIZ-ONLY-KEEP | |
| Plugs page (per-channel plug cards, activate toggles, fields) | `plugs/plugs.tsx`, `plugs/plug.tsx`, `plugs.context.ts` | POSTIZ-ONLY-KEEP | Skeletons tokenized (bbe94a8c); side panel calibrated |

## 17. Billing & onboarding & misc member surfaces

| Surface | Component/file | Status | Notes |
|---|---|---|---|
| Billing main (tiers, prorate preview, features, cancel flow) | `billing/main.billing.component.tsx`, `billing.component.tsx` | N/A-INTERNAL | Billing disabled internally; keep code paths |
| First-time billing / after-checkout | `billing/first.billing.component.tsx`, `new-layout/billing.after.tsx` | N/A-INTERNAL | |
| Embedded Stripe billing + coupon input | `billing/embedded.billing.tsx` | N/A-INTERNAL | |
| Lifetime deal page | `billing/lifetime.deal.tsx` | N/A-INTERNAL | |
| FAQ section | `billing/faq.component.tsx` | N/A-INTERNAL | |
| Finish-trial modal | `billing/finish.trial.tsx` | N/A-INTERNAL | |
| Onboarding wizard (welcome modal, connect steps) | `onboarding/onboarding.tsx`, `onboarding.modal.tsx`, `github.onboarding.tsx` | POSTIZ-ONLY-KEEP | Shows for invited teammates; neutral styling; sweep tokens opportunistically |
| Notifications dropdown list (bell panel content) | `notifications/notification.component.tsx` | NEEDS-WORK | (Same as §3 row — tracked once there; listed for completeness of the bell's panel content: mixed tokens, needs 32px/r6 menu rows) |
| Public post preview page (header, post render, copy link, comments) | `preview/preview.wrapper.tsx`, `copy.client.tsx`, `render.preview.date*.tsx`, `comments.components.tsx` | NEEDS-WORK | Legacy tokens on the comments render; restyle page chrome to token system |
| Import debug post modal (admin) | `launches/import-debug-post.modal.tsx` | N/A-INTERNAL | Admin pill popover tool |
| Admin errors table | `admin/admin-errors.component.tsx` | N/A-INTERNAL | Restyled bbe94a8c |
| Admin stats dashboard | `admin/admin-stats.component.tsx` | N/A-INTERNAL | Restyled bbe94a8c |

## 18. Auth & OAuth (all internal — SSO-only instance)

| Surface | Component/file | Status | Notes |
|---|---|---|---|
| Login (OIDC button flow) | `auth/login.tsx`, `login.with.oidc.tsx` | N/A-INTERNAL | Google SSO via Internal OIDC |
| Register / activate / after-activate | `auth/register.tsx`, `activate.tsx`, `after.activate.tsx` | N/A-INTERNAL | Registration disabled |
| Forgot / forgot-return | `auth/forgot.tsx`, `forgot-return.tsx` | N/A-INTERNAL | |
| Login-required interstitial | `app/(app)/auth/login-required` | N/A-INTERNAL | |
| Auth provider buttons (Google/GitHub/OAuth/Farcaster/Wallet) | `auth/providers/**` | N/A-INTERNAL | |
| Testimonials side panel on auth | `auth/testimonial*.tsx`, shared `testomonials.tsx` | N/A-INTERNAL | |
| OAuth consent (approve app) | `app/(app)/oauth/authorize/page.tsx` | N/A-INTERNAL | Spinner tokenized |

## 19. UI kit & shared primitives

| Surface | Component/file | Status | Notes |
|---|---|---|---|
| Icon system (231 inline SVGs ledgered to Lucide family, 16px vb24 stroke 2.2) | `components/ui/icons/index.tsx` + inline | VERIFIED-PARITY | 987a823b + b82cb93a |
| Empty-state component (hero variant, 64px circle pattern) | `cuesoft/empty-state.tsx` | VERIFIED-PARITY | S2 pattern |
| Loader / LoadingPane / spinner sizes | `cuesoft/loader.tsx`, `layout/loading.tsx` | VERIFIED-PARITY | Spinner call-site sweep complete (fc0f3cdf) |
| Skeleton primitives (route + per-surface) | `layout/skeleton.tsx` | VERIFIED-PARITY | bbe94a8c/fc0f3cdf sweep |
| Data table / settings table | `cuesoft/data-table.tsx`, `settings-table.tsx` | VERIFIED-PARITY | Buffer table specs (12px grid corners 82563526) |
| Table pagination + pager stepper | `cuesoft/table-pagination.tsx`, `toolbar/pager-stepper.tsx` | VERIFIED-PARITY | 32×32 r8 |
| Toolbar primitives (row, field, select, input, segmented) | `cuesoft/toolbar/toolbar.tsx` | VERIFIED-PARITY | Measured toolbar anatomy |
| Pressables (Chip, ChoiceChipGroup, PagerButton) | `cuesoft/pressables.tsx` | VERIFIED-PARITY | |
| Button (primary lime/secondary hairline, 32/40 r8) | `libraries/react-shared-libraries/src/form/button.tsx` | VERIFIED-PARITY | Fleet convergence |
| Input / textarea (32px, r8, 414px settings width) | `.../form/input.tsx`, `textarea.tsx` | VERIFIED-PARITY | Via settings measurements |
| Checkbox (16px r4) | `.../form/checkbox.tsx` | VERIFIED-PARITY | Measured in channels dialog |
| Select / custom select / multi-select | `.../form/select.tsx`, `custom.select.tsx`, `multi.select.tsx` | VERIFIED-PARITY | 200px select geometry |
| Color picker (tag colors) | `.../form/color.picker.tsx` | NEEDS-BUFFER-MEASUREMENT | Rides the Tags-manager measurement (§9): swatch geometry + palette |
| Canonical/total form helpers | `.../form/canonical.tsx`, `total.tsx` | N/A-INTERNAL | |
| Image fallback/safe image/video frame helpers | `.../helpers/image.with.fallback.tsx`, `safe.image.tsx`, `video.frame.tsx`, `video.or.image.tsx` | N/A-INTERNAL | |
| Global size ladder + phone overrides + p-[20px] pin | `app/global.scss` | N/A-INTERNAL | Parity mechanism (data-cs opt-out) |
| UpDownArrow, check icon, logo-text, translated-label, scroll hook | `launches/up.down.arrow.tsx`, `ui/check.icon.component.tsx`, `ui/logo-text.component.tsx`, `ui/translated-label.tsx`, `ui/is.scroll.hook.tsx` | N/A-INTERNAL | Micro-primitives |
| New post deep-link handler (?newPost=1) | `launches/new.post.tsx` | N/A-INTERNAL | Mechanism |

---

## Status totals (2026-08-10)

Counted from the tables above (335 rows):

- VERIFIED-PARITY: 154
- NEEDS-WORK: 15
- NEEDS-BUFFER-MEASUREMENT: 34
- POSTIZ-ONLY-KEEP: 92
- N/A-INTERNAL: 40
