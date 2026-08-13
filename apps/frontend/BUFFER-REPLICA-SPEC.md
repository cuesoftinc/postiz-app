# Buffer replica spec — measured from the live product (dark mode, 2026-08-10)

Source: publish.buffer.com, logged-in dark theme, 1440×900. Values measured
with getComputedStyle or read off reference captures. This spec is the
authority for the replica; Postiz business logic is untouchable.

## Global tokens

- Body bg: `#131313` (lab 7.7 neutral). Elevated card: ~`#1e1e1e`.
- Text primary: `#ededed` (lab 93.7). Muted: `#ababab` (lab 70).
- Hairlines/borders: **white-alpha** — `rgba(255,255,255,0.10)`; hover/active
  fills `rgba(255,255,255,0.05–0.10)`; calendar cell wash
  `rgba(255,255,255,0.012)`.
- Brand action green: pastel `lab(74.7 -28.8 30.7)` ≈ `#9fd68a`, near-black
  ink. (We keep Cuesoft lime `#bfff72` as this slot — same family.)
- Fonts: body **Inter** 14px (exact match, next/font/google); display
  **Outfit** (closest free face to their Stolzl) for page titles 20px/400.
  Tailwind: `font-sans` = Inter, `font-display` = Outfit.
- Radius: controls/chips 6–8, cards 12, big pill buttons 999.
- Light theme mirrors with black-alpha hairlines on white.

## Sidebar (240px, flat on page bg, no border)

Top → bottom:
1. Logo row (logo left, streak icon right).
2. **"+ New" pill** — full-width-ish, pastel green, dark ink, radius 999,
   h ~44.
3. Nav rows, h 32, radius 8, px 8, 14px/400: icon 20, label, right-aligned
   count badge (muted) or pill badge. Active/hover = `rgba(255,255,255,0.10)`
   fill. Rows: Home, Create, Publish (count), Community (99+), Insights (NEW
   pill badge).
4. Muted section header `Channels` 13px.
5. Channel rows: avatar 32 + platform badge bottom-right + green presence dot
   top-left, name 14px, right muted count. Same row hover/active as nav.
6. "Connect more channels" muted label + 24px platform icon buttons + a `+`.
7. "Locked channels · 4 ›" muted row.
8. Bottom sticky: connected-channels progress card (bordered, radius 12,
   green progress bars, bordered "Upgrade" button) then org row: logo 32,
   "Cuesoft Inc." 14px + "Free Plan" 12px muted, collapse icon right.

## Page header (Publish)

- Row 1: squared icon-chip (36, radius 8, white-alpha fill) + page title
  (20px Stolzl/400) + bookmark icon; right: comment icon-button,
  **List/Calendar segmented control** (container radius 8, active segment =
  deep-green fill with light-green text/icon, inactive transparent muted),
  **"+ New Post"** primary green button (h 40, radius 8, dark ink).
- Row 2 (calendar): ‹ › arrows (icon buttons 28), "August 2026" 16px/500,
  "Today" chip (h 24, radius 6, white-alpha 5% fill, 10% border), "Month ▾"
  quiet dropdown; right: filter dropdowns (Channels, All Posts, Tags,
  No Date, timezone) — icon + label + chevron, quiet text buttons 14px muted.
- Row 2 (list): **tabs** Queue 13 / Drafts 0 / Approvals / Sent 460 — 15px,
  active = text-primary + 2px green underline + count badge; inactive muted;
  right: same filter dropdowns.

## Calendar grid (Month)

- Day-of-week header row: 14px/500 muted, cells bordered.
- Cells: hairline 1px white-alpha-10 borders (collapsed), near-invisible
  white-alpha wash, date number 14px muted top-left (today = green dot next
  to date), "⌄ 3 More" collapsed indicator 14px.

## Queue (List view)

- Day sections: **"Today, August 10"** — 17-18px/500 sentence case (NOT
  uppercase), primary color, generous top margin (~32px).
- Left gutter column (~140px): time "9:00 AM" 15px primary + pin/label row
  "Custom" 13px muted with icon.
- Post card: bg ~#1e1e1e, radius 12, NO border (elevation by contrast),
  padding 20. Header: avatar 40 + platform badge, channel name 15px/600.
  Body 15px/1.5 with "... see more" muted link. Attachment icon strip.
  Media thumbnail right ~200px, radius 8.
- Card footer: hairline top border, "You created this 14 hours ago" 14px
  muted; right actions: "⊳ Publish Now" bordered quiet button (h 36,
  radius 8, white-alpha border), pencil icon-button 36, kebab icon-button 36.
- Floating comment icon-button right of card (36, circle, bordered).

## Composer (Create Post)

- Modal: near-full-bleed, bg #1a1a1a, radius 12. Header row: "Create Post"
  18px + "Tags ▾" chip; right: Templates, AI Assistant (quiet, icon+label),
  **Preview** (active = deep-green pill w/ light-green text), expand, X.
- Channel avatar row (40px avatars + badges, `+` tile).
- Editor: huge free area, placeholder "Start writing…", media drag&drop
  dashed zone (radius 8), icon row (+, emoji, #) bottom-left.
- Right panel 420: "Post Previews" 16px/600 + skeleton + hint text.
- Footer bar: hairline top; left "Create Another" checkbox; right split:
  "🕒 Next Available ▾" quiet dark button + primary green
  "Customize for each network →" (h 44, radius 8).

## Mapping to Postiz (logic-preserving)

- Sidebar nav rows ⇄ existing TopMenu routes (Calendar→/launches, Agent,
  Analytics, Media, Plugs, Integrations, Settings). Counts only where data
  already exists client-side; otherwise omit.
- Sidebar Channels ⇄ read-only render of the existing integrations list
  (same SWR the launches panel uses); rows navigate to /launches. Management
  (add/refresh/disable/groups) STAYS in the launches panel.
- "+ New" pill / "+ New Post" ⇄ trigger the existing Create Post modal only
  via an existing mechanism (grep for a search-param/deep-link the launches
  page already handles); otherwise navigate to /launches.
- List/Calendar segmented ⇄ existing display toggle. Tabs ⇄ existing
  All/Scheduled/Draft/Published filters (keep their semantics and counts if
  cheaply available; do not invent Approvals/Sent).
- Phone: the existing bottom tab bar pattern stays (Buffer mobile ≠ desktop
  sidebar; our mobile solution is already correct).

## Addendum — measured 2026-08-10 (second pass, light theme)

### Calendar month view (publish.buffer.com/calendar/month)
- Month cells: date number top-LEFT, muted; TODAY = filled green circle badge
  around the date number. Out-of-month days get a slightly shaded field.
- Cell entries are compact PILLS, not content cards: [platform icon chip]
  [time "7:18 AM"] [tiny media thumbnail right]. NO post text in month view.
  Pill = white/hairline border, radius ~8, h ~32.
- Per-cell overflow: "⌄ N More" expander row, muted.
- Weekday header row: full day names, centered, hairline dividers; toolbar
  identical to list view (month nav, Today chip, Month dropdown, filters right).

### Settings → Channels page (channel management home)
- Page title left + GREEN "Connect Channel" button top-right.
- Plan info card (muted field, icon + bold lead + body).
- "N/N Channels connected" heading with green progress dashes right.
- Channel card rows: avatar+badge 40, NAME bold 15, sub-line muted
  ("X Premium Profile" / "LinkedIn Page" / "TikTok Account" — platform +
  account-type descriptor), right side: gear icon + kebab (desktop);
  mobile collapses gear into the kebab.
- "Locked Channels" section: dimmed avatars, bordered "🔓 Unlock" buttons.
- Our manage-channels modal is the current equivalent; if it ever becomes a
  page, THIS is the pattern.

### Mobile (settings + everywhere)
- Same hamburger app bar (☰ + logo + streak) on every page; no bottom bar.
- Settings: cards stack full width; primary CTA keeps its size; sub-nav is
  reached via the drawer/back affordance ("← Settings" title row).

## Addendum — month-cell close-up (user capture, 2026-08-10)
- Day cell: date number top-left; TODAY = green circle. A bordered "+"
  button appears top-RIGHT of the cell (per-day create — wire to the
  existing day-click composer mechanism, do not invent a new one).
- Post pill anatomy (LTR): [platform LOGO chip ~20px, brand-colored square,
  NOT the channel avatar] [time "9:00 AM"] [media thumbnail right, rounded].
  White pill, hairline border.
- Drop from our cells anything Buffer doesn't show unless it carries real
  function; hide the list pager entirely when totalPages <= 1.

## Addendum — round-1 live measurements (2026-08-10, applied in waves aa2ce4bc…beb4c215)

### Calendar toolbar (desktop, month & week identical)
- Left group: ‹ › ADJACENT 32×32 r8 chevrons → "August 2026" 16/500 →
  Today 63×24 r6 1px hairline transparent 14/500 → view combobox 24px
  borderless, NO leading icon, options **Week/Month only** (no Day at desktop).
- Right group (right-aligned): Channels ▾ · All Posts ▾ · Tags ▾ · No Date
  (month only, toggle w/ grey active) · Lagos ▾ — 32px r8 transparent 14/500,
  [16px icon][label][16px chevron]. Channels icon = four circles; All Posts =
  overlapping squares (filled); Tags = lucide tag + dot; timezone = globe.
- Select menus: 200px white r6 p8, 32px r6 rows 14/500, check `M20 6 9 17l-5-5`
  LEFT of the selected row, subtle tint bg. All Posts options order/terms:
  All Posts / Drafts / **Scheduled** / Sent.
- Channels dialog 380 r12 p12: 32px search input, "Select all" link, 48px rows
  [avatar 32 r8 + platform badge · name · checkbox 16 r4 RIGHT].
- Tags dialog 256 r12: "Untagged" row, 40px colored-pill tag rows,
  footer Clear all + Settings.
- Timezone dialog 315 r12: "Search cities or timezones", rows
  **"City (GMT+1:00)"** 33px 14/400, current pinned top w/ channel avatars.
- No Date opens an in-content right panel (~300px): "Undated drafts" + X,
  sub-copy, empty state = doc icon in 64px grey circle + "No Undated Drafts".

### Month grid
Sunday-first; weekday header white 36px; weekend/other-month/past cells washed
(#F3F2F0-family → bg-newTableHeader); today = day number in 24px green circle
(ours: lime + black ink); three-tone day numbers (current/past/other); uniform
~205px rows; outer hairline border, square corners; pills 33px r8 white
hairline [brand chip 16 · h:mm A 13-14 full ink · thumbnail right]; "N More"
16px chevron + 14/500 neutral, left-aligned; pills NEVER grayscale when past.

### Week grid
No rail column — labels overlay col 1 every 2 hours, "h A" 12/500 grey;
~106px/hr rows; headers "Sunday 9" one line 36px white, today green ink +
2px green underline; past hours flat grey wash; auto-scroll to now; cards
white r8 hairline [chip 16 + h:mm A 14/500][2-line 13px snippet][36px thumb
bottom-right].

### List view
Tabs Queue·Drafts·Approvals(lavender ⚡ pill)·Sent w/ grey count pills, active
2px INK underline on a full-row hairline track, no 'All', Queue default; time
rail OUTSIDE cards (h:mm A 14/500 + ⚓ Custom 12 muted); cards ≤700px, comment
bubble floats outside top-right; groups "Tomorrow, August 11" 16px two-tone;
page-level scroll.

### Phone (390)
Cream 56px app bar ON canvas (☰ 40 w/ green dot at its corner + logo/wordmark
+ streak only); header [chip 40 · title 20 · bookmark · GREEN icon-only "+"
40 r8]; toolbar single row [‹ › title | funnel `M2 5h20/M6 12h12/M9 19h6` |
icon-only List|Calendar segmented]; filters open a BOTTOM SHEET (drag handle,
scrim, drill-in rows w/ chevrons); calendar = rolling 3-DAY hour grid starting
today (~80px rows, 48px gutter, "Mon 10" headers); full-bleed card.

### Chrome
Warm-cream light canvas #f7f6f3, hairlines/active-fills #eae8e5 (dark mode
untouched); desktop card 8px margins + hairline border, flush to sidebar; NO
top strip of any kind — admin/impersonation lives in a fixed bottom-center
pill w/ popover; support = 36px #def0ff "?" bubble bottom-right; sidebar 208px
rows, wordmark lockup, count badges, unconnected-only quick icons, FREE-tier
upsell card, org footer + panel-left-close collapse.

### Known blocked-on-deploy
Month/week/list media thumbnails render only when the backend ships the
`image` field (added in aa2ce4bc, live :4007 predates it — appears after the
next deploy). URL aliases: /schedule, /schedule/list,
/schedule/calendar/{month,week,day,three-day} → /launches.

---

## Addendum - LIGHT-THEME TOKEN MEASUREMENTS (2026-08-13, authenticated)

Source: `publish.buffer.com`, logged in (Cuesoft Inc., Free Plan, 3 channels),
viewport 1440×807 DPR 2. **Buffer serves colours as `lab()`**, so every value
below was read back through a canvas pixel - naive string parsing of those
declarations yields garbage. These supersede the dark-theme guesses at the top
of this file for light mode, and they are the authority for the token slots.

### Measured palette

| Slot | Hex | Observed on |
|---|---|---|
| Ink (body, titles, tab labels, menu items) | `#292928` | body, h1, tabs, menuitems |
| Hairline border | `#dedcd9` | New Post, Publish Now, Go to post, cards, segmented |
| Lighter card border (Insights stat tiles only) | `#eae8e5` | stat tile |
| Muted ink | `#5a5a59` | ghost labels, placeholders, tile labels, subtitles |
| Green pill fill | `#b0ec9c` | sidebar "New", 40px primary CTAs |
| Active-ghost green wash | `#d9f1d1` | Preview toggled on |
| Green link / active label ink | `#337046` | "select a file", segmented active label |
| Green drag-over outline | `#4e975b` | editor column while dragging |
| Dashed drop-zone border | `#8c8b88` | idle media tile |
| Segmented ACTIVE fill | `#95cd8f` @ alpha `0.322` | List (active) |
| Tab count pill fill | `#eae8e5` | Queue "7" pill |
| Surface white | `#ffffff` | body, cards, menu panels |
| **Previews-pane tint** | `#f7f6f3` | composer previews pane |
| Top-5 card tint | `rgba(51,34,0,0.059)` | Top 5 Posts card |
| Destructive ink | `#94120e` | Queue kebab Delete |

Two tokens are new to this spec: **muted ink `#5a5a59`** and **active-ghost
green wash `#d9f1d1`**. Note the drop-zone link green is **`#337046`**, not the
`#2f7d44` recorded in the r1 composer pass.

### Button hierarchy - the whole system, four levels

| Level | Spec | Seen on |
|---|---|---|
| **Primary** | h **40**, radius **12**, fill `#b0ec9c`, label `#292928` (dark, NOT white), 14/500, padding `0 16px`, gap 8 | "Customize for each network" |
| **Secondary** | h **32**, radius **8**, **transparent fill**, `1px #dedcd9`, label `#292928`, 14/500, padding `0 12px`, gap 4 | + New Post, Publish Now, Go to post, Tags chip, Export |
| **Ghost** | h 32, radius 8, no border, no fill, label `#5a5a59` | Templates, AI Assistant |
| **Ghost active** | ghost + fill `#d9f1d1`, label `#337046` | Preview (on) |
| **Sidebar pill** | h 40, radius **1440** (full), fill `#b0ec9c`, 208×40, padding `0 16px`, gap 8 | sidebar "New" |

**The rule that falls out: 40px controls take radius 12, 32px controls take
radius 8.** And **green is reserved** for the sidebar pill and 40px primary
CTAs - the header `+ New Post` is the transparent secondary, measured 110×32.
The secondary shape is byte-identical across `+ New Post` (110×32),
`Publish Now` (129×32) and `Go to post` (115×32).

### Type

Page title "All Channels" `20px / 400 / 25px` - **regular weight, not
semibold**. Composer title "Create Post" `18px / 500 / 22.5px`. Section and
day-group headings `16px / 550 / 20px`. Body and menu items `14px / 400`,
line-height 21px. Post time and control labels `14px / 500`. Tile labels,
schedule-type labels and date subtitles `12px / 400`.

### Geometry quick reference

- **Segmented control** (identical in Publish and Insights): wrapper h32,
  radius 8, white, `1px #dedcd9`, padding 4, gap 4; item h **24**, radius 6,
  padding `0 8px`, 14/500. Publish wrapper 174 wide, Insights 360.
- **Tab row**: height **45**, gap 16, tab padding `12px 8px`, 14/500; count
  pill 18×18 radius full on `#eae8e5`, 12/500, padding `0 4px`.
- **Post card**: 701×270, radius 6, `1px #dedcd9`, white; channel avatar 32
  radius 8; footer bar h **56**, padding `0 16px`, gap 16, 1px top border;
  footer order `Publish Now` (129×32) → `Edit` pencil (32×32) → kebab (32×32);
  comment bubble rendered OUTSIDE the card, top-right.
- **List column** padding `0 48px 16px`, group gap 16.
- **Menu / dropdown panel**: white, radius **12**, **NO border**, padding
  `12px 8px`, shadow `0 0 1px 1px rgba(55,33,0,.09), 0 4px 8px -4px
  rgba(49,25,0,.122), 0 16px 24px -8px rgba(49,25,0,.122)`; rows h32, 14/500,
  padding `8px 12px 8px 8px`, gap 8, icon 16.
- **Composer dialog**: 1100×759 at (170,24), white, radius **16**, no border,
  shadow `0 0 0 1px rgba(0,0,0,.08), 0 1px 1px 0 rgba(0,0,0,.02), 0 4px 8px
  -4px rgba(0,0,0,.04), 0 16px 24px -8px rgba(0,0,0,.06)`. Editor column 654,
  previews pane **379** on `#f7f6f3`. Channel avatars **40 radius 12**, row
  gap 16. Footer bar 1036×40. Schedule control = one joined split button
  410×40 (left 165, radius `12px 0 0 12px`; right 245, radius `0 12px 12px 0`).
- **Media drop zone**: 120×120, radius 8, `1px dashed #8c8b88`, padding 8,
  gap 8; drag-over puts `1px dashed #4e975b` on the editor COLUMN.
- **Insights**: stat tile 216×77 radius 8 `1px #eae8e5` padding `12px 16px`;
  trends charts 1060×160, **Recharts BARS**, gridlines **vertical only** 1px
  solid `#dedcd9`, no yAxis labels, no dots, no legend, tooltip present, no
  sparklines anywhere; Top 5 card 212×179 radius 12, thumb 44×44 radius 6,
  actions 24×24; channels table width 1108, header row 49 (`th` padding
  `12px 16px`, 14/500, first cell radius `12px 0 0 0`), body row 64.

### BACKDROP - corrected and confirmed

The overlay element is **fully transparent**; the dim is on its **`::after`**,
which carries `content:""` + `background: rgba(0,0,0,0.8)` and
**`backdrop-filter: none`**. No blur anywhere. This confirms the 2026-08-10
finding and extends it to the composer, so any surviving
`backdrop-filter: blur()` on our modal layers is a divergence.

### Ranges and features Buffer does NOT have / we do not have

- **Buffer has no 90-day Insights range.** Options are `7 days`, `30 days`,
  `Month to date`, `Custom` (paid, "Upgrade" marker). Our 7/30/90 is our own
  invention; `Month to date` is the real gap. The relay channels' 7+30 matches
  Buffer's free surface exactly.
- Buffer states its comparison window in a subtitle ("Jul 15 - Aug 13, 2026 ·
  Compared to Jun 15 - Jul 14, 2026", `12px/400 #5a5a59`); we show a bare delta.
- Buffer-only, no counterpart here: `Create` and `Community` top-level nav,
  composer `Templates`, header `AI Assistant`, `Create Another`, Insights
  `Export`, the channels-table column chooser, and "Share as Post" on an
  insight.
- Sent cards carry a horizontally scrollable **per-platform** metrics strip
  (X: Reactions/Comments/Eng. Rate/Reposts/Impressions/Clicks; TikTok:
  …/Views/Shares/Reach; LinkedIn: …/Impressions/Reach/Shares), with absent
  metrics rendered as `no data available` and a `-` value rather than `0`.
- Sent list is newest-first **at both levels** (day groups descend AND posts
  descend within a day); Queue stays ascending.

### Measurement blocked by the plan

The legacy **`analyze.buffer.com` is paywalled** on this account (redirects to
`/paywall`), and the `Custom` range is a paid feature. Anything needing either
cannot be measured without an upgrade - record it as blocked, not as pending.
