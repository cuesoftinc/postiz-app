# Contributing

This repository is Cuesoft's fork of [Postiz](https://github.com/gitroomhq/postiz-app). It is not
a distribution and it is not upstream: it is the code that runs `postiz.cuesoft.io`, kept
deliberately close to upstream so we can keep rebasing on it.

Contributions here should be changes **we** need. If your change is a general improvement to
Postiz, send it to [gitroomhq/postiz-app](https://github.com/gitroomhq/postiz-app) instead, where
everyone gets it. We have no CLA and we do not use upstream's contribution funnel.

## Branches

| Branch | What it is |
| --- | --- |
| `cuesoft/customizations` | The default branch. Everything we build targets it, and it is what deploys. |
| `main` | Tracks upstream. Protected. Features never go here; it exists so we can rebase. |

Branch from `cuesoft/customizations` and open the pull request back into it:

```bash
git fetch origin
git switch -c feat/short-description origin/cuesoft/customizations
```

Never open a pull request against `main`, and never merge fork work into it. `main` moves only
when we pull upstream. Maintainers can push directly to `cuesoft/customizations`, but a pull
request is the normal route because that is where review and the CI gate happen.

## The rebase rule (read this before deleting anything)

We merge upstream regularly, so **deleting or reformatting an upstream file is not free**: it
becomes a conflict on every future merge, forever. Before you remove upstream code because it
looks unused, be sure it buys something other than bytes. That is why 25 unconnected social
providers, the browser extension, the SDK and the commands app are all still in the tree.

For the same reason, prefer additive changes over rewrites in upstream files. The size ladder in
`apps/frontend/src/app/global.scss` is the pattern: it rescales upstream's own utility classes
through attribute selectors so we never have to rewrite them.

## Getting set up

Node is pinned to 22.20 and the package manager is pnpm 10.6.1. Use pnpm, never npm or yarn: the
lockfile and the hoisted node-linker in `.npmrc` are load-bearing.

```bash
corepack enable && corepack prepare pnpm@10.6.1 --activate
pnpm install --frozen-lockfile   # postinstall runs prisma generate
cp .env.example .env             # then fill in development-safe values
pnpm run dev
```

Never put production credentials in your `.env`. Never commit it.

## Repository layout

```
apps/
  frontend/       Next 16 (React 19), Tailwind 4, the whole UI
  backend/        NestJS 11 API, controllers under src/api/routes
  orchestrator/   Temporal workflows and activities, the publishing path
  commands/       CLI entrypoints
  extension/      Browser extension (upstream, kept for rebase safety)
  sdk/            Published client SDK (upstream)
libraries/
  nestjs-libraries/          Prisma schema, database services, integrations, chat
  helpers/                   Shared runtime helpers
  react-shared-libraries/    Shared frontend pieces
tests/security/   Security regression tests, run by `pnpm test`
var/docker/       Runtime container assets (nginx config)
```

The social providers, including the `linkedinbuffer` and `tiktokbuffer` relay providers, live in
`libraries/nestjs-libraries/src/integrations/social/`.

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `chore:`,
`docs:`, `refactor:`, `test:`, `perf:`.

Write the body for the person who has to debug this in six months. Say what was actually wrong and
how you know the fix works, not just what you touched.

## Before opening a pull request

Run exactly what CI runs. The gate is `.github/workflows/build.yml`, named **Validate**, and it
runs these four in order:

```bash
pnpm test          # security regression tests in tests/security/
pnpm run lint      # eslint, --max-warnings=0, so a warning fails the build
pnpm run typecheck # the three project tsconfigs: frontend, backend, orchestrator
pnpm run build     # frontend, backend, orchestrator
```

All four must pass. `pnpm run typecheck` uses the per-app configs rather than the root one, so
running `tsc` at the root will lie to you.

Also:

- Do not commit secrets, credentials, or `.env` files. Push protection is on and will stop you.
- If you fix a security bug, add a test in `tests/security/` that fails without your fix. That
  directory exists so a hole cannot silently reopen on a later rebase.
- If you change the Prisma schema, say so in the pull request. The production container does
  **not** run `prisma db push` at startup, so a schema change needs a deliberate migration step or
  it will simply not apply.
- Fill in the pull request template and link related issues.
- Keep pull requests focused. Smaller ones review faster.

## Review

At least one approving review from a [CODEOWNER](CODEOWNERS) before merge. Be responsive to
feedback.

## Security issues

Do not open an issue or a pull request for a vulnerability. Follow [SECURITY.md](SECURITY.md).

## Licence

This project is licensed under **AGPL-3.0**, inherited from upstream Postiz. That licence is not
ours to change and cannot be relicensed.

By contributing, you agree your contribution is licensed under AGPL-3.0 and that you have the
right to license it that way. Practically:

- Do not paste in code you cannot license under AGPL-3.0, including code from a
  proprietary codebase or from a permissively-licensed source whose notices you have stripped.
- Leave existing copyright and licence headers alone. They record which parts are upstream's and
  which are ours.
- Section 13 obliges us to offer the Corresponding Source to anyone who uses this modified version
  over a network. This repository is that offer, which is why our changes are published here
  rather than kept private.

## Code of Conduct

Participation is governed by our [Code of Conduct](CODE_OF_CONDUCT.md).
