# Changelog

All notable changes to this repository are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

This repository is **not versioned yet**. It ships from the `cuesoft/customizations` branch, which
is the default branch and what deploys. Releases are tagged from it. When a
release is tagged, entries move into a dated section then.

There are no inherited tags left to confuse that. The Postiz tags this repository carried at fork
time (`v2.23.0` and earlier) described Gitroom's releases, never ours, and they have been deleted:
the `v*` namespace here is ours alone, and the first release tagged in it will be our own semantic
version starting from scratch. No number and no date are promised here until one is cut.

Postiz's own release notes live at
[gitroomhq/postiz-app](https://github.com/gitroomhq/postiz-app/releases) and cover the history this
code is derived from, up to the last sync we took. We do not merge from them any more, so nothing
in their later releases is reflected below. Only changes that are ours are listed.

## [Unreleased]

## [1.2.0] - 2026-08-15

### Fixed

- **The Approvals tab gated the owner's own posting, not just Ace's drafts.**
  It read `Post.needsApproval`, an org-wide field with no role bypass anywhere
  in `applyApprovalGate`: turning the org's approval gate on so the tab could
  show Ace's tagged drafts meant every manual post, including the owner's own,
  was also forced through the approval step. Reverted to the pre-existing
  `needs-approval` TAG mechanism, and this time `approvalTag` is actually
  threaded through `CalendarContext` to the components that read it, which the
  first version of this code never did. Verified against a real tagged draft in
  the running app, not just typecheck and unit tests, since neither exercises
  this UI path.
- **nginx published the container's internal port in redirects.** A request
  for `/api` came back with `Location: http://…:5000/api/`, the container-only
  port handed to the public and https downgraded to http, because of nginx's
  default `absolute_redirect on` rebuilding the header from what the server is
  bound to rather than what the client asked for. Fixed with
  `absolute_redirect off` / `port_in_redirect off`; this server is only ever
  reached through the Cloudflare Tunnel, so a relative redirect keeps the
  client on the origin it already had.

### Added

- **A CodeQL model pack** (`.github/codeql/extensions/`) teaching the
  JavaScript queries about this repo's own guards —
  `getSsrfSafeDispatcher`/`ssrfSafeDispatcher`, `sanitizeForLog`, `escapeHtml`,
  `htmlToPlainText` — so code that is actually guarded stops re-reporting as a
  false positive on every new commit that touches it. The barrier kinds were
  read out of the CodeQL 2.26.3 library rather than guessed. GitHub's own docs
  do not list JavaScript as a supported language for model packs under default
  setup even though the library declares the predicates and the JS queries
  consume them, so this is recorded as expected-but-unconfirmed until a scan
  proves it: watch whether the three `js/log-injection` alerts it targets stay
  dismissed on a new commit to those files.

## [1.1.0] - 2026-08-14

Everything CodeQL found on its first real scan of this codebase, and images that
run on more than one architecture.

### Security

- **The SSRF guard had never run against its primary payload.** `ssrf.safe.dispatcher.ts`
  put its IP check in the Agent's `connect.lookup` hook, and `node:net` skips DNS
  resolution entirely when the host is already an IP literal, so the check never
  fired for `http://169.254.169.254/` or for a redirect hop to one. Measured on
  Node 22 and 26: an IP-literal target reached a loopback listener and returned
  its body with **zero** calls into the guard. Every `getSsrfSafeDispatcher()`
  call site inherited that. The check now lives in the connector, which runs per
  connection and does see IP literals, and three regression tests dial a real
  socket rather than reasoning about one, because this hole was invisible to
  every form of reading the code.
- `POST /webhooks/send` and `read.or.fetch.ts` had no dispatcher at all.
  `read.or.fetch` was the only outbound call in the tree with no guard
  whatsoever, reachable from post media at five call sites.
- **Reflected XSS on `/auth/login` and `/auth/register`.** Express types a string
  response body as `text/html`, so a cross-site form POST rendered the reflected
  error as markup. Both now pin `text/plain` with `nosniff`.
- The Listmonk provider logged its connect payload, which carries a username and
  password in clear text.
- Google My Business persisted an unvalidated `data.id` as `internalId` and then
  spliced it into a URL on every publish and every analytics load. Validating
  `locationName` alone left the identical injection one field over, stored rather
  than transient.
- Instagram and LinkedIn ids are validated by shape rather than encoded.
  `encodeURIComponent` alone throws `URIError` on a lone surrogate, uncaught on
  that path, turning a malformed id into an opaque 500 instead of a connect error.
- `stripHtml` decoded entities **after** stripping tags, so `&lt;script&gt;`
  survived the strip and decoded into real markup on the way out.
- Invite emails interpolated the company name, sender name and sender email into
  HTML sent to an attacker-chosen recipient. Subjects are now escaped centrally.
- The R2 multipart endpoints returned SDK stack traces to the client.
- `uploadSimple` buffered a remote response with no size cap in both storage
  providers, including the live R2 path. It reuses the cap the public API already
  applied.
- An auth middleware that failed **open**: with no validator configured it
  accepted any non-empty bearer token. No caller reaches that branch today, but
  the default for an auth middleware must be deny.

### Added

- **Multi-arch images.** Both release workflows build `linux/amd64` and
  `linux/arm64` on native runners and merge them into one manifest list, with the
  attestation bound to the list rather than to one platform. CI had only ever
  built arm64, which no longer matches the host.

### Fixed

- The admin popover's click-away layer was `fixed` with no `z-index`, so it
  painted above the static panel and swallowed every click. All four admin chips
  and Stop impersonating did nothing but close the popover. Worse on phones,
  where the same tap collapsed the whole thing to a dot.
- `videoFunction` invoked its resolved method unbound, and its `if (!video)`
  guard was unreachable because the lookup dereferenced the result before it
  could return undefined, making an unknown identifier a 500 rather than a 400.
- Mail sent HTML as the plain-text alternative, so text-only clients saw raw
  markup and `Smith &amp; Co` for an ampersand.
- A second CodeQL workflow was uploading SARIF alongside GitHub's default setup,
  which rejects it, so every push to the default branch failed on a scan that had
  actually succeeded.

## [1.0.0] - 2026-08-14

The first release that is ours. Covers the fork from its first commit on 2026-08-07.

Numbered 1.0.0 rather than continuing Postiz's numbering because the inherited tags were deleted
when this repository detached from upstream, so the `v*` namespace starts here. It is not a claim
that the code is newer or better than Postiz 2.23.0; it is the first version of THIS codebase that
anyone tagged.

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

- **Detached from upstream.** This is now a standalone codebase. The `upstream` remote is gone, the
  195 Postiz release tags inherited at fork time were deleted from our remote, and we will not merge
  or rebase from [gitroomhq/postiz-app](https://github.com/gitroomhq/postiz-app) again, because the
  tree is too diverged for that to pay. Two consequences are worth stating plainly. First, the rule
  that governed every deletion made here, that removing an inherited file costs a conflict on every
  future merge, is **retired**: dead code should now be deleted rather than preserved, and
  `CONTRIBUTING.md` says so instead of the opposite. Second, a fix in code we did not change no
  longer reaches us by inheritance, so `SECURITY.md` still routes genuine Postiz bugs to Gitroom but
  no longer implies we will pick their fix up. **The licence does not move.** This is still a
  modified version of Gitroom's AGPL-3.0 work: `LICENSE` is untouched, the attribution in the README
  and in `SECURITY.md` stays, and section 13 still obliges us to offer the Corresponding Source to
  anyone using this version over a network. Detaching a git remote does not make this code ours to
  claim.
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

- **Postiz SaaS surface this app does not use**: 59 files and roughly 40 dependencies. The rule
  applied at the time was that deleting an inherited file is not free, because it becomes a conflict
  on every future merge, so anything that merely looked unused was left alone. That is why the 25
  unconnected social providers, the browser extension, the SDK and the commands app are all still
  here. **That rule is retired** as of the detachment above, so those four are now removable: it is
  available work rather than a thing to avoid, and each one is a scoped decision of its own.
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
