# Super Admin V2 — Deep Review & Enhancement Plan

**Repo:** `WebWakaDOS/webwaka-super-admin-v2`  
**Date:** 2026-03-23  
**Reviewer:** WebWaka Replit Agent  
**Status:** Analysis complete — no implementation changes made

---

## 1. Executive Summary

10 highest-impact findings and recommendations:

1. **🔴 CRITICAL — Demo credentials hardcoded in production UI.** `Login.tsx` renders live demo credentials (`admin@webwaka.com / password`) visible to anyone who opens the app. This must be removed before production.
2. **🔴 CRITICAL — JWT fallback secret.** `workers/src/index.ts` line 278: `c.env.JWT_SECRET || 'default-secret-for-dev-only'` — if the `JWT_SECRET` Worker secret is missing, tokens are signed with a public string, allowing anyone to forge admin sessions.
3. **🔴 CRITICAL — No service worker file despite PWA hook.** `useServiceWorker.ts` registers `/sw.js` but the `public/sw.js` found is a stub. There is no real caching strategy, offline queue processing, or background sync. The app has zero actual offline capability.
4. **🔴 HIGH — Frontend–API contract breaks.** The frontend calls at least 8 endpoints (`/tenants/stats`, `/billing/metrics`, `/billing/commissions`, `/health/status`, `/health/alerts`, `/settings/api-keys`, `/settings/audit-log`, `/operations/*`) that **do not exist** in `workers/src/index.ts`. All data-dependent pages will show errors in production.
5. **🔴 HIGH — No rate limiting on any API endpoint.** The Hono Workers API has no rate limiting, retry protection, or brute-force prevention on `/auth/login` or any mutation endpoint.
6. **🟠 HIGH — DB schema divergence.** `tenants` migration (001) defines statuses `ACTIVE | SUSPENDED | PROVISIONING | ARCHIVED` and 10 industries; but `schema.ts` TypeScript types define `ACTIVE | SUSPENDED | TRIAL | CHURNED` and 7 industries. This inconsistency will cause runtime type errors.
7. **🟠 HIGH — All tests are assertion-only stubs.** The 5 test files contain no real API calls, no component render tests with real hooks, and no E2E tests. Zero of the 35+ endpoints are integration-tested. Coverage is effectively 0% for critical paths.
8. **🟠 MEDIUM — Auth token stored in `localStorage`.** JWT tokens in `localStorage` are vulnerable to XSS. Should migrate to `HttpOnly` cookies or at minimum implement CSP headers and a token refresh mechanism.
9. **🟡 MEDIUM — API base URL detection breaks in proxied environments.** Both `AuthContext.tsx` and `api-client.ts` detect `localhost` by hostname to switch between dev/prod API. This breaks completely on Replit, staging environments, or any reverse proxy where hostname is not `localhost`.
10. **🟡 MEDIUM — i18n infrastructure exists but is not wired into most UI.** Four locales (en, yo, ig, ha) are defined and translated, but most pages use hardcoded English strings rather than calling the `useTranslation` hook.

---

## 2. Repo Overview

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    WebWaka Super Admin V2                    │
│                                                             │
│  ┌─────────────────┐         ┌─────────────────────────┐   │
│  │  React 19 SPA   │ HTTPS   │  Cloudflare Workers     │   │
│  │  (CF Pages)     │────────▶│  Hono API (35+ routes)  │   │
│  │  /frontend      │  /api   │  /workers               │   │
│  └─────────────────┘         └──────────┬──────────────┘   │
│                                         │                   │
│                         ┌───────────────┼───────────────┐  │
│                         ▼               ▼               ▼  │
│                    D1 (5 DBs)      KV (4 namespaces)   R2  │
│              TENANTS_DB           SESSIONS_KV              │
│              BILLING_DB           FEATURE_FLAGS_KV         │
│              RBAC_DB              CACHE_KV                 │
│              MODULES_DB           NOTIFICATIONS_KV         │
│              HEALTH_DB                                      │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────▼───────────────┐
              │  External Suite Health Checks  │
              │  civic / commerce / transport  │
              │  (via fetch to Workers URLs)   │
              └───────────────────────────────┘
```

### 2.2 Key Folders and Files

| Path | Role |
|------|------|
| `frontend/src/App.tsx` | Root router (Wouter, hash-based). Wraps all routes in `AuthProvider → TenantProvider → ThemeProvider` |
| `frontend/src/contexts/AuthContext.tsx` | JWT auth state, login/logout, permission/role checks, localStorage persistence |
| `frontend/src/contexts/TenantContext.tsx` | Active tenant state, tenant list cache |
| `frontend/src/contexts/ThemeContext.tsx` | Dark/light theme toggle |
| `frontend/src/pages/` | 15 pages: Dashboard, TenantManagement, PartnerManagement, Billing, ModuleRegistry, SystemHealth, Analytics, OperationsOverview, DeploymentManager, Settings, Login, Home, Unauthorized, NotFound, Health |
| `frontend/src/hooks/` | `useApi`, `useDashboardData`, `useTenantData` (with WebSocket), `useBillingData`, `useHealthData`, `useServiceWorker`, `useTranslation`, `usePersistFn`, `useMobile`, `useComposition` |
| `frontend/src/lib/api.ts` | `ApiClient` class — REST wrapper (has method-signature bug, see §5.2) |
| `frontend/src/lib/api-client.ts` | Secondary `ApiClient` used by some pages (hardcodes `VITE_FRONTEND_FORGE_API_URL`) |
| `frontend/src/lib/db.ts` | Dexie/IndexedDB — offline cache, pending mutations queue, offline events log |
| `frontend/src/i18n/` | i18n engine + 4 locale JSON files (en, yo, ig, ha) |
| `frontend/public/sw.js` | Stub service worker (exists but has no caching strategy) |
| `frontend/public/manifest.json` | PWA manifest (exists) |
| `workers/src/index.ts` | 1,509-line Hono API — 35+ endpoints across all domains |
| `workers/src/schema.ts` | TypeScript types + `formatKoboToNaira`, `generateId` utilities |
| `workers/migrations/` | 6 SQL migration files for all 5 D1 databases |
| `workers/scripts/` | `seed-staging.mjs`, `seed-production.mjs` |
| `workers/wrangler.toml` | Cloudflare Workers + D1 + KV bindings for staging/production |
| `.github/workflows/` | 3 CI/CD workflows: `deploy.yml`, `deploy-frontend.yml`, `deploy-workers.yml` |

### 2.3 How Super Admin V2 Connects to the WebWaka Ecosystem

Super Admin V2 is the **platform control plane** for the entire WebWaka OS v4:

- **Manages tenants** across all 7 suites (Civic, Commerce, Transport, Fintech, Real Estate, Education, Super Admin)
- **Monitors suite health** via on-demand HTTP health checks to each suite's production Workers URL
- **Tracks deployments** — records Cloudflare Workers/Pages/D1 status per tenant-suite combination
- **Administers AI quotas** — controls BYOK (Bring Your Own Key) token limits per tenant per vendor
- **Manages partners** — onboards resellers/ISVs with NDPR consent, tier assignment, and suite access
- **Central billing ledger** — immutable double-entry accounting for all revenue across suites
- **RBAC source of truth** — defines roles and permissions that suites can reference via the shared `webwaka-core` package (currently inlined)

---

## 3. Test Status and Coverage Roadmap

### 3.1 Existing Tests

**Run commands:**
```bash
# Frontend tests
cd frontend && pnpm test -- --run

# Worker tests  
cd workers && pnpm test -- --run
```

**Test files found:**

| File | Tests | Type | Quality |
|------|-------|------|---------|
| `workers/src/__tests__/layer2-qa.test.ts` | ~30 | Schema assertions only | ❌ No real API calls |
| `frontend/src/__tests__/pages/Dashboard.test.tsx` | 3 | Mocked renders | ⚠️ All mocked |
| `frontend/src/__tests__/pages/Billing.test.tsx` | ~4 | Mocked renders | ⚠️ All mocked |
| `frontend/src/__tests__/pages/TenantManagement.test.tsx` | ~4 | Mocked renders | ⚠️ All mocked |
| `frontend/src/__tests__/pages/ModuleRegistry.test.tsx` | ~3 | Mocked renders | ⚠️ All mocked |
| `frontend/src/contexts/__tests__/AuthContext.test.tsx` | 4 | Mocked fetch | ⚠️ All mocked |

**Overall coverage: effectively ~0% for real business logic, API integration, or E2E flows.**

The worker tests are exclusively array/constant assertions (`expect(['PENDING', 'ACTIVE']).toContain('ACTIVE')`), not tests of actual Worker behavior. The frontend tests mock the entire auth context and API layer, testing only that components render without crashing.

No Playwright E2E test configuration or test files exist despite Playwright being in `package.json`.

### 3.2 Critical Missing Tests

**Authentication and RBAC:**
- `POST /auth/login` with valid/invalid credentials (actual D1 lookup + bcrypt)
- `GET /auth/me` with expired vs. valid session tokens
- RBAC permission enforcement — super_admin vs. partner vs. tenant_admin trying to access `/tenants`
- Session KV TTL expiry behavior
- Multiple concurrent login attempts (brute force simulation)

**Partner Onboarding:**
- `POST /partners` — NDPR consent enforcement (400 if missing)
- `POST /partners/:id/suites` — suite assignment idempotency
- `PUT /partners/:id` — partial update merging
- Partner tier upgrade flow

**Tenant Provisioning:**
- `POST /tenants` — duplicate email rejection (UNIQUE constraint)
- `DELETE /tenants/:id` — soft delete, verify `deleted_at` set and tenant excluded from list
- Tenant status transitions (ACTIVE → SUSPENDED → ARCHIVED)

**Billing and Quotas:**
- Immutable ledger entry validation (no updates to `ledger_entries`)
- Kobo integer enforcement (reject float values)
- AI quota token deduction and daily reset logic
- Commission 5-level hierarchy calculations

**Deployment Tracking:**
- `PUT /deployments/:id/status` — invalid status rejection
- `POST /deployments/refresh` — stale deployment detection

**E2E Flows (Playwright):**
- Full login → navigate to tenants → create tenant → verify in list
- Login → navigate to partners → onboard partner with NDPR → assign suite
- Login → billing ledger → verify kobo-to-naira rendering
- Mobile viewport PWA install banner behavior

### 3.3 Test Coverage Roadmap

| Phase | Files to Create | Priority |
|-------|----------------|----------|
| P0 | `workers/src/__tests__/auth.test.ts` — real Miniflare/Wrangler D1 local tests | P0/S |
| P0 | `workers/src/__tests__/tenants.test.ts` — CRUD + soft delete + pagination | P0/M |
| P0 | `workers/src/__tests__/rbac.test.ts` — role/permission matrix | P0/M |
| P1 | `workers/src/__tests__/billing.test.ts` — kobo enforcement, ledger immutability | P1/M |
| P1 | `workers/src/__tests__/partners.test.ts` — NDPR, suite assignments | P1/M |
| P1 | `frontend/src/__tests__/integration/TenantFlow.test.tsx` — real hook + API mock at fetch level | P1/M |
| P2 | `e2e/login.spec.ts`, `e2e/tenants.spec.ts` — Playwright E2E | P2/L |
| P2 | `workers/src/__tests__/rate-limit.test.ts` — once rate limiting is added | P2/S |

---

## 4. Dimension Reviews

---

### 4.1 UI/UX and Accessibility

#### Current State

The frontend uses React 19, Tailwind CSS 4, and shadcn/ui (Radix UI primitives), which provides a strong accessibility baseline. The layout is a responsive sidebar + main content area with `useMobile` for breakpoint detection. Pages include skeleton loading states and an `ErrorBoundary`. Recharts powers all analytics. Sonner handles toasts.

#### Identified Gaps

| Gap | Severity |
|-----|----------|
| No virtualization on tenant/partner lists — renders all rows in DOM; will lag at 100+ records | High |
| Tenant and Partner tables have no server-side pagination UI component wired to API | High |
| Sidebar has no collapsed/mobile-drawer mode — at mobile widths the layout breaks | High |
| No empty state illustrations or onboarding guidance for freshly-provisioned admin instances | Medium |
| Login form uses raw `<input>` instead of shadcn/ui `<Input>` — inconsistent focus/error styling | Medium |
| Login form `onKeyPress` is deprecated — should use `onKeyDown` | Low |
| No `aria-label` on icon-only buttons throughout the dashboard | High |
| Color contrast on `text-slate-400` on dark backgrounds may fall below WCAG AA (4.5:1 minimum) | Medium |
| No focus-visible outlines on custom button in `Login.tsx` | Medium |
| Charts have no accessible alternatives (no `aria-describedby`, no table fallback) | Medium |
| No keyboard navigation for the sidebar menu (no roving tabindex or arrow key support) | Medium |
| `DashboardLayout` has no `<main role="main">` landmark | Low |
| Dark mode `ThemeContext` exists but no dark mode styles are applied in Tailwind CSS | Medium |

#### Recommended Enhancements

| Enhancement | Priority | Effort |
|------------|----------|--------|
| Implement `@tanstack/react-virtual` (or `react-window`) for tenant/partner tables | P0 | M |
| Wire pagination UI (`<Pagination>` component exists in ui/) to API page/limit params | P0 | S |
| Add mobile sidebar as a `<Sheet>` slide-over; collapse to icon strip on tablet | P1 | M |
| Replace raw `<input>` in `Login.tsx` with shadcn `<Input>` + `<Form>` with react-hook-form | P1 | S |
| Add `aria-label` to all icon-only buttons; add `role="main"` to dashboard content area | P1 | S |
| Implement Tailwind dark mode variant classes; wire to `ThemeContext` | P1 | M |
| Add empty state components with illustration + CTA for each data table | P2 | S |
| Add chart `aria-describedby` with summary of key values for screen reader users | P2 | S |
| Replace deprecated `onKeyPress` with `onKeyDown` | P2 | S |

---

### 4.2 Security and Compliance

#### Current State

Auth uses JWT (HS256 via Web Crypto API), bcryptjs for password hashing, and Cloudflare KV for session storage with 24-hour TTL. CORS is wide-open (`origin: '*'`). RBAC is enforced at the API level via `requirePermission()`. NDPR consent is enforced for partner onboarding.

#### Identified Gaps

| Gap | Severity | Location |
|-----|----------|---------|
| **Demo credentials hardcoded in UI** — `email: 'admin@webwaka.com', password: 'password'` rendered in login page | 🔴 CRITICAL | `Login.tsx` L7-8, demo block L119 |
| **JWT fallback secret** — `'default-secret-for-dev-only'` used if `JWT_SECRET` env var unset | 🔴 CRITICAL | `workers/src/index.ts` L278 |
| **No rate limiting** on `/auth/login` or any write endpoint | 🔴 HIGH | All endpoints |
| **No input validation** — raw `await c.req.json()` without schema validation (Zod/Valibot) | 🔴 HIGH | All POST/PUT endpoints |
| **JWT in localStorage** — vulnerable to XSS attacks | 🟠 HIGH | `AuthContext.tsx` |
| **Hardcoded API key fallback** — `'dev-key'` in `api-client.ts` L5 | 🟠 HIGH | `api-client.ts` |
| **CORS `origin: '*'`** — allows any origin to make credentialed requests | 🟠 HIGH | `workers/src/index.ts` L100 |
| **No CSRF protection** | 🟠 HIGH | All state-mutating endpoints |
| **Duplicate API client files** — `api.ts` and `api-client.ts` with different env var names | 🟡 MEDIUM | Frontend |
| **Token not validated on frontend** — `AuthContext` restores any stored token without verifying expiry on mount | 🟡 MEDIUM | `AuthContext.tsx` `useEffect` |
| **`switchTenant()` has no server-side validation** — anyone can call it client-side | 🟡 MEDIUM | `AuthContext.tsx` |
| **Audit log not surfaced in UI** — mutations have no visible trail for compliance auditors | 🟡 MEDIUM | No audit UI page |
| **NDPR consent tracked for partners but not for users** | 🟡 MEDIUM | `003_init_rbac.sql` |
| **SQL construction with string concatenation** (partner/tenant query builders) — potential injection if params ever come from unvalidated user input | 🟡 MEDIUM | `index.ts` tenant/partner GET handlers |
| **`require permission` returns false on error** (catch block) — errors silently grant no access rather than throwing | 🟡 LOW | `requirePermission()` |

#### Recommended Enhancements

| Enhancement | Priority | Effort |
|------------|----------|--------|
| Remove demo credentials from `Login.tsx` entirely | P0 | S |
| Remove JWT `'default-secret-for-dev-only'` fallback — throw if `JWT_SECRET` not set | P0 | S |
| Add Cloudflare KV-based rate limiting to `/auth/login` (5 attempts/min per IP) | P0 | M |
| Integrate `zod` schema validation on all Workers POST/PUT request bodies | P0 | M |
| Restrict CORS to specific origin domains (Pages URLs + custom domains) | P0 | S |
| Migrate JWT to `HttpOnly` cookies (requires Workers cookie handling) OR implement short-lived access tokens + refresh tokens | P1 | L |
| Add `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security` response headers | P1 | S |
| Implement audit log UI page (`/audit-log`) backed by RBAC_DB `audit_log` table | P1 | M |
| Validate token on `AuthContext` mount via `GET /auth/me` rather than trusting localStorage blindly | P1 | S |
| Consolidate `api.ts` and `api-client.ts` into single client; standardize env var to `VITE_API_URL` | P1 | S |
| Add CSRF token for all state-mutating forms | P2 | M |

---

### 4.3 Performance and Scalability

#### Current State

The API uses D1 (SQLite) with appropriate indexes on most tables. The frontend uses skeleton loaders during data fetches. `useTenantData` polls every 45s and opens a WebSocket connection. `useDashboardData` and `useHealthData` have shorter polling intervals (10s for health).

#### Identified Gaps

| Gap | Severity |
|-----|----------|
| **WebSocket connects to `ws://localhost:8787`** — hardcoded dev URL; will fail in production | 🔴 HIGH |
| **No pagination in most list views** — API supports `page/limit` but UI renders all records | 🔴 HIGH |
| **`health_db` metrics query fetches last hour without limit** — `LIMIT 50` may truncate; time-series can grow unboundedly | 🟠 HIGH |
| **Multiple simultaneous polling hooks** — Dashboard, Tenant, Health, Billing all polling independently at different intervals with no request deduplication | 🟠 MEDIUM |
| **No query caching** — every navigation re-fetches all data; Dexie cache exists but is not used by `useApi` hook | 🟠 MEDIUM |
| **`operations_metrics` summary** — uses `AVG()` over unbounded dataset without time-range index | 🟡 MEDIUM |
| **`partner_suite_assignments` lacks composite index** on `(suite, status)` | 🟡 MEDIUM |
| **Frontend bundle splitting** — `manualChunks` in Vite config is correct but `framer-motion` (a large dep) is in the main bundle | 🟡 MEDIUM |
| **No request batching** — tenant stats and tenant list are two separate D1 queries that could be merged | 🟡 LOW |

#### Recommended Enhancements

| Enhancement | Priority | Effort |
|------------|----------|--------|
| Fix WebSocket URL to use runtime-detected API base (not hardcoded localhost) | P0 | S |
| Wire pagination UI to all list views (tenants, partners, billing ledger, audit log) | P0 | M |
| Add `LIMIT` + time-range parameter to all metric/time-series queries | P1 | S |
| Implement SWR-style caching layer on `useApi` using Dexie `cachedData` table (already modeled) | P1 | M |
| Add framer-motion to `manualChunks` in `vite.config.ts` | P1 | S |
| Add `(suite, status)` index to `partner_suite_assignments`; add `(metric_date, tenant_id)` index to `operations_metrics` | P1 | S |
| Implement request deduplication — single polling manager context vs. per-hook intervals | P2 | M |
| Add Cloudflare KV caching for expensive aggregation queries (billing summary, ops summary) with appropriate TTL | P2 | M |

---

### 4.4 Reliability, Logging, and Observability

#### Current State

The Hono API has logger middleware and per-route `try/catch` with `console.error`. Cloudflare Observability is enabled in `wrangler.toml`. Health check infrastructure exists in D1 (`service_health`, `system_metrics`, `alerts` tables). The `/health/check` endpoint actively pings suite endpoints.

#### Identified Gaps

| Gap | Severity |
|-----|----------|
| **No structured logging** — all logs are plain `console.error('msg:', err)` with no correlation IDs or structured fields | 🟠 HIGH |
| **No request ID / trace ID** — impossible to correlate frontend errors with backend logs | 🟠 HIGH |
| **Error responses leak implementation details** — `throw new HTTPException(500, { message: 'Internal server error' })` is correct, but some catch blocks pass raw error objects | 🟡 MEDIUM |
| **No alerting hooks** — the `alerts` table in HEALTH_DB is never written to by the application itself | 🟡 MEDIUM |
| **Health check results not persisted correctly** — `POST /health/check` uses `INSERT OR IGNORE` which silently ignores duplicate IDs (ID collision probable with 12-char alphanumeric) | 🟡 MEDIUM |
| **No circuit breaker** for suite health checks — if one suite is down, the check still waits for full timeout per suite | 🟡 MEDIUM |
| **Frontend errors not reported** — `ErrorBoundary` catches React errors but logs nothing to a monitoring service | 🟡 MEDIUM |
| **`useServiceWorker` swallows all errors** silently | 🟡 LOW |

#### Recommended Enhancements

| Enhancement | Priority | Effort |
|------------|----------|--------|
| Add `X-Request-ID` header generation middleware; propagate through all logs | P0 | S |
| Implement structured JSON logging: `{ requestId, method, path, status, duration, error }` | P1 | M |
| Wire `alerts` table writes into API — log all 5xx responses and health check failures | P1 | M |
| Integrate Cloudflare Logpush or Analytics Engine for long-term observability | P1 | L |
| Replace `INSERT OR IGNORE` in health checks with proper unique ID generation (use `nanoid` from npm or `crypto.randomUUID()`) | P1 | S |
| Add circuit breaker pattern (fail fast after N consecutive failures per suite) | P2 | M |
| Integrate `Sentry` or similar for frontend error boundary reporting | P2 | M |

---

### 4.5 Developer Experience and Repo Hygiene

#### Current State

The repo has a monorepo structure with `pnpm` workspaces (frontend + workers). Documentation includes `README.md`, `REPO_ANALYSIS.md`, `ENV_SETUP.md`, and several architecture docs. Scripts exist in `package.json` for `dev`, `build`, `deploy`, `test`.

#### Identified Gaps

| Gap | Severity |
|-----|----------|
| **No `.env.example` file** — new developers must reverse-engineer env vars from code | 🟠 HIGH |
| **No `CONTRIBUTING.md`** — no documented branching strategy, PR process, or commit conventions | 🟠 HIGH |
| **Two competing API clients** — `lib/api.ts` vs `lib/api-client.ts` with different env var names and different method signatures | 🟠 HIGH |
| **`api.ts` has a method signature bug** — `this.request(endpoint, method, body)` called as `this.request(method, endpoint, body)` — all API calls from this client are broken | 🔴 CRITICAL |
| **No local D1 seed/fixture setup** — developers can't run the app fully locally without connecting to staging Cloudflare resources | 🟡 MEDIUM |
| **`workers/scripts/seed-*.mjs`** reference staging URLs; no documented local dev setup with `wrangler dev --local` | 🟡 MEDIUM |
| **TypeScript config for workers uses `node` types** but target is Cloudflare Workers — should use `@cloudflare/workers-types` exclusively | 🟡 LOW |
| **No Prettier/ESLint config at root** — workers has `.prettierrc` but frontend doesn't | 🟡 LOW |
| **GitHub Actions use `pnpm/action-setup@v2`** (outdated) — should use `v4` | 🟡 LOW |

#### Recommended Enhancements

| Enhancement | Priority | Effort |
|------------|----------|--------|
| Fix the `api.ts` method signature bug (`request(method, endpoint, body)` order) | P0 | S |
| Consolidate `api.ts` and `api-client.ts` into one unified client | P0 | M |
| Add `.env.example` with all required variables and safe default comments | P0 | S |
| Add `CONTRIBUTING.md` — branch naming convention (`feature/`, `fix/`, `chore/`), PR template, commit format | P1 | S |
| Add `wrangler dev --local` setup instructions; create local fixture seed using D1 local mode | P1 | M |
| Add root-level `.eslintrc` and `.prettierrc` covering both `frontend/` and `workers/` | P2 | S |
| Update GitHub Actions to latest action versions (`pnpm/action-setup@v4`, `actions/checkout@v4`) | P2 | S |

---

### 4.6 Features and Product Completeness

#### Current State

The platform covers: tenant CRUD, partner onboarding + suite assignments, deployment tracking, operations analytics, AI quota management, billing ledger, module registry, and system health. 15 pages are implemented with varying levels of API connectivity.

#### Frontend–API Contract Gaps (Missing Endpoints)

The following endpoints are called by the frontend hooks but do not exist in `workers/src/index.ts`:

| Frontend Call | Hook/Page | Status |
|--------------|-----------|--------|
| `GET /tenants/stats` | `useTenantData` | ❌ Missing |
| `GET /billing/metrics` | `useBillingData` | ❌ Missing |
| `GET /billing/commissions` | `useBillingData` | ❌ Missing |
| `GET /health/status` | `useHealthData` | ❌ Missing (exists as `/health/services`) |
| `GET /health/alerts` | `useHealthData` | ❌ Missing |
| `GET /settings/api-keys` | `useApiKeys` | ❌ Missing |
| `POST /settings/api-keys` | Settings page | ❌ Missing |
| `GET /settings/audit-log` | Settings page | ❌ Missing |
| `GET /operations/*` | OperationsOverview | ⚠️ Partially exists |
| `GET /tenants/:id/history` | Tenant detail views | ❌ Missing |

#### Feature Backlog

| Feature | Rationale | Priority | Effort |
|---------|-----------|----------|--------|
| Implement all 10+ missing API endpoints listed above | Pages show errors without these | P0 | L |
| **Tenant provisioning wizard** — multi-step flow (basic info → suite selection → environment config → billing plan) | Critical admin workflow | P1 | L |
| **Bulk tenant operations** — suspend, archive, export multiple tenants | Efficiency at scale | P1 | M |
| **Audit log page** (`/audit-log`) — searchable, filterable view of all privileged actions | NDPR/compliance | P1 | M |
| **Real-time notifications** — WebSocket or SSE for deployment status changes, health alerts | Operational awareness | P1 | L |
| **Partner commission payout tracking** — approve, pay, reverse commission records | Core billing workflow | P1 | M |
| **AI quota dashboard** — per-tenant token usage graphs with vendor breakdown | Vendor-neutral AI visibility | P1 | M |
| **Deployment trigger UI** — button to trigger Workers/Pages rebuild via Cloudflare API | Admin control | P2 | M |
| **White-label domain management** — UI for `tenant_domains` table (SSL status, primary domain) | Multi-tenancy | P2 | M |
| **Export to CSV/Excel** — for tenants, billing ledger, audit log | Compliance & reporting | P2 | M |
| **Tenant impersonation** (super admin only) — view a tenant's portal as that tenant | Support workflows | P2 | L |
| **Suite health SLA tracking** — uptime SLA per suite with historical graphs | Platform reliability | P2 | M |

---

### 4.7 Cloudflare, CI/CD, and Infrastructure

#### Current State

Three GitHub Actions workflows cover frontend (Cloudflare Pages) and workers (Cloudflare Workers) deployment to staging (develop branch) and production (master/main). Wrangler handles D1 migrations as a pre-deploy step. `wrangler.toml` defines all bindings with UUIDs for D1 and KV.

#### Identified Gaps

| Gap | Severity |
|-----|----------|
| **D1 database IDs are shared between staging and production** in `wrangler.toml` — same UUIDs in both `[env.staging]` and `[env.production]` blocks, causing data contamination | 🔴 CRITICAL |
| **No migration rollback strategy** — all migrations are forward-only with no documented rollback procedure | 🟠 HIGH |
| **`deploy.yml` installs workers with `@webwaka/core` reference** — would fail if workers was not fixed (now fixed, but pipeline wasn't updated to reflect this) | 🟠 HIGH (fixed) |
| **Frontend CI deploys on every push to master** — no preview environments for PRs | 🟡 MEDIUM |
| **No smoke tests post-deploy** — workers CI does `curl /health` but frontend CI has no health check | 🟡 MEDIUM |
| **`pnpm/action-setup@v2`** used in all 3 workflows — v4 is current stable | 🟡 LOW |
| **No dependency caching** in GitHub Actions — `node_modules` are reinstalled on every run | 🟡 LOW |
| **wrangler.toml `migrations` section** uses `tag: "v1"` for all migrations — should track individual migration tags | 🟡 LOW |

#### Recommended Enhancements

| Enhancement | Priority | Effort |
|------------|----------|--------|
| Provision separate D1 databases for staging and production; update `wrangler.toml` with distinct IDs | P0 | M |
| Create migration rollback scripts for each migration file | P1 | M |
| Add Cloudflare Pages preview deployments on PRs (automatic with Pages, just needs branch strategy) | P1 | S |
| Add `pnpm store cache` to GitHub Actions using `actions/cache` | P1 | S |
| Upgrade all GitHub Actions to latest versions (`pnpm@v4`, `checkout@v4`, `setup-node@v4`) | P1 | S |
| Add post-deploy smoke test to frontend CI (`curl` check on Pages URL) | P2 | S |
| Implement database backup strategy using `wrangler d1 export` before each migration | P2 | M |

---

### 4.8 PWA, Mobile, and Offline-First

#### Current State

The app has:
- `public/manifest.json` (exists, content not fully verified)
- `public/sw.js` (exists — identified as a stub without real caching strategy)
- `useServiceWorker.ts` hook that registers the SW, checks for updates, and handles `SKIP_WAITING`
- `lib/db.ts` — Dexie/IndexedDB with three tables: `cachedData`, `pendingMutations`, `offlineEvents`
- `usePersistFn.ts` — for queuing mutations offline
- Hash-based routing (Wouter) — enables full PWA/offline URL compatibility
- `useMobile` hook for responsive breakpoint detection

#### Identified Gaps

| Gap | Severity |
|-----|----------|
| **`sw.js` has no caching strategy** — the infrastructure exists but the service worker does not cache anything, precache routes, or serve offline content | 🔴 CRITICAL |
| **Offline UI is invisible** — when offline, the app shows spinner/error states with no "You are offline" banner | 🔴 HIGH |
| **`pendingMutations` queue** in Dexie is never flushed — `getPendingMutations()` is defined but no background sync trigger exists | 🟠 HIGH |
| **`manifest.json` needs review** — icons, `start_url`, `scope`, `display: standalone`, `background_color`, and `theme_color` must all be correctly set for installability | 🟠 HIGH |
| **No PWA install prompt UI** — the app should detect and surface `beforeinstallprompt` on mobile | 🟡 MEDIUM |
| **No offline-capable read paths** — Dashboard data is not served from Dexie cache when offline | 🟡 MEDIUM |
| **WebSocket in `useTenantData`** has no reconnection logic or offline detection | 🟡 MEDIUM |

#### Recommended Enhancements

| Enhancement | Priority | Effort |
|------------|----------|--------|
| Implement real `sw.js` with Workbox (or hand-written): cache-first for static assets, network-first for API, background sync for mutations | P0 | L |
| Add offline detection banner (listen to `online`/`offline` events, show non-intrusive ribbon) | P0 | S |
| Implement background sync for `pendingMutations` — trigger flush on `online` event | P1 | M |
| Audit and fix `manifest.json` — verify all required PWA fields, add icon sets (192×192, 512×512, maskable) | P1 | S |
| Serve Dashboard metrics from Dexie cache (stale-while-revalidate pattern) | P1 | M |
| Add PWA install prompt using `beforeinstallprompt` event | P2 | S |
| Add WebSocket reconnection with exponential backoff in `useTenantData` | P2 | S |

---

### 4.9 Internationalization and Localization

#### Current State

Strong foundation: a custom i18n engine (`i18n/index.ts`) with dot-notation key lookup, parameter substitution (`{{param}}`), and English fallback. Four locales are defined: `en` (English), `yo` (Yorùbá), `ig` (Igbo), `ha` (Hausa). A `LanguageSwitcher` component exists. Currency formatting uses `Intl.NumberFormat('en-NG', { currency: 'NGN' })`. `useTranslation` hook is available.

#### Identified Gaps

| Gap | Severity |
|-----|----------|
| **Most pages don't use `useTranslation`** — hardcoded English strings in Dashboard, TenantManagement, PartnerManagement, SystemHealth, etc. | 🟠 HIGH |
| **No locale auto-detection** — locale defaults to `'en'` regardless of browser `navigator.language` | 🟡 MEDIUM |
| **No date/time localization** — dates are displayed as raw ISO strings with no locale-aware formatting | 🟡 MEDIUM |
| **`LanguageSwitcher` component exists but is not mounted** in `DashboardLayout` header | 🟡 MEDIUM |
| **Translation key coverage** — locale JSON files may have coverage gaps (some nested keys missing in non-English files) | 🟡 MEDIUM |
| **No RTL support** — would be needed for Arabic support (Hausa uses Arabic script in some regions) | 🟡 LOW |
| **No pluralization support** in the i18n engine (e.g., "1 tenant" vs "3 tenants") | 🟡 LOW |
| **Locale not SSR-safe** — `localStorage.getItem()` called directly in `getStoredLocale()` without `typeof window` guard (fails if ever used server-side) | 🟡 LOW |

#### Recommended Enhancements

| Enhancement | Priority | Effort |
|------------|----------|--------|
| Wire `useTranslation` into all 15 pages and key components, replacing hardcoded strings | P0 | L |
| Mount `LanguageSwitcher` in `DashboardLayout` Header component | P0 | S |
| Add locale auto-detection from `navigator.language` with fallback chain | P1 | S |
| Integrate `date-fns` with locale support for consistent date/time formatting | P1 | S |
| Add pluralization rules to the i18n engine (`{{count}}` + plural suffix handling) | P2 | M |
| Audit all 4 locale JSON files for missing keys; add a `pnpm i18n:check` script to CI | P2 | S |

---

## 5. Prioritized Implementation Roadmap

### Phase 0 — Critical Security & Contract Fixes (1–2 days)
*These are blockers. The app cannot go to production without them.*

| Task | File(s) | Effort |
|------|---------|--------|
| Remove hardcoded demo credentials from `Login.tsx` | `frontend/src/pages/Login.tsx` | S |
| Remove JWT fallback `'default-secret-for-dev-only'` — throw if unset | `workers/src/index.ts` L278 | S |
| Fix `api.ts` method signature bug (method/endpoint param order reversed) | `frontend/src/lib/api.ts` | S |
| Fix D1 database UUIDs — staging and production must use separate databases | `workers/wrangler.toml` | M |
| Fix WebSocket URL — replace hardcoded `ws://localhost:8787` with dynamic detection | `frontend/src/hooks/useTenantData.ts` | S |

### Phase 1 — API Completeness + Core Security (1–2 weeks)
*Fill in the missing 10+ API endpoints that power existing UI pages.*

| Task | File(s) | Effort |
|------|---------|--------|
| Implement missing endpoints: `/tenants/stats`, `/billing/metrics`, `/billing/commissions`, `/health/status`, `/health/alerts`, `/settings/api-keys`, `/settings/audit-log` | `workers/src/index.ts` | L |
| Consolidate `api.ts` + `api-client.ts` into one client | `frontend/src/lib/` | M |
| Add Zod request body validation on all POST/PUT Workers endpoints | `workers/src/index.ts` | M |
| Add KV-based rate limiting on `/auth/login` | `workers/src/index.ts` | M |
| Restrict CORS to known origins; add security response headers | `workers/src/index.ts` | S |
| Add `X-Request-ID` middleware + structured JSON logging | `workers/src/index.ts` | M |
| Validate auth token on `AuthContext` mount via `GET /auth/me` | `frontend/src/contexts/AuthContext.tsx` | S |

### Phase 2 — Tests + DX (1–2 weeks)
*Establish real test coverage and onboarding docs.*

| Task | File(s) | Effort |
|------|---------|--------|
| Write auth/RBAC integration tests using Wrangler local D1 | `workers/src/__tests__/auth.test.ts` | M |
| Write tenant CRUD + soft delete tests | `workers/src/__tests__/tenants.test.ts` | M |
| Write billing kobo enforcement tests | `workers/src/__tests__/billing.test.ts` | M |
| Configure Playwright; write login + tenant E2E flow | `e2e/` | M |
| Add `.env.example` | `.env.example` | S |
| Add `CONTRIBUTING.md` with branch/PR/commit conventions | `CONTRIBUTING.md` | S |
| Add local dev seed with `wrangler d1 execute --local` | `workers/scripts/seed-local.mjs` | M |

### Phase 3 — i18n + Accessibility + PWA (2–3 weeks)
*Nigeria First, Mobile First, PWA First — make them real.*

| Task | File(s) | Effort |
|------|---------|--------|
| Wire `useTranslation` into all 15 pages | `frontend/src/pages/*` | L |
| Mount `LanguageSwitcher` in Header | `frontend/src/components/Header.tsx` | S |
| Implement real service worker with Workbox (cache-first static, network-first API, background sync) | `frontend/public/sw.js` | L |
| Add offline banner (listen `online`/`offline` events) | `frontend/src/components/` | S |
| Implement pending mutations flush on reconnect | `frontend/src/hooks/usePersistFn.ts` | M |
| Add mobile sidebar `<Sheet>` slide-over | `frontend/src/components/DashboardLayout.tsx` | M |
| Audit and fix `manifest.json`; add icon assets | `frontend/public/` | S |
| Add ARIA labels, landmarks, keyboard nav | All pages | M |

### Phase 4 — Performance + Features (2–4 weeks)
*Scale and product completeness.*

| Task | File(s) | Effort |
|------|---------|--------|
| Virtualize tenant/partner tables with `@tanstack/react-virtual` | `frontend/src/pages/TenantManagement.tsx`, `PartnerManagement.tsx` | M |
| Wire pagination to all list views | `frontend/src/pages/*` | M |
| Implement SWR-style Dexie caching in `useApi` | `frontend/src/hooks/useApi.ts` | M |
| Implement tenant provisioning wizard | `frontend/src/pages/TenantProvisioning.tsx` | L |
| Build audit log page | `frontend/src/pages/AuditLog.tsx` | M |
| Add bulk operations (suspend/archive/export tenants) | `frontend/src/pages/TenantManagement.tsx` | M |
| Add missing D1 indexes (`partner_suite_assignments`, `operations_metrics`) | `workers/migrations/011_indexes.sql` | S |
| Add Cloudflare Pages preview environments for PRs | `.github/workflows/deploy-frontend.yml` | M |

---

## Appendix A: API Endpoint Coverage Matrix

| Endpoint | Workers | Frontend Calls | Status |
|---------|---------|---------------|--------|
| `POST /auth/login` | ✅ | `AuthContext.login()` | ✅ |
| `POST /auth/logout` | ✅ | `AuthContext.logout()` | ✅ |
| `GET /auth/me` | ✅ | Not called on mount | ⚠️ |
| `GET /tenants` | ✅ | `useTenantData` | ✅ |
| `POST /tenants` | ✅ | `TenantManagement` | ✅ |
| `GET /tenants/:id` | ✅ | Not wired | ⚠️ |
| `PUT /tenants/:id` | ✅ | `TenantManagement` | ✅ |
| `DELETE /tenants/:id` | ✅ | `TenantManagement` | ✅ |
| `GET /tenants/stats` | ❌ | `useTenantData` | 🔴 |
| `GET /partners` | ✅ | `PartnerManagement` | ✅ |
| `POST /partners` | ✅ | `PartnerManagement` | ✅ |
| `GET /partners/:id` | ✅ | Not wired | ⚠️ |
| `PUT /partners/:id` | ✅ | Not wired | ⚠️ |
| `DELETE /partners/:id` | ✅ | Not wired | ⚠️ |
| `POST /partners/:id/suites` | ✅ | Not wired | ⚠️ |
| `GET /billing/ledger` | ✅ | `Billing` page | ✅ |
| `GET /billing/summary` | ✅ | `Billing` page | ✅ |
| `POST /billing/entry` | ✅ | Not wired | ⚠️ |
| `GET /billing/metrics` | ❌ | `useBillingData` | 🔴 |
| `GET /billing/commissions` | ❌ | `useBillingData` | 🔴 |
| `GET /health` | ✅ | Not called | ⚠️ |
| `GET /health/services` | ✅ | `SystemHealth` | ✅ |
| `GET /health/metrics` | ✅ | `SystemHealth` | ✅ |
| `POST /health/check` | ✅ | `SystemHealth` | ✅ |
| `GET /health/status` | ❌ | `useHealthData` | 🔴 |
| `GET /health/alerts` | ❌ | `useHealthData` | 🔴 |
| `GET /modules` | ✅ | `ModuleRegistry` | ✅ |
| `GET /modules/:tenantId` | ✅ | Not wired | ⚠️ |
| `PUT /modules/:tenantId/:moduleId` | ✅ | `ModuleRegistry` | ✅ |
| `GET /settings` | ✅ | `Settings` page | ✅ |
| `PUT /settings` | ✅ | `Settings` page | ✅ |
| `GET /settings/api-keys` | ❌ | `useApiKeys` | 🔴 |
| `POST /settings/api-keys` | ❌ | `Settings` page | 🔴 |
| `GET /settings/audit-log` | ❌ | `Settings` page | 🔴 |
| `GET /deployments` | ✅ | `DeploymentManager` | ✅ |
| `GET /deployments/:id` | ✅ | Not wired | ⚠️ |
| `PUT /deployments/:id/status` | ✅ | `DeploymentManager` | ✅ |
| `POST /deployments/refresh` | ✅ | `DeploymentManager` | ✅ |
| `GET /operations/metrics` | ✅ | `OperationsOverview` | ✅ |
| `GET /operations/summary` | ✅ | `OperationsOverview` | ✅ |
| `GET /operations/ai-usage` | ✅ | `OperationsOverview` | ✅ |
| `GET /ai-quotas/:tenantId` | ✅ | Not wired | ⚠️ |
| `PUT /ai-quotas/:tenantId` | ✅ | Not wired | ⚠️ |
| `POST /ai-quotas/:tenantId/reset` | ✅ | Not wired | ⚠️ |

**Legend:** ✅ Exists & wired | ⚠️ Exists but not called by frontend | 🔴 Called by frontend but does not exist in Workers

---

## Appendix B: DB Schema Status Inconsistencies

| Issue | Migration | TypeScript Type | Impact |
|-------|-----------|----------------|--------|
| Tenant status: migration has `PROVISIONING, ARCHIVED`; `schema.ts` has `TRIAL, CHURNED` | `001_init_tenants.sql` | `schema.ts:TenantStatus` | Runtime type errors |
| Tenant industry: migration has 10 values; `schema.ts` has 7 | `001_init_tenants.sql` | `schema.ts:TenantIndustry` | Invalid industry values |
| `tenant_id` column in `tenants` table is self-referential string (not FK) — no FK constraint | `001_init_tenants.sql` | — | Data integrity risk |
| `service_health` table has no `tenant_id` — not multi-tenant aware | `005_init_health.sql` | — | Suite-level isolation missing |
