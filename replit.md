# WebWaka Super Admin V2

A production-ready, multi-tenant administration platform with an enterprise-grade React 19 frontend and Hono Cloudflare Workers API. Nigeria First — all monetary values in kobo (integer), NDPR consent enforced, Yoruba/Igbo/Hausa i18n.

## Project Overview

Monorepo: React 19 SPA (Cloudflare Pages) + Hono Workers API (Cloudflare Workers + D1 + KV). In Replit, only the frontend dev server runs locally. The Workers API requires Wrangler CLI and Cloudflare infrastructure.

**Deployment target: Cloudflare only — no Replit deployments.**

## Implementation Status — All Phases Complete ✅

| Phase | Status | PR | Tests |
|-------|--------|----|-------|
| Phase 0 — Critical blockers (demo creds, JWT, CORS, rate limit) | ✅ DONE | #5 | — |
| Phase 1 — API completeness (11 endpoints, Zod v4, security headers) | ✅ DONE | #6 | 20 |
| Phase 2 — Tests + DX (Vitest, Playwright, seed, CI hardening) | ✅ DONE | #8 | 237 |
| Phase 3 — i18n + PWA + Accessibility (sidebar, offline, ARIA) | ✅ DONE | #7, #9 | — |
| Phase 3 (enhanced) — `useTranslation` + `t()` on all 15 pages, `role="main"`, 8 PWA icons, SW v3 | ✅ DONE | #9 | — |
| Phase 4 — Performance + Features (virtual scroll, bulk actions, provisioning wizard, AI quota, SWR cache, 25+ D1 indexes, circuit breaker, CI hardening) | ✅ DONE | #10 | — |

## Tech Stack

- **Frontend**: React 19, Vite 7, Tailwind CSS 4, shadcn/ui, Wouter (hash routing), Recharts, i18next
- **Backend**: Hono 4, Cloudflare Workers, D1 (4 databases), KV (sessions/cache/flags)
- **Validation**: Zod v4.3.6 (using `error:` syntax, not `errorMap`)
- **Auth**: bcryptjs, HS256 JWT, KV session store (24h TTL), rate limiting (5/min/IP)
- **Testing**: Vitest (237 tests, 6 files), Playwright (3 E2E spec files)
- **Package manager**: pnpm (workspace monorepo)

## Project Structure

```
frontend/
  src/
    components/       # DashboardLayout, Sidebar (mobile drawer), Header, OfflineBanner
    contexts/         # AuthContext (token validation on mount), TenantContext
    hooks/            # useTenantData, useBillingData, useDashboardData, useHealthData
    lib/              # api.ts (unified client), api-client.ts (facade)
    pages/            # TenantManagement, PartnerManagement, AuditLog, Billing, Health, Settings
    i18n/locales/     # en, yo (Yorùbá), ig (Igbo), ha (Hausa)
  e2e/                # Playwright specs (super-admin-v2, tenant-lifecycle, partner-onboarding)
  public/             # manifest.webmanifest, sw.js (PWA)
  playwright.config.ts

workers/
  src/
    index.ts          # ~2100 lines: all 11 endpoints, 17 Zod schemas, middleware
    __tests__/        # 6 Vitest test files (237 tests total)
  migrations/         # D1 SQL (001–004 + seed/)
  scripts/
    seed-local.mjs    # Seeds all 4 D1 DBs for local dev
  wrangler.toml       # Workers + D1 + KV config (staging/prod separated)

.github/
  workflows/ci.yml          # Frontend build, Workers tests (237), security scan, Playwright E2E
  pull_request_template.md  # Nigeria First checklist

IMPLEMENTATION_REPORT.md   # Complete phase audit with PR table and test breakdown
CONTRIBUTING.md            # Full DX guide (setup, tests, E2E, seeding, deployment)
.env.example               # All env vars documented
```

## Running in Replit

The `Start application` workflow runs: `cd frontend && pnpm dev`
Starts Vite dev server (port 5000, `host: '0.0.0.0'`, `allowedHosts: true`).

API calls will fail gracefully (no local Workers) — frontend shows loading states.

## Running Tests

```bash
cd workers && pnpm test --run     # 237 Vitest tests
cd frontend && pnpm exec playwright test  # E2E (requires dev server on port 5175)
```

## Key Invariants (Nigeria First)

| Rule | Implementation |
|------|---------------|
| All amounts in kobo | `z.number().int()` in BillingEntrySchema |
| NDPR consent required | `z.literal(true)` in PartnerCreateSchema |
| 5-level MLM commissions | `level` field (1–5) in commissions table |
| Nigerian locale | `en-NG`, `₦` currency symbol |
| Zod v4 syntax | `error: 'msg'` not `errorMap` for enum/literal |

## RBAC Roles

| Role | Permissions |
|------|------------|
| `super_admin` | All permissions |
| `admin` | Read/write tenants, read billing, manage modules |
| `finance` | Read/write billing, read analytics |
| `support` | Read tenants/billing/settings/analytics |
| `readonly` | Read tenants + analytics only |

## GitHub

Repo: `WebWakaDOS/webwaka-super-admin-v2`
Auth: `webwakaagent18` via `GITHUB_PAT` secret
Push pattern: GitHub REST API (blobs → tree → commit → ref)
