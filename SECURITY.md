# Security Policy

This is `cuesoftinc/postiz-app`, a modified version of
[gitroomhq/postiz-app](https://github.com/gitroomhq/postiz-app) (Postiz, by Gitroom). It is the
code that runs `postiz.cuesoft.io`. It is maintained as a standalone codebase and is no longer
synced with Gitroom's repository, which matters for triage: see Scope below.

Treat it as sensitive. A running instance holds live OAuth access and refresh tokens for real
social accounts, so a bug that crosses an organization boundary, leaks a token, or lets an
unapproved post reach the publisher is not theoretical: it can post as a real brand, delete real
posts, or read a real account's analytics. Report those privately.

## Reporting a vulnerability

**Do not open a public issue, discussion, or pull request for a vulnerability.**

Report it through GitHub's
[private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability):
go to this repository's **Security** tab and choose **Report a vulnerability**. Private reporting
is enabled here, so that route works today and is the one we prefer, because the report, the fix
and the advisory stay attached to the repository.

If the Security tab is unavailable to you, email `security@cuesoft.io` with the subject
`Security vulnerability: postiz-app`.

Please include:

- what the issue is and what an attacker gets from it,
- steps to reproduce, ideally against a local instance,
- the affected surface (frontend, backend, orchestrator, Ace, publishing) and file paths if you
  have them,
- the commit you tested, since builds here are identified by commit rather than by a version.

We aim to acknowledge within 3 business days. Please give us time to ship a fix before disclosing
publicly.

Do not test against `postiz.cuesoft.io`. It publishes to production social accounts, and a
successful proof there is a real post on a real channel. Run a local instance instead:
`README.md` has the setup.

## Scope

**In scope: this repository's code and its deployment.** These are the parts we wrote or changed,
and the parts we can actually fix:

- Google SSO authentication and the invite-only user flow (registration is disabled).
- The `linkedinbuffer` and `tiktokbuffer` relay providers, and anything reached through them.
- Ace, the in-product chat backed by fenced Claude Code sessions, including session ownership and
  the fence around the child process.
- The approvals gate and undated drafts, including any path that publishes a post that was not
  approved.
- Multi-tenancy: any query, route, or workflow that resolves a record by a client-supplied id
  without scoping it to the caller's organization.
- The publishing workflow, including duplicate or double publishing.
- The container image and the runtime configuration surface in this repository.

**Out of scope here, but still worth reporting somewhere:**

- Code we have not modified, which came from Postiz. We are not the authority on it, so report it to
  [gitroomhq/postiz-app](https://github.com/gitroomhq/postiz-app/security), where the fix reaches
  every Postiz user and not only us. That routing is still correct. What has changed is what happens
  next: we no longer sync with Gitroom's repository, so we cannot promise to pick up their fix, and
  a bug in inherited code that runs on our instance is ours to assess and patch here. **So tell us
  the advisory id too** if it affects our deployment. Reporting it there and telling us are not
  alternatives.
- Third-party services we call: Buffer, LinkedIn, TikTok, Google, Cloudflare R2, Brevo. Report to
  the vendor.
- Volumetric denial of service, automated scanner output with no demonstrated impact, and reports
  about social platforms' own policies.

## Supported versions

This repository ships from a branch, not a release. `main` is the default branch
and the one that is deployed; fixes land there, and deployed environments are expected to track it.
`backup` is frozen inherited history and is not where our fixes go.

There are no version tags. The Postiz tags this repository once carried were deleted, because they
described Gitroom's releases and never ours, so nothing in the tag namespace can be read as a
statement about this code. If a release is tagged here it will be ours and it will say what it
covers; until then, identify a build by its commit.

## Handling of secrets

- **Never commit credentials.** No `.env`, no OAuth client secrets, no tokens, no keys, no
  database URLs with a password in them. `.gitignore` covers `.env` and `.env.*` while keeping
  `.env.example`, and `.dockerignore` keeps all of it out of the build context so nothing lands in
  an image layer.
- Secret scanning and push protection are enabled on this repository. If push protection blocks
  you, do not work around it: the credential is real and needs rotating.
- If a secret does reach a commit, **rotate it first**, then clean the history. Rewriting history
  alone does not help, because the value was already published.
- Supply configuration at runtime through environment variables or a secret manager, never baked
  into an image and never hardcoded. `.env.example` is the template and holds placeholders only.
- Ace's sessions run fenced: credentials must not be passed into a child process or echoed into
  chat output. A change that widens that fence is a security change and should be reviewed as one.
- Deployment, the compose stack, and how secrets are supplied in production are documented in the
  [design-system](https://github.com/cuesoftinc/design-system) repository under `postiz/`. Do not
  copy production values into this repository to reproduce a bug.

## Security tests

Security regressions are pinned by tests in `tests/security/`, run by `pnpm test` in CI on every
push and pull request. A fix for a reported vulnerability should come with a test there that fails
without the fix, so the hole cannot reopen on a later change.
