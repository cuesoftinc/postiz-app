<!-- Base this PR on `cuesoft/customizations`. Never on `main`: main tracks upstream. -->

## Summary

<!-- What this changes and why. If it fixes a bug, say what was actually wrong. -->

## Related issues

<!-- e.g. Closes #123 -->

## Type of change

- [ ] Bug fix
- [ ] New feature
- [ ] Refactor / chore
- [ ] Documentation
- [ ] Security fix
- [ ] Upstream rebase / merge

## Affected surface

- [ ] `apps/frontend`
- [ ] `apps/backend`
- [ ] `apps/orchestrator` (Temporal, publishing)
- [ ] Ace (in-product chat and sessions)
- [ ] Publishing and providers (including the `linkedinbuffer` / `tiktokbuffer` relay)
- [ ] `libraries/`
- [ ] Build, image, or CI

## Validation

Run what CI runs, all four:

- [ ] `pnpm test` passes
- [ ] `pnpm run lint` passes (`--max-warnings=0`)
- [ ] `pnpm run typecheck` passes with 0 errors
- [ ] `pnpm run build` passes

<!-- If you verified in a running instance, say how. Screenshots for UI changes. -->

## Fork checks

- [ ] Base branch is `cuesoft/customizations`.
- [ ] Commits follow Conventional Commits (`feat:`, `fix:`, `chore:`, ...).
- [ ] If this deletes or rewrites an upstream file, the PR says what that buys, because it costs a
      conflict on every future merge.
- [ ] No secrets, credentials, or `.env` files are committed.
- [ ] Prisma schema changed? Flagged here, with the migration step, because the container does not
      run `prisma db push` at startup.
- [ ] Security fix? A test in `tests/security/` that fails without this change is included.
- [ ] Documentation updated where relevant.
