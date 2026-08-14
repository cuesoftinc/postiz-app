# Changelog

All notable changes to this fork are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

This fork is **not versioned**. It ships from the `cuesoft/customizations` branch, which is the
default branch and what deploys. The version tags in this repository (`v2.23.0` and earlier) are
upstream Postiz's, inherited when we forked, and none of them describe our changes. Everything we
have shipped therefore sits under Unreleased. If we ever tag this fork, entries move into a dated
section then.

Upstream's own release notes live at
[gitroomhq/postiz-app](https://github.com/gitroomhq/postiz-app/releases). Only changes that are
ours are listed below.

## [Unreleased]

Covers the fork from its first commit on 2026-08-07 to 2026-08-14.

### Added

- **Google SSO as the only login.** Authentication goes through Cuesoft's internal OIDC provider.
  Registration is disabled and users arrive by invite. SSO signups skip the company-name step, and
  there is an email-login fallback for provisioned accounts that are not Google Workspace
  identities.
- **The Buffer relay: `linkedinbuffer` and `tiktokbuffer` providers.** They connect like any other
  channel and hand the post to Buffer at publish time, so LinkedIn and TikTok queue, approve and
  publish alongside every other platform. Neither can be a native channel here: TikTok's developer
  app was rejected for internal company use, and self-hosted Postiz needs its own credentials.
  There is exactly one gate and it lives in Postiz. Proven end to end in production.
- **Insights for the relay channels**, including a real per-day series bucketed from one paginated
  request rather than 31 day-windows, impressions-weighted rates, and Buffer's authoritative
  rollup carried alongside so the tiles stay exact. Ranges Buffer will not serve are no longer
  offered.
- **Ace**, an in-product chat backed by fenced Claude Code sessions, for drafting a week's copy
  inside the app instead of a terminal. Sessions are owner-scoped and credentials never enter the
  child process. Includes the shared sessions rail, streamed replies, working notes that keep
  their steps, a copy button on finished replies, and a Post Assistant in the composer.
- **An approvals gate and undated drafts.** Posts can be drafted with no date and released through
  approval one week at a time, with count pills across the surfaces that need them.
- **Security regression tests** in `tests/security/`, and the `Validate` CI workflow that runs
  `pnpm test`, `pnpm run lint`, `pnpm run typecheck` and `pnpm run build` on every push and pull
  request.
- Media library multi-select and bulk delete.
- Per-channel queue views, a channels filter, state and tag filters, display timezone, and media
  thumbnails on the publish toolbar.
- Community health files authored for this fork: `SECURITY.md`, `CONTRIBUTING.md`,
  `CODE_OF_CONDUCT.md`, `CODEOWNERS`, this changelog, pull request and issue templates, and
  `.editorconfig`.

### Changed

- **Tailwind 4.3.3 replaces 3.4.17.** The v3 JS config is kept and loaded through `@config` rather
  than ported to `@theme`, because every colour is a passthrough to an app variable that would
  collide with v4's namespace and because screen declaration order carries real precedence.
  Tailwind is imported as three unlayered parts so Sass cannot hoist preflight above the app's own
  CSS. Six behaviours v4 would have changed on its own are pinned back, including `hover:` on
  touch. The size ladder in `apps/frontend/src/app/global.scss`, which rescales roughly 370 of
  upstream's own arbitrary-value classes through attribute selectors, was captured under v3 and
  checked cell for cell at 1440 and 393 after the upgrade.
- **A Buffer-parity pass over the whole interface**: measured geometry rather than eyeballed, one
  shared segmented control, real menus instead of panels, empty states, Buffer's calendar grids
  and list cards, a 52px collapse rail with a tablet auto-collapse, unified page headers, all 231
  inline SVGs normalised onto one icon family, and native-shaped URLs.
- **The app works on a phone.** Every mobile defect was photographed on a real device at 402x874
  and measured before it was fixed, including the composer, the calendar, the drawer, the
  super-admin surfaces and the Ace pane.
- **Branding**: Cuesoft logo throughout including favicon and previews, theme-aware logo, the
  lowercase `cuesoft` wordmark, and page titles unified on `Cuesoft - X`.
- Dependency set upgraded and pinned: Node 22.20, pnpm 10.6.1, Next 16.2, React 19.2, NestJS 11,
  Prisma 6.19.
- Transactional email is sent synchronously, bypassing a wedged Temporal singleton.
- Mastra AI-span telemetry is disabled through a NoOp observability implementation after it filled
  a table to 1600 columns.
- **The container no longer runs `prisma db push --accept-data-loss` at startup.** This is an
  operational change, not just hardening: a schema change now needs a deliberate step or it
  silently will not apply. The destructive form is kept as a separate script.
- The README was rewritten to describe what this fork actually is and what it runs.

### Fixed

- Twenty-five bugs verified across five adversarial audit loops, each confirmed by a reviewer that
  tried to refute it. Nine further claims failed that review and were dropped.
- Relay: multi-segment posts were silently truncated to the first segment because the provider
  defined no `comment()`, and the orphaned child was excluded from the recovery sweep. `firstComment`
  was read from settings and written by nobody. 429 and 5xx were raised as a non-retryable Temporal
  failure, so a rate limit meant the post never published. A failure after the parent published no
  longer marks the live post as errored with a retry button that must not be pressed. TikTok
  brand-organic disclosure now reaches the caption.
- The `Validate` workflow's typecheck pointed at the root tsconfig, which sets no `jsx`, so every
  `.tsx` file failed TS17004 and the gate could never pass. It now typechecks the three project
  configs that describe what ships.
- The content-chat stream is never compressed and proxy buffering is disabled on it, so replies
  arrive as they are produced.
- `pnpm prune --prod` asks for confirmation and a Docker build has no terminal to answer, so the
  image build hung rather than failed. `CI=true` fixes it.
- Sent list reads newest first, `createdAt` is selected so list cards can date themselves, video
  posts get the same thumbnail anatomy as image posts, calendar cards and the analytics chart are
  readable in dark mode, and a route loading boundary replaced the blank flash on navigation.

### Removed

- **Upstream SaaS surface this fork does not use**: 59 files and roughly 40 dependencies. The rule
  applied throughout was that deleting an upstream file is not free, it is a conflict on every
  future merge, so anything that merely looked unused was left alone. That is why the 25
  unconnected social providers, the browser extension, the SDK and the commands app are all still
  here.
- **Upstream's contribution funnel**, which pointed contributors and, worse, vulnerability reports
  at Gitroom rather than at us: the CLA pair, upstream's `CONTRIBUTING.md` and pull request
  template, upstream's `SECURITY.md`, its code of conduct, funding and sponsor assets, its issue
  templates, and its Copilot instructions. Replaced by ours in this release.
- The root `docker-compose.yml` that pulled `ghcr.io/gitroomhq/postiz-app:latest`, the
  extension-publishing workflow that shipped to the Postiz Chrome listing, the translation-service
  files nothing calls, and a workflow file with no extension that Actions had never run.
- Agent configuration files that do not belong in the product repository.
- `LICENSE` was kept deliberately. AGPL-3.0 is not ours to relicense, and section 13 obliges us to
  offer the Corresponding Source to network users.

### Security

- **Tenant scoping.** Post updates took a client-supplied id without scoping it to the caller's
  organization, and group cleanup was scoped by group id alone. Both predicates now carry
  `organizationId`, so a foreign id is a miss rather than a write.
- **Approvals could be bypassed by editing.** With approvals on, editing a queued post set
  `needsApproval` but left the state at `QUEUE`, and the workflow later published it without
  rechecking. The publish guard re-reads state after the sleep, so a revision cannot inherit the
  old slot's authorization.
- **Duplicate publishing.** The Buffer relay retried every 5xx up to three times while calling
  `shareNow`, which is not idempotent, so a proxy that failed after Buffer had accepted published
  the post twice. This was live in production. Retries are now gated to queries.
- **The `/enterprise` controller was removed.** It exposed create-user, url and delete-channel, and
  was registered as a controller but left out of the authenticated set, so the auth middleware
  never covered it. The routes did verify a JWT against `JWT_SECRET`, which also signs session
  cookies, and one of them deletes a channel and every post attached to it.
- **Image hardening.** Secrets are excluded from the build context, and the runtime is a separate
  stage running as a non-root user.
- Registration error surfacing, SMTP timeouts, PDF upload handling, and CI hardening.
