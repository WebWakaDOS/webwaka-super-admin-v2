# Repo Analysis: webwaka-super-admin-v2

**Date:** 2026-03-23  
**Analyst:** Replit Executor Agent  
**Repo:** https://github.com/WebWakaDOS/webwaka-super-admin-v2  
**Role in Ecosystem:** Central Super Admin — Platform Owner Dashboard (1 of 8 WebWaka microservice repos)

---

## 1. Executive Summary

**Key Findings:**
- **Full-stack monorepo** with a React 19 SPA frontend (Cloudflare Pages) and Hono API backend (Cloudflare Workers), connected via Vite proxy in dev and direct URL in production.
- **Cross-repo dependency blocker:** `workers/` previously depended on `@webwaka/core` (a missing local repo `file:../../webwaka-core`) — **fixed** by inlining the `signJWT` utility using Web Crypto API (native to Cloudflare Workers). Workers are now fully self-contained.
- **35+ API endpoints** covering Auth, Tenants, Partners, Billing, Modules, Deployments, Operations, AI Quotas, and Health across 5 Cloudflare D1 databases and 4 KV namespaces.

---

## 2. Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend Framework | React 19 |
| Build Tool | Vite 7 |
| Styling | Tailwind CSS 4 |
| Component Library | shadcn/ui (Radix UI primitives) |
| Routing | Wouter (hash-based for PWA/offline) |
| Charts | Recharts |
| State | React Context (AuthContext, TenantContext, ThemeContext) |
| API Framework | Hono (Cloudflare Workers) |
| Auth | JWT (HS256, Web Crypto API) + bcryptjs password hashing |
| Database | Cloudflare D1 (5 databases) |
| Cache/Sessions | Cloudflare KV (4 namespaces) |
| Package Manager | pnpm (monorepo workspaces) |
| Deployment | Wrangler CLI → Cloudflare Pages + Workers |
| CI/CD | GitHub Actions (3 workflow files) |
| Testing | Vitest (unit), Playwright (E2E) |
| Language | TypeScript throughout |

---

## 3. Project Structure

```
webwaka-super-admin-v2/
├── frontend/                      # Cloudflare Pages (React SPA)
│   ├── src/
│   │   ├── components/            # DashboardLayout, Sidebar, Header, shadcn/ui
│   │   ├── contexts/              # AuthContext, TenantContext, ThemeContext
│   │   ├── hooks/                 # useApi, useDashboardData, useTenantData, useHealthData
│   │   ├── lib/                   # api.ts (ApiClient), api-client.ts, db.ts, utils.ts
│   │   ├── pages/                 # 15 pages: Dashboard, TenantManagement, Billing,
│   │   │                          #   ModuleRegistry, SystemHealth, Analytics, Settings,
│   │   │                          #   PartnerManagement, OperationsOverview, DeploymentManager
│   │   └── App.tsx                # Router entry (hash-based)
│   ├── vite.config.ts             # Port 5000, host 0.0.0.0, /api → localhost:8787 proxy
│   └── wrangler.toml              # Pages deployment config
│
├── workers/                       # Cloudflare Workers (Hono API)
│   ├── src/
│   │   ├── index.ts               # 35+ endpoints (1474 lines)
│   │   └── schema.ts              # TypeScript types + DB schema helpers
│   ├── migrations/                # 6 SQL migration files (D1)
│   │   ├── 001_init_tenants.sql
│   │   ├── 002_init_billing.sql
│   │   ├── 003_init_rbac.sql
│   │   ├── 004_init_modules.sql
│   │   ├── 005_init_health.sql
│   │   └── 010_superadmin_v2.sql  # Partners, Deployments, Ops, AI Quotas
│   ├── scripts/                   # seed-staging.mjs, seed-production.mjs
│   └── wrangler.toml              # Workers + D1 + KV bindings for staging/production
│
├── .github/workflows/
│   ├── deploy.yml                 # Combined frontend+workers on push to master
│   ├── deploy-frontend.yml        # Frontend only (Pages)
│   └── deploy-workers.yml        # Workers only (with lint, test, staging/prod gates)
│
├── scripts/                       # Infrastructure MJS scripts
├── docs/                          # Platform reports
└── pnpm-workspace.yaml            # Workspace: frontend + workers
```

---

## 4. Database Schema (Cloudflare D1)

### TENANTS_DB
- `tenants` — Tenant registry (id, name, email, status, industry, domain)
- `tenant_environments` — Module/config state per tenant
- `tenant_domains` — White-label domain mapping

### BILLING_DB
- `ledger_entries` — Immutable double-entry financial records (**all amounts in INTEGER KOBO — Nigeria First**)
- `billing_plans` — Plan definitions
- `commissions` — 5-level affiliate hierarchy
- `escrow_accounts` — Escrow management

### RBAC_DB
- `roles`, `permissions` — RBAC definitions
- `users` — User accounts with password_hash
- `user_roles` — Role assignments
- `audit_log` — NDPR compliance audit trail

### MODULES_DB
- Module registry and feature flag management

### HEALTH_DB + TENANTS_DB (010 migration)
- `service_health`, `system_metrics` — Platform health monitoring
- `partners` — Partner onboarding with NDPR consent tracking
- `partner_suite_assignments` — Partners ↔ Suites (many-to-many)
- `deployments` — Workers/Pages/D1 deployment status per tenant
- `operations_metrics` — Revenue, transactions, AI token usage per suite
- `ai_usage_quotas` — BYOK token limits (OpenAI/Gemini/Anthropic/platform)
- `platform_health_checks` — On-demand cross-suite health checks

---

## 5. API Endpoints (workers/src/index.ts)

| Group | Endpoints |
|-------|-----------|
| Health | `GET /health`, `GET /health/services`, `GET /health/metrics`, `POST /health/check` |
| Auth | `POST /auth/login`, `POST /auth/logout`, `GET /auth/me` |
| Tenants | Full CRUD: `GET/POST /tenants`, `GET/PUT/DELETE /tenants/:id` |
| Partners | Full CRUD + suite assignment: `GET/POST /partners`, `GET/PUT/DELETE /partners/:id`, `POST /partners/:id/suites` |
| Deployments | `GET /deployments`, `GET /deployments/:id`, `PUT /deployments/:id/status`, `POST /deployments/refresh` |
| Operations | `GET /operations/metrics`, `GET /operations/summary`, `POST /operations/metrics`, `GET /operations/ai-usage` |
| AI Quotas | `GET/PUT /ai-quotas/:tenantId`, `POST /ai-quotas/:tenantId/reset` |
| Billing | `GET /billing/ledger`, `GET /billing/summary`, `POST /billing/entry` |
| Modules | `GET /modules`, `GET /modules/:tenantId`, `PUT /modules/:tenantId/:moduleId` |
| Settings | `GET /settings`, `PUT /settings` |

---

## 6. Cross-Repo Hooks & Integration Points

| Dependency | Direction | Purpose |
|------------|-----------|---------|
| `@webwaka/core` | Inbound (was) | `signJWT` — **fixed:** now inlined using Web Crypto API |
| `webwaka-civic-api` | Outbound | Health checks via `POST /health/check` |
| `webwaka-commerce-api` | Outbound | Health checks via `POST /health/check` |
| `webwaka-transport-api` | Outbound | Health checks via `POST /health/check` |
| All 7 other repos | Managed | This admin is the central platform dashboard; all suites report here |

**Cross-suite health endpoints (production):**
- Civic: `https://webwaka-civic-api-prod.webwaka.workers.dev/health`
- Commerce: `https://webwaka-commerce-api-prod.webwaka.workers.dev/health`
- Transport: `https://webwaka-transport-api-prod.webwaka.workers.dev/health`

---

## 7. Core Invariants Compliance

| Invariant | Implementation |
|-----------|---------------|
| **Build Once Use Infinitely** | Modular React components, shadcn/ui reusable library, shared TypeScript types |
| **Mobile First** | Responsive Tailwind layout, `useMobile` hook, touch-optimized Radix UI |
| **PWA First** | Hash-based routing (Wouter), `useServiceWorker` hook, Dexie.js (IndexedDB) in `lib/db.ts` |
| **Offline First** | Dexie local DB, `usePersistFn` hook for queue persistence |
| **Nigeria First** | All money in INTEGER KOBO; `formatKoboToNaira()` helper; `en-NG` locale; NDPR consent fields |
| **Africa First** | Low-latency routing via Cloudflare's African PoPs; low-data PWA design |
| **Vendor Neutral AI** | `ai_usage_quotas` supports `platform \| openai \| gemini \| anthropic \| byok`; abstracted via `active_vendor` field |

---

## 8. CI/CD Pipeline

| Workflow | Trigger | Target |
|----------|---------|--------|
| `deploy-frontend.yml` | Push to master/main/develop on `frontend/**` | Cloudflare Pages (`webwaka-super-admin-ui`) |
| `deploy-workers.yml` | Push to master/main/develop on `workers/**` | Cloudflare Workers (`webwaka-super-admin-api`) |
| `deploy.yml` | Push to master/main | Both (combined) |

**Required GitHub Actions Secrets:** `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`

---

## 9. Fixes Applied in This Setup

1. **Removed `@webwaka/core` dependency** from `workers/package.json` (was `file:../../webwaka-core` — repo doesn't exist locally).
2. **Inlined `signJWT`** in `workers/src/index.ts` using Web Crypto API (HMAC-SHA256, Cloudflare Workers native).
3. **Added `bcryptjs`** to `workers/package.json` (was only in root package.json; CI installs workers independently).
4. **Restored workers** to `pnpm-workspace.yaml`.
5. **Configured Vite** for Replit: `host: '0.0.0.0'`, `port: 5000`, `allowedHosts: true`.

---

## 10. Known Issues & Next Steps

| Issue | Priority | Action |
|-------|----------|--------|
| Frontend API client (`lib/api.ts`) uses runtime hostname detection — Replit dev domain is not `localhost` so it routes to production Cloudflare Workers URL (which may not exist yet) | High | Set `VITE_API_URL` env var or update detection logic |
| Cloudflare D1 database IDs in `wrangler.toml` are placeholders — need real IDs from Cloudflare dashboard | High | Provision real D1 databases via Wrangler; update IDs |
| `workers/scripts/` seed files need to be run after D1 migrations | Medium | Run `wrangler d1 migrations apply` then seed scripts |
| GitHub Actions secrets (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`) must be set in GitHub repo settings | High | Add via GitHub → Settings → Secrets |
| `@webwaka/core` signJWT is now inlined — when `webwaka-core` repo is available, replace with the shared version | Low | Replace inline impl with `@webwaka/core` import |
