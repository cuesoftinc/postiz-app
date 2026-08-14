---
name: Bug report
about: Report a problem in Cuesoft's Postiz fork
title: "[Bug]: "
labels: [bug]
---

<!--
Security vulnerabilities do NOT go here. See SECURITY.md and use the Security tab.

This repository is a modified version of Postiz, maintained on its own. If the bug is in code we
did not change and also happens in Postiz, https://github.com/gitroomhq/postiz-app is the right
place for the fix. Open it here too if it affects this app: we do not pull their changes, so a fix
there does not reach us on its own.
-->

## Description

<!-- What happened, and what you expected instead. -->

## Which surface?

- [ ] Frontend (the UI)
- [ ] Backend (API)
- [ ] Orchestrator (Temporal, scheduling, publishing)
- [ ] Ace (in-product chat, sessions)
- [ ] Publishing to a channel (which platform? include the relay channels
      `linkedinbuffer` / `tiktokbuffer`)
- [ ] Build, image, or CI
- [ ] Something else / not sure

## Where does it reproduce?

- [ ] On the deployed instance
- [ ] Locally (`pnpm run dev`)
- [ ] Both
- [ ] Have not tried the other one

## Steps to reproduce

1.
2.
3.

## Expected behavior

## Actual behavior

## Environment

- Commit or branch:
- Browser and device (for frontend bugs):
- Channel and platform (for publishing bugs):

## Additional context

<!--
Logs, screenshots, request or response bodies.

DO NOT PASTE SECRETS. Redact tokens, cookies, JWTs, OAuth codes, connection strings and
`.env` contents. A publishing bug report almost always includes a request that carries a token.
-->
