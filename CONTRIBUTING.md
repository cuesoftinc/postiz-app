# Contributing

This repository is a modified version of [Postiz](https://github.com/gitroomhq/postiz-app),
licensed under AGPL-3.0. It is not a distribution: it is the code that runs `postiz.cuesoft.io`.

It is also a **standalone codebase**. We no longer track Gitroom's repository: there is no
`upstream` remote and we will not merge or rebase from it again, because this tree is too diverged
for that to be useful. Postiz is still the origin of this code, and the licence and the
attribution to Gitroom stay exactly as they are. What ended is the syncing, not the lineage.

Contributions here should be changes **we** need. If your change is a general improvement to
Postiz, send it to [gitroomhq/postiz-app](https://github.com/gitroomhq/postiz-app) as well, so
everyone gets it. Send it here too if we need it: we do not pull their commits any more, so a fix
that lands there will never arrive here on its own. We have no CLA and we do not use Gitroom's
contribution funnel.

## Branches

| Branch | What it is |
| --- | --- |
| `cuesoft/customizations` | The default branch. Everything we build targets it, and it is what deploys. |
| `main` | Frozen history. It holds the inherited Postiz tree as it stood at the last sync we ever took. Protected. Nothing ships from it and nothing merges into it. |

Branch from `cuesoft/customizations` and open the pull request back into it:

```bash
git fetch origin
git switch -c feat/short-description origin/cuesoft/customizations
```

Never open a pull request against `main`, and never merge work into it. It is kept as a record of
where this code came from and it does not move any more. Maintainers can push directly to
`cuesoft/customizations`, but a pull request is the normal route because that is where review and
the CI gate happen.

## Deleting code (this rule has changed)

Earlier versions of this file told you that **deleting or reformatting an inherited file was not
free**, because it became a conflict on every future merge from upstream. There is no upstream to
merge from now, so that cost does not exist, and the rule has been retired. Keeping it would only
protect dead code in exchange for a benefit we no longer receive.

So: if code is genuinely unused, **delete it**. Prove it is unused before you do, and put the
proof in the pull request: no importers, no route that reaches it, no configuration that switches
it on. "It looks unused" is how a working feature gets removed, and that risk is unchanged.
Reformatting a file you are not otherwise touching is still noise in a diff, but it is only noise
now, not a debt.

This unlocks real work that used to be off limits. Things kept only to avoid the old merge cost
are now removable: roughly 25 social providers nothing here connects to, the browser extension
(`apps/extension`), the client SDK (`apps/sdk`) and the commands app (`apps/commands`). **Do not
remove any of them on your own initiative.** Each one is a maintainer's call, wants its own pull
request, and needs the capability question answered first. Ask before you start.

One artefact of the old era survives because it is load-bearing on its own merits: the size ladder
in `apps/frontend/src/app/global.scss` rescales roughly 370 of Postiz's arbitrary Tailwind values
through attribute selectors, so an authored class and the value the browser paints are not the
same number. It is no longer there to avoid rewriting files. It is there because the whole
interface was measured against it. Read the MECHANISM section of `apps/frontend/PARITY-CATALOG.md`
before you change a size or report a size regression, or you will chase a phantom.

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
  extension/      Browser extension, inherited from Postiz, nothing here uses it
  sdk/            Client SDK, inherited from Postiz, nothing here uses it
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
  directory exists so a hole cannot silently reopen on a later change.
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

This project is licensed under **AGPL-3.0**, inherited from Postiz, the work it is derived from.
That licence is not ours to change and cannot be relicensed. Detaching from Gitroom's repository
changed nothing here: this is still a modified version of their AGPL-3.0 work, and no git
operation can alter that.

By contributing, you agree your contribution is licensed under AGPL-3.0 and that you have the
right to license it that way. Practically:

- Do not paste in code you cannot license under AGPL-3.0, including code from a
  proprietary codebase or from a permissively-licensed source whose notices you have stripped.
- Leave existing copyright and licence headers alone, and never delete one. They record which
  parts came from Postiz and which are ours.
- Section 13 obliges us to offer the Corresponding Source to anyone who uses this modified version
  over a network. This repository is that offer, which is why our changes are published here
  rather than kept private.

## Code of Conduct

Participation is governed by our [Code of Conduct](CODE_OF_CONDUCT.md).
