# Changelog

All notable changes to this repository are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

This repository is **not versioned yet**. It ships from the `main` branch, which
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

### Fixed

- **`linkedin-page` connects without the OpenID Connect scopes.** Upstream's
  provider asks for `openid` + `profile` and reads the connecting member from
  `/v2/userinfo`. Our LinkedIn app holds Community Management but cannot add
  *Sign In with LinkedIn using OpenID Connect* — a separate product, and every
  "Request access" button on the Products page was greyed out while the
  Community Management review was open (01 Sep 2026). Because `checkScopes()`
  compares the provider's array against the scopes the token comes back with,
  **every** connect failed with `NotEnoughScopes` before a page could be picked.

  The provider now asks for the five scopes the app actually holds
  (`w_member_social`, `r_basicprofile`, `rw_organization_admin`,
  `w_organization_social`, `r_organization_social`) and takes the member fields
  from `/v2/me` through a shared `fetchMember()` helper, replacing two calls
  with one. Both code paths already called `/v2/me` for `vanityName`, so
  `r_basicprofile` access is not a new assumption.

  Contained because neither caller keeps those fields: `isBetweenSteps = true`,
  so `authenticate()`'s identity is the intermediate record only and
  `POST /connect` replaces id/name/picture with the organization's own via
  `fetchPageInformation()`; and `refresh()` re-saves the row with the
  integration's existing `internalId`/name/picture, so only the token fields
  survive a refresh. The member id is now a legacy numeric id rather than
  userinfo's `sub`, and nothing downstream compares them.

  Personal `linkedin` is untouched — it still asks for `openid`, and we do not
  connect it. **Do not re-add the two scopes to `linkedin-page`** if the product
  is granted later: fewer scopes is the better resting state, and re-adding them
  reintroduces the failure.

  Verified on the Cuesoft host: the channel connected as `linkedin-page`
  "Cuesoft" (organization `11761352`) with a refresh token issued, and a
  scheduled post with a first comment created a parent + child post pair on it.

### Changed

- **The default branch is now `main`; the inherited upstream branch is `backup`.**
  This fork's default was `cuesoft/customizations`, with the frozen upstream tree
  sitting on `main` — so the one branch everything targets had a non-obvious name
  and the conventional name pointed at history nothing ships from. They have
  swapped: `main` is the default and what deploys, `backup` is the frozen
  inherited Postiz tree.

  The risk in this was not the rename, it was a `push:` trigger. GitHub matches
  those by name and fails **silently**: the staging workflow listed only
  `cuesoft/customizations`, so the instant the branch was renamed it would have
  fired on nothing — merges producing no image, no failed job, no error, the first
  symptom being someone noticing GHCR had gone quiet. The trigger was widened to
  accept both names in a separate change that landed *first*, so no window
  existed, and the old name is dropped here.

  `main-protection` was retargeted and renamed to `backup-protection`. It pinned
  `refs/heads/main`, which after the rename would have landed on the live default,
  duplicating `default-branch-protection` (`~DEFAULT_BRANCH`) while leaving the
  archived branch unprotected — the exact inversion of its intent. It now pins
  `refs/heads/backup` with deletion and non-fast-forward rules; the pull_request
  rule was dropped, since nothing is meant to merge into an archive at all.

  Prose references were updated across `CONTRIBUTING.md`, `SECURITY.md`,
  `PARITY-CATALOG.md`, the PR template and the workflow headers. Several of those
  named *both* branches in one breath ("base on X, never on `main`"), so a
  substitution of the old name alone left them contradicting themselves; each was
  rewritten rather than swapped.

  Existing clones need `git remote set-head origin -a`, and any clone with a
  single-branch fetch refspec needs `remote.origin.fetch` repointed — GitHub
  redirects the old default for pushes and fetches, but a pinned refspec is not
  covered by that redirect.

## [1.2.4] - 2026-08-23

### Added

- **Regression tests for the upload allow-lists** (`tests/security/upload.allowlist.test.cjs`).
  1.2.3 fixed a `application/pdf` entry that had been added to one of six copies
  of the same list, and left a comment asking future readers not to "reconcile"
  the lists that differ deliberately. A comment cannot fail a build. These nine
  tests encode the invariants instead: every uploadable type must also be
  storable (the direction that actually broke, and the one that surfaces as an
  opaque 500 from inside the storage provider); audio is storable but never
  uploadable; `.avif`/`.bmp`/`.tiff` are storable but never postable; `getMaxSize`
  caps every type the sets permit; a PDF gets LinkedIn's 100MB document headroom
  rather than the 10MB image cap; and `ValidUrlExtension` accepts a stored `.pdf`,
  survives a query string, and still refuses `.exe`, `.svg` and empty input.

  Verified to fail for the right reason: removing `DOCUMENT_MIME_TYPES` from
  `STORAGE_ALLOWED_MIME_TYPES` — exactly the 1.2.3 bug — turns two of them red
  with "application/pdf is uploadable but not storable".

## [1.2.3] - 2026-08-23

### Fixed

- **Every LinkedIn carousel upload failed with a 500, because the PDF allow-list
  was added to one of five copies.** `application/pdf` was allowed in
  `custom.upload.validation.ts` (and given a 100MB cap in `getMaxSize`) so that
  `LinkedinProvider` could reach LinkedIn's `/documents` endpoint, which it has
  always supported. But the same list was retyped in `cloudflare.storage.ts`,
  `local.storage.ts` and `public.integrations.controller.ts`, and those copies
  were never touched. So a carousel PDF passed `CustomFileValidationPipe` at the
  `/public/v1/upload` boundary and was then rejected one layer deeper inside
  `CloudflareStorage.uploadFile` — as a bare `Error` rather than an
  `HttpException`, which is why the caller saw an opaque HTTP 500 instead of a
  400 naming the file type. All copies now compose from
  `upload/allowed.mime.types.ts`, which keeps the deliberate distinction the
  duplicates were blurring: `UPLOAD_ALLOWED_MIME_TYPES` is what a caller may
  upload, `STORAGE_ALLOWED_MIME_TYPES` adds the audio a provider may persist but
  no caller may send. `r2.uploader.ts` stays extension-keyed — the multipart flow
  must name the object key before it has bytes to sniff — and gained `.pdf`
  alongside.

- **The same drift had a second layer: a PDF that uploaded could still not be
  attached to a post.** With the allow-lists fixed, the carousel reached R2 and
  then failed at post creation instead — `ValidUrlExtension`, the class-validator
  constraint on `MediaDto`, checks the stored URL's extension against its own
  hard-coded list of six and rejected `.pdf` with a 400. It now derives from
  `POSTABLE_MEDIA_EXTENSIONS` in the same shared module, and its error message is
  generated from that list so it can never name a different set than the one
  enforced. That list stays deliberately narrower than the upload allow-list:
  `.avif`, `.bmp` and `.tiff` are safe to store but the platforms will not accept
  them, so they remain storable and not postable. The constraint also no longer
  reports `true` for a path that is only a query string.

## [1.2.2] - 2026-08-18

### Fixed

- **A LinkedIn post was lost outright when Buffer refused its first comment.**
  Buffer's plan rejects `metadata.linkedin.firstComment`, and it rejects it IN
  BAND: HTTP 200, no top-level `errors` array, the refusal carried as a member
  of the `createPost` union. `BufferRelayProvider.post` keyed its
  degrade-gracefully retry on a *thrown* error, so nothing ever caught it and
  the post died `nonRetryable` after three attempts. The operator saw only
  "Buffer refused the post: unknown reason", because the message was read only
  when `__typename` equalled `MutationError` — the INTERFACE name, which is
  never what comes back (the concrete member was `InvalidInputError`). The
  refusal is now read off the response, so the retry fires and the post
  publishes without the comment as it was always meant to, and every error
  member surfaces its own message instead of one hard-coded typename. Reading
  the union moved to `buffer.relay.response.ts` with regression tests, because a
  `try`/`catch` could not have covered this and review alone had already missed
  it once. One post lost on 2026-08-18; an audit of every error ever recorded
  bounds the exposure to that single incident, `InvalidInputError` being the
  only non-success member the relay has seen since it went live on 12/13 Aug.

### Changed

- **`Dockerfile.dev` reinstalled its `apt-get` toolchain on every build.**
  `ARG NEXT_PUBLIC_VERSION` / `ENV NEXT_PUBLIC_VERSION=$NEXT_PUBLIC_VERSION`
  carries the commit SHA plus a `-dirty` marker, so it differs on every build
  and invalidated the layer beneath it — `g++`/`make`/`python3`, reinstalled
  each time to reproduce a byte-identical layer. The declaration moves below
  the install layers, just above its only consumer (`pnpm run build`).
  Measured at 276.2s per build; two builds afterward report `#9 CACHED`. The
  4.56GB runtime `COPY` remains the dominant cost and was not addressed here —
  several restructurings were tried and reverted because they measured worse
  or failed on `pnpm install` not being manifest-pure in this tree.

## [1.2.1] - 2026-08-16

### Fixed

- **YouTube channel analytics failed silently.** `analytics()` ended in
  `catch { return [] }`: the `checkAnalytics` RefreshToken retry can only fire
  if an auth failure escapes the method, so a dead token produced an empty
  chart, Redis-cached for an hour, with no error anywhere — for a week. Errors
  are now logged with Google's response detail, and a 401 rethrows as
  `RefreshToken`, the contract posting already honors (which is why posting
  survived the same token while insights died). A 403 deliberately stays a
  logged empty result: the service retries `RefreshToken` with `forceRefresh`,
  and a post-refresh 403 (quota, API not enabled) would recurse forever.
- **The delete-channel confirm painted behind the channel list that opened
  it.** The manage-channels overlay sat at `z-[210]`, inside the modal band
  [200-299], one layer above the store's first modal (200). It now sits at
  199, the top of the fixed-page-furniture band; the canonical z scale in
  `global.scss` records the move and the rejected alternative (a global
  anchor bump would put the composer modal above the drag-drop overlay that
  must beat it).

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
