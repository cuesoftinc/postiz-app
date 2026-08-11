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
- 2026-08-11 - iPhone 16 Pro visual-defect round 2 (9 fixes). composer:
  the floating support launcher can never cover the footer CTA - ManageModal
  emits supportEmitter change=false on mount / true on unmount, the Chatbase
  path now honors the emitter (CSS hide via doubled-id selector; widget +
  scoped restyle stay mounted - support.tsx), and the launcher restyle caps
  z-index at 199, under the 200+ modal layer (chatbase.component.tsx; the
  embed inlines zIndex 2147483646 - ids verified current in embed.min.js).
  three-day: the phone hour grid hides scrollbar chrome (scrollbar-none;
  the `scrollbar` utilities forced classic 16px webkit bars = the headerless
  4th-column sliver + the bottom thumb; desktop keeps styled bars), phone
  day columns are exact thirds of the scrollport for BOTH week spans (3-day
  fits exactly, 7-day pans sideways by whole columns), and scroll-to-now
  retries across frames until the scrollport has real height (the one-shot
  assignment clamped to 0 against unresolved flex ancestors = "opens at
  midnight"). list: the byline gets its own full-width line above the
  action row on phone (was crushed to 'Y..'); Publish Now/Request
  changes/Approve/Edit + kebab now phone:h-[40px] (kebab 40x40), matching
  the fixed comment bubble. composer toolbar: the 32px icon squares
  (bold/underline/link/bullets/heading/emoji + 30px signature) and the
  30px labeled chips (insert/design media, AI image/video, third-party)
  are 40px on phone. settings: Slider root gains shrink-0 so every toggle
  holds the 57px footprint (label length was crushing siblings to ~42px).
  composer: the reorder/trash gutter hides when items.length === 1 (both
  arrows were disabled anyway; editor + toolbar span the full width); the
  upload dropzone opts out (data-cs) of the phone toolbar-toggle rule in
  global.scss (rule now :not([data-cs])) - it was stretching the box and
  flinging icon/caption apart. audits: devIndicators:false in
  next.config.js so dev overlays never mask product UI; the Insights
  '1 Issue' pill traced (frontend-dev.log) to 'clsx is not defined' at
  Impersonate from a stale Fast Refresh chunk mid-edit - committed source
  imports clsx; not reproducible on a fresh load. tsc clean.
- 2026-08-11 - composer parity pass (iter3 Buffer spec, 16 diffs;
  new-launch/** plus scoped CSS). dialog: fixed 1100px wide / 813px cap,
  centered (shell justify+items-center; the <=1100px sheet media query
  releases the caps), layered hairline shadow ring (0 0 0 1px
  rgba(0,0,0,.08) + 0 1px 1px .02). header: padding ps-32/pe-24, title
  18px/22.5px, Preview toggle 32px 14/500 and close 32x32, tags chip
  32px/14 (scoped CSS). body: preview column
  420->379px; preview header 60px band (16/32/12/32, 16px/20px 500, was
  550). footer: min-h 64->72; Save Draft ghost r12->r8, 15->14, label 'Save
  Draft' (new save_draft key; save_as_draft stays for other surfaces); date
  label + chevron + lime primary now ONE attached split control, r12 outer
  corners only (chevron segment rounded-none, primary rounded-s-none
  rounded-e-[12px]); #cs-datetime/#cs-repeat fonts 15->14. editor: media
  dropzone 120x120 r8 square button on desktop (phone:w-full keeps the
  banner), plain 12/500 label copy replaces the green link span. channels:
  add-channel square r12->r8; selected tiles gain the Buffer 24x24 r6 white
  deselect badge (fixed #292928 ink; tile click still toggles). tags
  popover: 195px wide, padding 12px 8px, rows 32px at 14/500 (scoped CSS in
  manage.modal). tsc clean on owned files.
- 2026-08-11 - iPhone 16 Pro critique round 2 (6 fixes). date-sheet: both
  phone bottom sheets' controls carry data-cs so the size ladder never
  squeezes the phone-only surfaces (filters.tsx - PhoneFilterSheet rows
  44->was 36 + back row 40->was 32; PhoneCalendarSheet segmented 44,
  month chevrons true 40x40 (were 40x32), day buttons 40 (32px circle gets
  breathing room + real tap target), Today row 44). drawer: NavRow
  expanded + channel-row menu items phone:h-[44px] (sidebar.tsx) - drawer
  rows are primary navigation on phone and now match the 44px agent session
  rows; desktop keeps 32px density. list: comment bubble phone 40x40
  (glyph stays 16) with header clearance phone:pe-[48px]->[56px]
  (calendar.tsx).
  agents-assistant: chat send button phone:w/h-[44px]
  (content-chat.component.tsx; data-cs blocks the ladder, not phone:
  utilities). month: phone admin dot keeps its 20px visual but the button
  pads to a 40x40 hit area via inner span + -10px margins
  (impersonate.tsx). three-day: single todayKey (newDayjs format
  YYYY-MM-DD) hoisted in WeekView drives the slice anchor, header underline
  and day-cell wash, and CalendarColumn's isToday uses the same
  formatted-date compare - isSame(_, 'day') truncated in the machine-local
  zone, so the washed/underlined column could diverge from the slice anchor
  when the org display timezone differs from the device zone. tsc clean.
- 2026-08-11 - iPhone 16 Pro critique round 1 (25 fixes). date-sheet: the
  phone grid-cols-7 fallback (global.scss:1100) now carries :not([data-cs])
  and the PhoneCalendarSheet mini month picker opts out with data-cs +
  explicit repeat(7,minmax(0,1fr)) so all 7 columns fit the sheet (S/M/T/W
  clipping + stray sideways scrollbar gone). composer: phone overflow guards
  (modal root phone:max-w-[100dvw]/overflow-x-hidden in new-modal.tsx, same
  on #cs-composer-shell + header row; tags chip min-w-0, preview/close
  shrink-0); the "Add New Tag" trigger is whitespace-nowrap and reads "Tags"
  on phone. surfaces: new 'cs:surface-open' contract - the nav drawer
  (layout.component.tsx), every modal (new-modal openModal) and both phone
  sheets (filters.tsx) announce on open and the sheets/drawer yield to any
  other surface, so the calendar sheet can no longer sit over the drawer or
  the composer. month: phone month cells hug content (phone:min-h 163->88px);
  the phone New Post square carries data-cs (real 40x40, was laddered to
  40x32); the non-functional bookmark hides on phone; toolbar chevrons grow
  to phone 40x40. three-day: columns divide the window exactly
  (calc((100%-48px-3px)/3)) with overflow-x hidden (no 4th-column sliver/
  scrollbar), hour-0 label suppressed (clipped mid-glyph against the sticky
  header), the slice anchors on today via date-string compare, and today's
  column washes bg-newTableHeader (header + cells). analytics: Trends metric
  chips become a phone single-row sideways scroll strip; summary delta badge
  suppressed when the total is 0 or percentageChange is the provider
  placeholder 5 (no real comparison exists in any provider); recent-posts
  chevron 40x40 on phone; chart top padding 4->12 so the first y label is
  not cut. impersonate: phone collapses the Admin pill to a 20px dot that
  expands+opens on tap (it covered the Aug-30 month cell). plugs: card
  phone:h-auto (min 160) + button mt-auto; provider plug copy fixed
  ("reaches", "your followers") across linkedin.page/bluesky/threads/x.
  third-party: Add buttons pin bottom via mt-auto (shared baseline); the
  connected-integrations empty hero collapses to one muted line. agents:
  mode toggle/new-chat/session+thread rows phone:h-[44px] (new-chat
  phone:w-[44px]); rails + chat land on the single 16px phone gutter
  (pane phone:px-[4px] over the shell's 12); session rows gain a muted
  right-aligned relative timestamp. settings: rail logout phone:hidden with
  a phone-only copy at the content bottom; duplicated "Global Settings"
  heading phone:hidden; shared Slider knob inset (20px, centered) so it sits
  inside the pill. list: comment bubble overlays the card header top-right
  on phone (header clears it with phone:pe-[48px]) so cards span full width;
  list thumbnail + media grid tiles object-contain over a bg-newTableHeader
  letterbox (center-crop sliced typographic tiles); media lightbox
  object-contain. Also: teams.component.tsx local type widened (name?) to
  keep tsc green over a concurrent edit. tsc clean.
- 2026-08-10 - auth surfaces onto today's kit (login, email sign-in, register
  incl. disabled/SSO state, forgot, reset, activate, after-activate,
  login-required): auth layout rebuilt - legacy dark shell (`bg-[#0E0E0E]` +
  `#1A1919` panel, white ink) -> forced-light `light` wrapper on cream
  `bg-newBgColor` (fonts inherit from `(app)/layout.tsx`; auth components may
  not use `dark:` variants since the body can still carry `.dark`), centered
  brand lockup (primary mark + Fustat 24/700 lowercase "cuesoft") above a
  420px white `bg-newBgColorInner` r16 `border-newTableBorder` card, p32,
  soft shadow, phone full-width w/ 16px insets. New `auth/auth.ui.ts` shares
  the kit classes: titles 20/550 ink + 14px /60 sublines (40px heroes gone),
  inputs converge on the shared form `Input` via wrapper classes only
  (`!h-[44px] !rounded-[8px]` + `[&:hover:not(:focus-within)]:border-[#8a8a88]`,
  focus keeps `border-forth`; other Input consumers untouched), primary CTA
  lime `bg-btnPrimary` text-black 44px r8 550 full-width, secondary links
  14px Buffer-green `#2f7d44` hover:underline, provider buttons (generic
  OIDC/Google/GitHub/Farcaster/Wallet placeholder) -> white hairline 44px r8
  14/550 ink w/ glyph (OIDC label now "Continue with {displayName||Google}",
  Google button "Continue with Google"); `or` dividers `bg-fifth` ->
  `bg-newTableBorder` w/ masked label chip; not-activated notice -> light
  amber-50/200/800; success greens -> `#2f7d44`; login-required interstitial
  `bg-[#121212]` -> cream + 20/550 ink. ALL logic preserved verbatim
  (OIDC/Google/GitHub/wallet handlers, providers list, validation resolvers,
  disabled-registration redirect + SSO block, provider auto-submit + error
  surface, resend cooldown, return-url). tsc clean.
- 2026-08-10 - needs-work pages wave (Task B: public preview, missing-release,
  chatbase): `/p/[id]` shareable page kit-converted - canvas `bg-[#000000]`
  -> theme-aware `bg-newBgColor` + ink (p/[id]/layout.tsx); header rebuilt on
  the sidebar brand rule (theme-aware mark + Fustat wordmark replace the
  white-only 140px logo that vanished in light mode), share button kept,
  publication date -> 14px textItemBlur; post cards -> white r12 hairline
  cards (bg-newBgColorInner p16, 40px avatar + surface-ringed 20px platform
  badge, 14px/550 ink name + /60 handle, ink body, media tiles r8); comments
  rail -> 360px r12 hairline card (phone: full-width, stacked via phone:
  prefix - dead lg: variants dropped); comments render loses its last legacy
  tokens (bg-third/tableBorder/text-white textarea -> kit input pattern: r8
  hairline bg-newBgColorInner ink, placeholder /50, focus:border-forth; rows
  -> hairline dividers, 14px/550 ink names, ink body; rem-based
  text-sm/space-*/p-4 -> explicit px); render.preview.date debug console.log
  removed; all logic kept (copy link, comments form + login gate, date
  render). Missing-release modal converges: selected tile `border-[#612BD3]`
  -> lime border-btnPrimary, hover -> hairline, footer tableBorder ->
  newTableBorder, Cancel -> Button `secondary`, /70 muted -> /60, sm:/lg:
  grid steps -> `grid-cols-5 phone:grid-cols-3` (both skeleton + content).
  Chatbase launcher override moved from support.scss into
  chatbase.component.tsx as a scoped injected `<style>` that mounts only with
  the widget (CHATBASE_TOKEN gate + token fetch; self-hosted deployments ship
  nothing) and restyles the injected launcher into the Buffer help-bubble
  slot per the new measurement: 44px light circle bottom-right at a 16px
  inset, white surface + hairline, branding glyph hidden, ink circled-"?";
  id-keyed guard selectors (#chatbase-bubble-button/-window/-message-bubbles)
  degrade to the widget default if Chatbase changes its DOM. support.scss
  keeps only a pointer comment (duplicate !important rules on the same ids
  were load-order dependent). tsc clean.
- 2026-08-10 — list view + shared surfaces (orchestrator-measured wave, Task
  A): (1) queue block centered — ListView's rail+card block rides one
  `mx-auto w-full max-w-[800px]` column (Buffer 194/699/195 symmetric),
  phone full-width; date group headers re-measured to 16px font-[550] whole
  line. (2) Sent-tab per-card stats strip (new SentPostStats in
  calendar.tsx): hairline divider + 14px ink metrics (font-[550] values, gap
  16) from GET /analytics/post/:id?date=30 (recent-posts.tsx pattern, shared
  key), IntersectionObserver-lazy per visible card, 5-min SWR dedupe,
  list+published only, no releaseId → nothing. (3) ?tab= URL parity:
  setListState replaceState's ?tab=queue|drafts|approvals|sent, context
  seeds listState from ?tab= on mount, setFilters carries ?tab while the
  target view stays the list. (4) Toaster restyled to the measured Buffer
  surface (#f6f6f4 bg exact — newTableHeader #f4f3f0 NOT equal — 1px
  #e6e5e2, r12, 20px icon slot, 14px ink, soft shadow; position/timing
  ours; glow ellipse retired). (5) Modal backdrops flat black/80 NO blur
  (new-modal both overlay branches; blurMe blur-xs dropped, pointer guard
  kept) — mantine blur(10px)/overlay rgba in global.scss + bg-popup in
  post.url.selector/finish.trial left for the orchestrator (outside this
  wave's files). (6) Shared tooltip mount: !max-w-[170px] !text-[13px]
  !leading-[1.5], colors ours. tsc clean.
- 2026-08-10 — native Buffer URLs (route flip): /schedule/* stop being aliases
  and become the REAL Publish routes — `/schedule/calendar/month|week|day` and
  `/schedule/list` render `launches.component.tsx` directly, the view read
  from the pathname (new `launches/schedule.routes.ts`: scheduleViewPath /
  displayFromPathname / withQueryString); `/schedule` redirects to the
  `calendar-display`-cookie view (month default) and `/schedule/calendar` to
  week (Buffer's defaults), both query-preserving; `/launches` is now the
  legacy leg — a query-preserving redirect mapping `?display=` into the path.
  The calendar context's replaceState writer emits the native paths (dates/
  filters stay as query; `?display=` remains a legacy deep-link override; the
  ?state/?tags carry and the searchParams sync effect are unchanged). Full
  link sweep to /schedule: top.menu Publish nav path, sidebar (logo, "+ New"
  Post `?newPost=1`, Manage channels `?manageChannels=1` ×5, channel rows
  `?integration=` + hover New post, scheduledTotal badge path check), plugs +
  insights empty-state buttons, agents connect-channels link, onboarding
  close, layout.context onboarding hop, stars-table week link, proxy `/`
  redirect, continue.integration OAuth legs (?precondition/?msg/?added +
  error Redirect), launches.component continueIntegration push. Title-bar
  exclusion list gains '/schedule' (keeps '/launches' for the redirect
  moment). ?newPost=1/?manageChannels=1 consumers are path-agnostic
  (url.pathname-preserving replaceState) so they work on the native routes.
  tsc clean.
- 2026-08-10 — typography parity r4 (26 audited violations) + Buffer weight
  calibration: admin-stats/admin-errors page titles ("Admin Stats", "Errors")
  adopt the page-title spec (`data-cs font-display text-[20px] font-[400]
  text-newTextColor`); danger ink unified — admin-errors `text-red-400`
  (load-failure line + Unknown Error platform cell) → `text-[#FF3F3F]`; the
  off-scale opacity rungs died: every `opacity-60/70` muting in admin-stats
  (stat-card label, empty row, date-range, From/To labels), admin-errors
  (detail sub-labels ×6, "{n} total" counter, empty state, org-name meta) and
  moltbook waiting line (`text-sm opacity-70` → `text-[14px]
  text-newTextColor/60`) → `text-newTextColor/60`; admin-errors table-cell
  `opacity-90` and agent.media.modal body `opacity-80` (×3) → full body ink;
  main.billing tier name 18/600 display → 16/600 body (matches
  first.billing:279); notifications header + channels-modal heading drop
  font-display (16/600 Inter ink; vestigial data-cs removed). WEIGHT
  CALIBRATION (Buffer variable-Inter tokens: semibold 550, bold 650 — our
  sweep had standardized on 600/700): kit chrome `font-[600]` → `font-[550]`
  (137 across 53 files) and `font-[700]` → `font-[650]` (first.billing totals
  ×2 + hover), plus kit-chrome `font-bold` → `font-[650]` (calendar count
  badge, auth hover-links ×7, notification link HTML). Untouched per the
  exception list: Fustat wordmark 20/700 (sidebar + layout.component),
  platform-preview internals (instagram/facebook/linkedin/tiktok/pinterest/
  youtube previews, reddit.provider preview card, general.preview X-style
  name row), chart.js `weight:` configs, react-shared-libraries. Verified
  Inter loads via next/font/google with NO fixed weight in all three layouts
  ((app)/(provider)/(extension)) — variable wght axis 100–900 ships, so 550/
  650 render true, no config change needed. tsc clean.
- 2026-08-10 — typography parity r3 (16 audited violations): TopTitle
  (launches/helpers/top.title.component.tsx) adopts the composer modal-title
  pattern — `data-cs text-[18px] font-[500] text-newTextColor`, font-display
  dropped — so every TopTitle header (Change Bot Picture, Select Company,
  Comments, Connect Channel URL, ...) stops rendering 14px/400 display; last
  grey utilities left the shared form kit (custom.select chevron + clear X
  `text-slate-500` → `text-newTextColor/60`, total.tsx disabled decrement →
  `text-newTextColor/40`); admin PerSocialTable header de-eyebrowed
  (`uppercase opacity-70` → sentence-case `text-newTextColor/60`);
  CreationMethodBadge type normalized to 12px/500 (no font-bold/uppercase/
  tracking-wide — the WEB/API/MCP/CLI acronyms are uppercase content) at all
  three sizes; time.table "Add Time Slot" → 16/600 ink section heading;
  billing: "Plans" pane title → page-title spec (`data-cs` 20/400 display
  ink), MONTHLY/YEARLY sub-labels sentence-cased (component defaults + en
  locale), first.billing tier name → 16/600 (dead mobile:text-[18px]
  removed); billing.after h1 → page-title spec (stock text-3xl + redundant
  wrapper text-xl removed); public preview comments: textarea placeholder →
  `placeholder:text-white/50` with dead shadcn token classes deleted
  (ring-offset-background, muted-foreground, ring-ring), "Comments" h3 →
  16/600; HeyGen busy overlay re-inked for its black/90 surface (headline
  `data-cs` 18/500 `text-white`, meta `text-white/60`); channels-summary
  empty-cell em dash glyph → hyphen. tsc clean.
- 2026-08-10 — shared channels dropdown (user request: the calendar's Buffer
  "Channels" dropdown replaces the phone chip strips on Insights and Plugs):
  ChannelsFilter's presentation (32px transparent r8 trigger, 300px r12 panel
  w/ search + Select all + 28px avatar checkbox rows) extracted verbatim into
  `new-layout/channels-dropdown.tsx` with a clean prop API ({integrations,
  selectedIds, onChange, multi?, label?, anchor?}); the calendar rewires onto
  it byte-identically (same ?integration= comma-list replaceState plumbing).
  Single-select mode (new): trigger = current channel avatar (20px) + name +
  chevron, rows carry a check in a left 16px slot, picking closes. Insights
  adopts it as the first control of its toolbar row (replaces the phone
  [data-side-panel] chip strip; selection still URL-driven replaceState;
  refresh-needed channels now selectable — the pane's existing refresh card
  in render.analytics takes over, the same path the Channels table rows
  already allowed). Plugs adopts it at every width (replaces the phone chip
  strip AND the desktop ToolbarSelect; the selectIntegration refreshNeeded
  toaster guard + router.push stay). Phone: trigger lifts to a 40px tap
  target (`phone:h-[40px]`, prefixed so the ladder skips it) and the panel
  renders as the standard bottom sheet (scrim/rounded-top/drag-handle,
  z-[650], h-[100dvh] scrim). The global.scss [data-side-panel] chip-strip
  rules became dead (remaining carriers: launches' permanently-hidden panel,
  agents' Threads rail with no group/profile rows) and were removed; the
  [data-side-panel-footer] hide + the collapse-chevron hide (still live for
  agents) stay. tsc clean.
- 2026-08-10 — composer phone parity (390x844, orchestrator-measured Buffer):
  header Preview toggle now lives at phone too — glyph-only (label span
  `phone:hidden`), quiet chip; it drives a NEW phone-only overlay state
  (`showPreviewPhone`, default off so the sheet opens editor-first): the same
  mounted 420px preview pane (provider refs must stay mounted for submit
  validation) presents full-width inside the modal (`phone:flex phone:w-full
  phone:border-s-0` beats base `hidden` inside the media query) while the
  editor column display-hides; the toggle branches on
  `matchMedia('(max-width: 767px)')` (= the `phone` screen) so desktop pane
  state is untouched. Footer primary shortens at phone via span swap (Buffer
  shows "Customize"): Add to calendar→Schedule, Check the circles
  above→Pick channels, Create output→Create; desktop labels byte-identical.
  Full-viewport sheet re-verified structurally (fullScreen host fixed
  w-full/h-full + ≤1100px scoped @media p0/r0 — no page bleed); channels row
  (40px tiles + `+` tile), emoji chip and dashed media zone already phone-safe.
  Also folded in two measured desktop leftovers as light-only scoped CSS in
  manage.modal: date-picker popover day-cell hover #e6e5e2 (day cells =
  the only hover:bg-boxHover + rounded-[6px] nodes; selected day keeps lime)
  and composer text-input hover border #8a8a88 (--color-border-neutral;
  :not(:focus)/:not(:focus-within) guards keep focus on border-forth;
  dark mode untouched). tsc clean.
- 2026-08-10 — typography parity r2 (27 audited violations, shared-form layer +
  global.scss + auth): the shared form kit dropped its last legacy ink —
  Input/Textarea/Select/CustomSelect/Canonical/Total (`react-shared-libraries/src/form/`)
  `text-textColor placeholder-textColor` → `text-newTextColor` with
  `placeholder:text-newTextColor/50` (filters.tsx convention), Toaster body → ink;
  global.scss de-legacied: `.editor` descendant ink, both SweetAlert2 rules
  (`.swal2-modal *`, `.swal2-icon`), Uppy upload button + `.uppy-Dashboard-inner *`
  → newTextColor; react-tags: tag hover + listbox is-active → `text-newTextColor
  bg-boxHover` (system hover wash replaces customColor51 blue), combobox
  placeholder + disabled option `customColor53` grey hex → `text-newTextColor/60`,
  selected-checkmark accent → ink; instagram.preview engagement row (last tsx
  `text-textColor`) → ink; admin-errors Users-cell '—' placeholders (x2) → '-';
  auth titles calibrated — forgot/forgot-return/activate/login.with.oidc h1
  30/700 → `text-[40px] font-[500] -tracking-[0.8px]` (login/register pattern;
  oidc also dropped the conflicting `text-center`), activate h2 18/600 → 16/600
  section rung. tsc clean.
- 2026-08-10 — modern logout + org row menu: the sidebar footer org row is now a
  menu trigger (Buffer pattern) — click opens a compact popover above it (kit
  panel: white r8 hairline, p4, soft shadow, 32px r6 rows) with Settings (gear 16,
  /settings), a hairline divider, and Log out (log-out glyph 16, critical #FF3F3F
  ink); the collapse control moved to a sibling of the trigger (no nested buttons,
  same 24px control); the collapsed 52px rail's bottom org mark opens the SAME
  popover anchored start (32px hover square around the 24px mark). Logout flow
  extracted VERBATIM from `logout.component.tsx` into an exported `useLogout`
  (confirm dialog, cookie-clear vs POST /user/logout oauth branch, hard '/'
  redirect — byte-identical body); LogoutComponent keeps both exports/render
  sites working: `isIcon` untouched (first-billing header), text variant restyled
  to a quiet 32px hairline button ("Log out from Cuesoft" 14/500, critical ink +
  wash on hover) on settings/billing pages. tsc clean.
- 2026-08-10 — typography parity r1 (full type-scale sweep, `components/**` and
  `app/**` minus the agents/content-agent loops): legacy ink `text-textColor` (btn-text var,
  light #0e0e0e) → calibrated `text-newTextColor` ink across 48 files;
  settings-family page titles (Signatures/Teams/Developers/Autopost/Sets/Approved
  Apps/Webhooks + onboarding step titles + desktop top-bar Title) unified on the
  20/400 display data-cs pattern (were 24/500-600); generic modal chrome
  (new-modal, modal.wrapper) → 18/500 Inter data-cs composer pattern; settings
  section H2s 16/550 → 16/600; tracked-uppercase eyebrows (developer, public-api,
  onboarding, DataTable header) → 13px sentence-case muted; composer char counters
  10/600 → 12/500, editor-toolbar captions (AI Image/Video, Insert/Design Media,
  Integrations) 10-11/600 → 12/500, calendar tag strip + media-library caption +
  "New" pill + org monogram + channels-summary label 10-11 → 12; grey hexes/utilities
  → tokens (`#A3A3A3`→newTextColor/60 in select.current, mention dropdown +
  voice-loading greys → newTextColor ramp, dark interstitials continue.integration /
  oauth-authorize / public p/[id] greys → white/60-80); forth accents out of text
  (agent-media bullets → muted, TikTok legal links → #2f7d44 link green, DelayIcon →
  ink, coupon code → ink); danger ink unified on #FF3F3F (#F97066 row, #FF3535
  icons), success glyphs unified on #2f7d44 (#00FF00, #00EB75, #06ff00);
  customColor12/13/16/17/18 out of text (stars trending → ink/muted, FAQ body →
  muted, GitHub/OAuth auth buttons → the shared #0E0E0E button ink); billing
  checkout H4s 24/700 → 16/600, "Due today" 700 → 600, stat numeral weight
  render.analytics 700 → 600; em dashes out of user copy (impersonate switch/coupon
  strings, billing trial line → '·', admin stats range → en dash); dead upstream
  commented markup dropped (analytics News Feed block, embedded-billing/FAQ h4/h3).
  Exceptions kept (intentional): platform preview mimicry (facebook/instagram/
  linkedin/tiktok/youtube/reddit preview type + #A3A3A3/#1d9bf0 platform greys/blues),
  chart inks #2f7d44/#c2410c, Fustat wordmark 20/700, lucide/icon glyph sizing,
  micro-badges + monograms (7-11px counter bubbles, streak pill, creation-method
  acronym pill incl. its uppercase tracking, avatar initials, 'i'/X glyphs), nav-rail
  9-10px captions, stat/pricing display numerals (36-50px), dark OAuth interstitial
  28/24 heroes, auth marketing surfaces (40px heroes, testimonial dark panel
  #D1D1D1), first-billing paywall display type, lifetime-deal 30px headings,
  on-lime #292928 today chip, auth provider button #0E0E0E, Discord bubble
  #def0ff/#004781, brand-blue #325ea6 coupon check, empty-cell '—' glyphs. tsc clean.
- 2026-08-10 — composer (Create Post) loop i1, from live-measured Buffer values:
  title 18/500 Inter body face (was 20/400 display); header quiet controls (Preview
  toggle, close X) 40px px12 r8 15/500 textItemBlur + wash hover, active Preview
  keeps the boxFocused pair; Tags chip 40px r8 hairline 15/500 ink; channel avatars
  r10→r12 (tile + image wrapper + `+` tile); footer date control reshaped into
  Buffer's SPLIT button (existing DatePicker trigger = left segment via the
  `#cs-datetime` scoped skin — h40, start-only r12, px 12/8, 15/500 ink, hairline —
  plus an attached end-r12 chevron segment forwarding the same open action; picker
  logic untouched); footer family h-40 r12 (lime primaries, draft, repeat, Post Now);
  drop-zone "select a file" link → Buffer green #2f7d44 15/400 hover-underline;
  ≤1100px tablet full-bleed sheet via scoped `@media` (verified: `max-[1100px]:`
  does NOT compile against the raw/object `screens` config — Tailwind drops
  min-*/max-* there). r1 leftovers re-verified in code: preview pane
  bg-newTableHeader wash + hairline, "Post Previews" 16/600 + muted circle-i
  (`data-tooltip-id="tooltip"`), PreviewEmptyState card + caption wired in
  show.all.providers/high.order.provider, 64px header/footer bands. tsc clean.
- 2026-08-10 — calendar loop i1 (orchestrator-measured diffs vs live Buffer): phone
  7-day week keeps ~100px day columns (`minmax(100px,1fr)` when 'phone-week-span'='7')
  and scrolls horizontally inside the existing week overflow-auto container — day
  headers stay sticky-top, the 48px time gutter pins sticky-start (z-15), the corner
  spacer pins both axes (z-30); 3-day span and desktop keep exact prior behavior.
  Phone week chips 36→32px (Buffer measured 31; r8/18px icon/15-400 time kept).
  Month-pill/week-card white+shadow hover wrapped in `[@media(hover:hover)]` so touch
  taps never latch it (still covers both pill and card via the shared wrapper). Sheet
  mini-picker lime today circle re-verified in code (isToday lime fill precedes the
  boxFocused anchor fill; probe failure predates the 3a5dabbe deploy). tsc clean.
- 2026-08-10 — initial full inventory (routes + components walk; cross-checked against
  spec, waves `f3c25aa4…fc0f3cdf`, and scratchpad round-1 measurements/gap audits).
- 2026-08-10 — needs-work sweep (top rows): bell dropdown, org switcher popover, post
  preview interior, post statistics modal (flat #2f7d44 chart replaces gradient
  ChartSocial), platform picker multi-select tiles, and AI image modal converted to kit
  tokens; org switcher stays NEEDS-BUFFER-MEASUREMENT for Buffer's own org menu. tsc clean.
- 2026-08-10 — Plugs page adopts the shared PageShell/PageHeader (48px band, 40px r10
  plug-glyph chip, standard pane insets) with compact 32/14 phone channel chips
  (analytics-strip treatment); plug cards converge to kit white card chrome (white r12
  hairline, 16/600 title, muted body); admin pill shrinks (28px) and docks bottom-end
  with a 12px inset on phones. tsc clean.
- 2026-08-10 — ONE shared page header: new `new-layout/page-header.tsx` (`PageHeader` +
  `PageShell`, cloned from the measured /launches rhythm — 48px header band / 56px phone,
  40px r10 hairline chip w/ 20px stroke-2.2 glyph, 20/400 display title, actions slot;
  pane insets 24/32/20 w/ 8px gap, phone 12/12) adopted by /analytics, /agents, /media
  (incl. its layout wrapper and the page skeleton) and /third-party, replacing four
  drifting hand-rolled headers/containers (64px agent bar, p-[20px] panes). Analytics
  drops its duplicate phone-only 56px title row — one header per page at every width
  (the phone channel strip moved under it inside the shell). tsc clean.
- 2026-08-10 — phone calendar = Buffer: the Week/Month view dropdown joins the phone
  toolbar (beside the funnel; other filters stay behind the sheet) and actually switches
  views — the `Calendar` phone month→3-day coercion is removed, so Week = the rolling
  3-day hour grid and Month = a real 7-column grid at 390 (163px phone row floor on the
  cell inner per the grid-item min-height gotcha, 'ddd' weekday header, inline column
  template dodging the scss minmax(88px) grid-cols-7 fallback so nothing scrolls
  sideways). Month pills compact to 30×30 r6 mini-tiles on phone (thumbnail face, else
  centered 20px platform icon; time hidden); "N More" becomes a centered "+N" 11px muted
  row. Desktop untouched (all `phone:` variants). tsc clean.
- 2026-08-10 — phone calendar recalibrated to USER-PROVIDED Buffer phone screenshots
  (authoritative): month mini-tiles are ALWAYS the 30×30 hairline tile with the centered
  20px platform icon (media-thumbnail face removed), past-day tiles dim to 0.55; the
  "+N" overflow becomes a centered bordered pill (24px r8 white hairline, 13/500 ink),
  display-only at 390 (desktop expander/Show less untouched); phone week cards compact
  to single-row 36px r8 chips (18px icon + 15/400 time; snippet/thumb hidden); the phone
  toolbar title becomes an "August 10 ▾" chip (40px r8 newTableHeader) replacing the h2
  and the phone view dropdown, opening a new calendar bottom sheet (PhoneFilterSheet
  shell): [3 Days | Week | Month] segmented (boxFocused active), mini month picker (lime
  today circle, boxFocused anchor fill, 40px taps, day pick re-anchors via anchored
  getDateRange), divider + Today row. 3-vs-7 day phone week span = 'phone-week-span'
  cookie read fresh by WeekView's visibleDays. Desktop additions: month pills/week cards
  hover to white + soft shadow (user-flagged Buffer crop). Consistency sweep inside the
  two owned files: card kebab menus, day-view badge ring, action-menu divider and
  SetSelectionModal footer move off legacy `bg-fifth`/`tableBorder`/`border-fifth` onto
  newBgColorInner/newTableBorder. tsc clean.
- 2026-08-10 — content chat merged into the agent page (user: "why do we have an agent
  and a content page?"): admin-only [Assistant | Content] segmented joins the agent
  header actions (launches List|Calendar anatomy — 32px band, 4px inset, hairline r8,
  boxFocused/textItemFocused active); Content mode renders the bridge chat in the chat
  pane and hides the Threads rail + channel strip (bridge sessions aren't copilot
  threads; channel toggles feed the copilot only). content-chat.component drops its
  in-component page header for a slim in-pane 32px New chat strip (streaming/session
  logic untouched). `/content` nav item removed; the route survives as a redirect to
  `/agents/new?mode=content` (via /agents/new because /agents hard-redirects and drops
  the param), which preselects the Content segment for admins. tsc clean.
- 2026-08-10 — headers/nav loop iter 1 (sidebar): per-channel scheduled counts land on
  every channel row (Buffer a11y-tree anatomy: count at row end, muted 14px) via ONE
  batched SWR key of 1-row `/posts/list?page=1&limit=1&state=scheduled&integration=<id>`
  count queries (the filters.tsx loadTabCounts pattern, `expandPostsList().total`),
  60s refresh, skipped while the rail is collapsed — this also FIXES the Publish nav
  count, which read raw `.total`/`.posts` off the minified payload and had never
  rendered; channel-row hover actions become Buffer's pair: 24px "New post"
  (`/launches?newPost=1&integration=<id>`) + "Submenu" kebab (Manage channels /
  Channel analytics `/analytics?integration=<id>`), rendered as SIBLINGS of the row
  link (no nested anchors, real focusables, `phone:hidden` keeps drawer rows one big
  tap target; constant 52px trailing slot = zero hover/loading layout shift); channel
  search input grows to the 32px hairline spec and gains the dismissal contract (Esc
  closes+clears, blur-while-empty closes); Insights gets Buffer's visual "New" pill
  (`InsightsNewBadge`, 11px #EDE9FE/#7C3AED rounded-full, data-cs, single-const
  removable). Verified intact: 56px phone app bar (dot + streak only), push-down
  drawer w/ hidden logo row, 768–1100 tablet auto-rail + session override, footer
  utilities + org rows. tsc clean.

---

## 1. Routes (App Router map)

| Surface | Component/file | Status | Notes |
|---|---|---|---|
| `/schedule/calendar/month`, `/schedule/calendar/week`, `/schedule/calendar/day`, `/schedule/list` (Publish home, native Buffer URLs) | `app/(app)/(site)/schedule/calendar/[view]/page.tsx`, `schedule/list/page.tsx` → `launches/launches.component.tsx` (view read from the pathname via `launches/schedule.routes.ts`) | VERIFIED-PARITY | Maps to Buffer Publish; calendar/list/toolbar measured r1. The view lives in the PATH; dates/filters stay as query (startDate/endDate ≈ Buffer's ?date=). The calendar context's replaceState writer emits these URLs; `?display=` kept as a legacy override |
| `/schedule` (cookie hop), `/schedule/calendar` (→ week, Buffer default) | `app/(app)/(site)/schedule/page.tsx`, `schedule/calendar/page.tsx` | VERIFIED-PARITY | `/schedule` redirects to the `calendar-display`-cookie view (month default) like publish.buffer.com; both hops preserve every query param (?newPost=1, ?manageChannels=1, ?integration=, ...) |
| `/launches` legacy redirect | `app/(app)/(site)/launches/page.tsx` | N/A-INTERNAL | Query-preserving redirect to the native /schedule URL (display=list → /schedule/list, week/day → /schedule/calendar/week\|day, month/absent → /schedule/calendar/month); kept for old deep links + backend-emitted URLs (stripe/integration emails) |
| `/analytics` (Insights) | `app/(app)/(site)/analytics/page.tsx` → `platform-analytics/platform.analytics.tsx` | VERIFIED-PARITY | Measured vs buffer-insights-1440/390 + structure JSON |
| `/agents` → redirect `/agents/new` | `app/(app)/(site)/agents/page.tsx` | POSTIZ-ONLY-KEEP | No Buffer counterpart |
| `/agents/[id]` (AI agent chat + Content segment) | `agents/agent.tsx` + `agents/agent.chat.tsx` | POSTIZ-ONLY-KEEP | Restyled to token system (de7f7dc3); admin [Assistant \| Content] segmented hosts the bridge chat |
| `/content` → redirect `/agents/new?mode=content` | `app/(app)/(site)/content/page.tsx` | POSTIZ-ONLY-KEEP | Content chat merged into /agents; route kept so old links land on the Content segment (target is /agents/new because /agents hard-redirects and drops the param) |
| `/media` (Media library) | `app/(app)/(site)/media/page.tsx` → `new-layout/layout.media.component.tsx` | POSTIZ-ONLY-KEEP | Buffer has no media library page; chrome tokenized (de7f7dc3) |
| `/settings` | `app/(app)/(site)/settings/page.tsx` → `layout/settings.component.tsx` (SettingsPopup) | VERIFIED-PARITY | Rail + content measured vs buffer-settings-structure.json |
| `/third-party` (Integrations catalog) | `third-parties/third-party.component.tsx` | POSTIZ-ONLY-KEEP | No Buffer analog; fully tokenized in fleet (de7f7dc3) |
| `/plugs` | `plugs/plugs.tsx` | POSTIZ-ONLY-KEEP | Postiz automation plugs; no Buffer analog; shared PageShell/PageHeader + shared channels dropdown (single-select, replaced the phone chip strip + desktop ToolbarSelect) |
| `/billing`, `/billing/lifetime` | `billing/billing.component.tsx`, `billing/lifetime.deal.tsx` | N/A-INTERNAL | Billing disabled on the internal SSO instance; capability preserved |
| `/admin/errors`, `/admin/stats` | `admin/admin-errors.component.tsx`, `admin/admin-stats.component.tsx` | N/A-INTERNAL | Superadmin-only; restyled/skeletonized (bbe94a8c) |
| `/err` | `app/(app)/(site)/err/page.tsx` | N/A-INTERNAL | Error landing |
| `/auth/login` (+ `login-required`, `activate/[code]`, `forgot`, `forgot/[token]`) | `components/auth/**` | N/A-INTERNAL | Google SSO/OIDC only; registration disabled |
| `/oauth/authorize` | `app/(app)/oauth/authorize/page.tsx` | N/A-INTERNAL | Public-API OAuth consent; spinner tokenized (fc0f3cdf) |
| `/integrations/social/[provider]` | `launches/continue.integration.tsx` | N/A-INTERNAL | OAuth continue/redirect leg; spinner tokenized (fc0f3cdf) |
| `/p/[id]` public post preview | `app/(app)/(preview)/p/[id]` → `preview/preview.wrapper.tsx` | POSTIZ-ONLY-KEEP | Kit-converted 2026-08-10 (shareable, so on-brand): theme-aware `bg-newBgColor` canvas (was hard #000), brand row per the sidebar rule (mark + Fustat wordmark; white-only logo died in light mode), muted date, white r12 hairline post cards w/ surface-ringed platform badge, r12 comments card; all logic kept |
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
| Admin/impersonation bottom-center pill + popover (no top strip) | `layout/impersonate.tsx` | VERIFIED-PARITY | beb4c215; coupon panel spinner fc0f3cdf; phone: 28px pill docked bottom-end, 12px inset (content overlap fix) |
| Support "?" bubble (36px, #def0ff, bottom-right) | `layout/support.tsx` | VERIFIED-PARITY | Matches measured Buffer helpcenter bubble |
| Chatbase embed launcher (position/theme vs Buffer bubble) | `layout/chatbase.component.tsx` | VERIFIED-PARITY | 2026-08-10: scoped `<style>` override moved INTO the component (mounts only with the widget - CHATBASE_TOKEN gate, so self-hosted ships nothing); launcher -> Buffer help-bubble slot per new measurement: 44px light circle bottom-right 16px inset, white + hairline, branding glyph hidden, ink circled-"?"; id-keyed selectors degrade to widget default if Chatbase changes DOM. NOTE: Discord fallback bubble (support.tsx) still carries the earlier 36px/#def0ff/20px measurement |
| Announcement banner / top tip | `layout/announcement.banner.tsx`, `layout/top.tip.tsx` | POSTIZ-ONLY-KEEP | Admin-pushed announcements; shown in preview wrapper + layout |
| Dark/light mode switch | `layout/mode.component.tsx` | POSTIZ-ONLY-KEEP | Dark theme mirrors with white-alpha hairlines per spec |
| Language selector | `layout/language.component.tsx` | POSTIZ-ONLY-KEEP | i18n picker |
| RTL direction handling | `new-layout/change.dir.tsx`, `change.dir.client.tsx` | POSTIZ-ONLY-KEEP | Logical properties already used throughout |
| Toaster (toast notifications) | `libraries/react-shared-libraries/src/toaster/toaster.tsx` | VERIFIED-PARITY | Measured 2026-08-10: surface bg #f6f6f4 on 1px #e6e5e2 hairline, r12, 20px icon slot, 14px ink body, soft shadow (0 4 12 black/8%). Exact hexes kept — bg-newTableHeader (#f4f3f0) is close but NOT equal and the border token is an alpha. Our top-center position + 4200ms timing stay; dark card + glow ellipse retired; icon inks deepened for the light surface (#16a34a / #d97706) |
| Tooltips (react-tooltip surface) | `layout/top.tip.tsx` mount, app-wide `data-tooltip-id="tooltip"` | VERIFIED-PARITY | Partially measured 2026-08-10: max-w 170px + body line-height (1.5) + 13px body applied as ! overrides on the shared mount (react-tooltip injects core CSS at runtime); colors deliberately stay ours per orchestrator. Unmeasured leftovers (radius, arrow, delay) ride react-tooltip defaults |
| Generic modal wrapper (Mantine) | `layout/new-modal.tsx`, `new-launch/modal.wrapper.component.tsx` | NEEDS-BUFFER-MEASUREMENT | Backdrop DONE (measured 2026-08-10): plain rgba(0,0,0,0.8), NO blur — new-modal overlays bg-popup→bg-black/80, blurMe blur-xs dropped (pointer guard kept). ORCHESTRATOR: the remaining blur/backdrops live OUTSIDE this wave's files — global.scss `.mantine-Modal-inner { backdrop-filter: blur(10px) }` (~:652) + `.mantine-Overlay-root` rgba(65,64,66,.3) (~:661), and bg-popup in post.url.selector.tsx:121 / finish.trial.tsx:36. Still measure: modal radius/shadow, close-X geometry, title row spacing |
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
| Publish scheduled-count badge (muted right-aligned) | `new-layout/sidebar.tsx` (sidebar-scheduled-counts SWR) | VERIFIED-PARITY | Exact total via a 1-row /posts/list count query read through expandPostsList (old raw `.total` read never decoded the minified payload, so the badge silently never rendered); 60s refresh, skipped while the rail is collapsed |
| Insights "New" nav badge (10–11px violet pill after the label) | `new-layout/sidebar.tsx` `InsightsNewBadge` | VERIFIED-PARITY | Purely visual Buffer-ships-one pill (#EDE9FE/#7C3AED, rounded-full, data-cs); removable by deleting the single const + its one call site |
| Utility rows demoted below hairline (Plugs, Integrations, Settings) | `new-layout/sidebar.tsx` | VERIFIED-PARITY | Utilities-in-footer move (87488ff3) |
| "Channels" section header + hover-revealed search/gear + inline filter | `new-layout/sidebar.tsx` | VERIFIED-PARITY | Search toggles a 32px hairline input filtering rows client-side (case-insensitive name match); Esc or blur-while-empty closes |
| Channel rows (avatar 32 + platform badge, name, resting scheduled count, hover actions) | `new-layout/sidebar.tsx` + `new-layout/channel-row.tsx` | VERIFIED-PARITY | Buffer anatomy: link = name + per-channel scheduled count (exact, batched 1-row count queries in ONE SWR key, 60s refresh, rail-collapsed skip); hover swaps count for 24px "New post" (`/schedule?newPost=1&integration=<id>`) + Submenu kebab (Manage channels / Channel analytics `/analytics?integration=<id>`), desktop-only (`phone:hidden` — drawer rows stay one tap target) |
| Per-channel queue views (channel row opens its own queue) | `new-layout/sidebar.tsx` → `/schedule?integration=` | VERIFIED-PARITY | a3311c74; additive nav behavior |
| Connect-more quick icons (unconnected-only, 24px full-bleed tiles, + button) | `new-layout/sidebar.tsx` | VERIFIED-PARITY | Filtered to unconnected, cap 3 |
| "Locked channels · N ›" expander | `new-layout/sidebar.tsx` | VERIFIED-PARITY | Billing-gated; hidden when N=0 |
| Channels-limit upsell card (progress dashes, Upgrade for More) | `new-layout/sidebar.tsx` | VERIFIED-PARITY | FREE-tier gated, dismissable |
| Org footer row (logo 32, org name + plan, collapse control) | `new-layout/sidebar.tsx` | VERIFIED-PARITY | panel-left-close/open glyphs split; 2026-08-10: row is now the org-menu trigger (Buffer pattern), hover wash, collapse control a sibling |
| Org row menu (popover above the footer row: Settings, hairline, Log out in critical ink) | `new-layout/sidebar.tsx` + `layout/logout.component.tsx` (`useLogout`) | VERIFIED-PARITY | Added 2026-08-10: kit popover (white r8 hairline, p4, soft shadow, 32px r6 rows), opens above; Log out #FF3F3F reuses the exact existing flow via `useLogout` (confirm dialog + cookie/oauth branch); collapsed 52px rail: bottom org mark opens the same popover anchored start |
| Org switcher popover (click org footer) | `layout/organization.selector.tsx` | NEEDS-BUFFER-MEASUREMENT | Restyled to kit 2026-08-10: white r8 hairline panel + soft shadow, 32px r6 rows, 24px initial avatar, check on active org, lime asOpenSelect CTA — legacy bg-third/tableBorder removed. Remaining: measure Buffer's org menu if one exists (see §Measure) |
| Collapse rail (52px icon rail, expand control) | `new-layout/sidebar.tsx` | VERIFIED-PARITY | b82cb93a + ada738e4 |
| Notifications bell + dropdown (in sidebar utilities) | `notifications/notification.component.tsx` | POSTIZ-ONLY-KEEP | Postiz-only feature, kit-styled 2026-08-10: white r8 panel (shared panel shadow/hairline), 32px-min 14px ink rows, hairline dividers, unread = header wash + semibold (legacy seventh flash/tableBorder/fifth scrollbar removed) |
| Menu item primitive | `new-layout/menu-item.tsx` | VERIFIED-PARITY | Shared row styling |
| Side panel primitives (224px calibrated width, headers, collapse) | `new-layout/side-panel.ts`, `side-panel-header.tsx` | VERIFIED-PARITY | Used by launches/agents (analytics + plugs moved to the shared channels dropdown; their [data-side-panel] chip-strip scss removed as dead) |
| Mobile integration row variant | `new-layout/mobile.integration.tsx` | VERIFIED-PARITY | Phone drawer channel rows |

## 4. Publish — page header & toolbar

| Surface | Component/file | Status | Notes |
|---|---|---|---|
| Page header row (40×40 r10 icon chip, 20/400 display title, bookmark, right cluster) | `launches/filters.tsx` PageHeader | VERIFIED-PARITY | Rhythm 25/48/33/8/48 (de7f7dc3); now the measured reference cloned into the shared `new-layout/page-header.tsx` |
| Bookmark "Save current view" click behavior | `launches/filters.tsx` | NEEDS-BUFFER-MEASUREMENT | Click Buffer's bookmark icon: what opens (save-view dialog? named views list?), panel geometry + fields |
| Feedback bubble button (header right) | `launches/filters.tsx` | NEEDS-BUFFER-MEASUREMENT | Click Buffer's comment/feedback icon in the header: what surface opens (feedback form? beacon?), size + fields |
| List/Calendar segmented control (white, hairline, 32px, 4px pad, 32% green active tint) | `launches/filters.tsx` | VERIFIED-PARITY | Tint + container corrected |
| "+ New Post" primary button | `launches/filters.tsx` | VERIFIED-PARITY | Lime + black ink brand slot |
| Calendar toolbar left group (‹ › adjacent 32×32, H2 16/500, Today chip, view combobox) | `launches/filters.tsx` | VERIFIED-PARITY | Measured order/geometry |
| Week-view H2 shows "August 2026" (not a date range) | `launches/filters.tsx` getDisplayText | VERIFIED-PARITY | Gap fix landed |
| View combobox menu (Week/Month only, check-left rows) | `launches/filters.tsx` | VERIFIED-PARITY | 200px r6 p8 panel; DESKTOP-only now — the phone view switch moved into the date chip's calendar sheet (user phone screenshots) |
| Phone date chip + calendar bottom sheet ("August 10 ▾" → Calendar title, [3 Days\|Week\|Month] segmented, mini month picker, Today row) | `launches/filters.tsx` PhoneCalendarSheet | VERIFIED-PARITY | Per user phone screenshots: 40px r8 newTableHeader chip 16/500; sheet = PhoneFilterSheet shell; 44px segmented w/ boxFocused active; 40px day taps, lime today circle, boxFocused anchor fill; picking a day re-anchors the range (getDateRange anchored); 3-vs-7 week span via 'phone-week-span' cookie read by WeekView. Loop i1 lime-today probe re-verified in code: isToday→bg-btnPrimary/text-black/rounded-full precedes the anchor boxFocused fill (filters.tsx PhoneCalendarSheet gridDays cells), both states per spec; the failing live probe predates the 3a5dabbe deploy — re-probe after next deploy |
| Channels filter dropdown (380 r12: search, Select all, 48px avatar+checkbox rows) | `new-layout/channels-dropdown.tsx` via `launches/filters.tsx` ChannelsFilter | VERIFIED-PARITY | f67b9c9b + r1 measurements; presentation extracted to the shared ChannelsDropdown (multi mode) so Insights/Plugs reuse it — calendar behavior unchanged (same ?integration= replaceState plumbing) |
| All Posts select (All/Drafts/Scheduled/Sent, check-left) | `launches/filters.tsx` | VERIFIED-PARITY | aa2ce4bc |
| Tags filter dialog (256 r12: Untagged, colored pill rows, Clear all + Settings footer) | `launches/filters.tsx` | VERIFIED-PARITY | aa2ce4bc |
| No Date toggle + Undated drafts right panel (~300px, empty state) | `launches/filters.tsx` UndatedDraftsPanel | VERIFIED-PARITY | de6ca24f |
| Timezone dialog (315 r12, "City (GMT+X)" rows, pinned current) | `launches/filters.tsx` | VERIFIED-PARITY | Display-timezone read path (aa2ce4bc) |
| Filter trigger buttons (32px, transparent, full ink, 16px icons/chevrons) | `launches/filters.tsx` | VERIFIED-PARITY | Metrics converged |
| List tabs (Queue · Drafts · Approvals⚡ · Sent, count pills, ink underline on hairline track, 45px on rule) | `launches/filters.tsx` | VERIFIED-PARITY | de6ca24f + 03770f12; Approvals real since bbe94a8c |
| Per-tab count fetch (4 parallel state counts) | `launches/filters.tsx` + `calendar.context.tsx` | VERIFIED-PARITY | Includes approvals tag count |
| Phone toolbar (single row: ‹ › date chip, funnel, icon-only segmented) | `launches/filters.tsx` | VERIFIED-PARITY | 139cca46; reworked per user phone screenshots: the static month h2 and the phone view dropdown are replaced by the "August 10 ▾" chip → PhoneCalendarSheet |
| Phone filter bottom sheet (drag handle, scrim, drill-in rows) | `launches/filters.tsx` | VERIFIED-PARITY | Measured vs buffer-phone-filtersheet.png |
| Phone green icon-only "+" (40 r8) | `launches/filters.tsx` | VERIFIED-PARITY | 139cca46 |
| Last-view restore (list/month/week cookie) | `launches/filters.tsx` | VERIFIED-PARITY | 82563526; month default (87488ff3) |

## 5. Calendar — Month view

| Surface | Component/file | Status | Notes |
|---|---|---|---|
| Month grid (Sunday-first, uniform ~205px rows growing in flow, outer hairline, square corners) | `launches/calendar.tsx` MonthView | VERIFIED-PARITY | In-flow growth + Chrome minmax fix (de7f7dc3); phone: REAL 7-col grid at 390 (~51px cols, 163px row floor, 'ddd' header) — columns set inline so the scss minmax(88px) grid-cols-7 fallback can't force sideways scroll |
| Weekday header row (36px white, hairline, /70 ink) | `launches/calendar.tsx` | VERIFIED-PARITY | Two-tone → white retune |
| Cell wash model (weekend/other-month/past washed; today/future white; wash month-only) | `launches/calendar.tsx` + `global.scss` | VERIFIED-PARITY | Hatching removed; flat #f4f3f0-family |
| Today marker (day number in 24px lime circle, black ink) | `launches/calendar.tsx` | VERIFIED-PARITY | Brand map of Buffer's green circle |
| Day-number three-tone ink hierarchy | `launches/calendar.tsx` | VERIFIED-PARITY | current/past/other tones |
| Month post pills (h33 r8 p4: 20px brand chip · h:mm A 13px ink · 23px r6 thumb, 8px insets) | `launches/calendar.tsx` CalendarItem | VERIFIED-PARITY | de7f7dc3 chips pass; phone (user screenshots): 30×30 r6 hairline mini-tile, ALWAYS the centered 20px platform icon (never media), no time; past-day tiles dim to 0.55; desktop hover = white + soft shadow ([@media(hover:hover)]-guarded, loop i1) |
| Pill media thumbnails (backend `image` field) | `launches/calendar.tsx` + backend posts payload | NEEDS-WORK | Code landed (aa2ce4bc) but live deploy predates the field — verify thumbnails render after next deploy (month/week/list all gated on this) |
| Past pills never grayscale | `launches/calendar.tsx` | VERIFIED-PARITY | !grayscale removed |
| "N More" expander / "Show less" (16px chevron, 14/500 ink, left-aligned) | `launches/calendar.tsx` | VERIFIED-PARITY | Glyph + collapse retreated; phone month (user screenshots): centered bordered "+N" pill (24px r8 hairline white, 13/500 ink), display-only — no expansion at 390; desktop click + Show less unchanged |
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
| Week cards (natural height, r10 p10: 16px chip + h:mm A 14/500, 2-line 13px snippet, 44px thumb side-by-side) | `launches/calendar.tsx` CalendarItem | VERIFIED-PARITY | de7f7dc3; desktop hover = white + soft shadow (now [@media(hover:hover)]-guarded so touch taps never latch it); phone (loop i1, Buffer chip measured 31px): single-row 32px r8 px8 chip — 18px icon + 15/400 time only, snippet/thumb hidden |
| Week card thumbnails | backend `image` field | NEEDS-WORK | Same deploy gate as month pills |
| Sunday-first week ranges everywhere (context + filters) | `launches/calendar.context.tsx` | VERIFIED-PARITY | isoWeek → week |

## 7. Calendar — Day view & phone

| Surface | Component/file | Status | Notes |
|---|---|---|---|
| Phone 3-day rolling hour grid (~80px rows, 48px gutter, "Mon 10" headers) | `launches/calendar.tsx` WeekView machinery | VERIFIED-PARITY | Measured vs buffer-month-phone390.png; the calendar sheet's 3 Days option — its Week option shows all 7 days ('phone-week-span' cookie '3'\|'7', default '3', read fresh in visibleDays) — Month renders the real month grid, no more phone coercion in `Calendar` |
| Phone 7-day week span (calendar sheet "Week"): ~100px day columns, grid scrolls sideways | `launches/calendar.tsx` WeekView (sevenSpan) | VERIFIED-PARITY | Loop i1, orchestrator-measured vs Buffer (chips 101x31 at 390, no page overflow): columns minmax(100px,1fr) when the cookie is '7'; sideways scroll lives on the existing overflow-auto grid container; day headers stay sticky-top, the 48px time gutter pins sticky-start (z-15) with the corner spacer pinned both axes (z-30); 3-day span and desktop untouched |
| Desktop Day view (kept, not in the desktop combobox) | `launches/calendar.tsx` DayView | POSTIZ-ONLY-KEEP | Buffer desktop has Week/Month only; Day retained for phone + alias routes |
| Phone full-bleed calendar card | `launches/calendar.tsx` + layout | VERIFIED-PARITY | r1 phone pass |

## 8. Publish — List/Queue view

| Surface | Component/file | Status | Notes |
|---|---|---|---|
| Queue block centered in content pane | `launches/calendar.tsx` ListView | VERIFIED-PARITY | Measured 2026-08-10 (Buffer: rail starts 194px in, 699px cards, symmetric 195px right gap): rail+card block wrapped in one `mx-auto w-full max-w-[800px]` column; phone stays full-width |
| Day group headers ("Tomorrow, August 11" two-tone) | `launches/calendar.tsx` ListView | VERIFIED-PARITY | Re-measured 2026-08-10: 16px font-[550] on the whole line (weekday full ink, date muted) — replaces the r1 600-weekday-only weight |
| List tab URLs (?tab=queue\|drafts\|approvals\|sent) | `launches/calendar.context.tsx` | VERIFIED-PARITY | Buffer writes ?tab=sent on /schedule/list — setListState mirrors the tab via replaceState, the context seeds listState from ?tab= on mount ('all' default kept when absent/invalid), and setFilters' URL rewrite carries ?tab only while the target view is the list |
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
| Post preview modal (existing post quick view) | `launches/general.preview.component.tsx` | VERIFIED-PARITY | Interior kit-converted 2026-08-10: 14px ink name / muted handle, hairline (1px token) thread connector, surface-ringed platform badge — customColor25/26/27 + border-fifth removed; shell is the call sites' Buffer-measured r12 hairline preview card |
| Post statistics modal (clicks/short-link stats) | `launches/statistics.tsx`, `calendar.tsx` Statistics | VERIFIED-PARITY | Kit-converted 2026-08-10: 16/600 section heads, cards keep header-wash/hairline r12 (blue hover + purple/green/blue gradient charts dropped), chart now flat #2f7d44 2px line w/ hairline gridlines + token tooltip (local FlatMetricLine; skeleton loading kept), short-links table = hairline r8 frame + header wash (bg-forth/customColor6 removed). Buffer sent-post stats strip tracked in its own §Measure row |
| Sent-post per-card stats (Buffer Sent tab shows metrics under cards) | `launches/calendar.tsx` SentPostStats | VERIFIED-PARITY | Measured 2026-08-10: hairline divider above a 14px-ink strip, font-[550] values + labels, gap 16; platform-dependent metric set as returned by GET /analytics/post/:id?date=30 (recent-posts.tsx fetch pattern, shared SWR key). List view + Sent tab only (DayView reuses the card shape and never fetches); lazy per visible card via IntersectionObserver, 5-min dedupe; posts without releaseId render nothing |
| Delete post flow | `launches/calendar.tsx` DeletePost | VERIFIED-PARITY | Behind confirm dialog (surface itself → §Measure generic dialog) |
| Set selection modal (apply a Set from calendar) | `launches/calendar.tsx` SetSelectionModal | POSTIZ-ONLY-KEEP | Sets are Postiz-only |
| Missing-release modal | `launches/missing-release.modal.tsx` | POSTIZ-ONLY-KEEP | Kit-converged 2026-08-10: selected tile #612BD3 -> lime border-btnPrimary, hover -> hairline, tableBorder -> newTableBorder, Cancel -> Button secondary, /70 -> /60 muted, sm:/lg: grid -> grid-cols-5 phone:grid-cols-3 |
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
| Modal shell (near-full-bleed, bg, radius, padding, backdrop) | `new-launch/manage.modal.tsx` | NEEDS-BUFFER-MEASUREMENT | Tablet done (composer r1): ≤1100px = full-viewport sheet, no radius (scoped `@media` — `max-[...]` variants don't compile against the raw `screens` config). Phone loop 2026-08-10 re-verified the fill chain: host opens `removeLayout+fullScreen` → `fixed w-full h-full` wrapper (new-modal), body scroll-locked, shell `h-full` + `phone:p-0`, so the sheet is x0 y0 viewport-sized with no page bleed. Still measure: backdrop opacity, desktop outer size/radius confirmation |
| Header row ("Create Post" title, Tags chip, right cluster: Templates?, AI Assistant, Preview toggle, expand, X) | `new-launch/manage.modal.tsx` | VERIFIED-PARITY | Composer r1 measured: title 18/500 Inter (body face, not display); quiet header buttons 40px px12 r8 15/500 textItemBlur + wash hover (Preview active keeps boxFocused pair); close X 40px; Tags chip 40px r8 hairline 15/500 ink. Phone loop 2026-08-10: header keeps title + Tags chip + Preview toggle (glyph-only, quiet; drives the phone overlay) + 40px close, matching Buffer 390 (Templates/AI omitted per no-dead-buttons) |
| Channel avatar selector row (avatars 40 + badges, `+` tile, selected ring) | `new-launch/select.current.tsx`, `picks.socials.component.tsx` | VERIFIED-PARITY | Composer r1 measured: 40px rounded-[12px] tiles (was r10) on tile + image wrapper + `+` tile; lime ring selection kept |
| Per-network customize tab strip (when customizing per channel) | `new-launch/select.current.tsx` + store | NEEDS-BUFFER-MEASUREMENT | In Buffer click "Customize for each network": tab strip anatomy (icon chips? underline?), per-network panel transitions |
| Global vs per-channel editor split ("Customize for each network" flow) | `new-launch/store.ts` + `manage.modal.tsx` | VERIFIED-PARITY | Functional parity (Postiz global/internal values model preserved) |
| Editor area (tiptap: placeholder, 15px body, min height) | `new-launch/editor.tsx` | NEEDS-BUFFER-MEASUREMENT | Measure "Start writing…" placeholder color/size, body line-height, editor padding, focused state |
| Editor icon row (+ media, emoji, # tags position bottom-left) | `new-launch/editor.tsx` | NEEDS-BUFFER-MEASUREMENT | Measure icon row: order, 16px?, spacing, hover fills |
| Media drag-drop zone (dashed, r8) | `new-launch/editor.tsx` + `media/media.component.tsx` MultiMediaComponent | NEEDS-BUFFER-MEASUREMENT | Composer r1: "select a file" link now Buffer green #2f7d44 15/400 hover-underline (links follow Buffer; buttons stay Cuesoft). Still measure: dashed border color/width, min height, icon + copy, drag-over state |
| Attached-media thumbnails strip in editor | `media/media.component.tsx` MultiMediaComponent | NEEDS-BUFFER-MEASUREMENT | Measure thumb size/radius, remove-X, reorder affordance, video badge |
| Bold / Underline text-style buttons (unicode styling) | `new-launch/bold.text.tsx`, `u.text.tsx` | POSTIZ-ONLY-KEEP | Unicode-trick styling; Buffer has none |
| Emoji picker | `new-launch/editor.tsx` (emoji-picker-react) | POSTIZ-ONLY-KEEP | Third-party picker themed by mode |
| Signature box (choose/insert signature) | `components/signature.tsx` SignatureBox | POSTIZ-ONLY-KEEP | Signatures are Postiz-only |
| @-Mention suggestion dropdown (per-platform mentions) | `new-launch/mention.component.tsx` | VERIFIED-PARITY | Tokenized + skeletons (fc0f3cdf); Postiz-only capability |
| AI Assistant (Copilot textarea/completions in editor) | `new-launch/editor.tsx` + CopilotKit | POSTIZ-ONLY-KEEP | Buffer's AI Assistant differs; ours preserved |
| AI image generation modal | `launches/ai.image.tsx` | POSTIZ-ONLY-KEEP | No Buffer counterpart; kit-styled 2026-08-10: 13px muted labels, white hairline r6 textarea, 32px r8 style chips (lime selection replaces upstream purple), lime Generate button; generation flow + spinner-in-trigger kept (bg-input/inputText/border-fifth removed) |
| AI video generation (modal + provider select) | `launches/ai.video.tsx`, `videos/video.wrapper.tsx`, `video.render.component.tsx`, `video.context.wrapper.tsx` | POSTIZ-ONLY-KEEP | No Buffer counterpart; check tokens during next sweep |
| AI video providers (Veo3, image-text-slides) | `videos/providers/veo3.provider.tsx`, `image-text-slides.provider.tsx` | POSTIZ-ONLY-KEEP | Provider forms |
| Post generator (AI generate posts from prompt/URL) | `launches/generator/generator.tsx` | POSTIZ-ONLY-KEEP | Postiz-only |
| Thread finisher (add-another-post in thread) | `new-launch/finisher/thread.finisher.tsx` | POSTIZ-ONLY-KEEP | Threads/multi-post trains |
| Add post button (thread segment add) | `new-launch/add.post.button.tsx` | POSTIZ-ONLY-KEEP | Thread segments |
| Delay-between-posts control | `new-launch/delay.component.tsx` | POSTIZ-ONLY-KEEP | Tokenized |
| Tags picker in composer (create/select tags) | `launches/tags.component.tsx` | VERIFIED-PARITY | Tokenized; tag colors → §Measure tags manager |
| Tags manager (create/edit tag: name + color swatches) | `launches/tags.component.tsx` TagsComponentInner | NEEDS-BUFFER-MEASUREMENT | Open Buffer Tags settings/new tag: dialog geometry, name input, color swatch grid (swatch size, palette, selected ring), save/cancel row |
| Date/time picker (schedule field) | `launches/helpers/date.picker.tsx` | NEEDS-BUFFER-MEASUREMENT | Trigger done (composer r1): reshaped via `#cs-datetime` scoped skin + chevron segment in manage.modal into Buffer's split button — left calendar+label h40 start-r12 px12/8 15/500 ink hairline, attached end-r12 chevron (shared border, same action). Phone loop 2026-08-10: popover day-cell hover = measured #e6e5e2 wash (light only, scoped CSS in manage.modal; selected day keeps its lime). Still measure: popover mini-calendar geometry, time field, timezone hint |
| "Next Available"-style schedule dropdown / footer split | `new-launch/manage.modal.tsx` footer | VERIFIED-PARITY | Composer r1 measured: split date button applied (see date picker row); footer family h-40 r12 (lime primaries + draft + repeat) so the row reads as one family; Postiz Post Now hover-dropdown semantics kept |
| Footer actions: Save as Draft / Add to calendar / Schedule / Update / Post Now | `new-launch/manage.modal.tsx` | VERIFIED-PARITY | All Postiz semantics preserved; composer r1: primaries/draft rounded-[12px] h-40 (draft 15/500) per Buffer footer family. Phone loop 2026-08-10: primary label shortens at phone via span swap (Buffer shows "Customize" at 390) — "Add to calendar"→"Schedule", "Check the circles above"→"Pick channels", "Create output"→"Create"; desktop labels untouched |
| Repeat/recurring post control | `launches/repeat.component.tsx` | POSTIZ-ONLY-KEEP | intervalInDays; no Buffer analog |
| Customer selector (agency per-customer posting) | `launches/select.customer.tsx`, `customer.modal.tsx` | POSTIZ-ONLY-KEEP | Explicitly keep |
| Post-URL selector (link a repo/release URL) | `post-url-selector/post.url.selector.tsx` | POSTIZ-ONLY-KEEP | Postiz-only |
| Web3 posting providers (Telegram/Nostr/Warpcast/Moltbook connect dialogs) | `launches/web3/**` | POSTIZ-ONLY-KEEP | Explicitly keep; wrapcaster spinner tokenized (fc0f3cdf) |
| Right "Post Previews" panel (420px: header, per-network preview, hints) | `new-launch/manage.modal.tsx` + `provider-preview/preview.provider.component.tsx` | NEEDS-BUFFER-MEASUREMENT | Phone loop 2026-08-10: at phone the same mounted pane (provider refs validate through it) presents full-width inside the modal via the header Preview toggle (`showPreviewPhone`, editor column display-hidden meanwhile). Still measure (desktop): width, "Post Previews" type, network switcher, preview card chrome (device frame? plain card?), skeleton |
| Per-network preview renderers | `new-launch/providers/*/…preview…`, `provider-preview/**` | POSTIZ-ONLY-KEEP | Platform-accurate previews; keep all |
| Composer comments (per-post comment thread) | `launches/comments/comment.component.tsx` | VERIFIED-PARITY | Rewired to per-post endpoints + restyled (de7f7dc3); quiet bordered Add-comment (ac9b7c33) |
| Buffer comments UI reference | — | NEEDS-BUFFER-MEASUREMENT | Open a Buffer post's comment thread: panel placement (side? below?), avatar row, input geometry, timestamp style — confirm our dialog matches the pattern |
| Phone composer (editor owns full width; preview via header toggle overlay) | `new-launch/manage.modal.tsx` | VERIFIED-PARITY | 02e62616, then phone parity loop 2026-08-10: full-viewport sheet (fixed fullScreen host + ≤1100px scoped `@media`, radius 0, p 0); header keeps title/Tags chip/Preview toggle (glyph-only at phone)/40px close; footer primary swaps to a short label at phone; preview = the mounted side pane shown full-width via the toggle |
| Buffer phone composer reference | — | VERIFIED-PARITY | Measured 390x844 (orchestrator screenshot 2026-08-10): full-screen sheet r0; header "Create Post" (wraps) + Tags chip + glyph-only Templates/AI/Preview + X; channels row avatars + `+` tile; editor full-width w/ dashed drop zone + emoji row; footer "Create Another" + Next Available split + lime "Customize" short-label primary. Ours matches except Templates/AI Assistant (omitted per no-dead-buttons) and Create Another (no Postiz analog) |
| Close-with-unsaved-changes confirm | `new-launch/manage.modal.tsx` | VERIFIED-PARITY | Confirm dialog flow kept |
| Editor helpers (headings, bullets, links) | `new-launch/heading.component.tsx`, `bullets.component.tsx`, `a.component.tsx` | POSTIZ-ONLY-KEEP | Long-form platforms (dev.to/Hashnode/WordPress) |
| Dummy code block (API-created posts) | `new-launch/dummy.code.component.tsx` | POSTIZ-ONLY-KEEP | Debug/code display |
| Set creation from composer (addEditSets) | `new-launch/manage.modal.tsx` + `sets/sets.tsx` | POSTIZ-ONLY-KEEP | Sets pipeline |
| Information/help popover in composer | `launches/information.component.tsx` | POSTIZ-ONLY-KEEP | Contextual help |
| Composer settings modal (per-channel Settings title row) | `launches/settings.modal.tsx` | POSTIZ-ONLY-KEEP | Wraps provider settings |
| Provider settings shared form styling (inputs/selects inside per-network tabs) | `new-launch/providers/high.order.provider.tsx` | NEEDS-BUFFER-MEASUREMENT | Phone loop 2026-08-10: composer text-input hover border = measured #8a8a88 (Buffer --color-border-neutral), scoped CSS in manage.modal (light only; focus keeps border-forth). Still measure: input geometry, labels, helper text (Instagram first comment, Pinterest board/title, YouTube title) |

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
| Platform picker step (choose platform → variant) | `launches/helpers/pick.platform.component.tsx` | VERIFIED-PARITY | Multi-select tiles converged 2026-08-10 on the picks.socials Buffer channel-tile spec: 40px r10 (data-cs), ring-2 ring-btnPrimary selected / opacity-60 hover:100 unselected, 16px r4 badge; single-select Buffer chip untouched except badge border-fifth → surface ring |
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
| Page header (icon chip + "Media" + Upload primary top-right) | `media/media.component.tsx` + `new-layout/layout.media.component.tsx` | VERIFIED-PARITY | Shared `PageHeader`/`PageShell` (page-header.tsx): 48px row (56 phone), launches pane rhythm replaces the p-[20px] wrapper; Upload primary passed through unchanged |
| Upload button (lime primary h32 r8) | `media/media.component.tsx` | VERIFIED-PARITY | Promoted per fleet |
| Uppy uploader (dashboard strip gated on activity, progress) | `media/new.uploader.tsx`, `media/media.component.tsx` | VERIFIED-PARITY | Idle dead-space fix |
| Media grid tiles (r8, hover-only filename chip, quiet maximize) | `media/media.component.tsx` | VERIFIED-PARITY | Fleet fixes |
| Search input (32px, capped width) | `media/media.component.tsx` | VERIFIED-PARITY | Fleet |
| Pagination (32×32 r8 pager, admin-pill clearance) | `media/media.component.tsx` Pagination | VERIFIED-PARITY | Fleet + S6 clearance |
| Empty state (64px circle + image icon) | `media/media.component.tsx` + `cuesoft/empty-state.tsx` | VERIFIED-PARITY | Violet illustration retired |
| Media picker modal (showMediaBox select-into-composer) | `media/media.component.tsx` MediaBox/ShowMediaBoxModal | VERIFIED-PARITY | Quiet variant kept in-picker |
| Insert-media toolbar (composer/agents attachment row) | `media/media.component.tsx` (b2 buttons) | VERIFIED-PARITY | 32px/r8 convergence (fleet) |
| AI image entry from media | `launches/ai.image.tsx` | POSTIZ-ONLY-KEEP | Same dialog as §9 row — kit-styled 2026-08-10; toolbar trigger chip stays matched to its Insert/Design Media siblings, spinner now currentColor |
| Video generation from media (providers) | `videos/**` | POSTIZ-ONLY-KEEP | |
| Polonto design editor (Polotno canvas) | `launches/polonto.tsx`, `polonto/polonto.picture.generation.tsx` | POSTIZ-ONLY-KEEP | Third-party editor; theme wrapper only |
| Third-party media import (HeyGen video into library) | `third-parties/third-party.media-library.tsx`, `third-party.media.tsx`, `providers/heygen.provider.tsx` | POSTIZ-ONLY-KEEP | Spinner/skeleton tokenized (fc0f3cdf) |
| Agent media modal (insert media from chat) | `layout/agent.media.modal.tsx` | POSTIZ-ONLY-KEEP | |

## 13. Insights (/analytics)

| Surface | Component/file | Status | Notes |
|---|---|---|---|
| Page header (bar-chart chip + title) | `new-layout/page-header.tsx` on `platform.analytics.tsx` | VERIFIED-PARITY | Shared `PageHeader`/`PageShell`; ONE header at every width (separate 56px phone copy removed) |
| Channel selection (shared channels dropdown, single-select: avatar+name trigger, check-left rows) | `platform.analytics.tsx` + `new-layout/channels-dropdown.tsx` | VERIFIED-PARITY | Replaced the phone chip strip (user request: calendar-style dropdown at every width, first control of the Insights toolbar); phone = 40px trigger + bottom sheet; refresh-needed channels stay selectable — the pane's refresh card (render.analytics) takes over, same path the Channels table rows allow |
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
| Page header (sparkle chip + title + New chat primary; phone icon-only) | `new-layout/page-header.tsx` on `agents/agent.tsx` | VERIFIED-PARITY | Shared `PageHeader`/`PageShell` (48px row replaces the hand-rolled 64px bar); lime New chat kept as the actions slot (Assistant mode only) |
| [Assistant \| Content] header segmented (admin-only) | `agents/agent.tsx` | POSTIZ-ONLY-KEEP | Launches List\|Calendar anatomy (32px band, 4px inset, hairline r8; active boxFocused/textItemFocused); preselects from ?mode=content; mode written back via history.replaceState |
| Threads rail ("Chats" header, 32px r8 rows, collapse, empty state) | `agents/agent.tsx` | VERIFIED-PARITY | Fleet; sidePanelRoot width calibrated |
| Channel toggle bar (composer-style avatar toggles, 40px, ring on-state) | `agents/agent.tsx` AgentList | VERIFIED-PARITY | 7ce47dff + S5 sizing |
| Chat pane (CopilotKit: Inter inherit, tokened bubbles/input, r12 input) | `agents/agent.chat.tsx`, `agent.styles.scss` | VERIFIED-PARITY | Fleet token pass |
| Welcome copy (Cuesoft agent, correct directions) | `agents/agent.chat.tsx` | VERIFIED-PARITY | S3 rewrite |
| Insert media portal + attachments row | `agents/agent.tsx` MediaPortal + media b2 row | VERIFIED-PARITY | 32px/r8 convergence |
| Phone stacking (chat + rail columns) | `agents/agent.tsx` | VERIFIED-PARITY | Fleet phone:flex-col |
| Admin pill clearance over input | `agents/agent.chat.tsx` | VERIFIED-PARITY | S6 |
| Auto-resizing textarea / input primitives | `agents/agent.textarea.tsx`, `agent.input.tsx` | POSTIZ-ONLY-KEEP | |
| Whole surface (no Buffer counterpart) | `agents/**` | POSTIZ-ONLY-KEEP | Buffer has no agent chat; internal-consistency styling only |
| Content bridge chat pane (streamed Claude turns, session continuity, composer) | `content-agent/content-chat.component.tsx` | POSTIZ-ONLY-KEEP | Landed, then merged into the agent page as the Content segment: renders in the agents chat pane; Threads rail + channel strip hide (bridge sessions aren't copilot threads); streaming/session logic untouched; admin gate kept in-component |
| Content pane New chat strip (in-pane session reset) | `content-agent/content-chat.component.tsx` | POSTIZ-ONLY-KEEP | Slim right-aligned strip replaces the removed in-component page header; 32px hairline r8 kit button |
| Content entry point | header segmented on `agents/agent.tsx` (was a `/content` nav item) | POSTIZ-ONLY-KEEP | Nav item removed from `layout/top.menu.tsx`; `/content` route kept as a redirect to `/agents/new?mode=content` |

## 15. Settings

| Surface | Component/file | Status | Notes |
|---|---|---|---|
| Settings shell (generic title bar removed; rail carries title) | `layout.component.tsx` exclusion + `layout/settings.component.tsx` | VERIFIED-PARITY | Fleet S1 exception |
| Rail (260px, icon 16 + 14px rows, r8, active fill; grouped) | `layout/settings.component.tsx` | VERIFIED-PARITY | Row geometry per Buffer rail |
| Rail logout row ('Cuesoft' copy, quiet style) | `layout/logout.component.tsx` | VERIFIED-PARITY | S3 brand fix (de7f7dc3); 2026-08-10: restyled to a quiet 32px hairline button (log-out glyph 16 + "Log out from Cuesoft" 14/500, critical #FF3F3F ink on hover); logout flow extracted verbatim into exported `useLogout` for the sidebar org menu; `isIcon` variant untouched |
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
| Third-party page header + section labels | `third-parties/third-party.component.tsx` | VERIFIED-PARITY | Shared `PageHeader`/`PageShell` (launches pane rhythm; `!pb-[56px]` keeps the admin-pill clearance); eyebrow stays sentence case |
| Catalog cards (quiet Add CTA, 1-col phone) | `third-parties/third-party.list.component.tsx` | VERIFIED-PARITY | Fleet |
| Connected rows (avatar 40, bold name, sub-line, kebab menu) | `third-parties/third-party.component.tsx` | VERIFIED-PARITY | Fleet; kebab menu on panel surface |
| API-key connect modal + function wrapper | `third-parties/third-party.function.tsx`, `third-party.wrapper.tsx` | POSTIZ-ONLY-KEEP | |
| HeyGen provider UI (avatar/voice pickers, generate) | `third-parties/providers/heygen.provider.tsx` | POSTIZ-ONLY-KEEP | Skeleton tokenized (fc0f3cdf) |
| Media slider picker | `third-parties/slider.component.tsx` | POSTIZ-ONLY-KEEP | |
| Plugs page (per-channel plug cards, activate toggles, fields) | `plugs/plugs.tsx`, `plugs/plug.tsx`, `plugs.context.ts` | POSTIZ-ONLY-KEEP | Skeletons tokenized (bbe94a8c); shared PageShell/PageHeader, kit white plug cards (r12 hairline, 16/600 title); channel selection = shared channels dropdown (single-select; replaced the phone chip strip + desktop ToolbarSelect; refreshNeeded toaster guard kept) |

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
| Notifications dropdown list (bell panel content) | `notifications/notification.component.tsx` | POSTIZ-ONLY-KEEP | (Same as §3 row — tracked once there) Kit-styled 2026-08-10: 32px-min 14px ink rows, hairline dividers, unread wash |
| Public post preview page (header, post render, copy link, comments) | `preview/preview.wrapper.tsx`, `copy.client.tsx`, `render.preview.date*.tsx`, `comments.components.tsx` | POSTIZ-ONLY-KEEP | Kit-converted 2026-08-10: comments render dropped its last legacy tokens (bg-third/tableBorder/text-white textarea -> kit input r8 hairline w/ focus:border-forth; hairline dividers, 14px/550 ink names, ink body; rem-based text-sm/space-* -> px); date-render debug console.log removed; copy link/login gate/date logic untouched |
| Import debug post modal (admin) | `launches/import-debug-post.modal.tsx` | N/A-INTERNAL | Admin pill popover tool |
| Admin errors table | `admin/admin-errors.component.tsx` | N/A-INTERNAL | Restyled bbe94a8c |
| Admin stats dashboard | `admin/admin-stats.component.tsx` | N/A-INTERNAL | Restyled bbe94a8c |

## 18. Auth & OAuth (all internal — SSO-only instance)

| Surface | Component/file | Status | Notes |
|---|---|---|---|
| Auth shell (forced-light cream canvas + brand lockup + white card) | `app/(app)/auth/layout.tsx` + `auth/auth.ui.ts` | N/A-INTERNAL | Kit-restyled 2026-08-10: `light` wrapper on `bg-newBgColor` (fonts inherited from `(app)/layout.tsx`); mark + Fustat 24/700 "cuesoft" above a 420px `bg-newBgColorInner` r16 hairline card, p32, soft shadow; phone full-width w/ 16px insets; legacy `#0E0E0E`/`#1A1919` dark shell gone (loginBox/loginBg bgImage tokens were already unreferenced) |
| Login (OIDC button flow) | `auth/login.tsx`, `login.with.oidc.tsx` | N/A-INTERNAL | Google SSO via Internal OIDC; kit-restyled 2026-08-10 (20/550 title + muted subline, kit inputs/CTA, green links, light amber not-activated notice); SSO handler + email fallback logic untouched |
| Register / activate / after-activate | `auth/register.tsx`, `activate.tsx`, `after.activate.tsx` | N/A-INTERNAL | Registration disabled (SSO block on `/auth`); kit-restyled 2026-08-10; OAuth-callback/auto-submit/resend-cooldown logic untouched |
| Forgot / forgot-return | `auth/forgot.tsx`, `forgot-return.tsx` | N/A-INTERNAL | Kit-restyled 2026-08-10 (titles, sublines, kit inputs/CTA, green back-to-login links) |
| Login-required interstitial | `app/(app)/auth/login-required` | N/A-INTERNAL | Kit-restyled 2026-08-10: `bg-[#121212]`/4xl -> cream canvas + 20/550 ink |
| Auth provider buttons (Google/GitHub/OAuth/Farcaster/Wallet) | `auth/providers/**` | N/A-INTERNAL | Kit-restyled 2026-08-10 to the shared `AUTH_PROVIDER_BUTTON` (white hairline 44px r8, 14/550 ink); all OAuth/OIDC/wallet handlers untouched |
| Testimonials side panel on auth | `auth/testimonial*.tsx`, shared `testomonials.tsx` | N/A-INTERNAL | Orphaned (no importer since the card layout); left as-is |
| OAuth consent (approve app) | `app/(app)/oauth/authorize/page.tsx` | N/A-INTERNAL | Spinner tokenized |

## 19. UI kit & shared primitives

| Surface | Component/file | Status | Notes |
|---|---|---|---|
| Icon system (231 inline SVGs ledgered to Lucide family, 16px vb24 stroke 2.2) | `components/ui/icons/index.tsx` + inline | VERIFIED-PARITY | 987a823b + b82cb93a |
| Empty-state component (hero variant, 64px circle pattern) | `cuesoft/empty-state.tsx` | VERIFIED-PARITY | S2 pattern |
| Shared page header + page shell (48px band → 56 phone; 40px r10 chip, 20/400 display title, actions slot; pane insets 24/32/20, gap 8) | `new-layout/page-header.tsx` | VERIFIED-PARITY | Cloned from the measured /launches header/pane; adopted by analytics, agents, media, third-party (and plugs) |
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

Counted from the tables above (336 rows):

- VERIFIED-PARITY: 155
- NEEDS-WORK: 15
- NEEDS-BUFFER-MEASUREMENT: 34
- POSTIZ-ONLY-KEEP: 92
- N/A-INTERNAL: 40
