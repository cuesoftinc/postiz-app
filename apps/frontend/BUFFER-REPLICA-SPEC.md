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
