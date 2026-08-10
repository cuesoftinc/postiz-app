# Postiz — Cuesoft fork (`cuesoftinc/postiz-app`, branch `cuesoft/customizations`)

Self-hosted Postiz, deployed at postiz.cuesoft.io. This fork's UI has been
**deliberately rebuilt** — Buffer's skeleton, Cuesoft's skin. Upstream's visual
conventions are NOT the reference anymore; do not "match existing upstream
components" when styling. The contract below is the reference.

## The design contract (Buffer look, Cuesoft theme)

Source design system: the `cuesoft-design` skill / `cuesoftinc/design-system`.

- **Palette** (all via CSS vars in `apps/frontend/src/app/colors.scss` — never
  hardcode surfaces): dark theme = true-black family (#000 page, #101010
  cards); light theme = white family. `--new-btn-primary` = **brand lime
  #bfff72**; `--color-forth` = **brand blue #325ea6**; `bg-seventh` = blue
  wash. **Violet/purple is dead** — if you see one, it's a bug.
- **Ink on lime is black** — a global rule paints `[class*="bg-btnPrimary"]`
  black; never put `text-white` on a primary button.
- **Lime = primary actions and active states only.** Informational accents,
  links, focus rings, progress = brand blue. Destructive = red. Platform
  colors (Twitter blue etc.) stay authentic.
- **Type**: Fustat (variable, in `public/fonts/`, wired via `font-sans`).
  Page title 20/600, section 16/600, body 14, meta/labels 12–13 muted.
  Muted = `text-newTextColor/60` — **`text-textColor/NN` emits NO CSS**
  (textColor lacks `<alpha-value>`); never use it.
- **Micro-labels** (table headers, eyebrows): 11–12px uppercase
  `tracking-[0.08em]` muted.
- **Radius scale**: controls 6, cards/rows 8, floating panels/modals 16,
  pills 999. A global ladder normalizes legacy arbitrary values.
- **Density**: 12px inside cards, 16px between sections, 8px between sibling
  controls. Flat surfaces + 1px borders (`border-newTableBorder` /
  `border-newBorder`) over heavy fills.
- **Focus**: universal `:focus-visible` brand-blue outline (global.scss).

## Reusable components — use them, never hand-roll

- `components/cuesoft/` — ModalBody/ModalFooter/ModalCloseButton, DataTable,
  TablePagination, toolbar kit (ToolbarRow/Field/Select/Input,
  SegmentedControl, PagerStepper), Chip/ChoiceChipGroup/PagerButton,
  Loader/LoadingPane, EmptyState, SettingsTable, DropdownPanel/useDropdown,
  UserSearchDropdown.
- `components/new-layout/` — ChannelAvatar, ChannelRow, SidePanelHeader/
  Chevron/Version + useSidePanelCollapse, side-panel.ts (sidePanelRoot/Pane).
- Form primitives live in `libraries/react-shared-libraries` (Button, Input,
  Select, Textarea, Checkbox) — restyled to the contract; extend them, don't
  fork them per screen.
- New shared components go in `components/cuesoft/` (fork-owned namespace —
  survives upstream rebases with zero conflicts).

## Tailwind gotchas (they will silently eat your work)

1. **Default breakpoints emit nothing** (`md:` is dead). Phone = `phone:`
   (max-width 767px). `custom`/`minCustom` are *height* queries. Screen
   declaration ORDER in `tailwind.config.cjs` is precedence — `phone` stays
   second-to-last.
2. The `global.scss` ladder rescales unprefixed `text-[N]`/`h-[N]`/`p-[20px]`/
   `gap-[20px]`/radius tokens with `!important`. Opt an element out with
   `data-cs` — don't fight it with specificity.
3. Never key CSS to the side panel's width class (collapse swaps it). Use
   `data-side-panel` attributes.
4. Class-shaped tokens in comments/JSDoc (`min-w-[var(..)]`) get scanned and
   JIT-compiled by Tailwind — they can break the whole CSS build. Keep class
   syntax out of comments.
5. An element wider than the viewport expands the *layout viewport* and every
   `position:fixed` element then anchors to it (the mobile nav dies).
   Diagnostic: `window.innerWidth !== document.documentElement.clientWidth`.

## Working loop (user-mandated — do not deviate)

1. Edit + verify on the local dev server (`:6274`, auth helper mints a
   localhost super-admin cookie; CORS already allows the port).
2. Verify at desktop AND phone (402×745), dark AND light, before calling
   anything done.
3. **One local docker build at the end** (`Dockerfile.dev`, tags
   `v2.23.0-sso` + `cuesoft-latest`; the pnpm store rides a BuildKit cache
   mount — prune with `--keep-storage 5GB`, never bare `-af`), then
   `docker compose up -d postiz` from `design-system/postiz/`. **Never pull
   images on this machine.**
4. Push after local verification; GitHub Actions builds GHCR for teammates
   only.
5. Long experiments → background subagents that wait for heavy processes and
   clean up after themselves.

## Hard rules

- Monorepo is pnpm-only. Don't install new frontend deps for UI work — write
  native components.
- `--color-custom*` vars are legacy; don't add new usages.
- Behavior/business logic is untouchable during visual work: className and
  stylesheet edits only.
- The cueshow YouTube channel connected in production is the real 20k+
  subscriber channel. Never auto-publish; test posts Private/Unlisted only.
