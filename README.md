# Cuesoft Postiz

Cuesoft's self-hosted social publishing and scheduling app. It is a fork of
[gitroomhq/postiz-app](https://github.com/gitroomhq/postiz-app), rebuilt around how Cuesoft
actually publishes: one organization, six channels, a weekly content pipeline, and an agent that
drafts the copy.

This is not a distribution. It is the code that runs `postiz.cuesoft.io`, and it is opinionated
about that. If you want upstream Postiz, use upstream Postiz.

## What we changed, and why

| Area | What the fork does |
| --- | --- |
| Auth | Google SSO through our internal OIDC provider. Registration is disabled; users arrive by invite. |
| LinkedIn and TikTok | Two providers, `linkedinbuffer` and `tiktokbuffer`, that connect like any other channel and hand the post to Buffer at publish time. Neither platform can be native here: TikTok's developer app was rejected for internal company use, and self-hosted Postiz needs its own credentials. There is exactly **one** gate and it lives in Postiz. |
| Ace | A web chat backed by fenced Claude Code sessions, for drafting a week's copy in the product instead of a terminal. Sessions are owner-scoped; credentials never enter the child process. |
| Approvals | Posts can be drafted without a date and released through an approval gate, one week at a time. |
| Interface | A Buffer-parity pass over the whole app: measured geometry, one shared segmented control, empty states, and a size ladder in `global.scss` that rescales upstream's own utility classes so we do not have to rewrite them and re-conflict on every rebase. |
| Storage and mail | Cloudflare R2 for media, Brevo over SMTP for transactional mail. |

## Tech stack

- **Monorepo** pnpm 10.6.1 workspaces, Node 22.20
- **Frontend** Next 16.2 (React 19.2), Tailwind 4.3, chart.js
- **Backend** NestJS 11, Prisma 6.19 against PostgreSQL
- **Workflows** Temporal, for scheduled publishing
- **Cache and queue** Redis (ioredis)
- **Storage** Cloudflare R2
- **Mail** Brevo (SMTP)

Apps live in `apps/` (`frontend`, `backend`, `orchestrator`, `commands`, `extension`, `sdk`) and
shared code in `libraries/`.

## Running it

Node is pinned. Use pnpm, never npm or yarn.

```bash
corepack enable && corepack prepare pnpm@10.6.1 --activate
pnpm install --frozen-lockfile
pnpm run dev
```

Before opening a PR, run what CI runs:

```bash
pnpm test          # security regression tests
pnpm run lint
pnpm run typecheck
pnpm run build
```

## Deployment

The production host **builds the image locally and never pulls it**. Deployment tooling, the
compose stack, secrets handling and the runbooks live in the
[design-system](https://github.com/cuesoftinc/design-system) repository under `postiz/`, alongside
the weekly content pipeline that feeds this app through its public API.

Two things worth knowing before you touch a deploy:

- The container does **not** run `prisma db push` at startup. A schema change needs a deliberate
  step, or it silently will not apply. Use `postiz/check-schema.sh` to see drift.
- `POSTIZ_IMAGE` may pin an immutable registry digest, but it is never required, because the
  local-build host has no registry digest to give.

## Licence and source

This repository is a modified version of Postiz and stays under the
[AGPL-3.0 licence](LICENSE), which is not optional and cannot be relicensed. Section 13 obliges us
to offer the Corresponding Source to anyone who uses a modified version we serve over a network:
this repository is that offer.

Upstream Postiz is by [Gitroom](https://github.com/gitroomhq/postiz-app). The features listed above
are ours; everything else is theirs, and the copyright notices in the source say which is which.
