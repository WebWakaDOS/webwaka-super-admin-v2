## Description

<!-- Briefly describe what this PR does and why -->

## Type of change

- [ ] Bug fix (`fix:`)
- [ ] New feature (`feat:`)
- [ ] Test (`test:`)
- [ ] Chore / tooling (`chore:`)
- [ ] Documentation (`docs:`)
- [ ] Performance (`perf:`)
- [ ] Refactor (`refactor:`)

## Related issue / phase

<!-- e.g. "Phase 2 — Tests + DX" or "Fixes #42" -->

## Checklist

- [ ] Unit tests pass: `cd workers && pnpm test --run` (138 tests green)
- [ ] TypeScript type-check passes: `pnpm tsc --noEmit`
- [ ] Frontend builds: `cd frontend && pnpm build`
- [ ] No hardcoded secrets or credentials
- [ ] All monetary values use kobo (integer) — not NGN floats
- [ ] NDPR consent enforced for partner endpoints
- [ ] New endpoints have Zod validation + `requireAuth` / `requirePermission`
- [ ] New API methods added to `frontend/src/lib/api.ts`
- [ ] Migration file created for any schema changes

## Nigeria First checks

- [ ] No NGN float amounts (use kobo integers: `z.number().int()`)
- [ ] Partner endpoints enforce `ndpr_consent: true`
- [ ] Currency display uses `₦` or `NGN` (not `$`)
- [ ] New i18n strings added to all 4 locale files (`en`, `yo`, `ig`, `ha`)

## Screenshots (if UI changes)

<!-- Paste before/after screenshots for UI changes — include mobile view -->

## Notes for reviewers

<!-- Anything else the reviewer should know -->
