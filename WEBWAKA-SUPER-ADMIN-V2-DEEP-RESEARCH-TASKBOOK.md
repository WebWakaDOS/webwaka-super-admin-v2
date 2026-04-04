# WEBWAKA SUPER ADMIN V2 — DEEP RESEARCH + ENHANCEMENT TASKBOOK + QA PROMPT FACTORY

**Repo:** `webwaka-super-admin-v2`
**Document Class:** Platform Taskbook — Implementation + QA Ready
**Date:** 2026-04-04
**Status:** EXECUTION READY

---

## TABLE OF CONTENTS

1. [Repo Deep Understanding](#1-repo-deep-understanding)
2. [External Best-Practice Research](#2-external-best-practice-research)
3. [Synthesis and Gap Analysis](#3-synthesis-and-gap-analysis)
4. [Top 20 Enhancements + Bug Fixes](#4-top-20-enhancements--bug-fixes)
5. [Task Breakdown (T-01 through T-22)](#5-task-breakdown)
6. [QA Plans for Every Task](#6-qa-plans-for-every-task)
7. [Implementation Prompts for Every Task](#7-implementation-prompts-for-every-task)
8. [QA Prompts for Every Task](#8-qa-prompts-for-every-task)
9. [Priority Order](#9-priority-order)
10. [Dependencies Map](#10-dependencies-map)
11. [Phase 1 / Phase 2 Split](#11-phase-1--phase-2-split)
12. [Repo Context and Ecosystem Notes](#12-repo-context-and-ecosystem-notes)
13. [Governance and Reminder Block](#13-governance-and-reminder-block)
14. [Execution Readiness Notes](#14-execution-readiness-notes)

---

## 1. REPO DEEP UNDERSTANDING

### 1.1 Repository Identity

- **Name:** `webwaka-super-admin-v2`
- **Version:** 2.0.0
- **Role in Ecosystem:** Central super-admin control plane for the full WebWaka multi-tenant platform. It is not standalone — it sits above the `webwaka-commerce-api`, `webwaka-transport-api`, `webwaka-education-api`, and other suite repos, orchestrating tenants, partners, modules, billing, and deployments across them.
- **Architecture Pattern:** Monorepo (pnpm workspaces): `frontend/` (React 19 + Vite) + `workers/` (Hono on Cloudflare Workers)

### 1.2 Frontend Architecture

- **Framework:** React 19 (TypeScript), Vite 7
- **Routing:** Wouter with `useHashLocation` (hash-based for offline/PWA support)
- **UI Components:** Radix UI primitives + Tailwind CSS v4 + shadcn/ui (45+ components)
- **State Management:** React Context API (3 contexts: AuthContext, TenantContext, ThemeContext)
- **Charts:** Recharts
- **Forms:** React Hook Form + Zod v4
- **Offline/PWA:** Dexie.js (IndexedDB) with pending mutation queue + Service Worker hook
- **i18n:** Custom implementation, 4 locales: en, yo (Yorùbá), ig (Igbo), ha (Hausa)
- **Virtualization:** @tanstack/react-virtual for large lists

**Pages (15):**
| Page | Route | Permission |
|------|-------|-----------|
| Dashboard | `/` | authenticated |
| TenantManagement | `/tenants` | `manage:tenants` |
| TenantProvisioning | `/tenant-provisioning` | `manage:tenants` |
| Billing | `/billing` | `view:billing` |
| ModuleRegistry | `/modules` | `manage:modules` |
| SystemHealth | `/health` | `view:health` |
| Analytics | `/analytics` | authenticated |
| Settings | `/settings` | `manage:settings` |
| PartnerManagement | `/partners` | `manage:partners` |
| OperationsOverview | `/operations` | `view:operations` |
| DeploymentManager | `/deployments` | `manage:deployments` |
| FeatureFlagManager | `/feature-flags` | `write:tenants` |
| AuditLog | `/audit-log` | `manage:settings` |
| Login / ForgotPassword / ResetPassword | public | none |
| Unauthorized / NotFound | public | none |

**Custom Components (13):**
DashboardLayout, Sidebar, Header, MetricCard, ProtectedRoute, ErrorBoundary, TenantForm, TwoFactorSetup, NotificationBell, LanguageSwitcher, OfflineBanner, ManusDialog, Map

**Custom Hooks (10):**
useApi, useBillingData, useComposition, useDashboardData, useHealthData, useMobile, useNotifications, usePersistFn, useServiceWorker, useTenantData, useTranslation

### 1.3 Backend Architecture (Cloudflare Workers)

**Runtime:** Cloudflare Workers + Hono v4 framework
**Language:** TypeScript
**Endpoints (35+):**

| Category | Endpoints |
|---------|-----------|
| Health | GET /health, GET /health/services, GET /health/metrics, GET /health/status, GET /health/alerts, POST /health/alerts, POST /health/check |
| Auth | POST /auth/login, POST /auth/logout, GET /auth/me, POST /auth/refresh, POST /auth/2fa/validate |
| Tenants | GET /tenants, POST /tenants, GET /tenants/:id, PUT /tenants/:id, DELETE /tenants/:id, GET /tenants/stats |
| Partners | GET /partners, POST /partners, GET /partners/:id, PUT /partners/:id, DELETE /partners/:id, POST /partners/:id/suites |
| Deployments | GET /deployments, GET /deployments/:id, PUT /deployments/:id/status, POST /deployments/refresh |
| Operations | GET /operations/metrics, GET /operations/summary, POST /operations/metrics, GET /operations/ai-usage |
| AI Quotas | GET /ai-quotas/:tenantId, PUT /ai-quotas/:tenantId, POST /ai-quotas/:tenantId/reset |
| Billing | GET /billing/ledger, GET /billing/summary, GET /billing/metrics, GET /billing/commissions, POST /billing/entry |
| Modules | GET /modules, GET /modules/:tenantId, PUT /modules/:tenantId/:moduleId |
| Feature Flags | GET /feature-flags/:tenantId, PUT /feature-flags/:tenantId, DELETE /feature-flags/:tenantId |
| Settings | GET /settings, PUT /settings, GET /settings/api-keys, POST /settings/api-keys, DELETE /settings/api-keys/:id, GET /settings/audit-log, POST /settings/audit-log, GET /audit-log |

**Databases (D1 — Cloudflare):**
- `TENANTS_DB` — tenants, partners, deployments, operations_metrics, ai_usage_quotas
- `BILLING_DB` — ledger_entries, billing_plans, commissions
- `RBAC_DB` — users, roles, permissions, role_permissions, audit_log
- `MODULES_DB` — modules, tenant_modules
- `HEALTH_DB` — service_health, alerts

**KV Namespaces:**
- `SESSIONS_KV` — (currently unused — sessions are stateless JWT cookies)
- `FEATURE_FLAGS_KV` — feature flags, module flags, platform settings
- `CACHE_KV` — API response caches, API keys
- `NOTIFICATIONS_KV` — (exists, unused)
- `RATE_LIMIT_KV` — sliding window rate limiting

**Service Bindings:**
- `COMMERCE_WORKER` — cross-repo tenant provisioning (T-FND-03 pattern)

### 1.4 Security Implementation

- **Auth:** HttpOnly + SameSite=Strict cookie (JWT), PBKDF2-SHA256 (310k iterations, OWASP 2024), timing-safe comparison
- **Token lifecycle:** 24-hour JWT, client-side refresh schedule via `scheduleTokenRefresh`
- **CORS:** Environment-aware allowlist (no wildcards in production/staging)
- **Security headers:** X-Content-Type-Options, X-Frame-Options, Referrer-Policy, HSTS (production only)
- **Rate limiting:** KV-backed sliding window, 10 login attempts per 15 minutes per IP
- **Permission model:** JWT-embedded permissions array + role bypass for SUPER_ADMIN

### 1.5 Financial System

- **Currency:** All monetary values in integer kobo (100 kobo = ₦1 NGN)
- **Commission:** 5-level affiliate hierarchy (5%/3%/2%/1%/0.5% flat-rate of original transaction)
- **Ledger:** Double-entry with `account_from` / `account_to` fields
- **Formats:** `₦` prefix, `en-NG` locale, `Intl.NumberFormat`

### 1.6 Offline / PWA

- Dexie (IndexedDB) with 3 stores: `cachedData`, `pendingMutations`, `offlineEvents`
- Pending mutations have `maxRetries: 3` but **no automatic replay mechanism**
- `useServiceWorker.ts` registers `sw.js` with 60-second update polling
- `OfflineBanner` component shows connectivity status
- Hash-based routing enables PWA compatibility without server-side fallback

### 1.7 CI/CD

- **GitHub Actions files:** `ci.yml`, `deploy-frontend.yml`, `deploy-workers.yml`, `deploy.yml`
- `ci.yml`: frontend type-check + build, workers type-check + unit tests, security audit (pnpm audit + gitleaks), Playwright E2E (conditional on `PLAYWRIGHT_BASE_URL`)
- Frontend CI uses separate pnpm-lock.yaml (workers excluded from workspace)
- `continue-on-error: true` on TypeScript type check — silently hides type errors in CI

### 1.8 Migrations

10 migration files covering: tenants, billing, RBAC, modules, health, indexes, password hashing fix, status enum fix, and v2 super admin schema. Migration 012 maps `PROVISIONING→TRIAL` and `ARCHIVED→CHURNED` for the canonical 4-status enum.

### 1.9 Known Implementation Gaps (from audit docs + code review)

1. `GET /settings` returns hardcoded JSON — never reads from `FEATURE_FLAGS_KV`
2. `billing/summary`: MTD and YTD fields are identical (both use total aggregate, no date filter)
3. `generateId()` uses `Math.random()` — not cryptographically secure
4. Partner count query in `GET /partners` ignores `status`/`tier` filter
5. `POST /settings/audit-log` vs `GET /audit-log` — path inconsistency (frontend calls `/audit-log`, backend registers under `/settings/audit-log`)
6. 2FA: frontend has `TwoFactorSetup.tsx` but backend has no TOTP secret storage, setup, or validation endpoints
7. Pending mutation queue has no automatic replay on reconnect
8. No Content-Security-Policy header
9. API keys stored in KV `CACHE_KV` (not a dedicated namespace), no TTL
10. `SESSIONS_KV` is bound but completely unused
11. `deployments/refresh` is mocked (not calling real Cloudflare API)
12. No webhook outbound system for tenant events
13. `NOTIFICATIONS_KV` is bound but completely unused
14. TypeScript type-check has `continue-on-error: true` in CI — silently hides errors
15. Rate limiting fails open on KV error (acceptable but undocumented)
16. `account_from` and `account_to` are NOT NULL in schema but code passes `null`
17. Settings `PUT` uses `write:tenants` permission instead of `manage:settings`

---

## 2. EXTERNAL BEST-PRACTICE RESEARCH

### 2.1 Multi-Tenant SaaS Admin Platform Standards (2024-2026)

**Global leaders in super-admin/control-plane UX:** Stripe Dashboard, Vercel Platform Admin, Cloudflare Dashboard, Datadog, PagerDuty.

Key standards they apply:
- **Real-time health pulse:** Streaming health status with automatic incident creation; not just polling
- **Tenant drill-down:** From platform view → tenant view in one click, with full context preserved
- **Audit trail immutability:** Append-only audit logs (soft delete forbidden), with actor + IP + session on every event
- **Role-based views:** Different UI layouts for super_admin vs. partner vs. support roles
- **Bulk operations:** Multi-select with confirmation dialogs for destructive bulk actions
- **Search-as-you-type:** Global search across tenants, partners, billing — results < 200ms
- **Export to CSV/JSON:** All data tables exportable with applied filters
- **Inline status editing:** Status changes directly in the table row (no modal required)
- **Keyboard shortcuts:** Power-user command palette (Cmd+K)
- **Empty states:** Every zero-data state has contextual actions, not just blank space

### 2.2 Cloudflare Workers Best Practices (2024-2026)

- **Durable Objects for strong consistency:** Rate limiting with KV is eventually consistent; Durable Objects guarantee exactly-once semantics
- **Queues for async work:** Cloudflare Queues for provisioning webhooks and billing event fan-out
- **D1 batch operations:** Using `db.batch()` for atomic multi-table writes
- **Worker-to-Worker service bindings:** Already in use for `COMMERCE_WORKER` — extend to other suite workers
- **Structured logs with `console.log` JSON:** Cloudflare Workers observability ingests structured JSON logs
- **jti blocklist in KV:** For JWT revocation on logout / forced re-auth
- **CSP headers:** `Content-Security-Policy` is missing from the current security headers middleware
- **Signed URLs:** For secure file/attachment access in admin operations

### 2.3 PWA/Offline-First Admin Standards

- **Background Sync API:** Service Worker background sync for guaranteed mutation replay (not just manual retry)
- **Workbox:** Industry-standard library for SW caching strategies
- **Conflict resolution:** Last-write-wins is the minimum; vector clocks preferred for multi-device admin
- **IndexedDB schema versioning:** Dexie migrations for DB schema evolution
- **Offline-aware UI:** Buttons/forms disable in offline mode for write operations (read remains available)

### 2.4 Nigeria/Africa Platform Standards

- **NDPR (Nigeria Data Protection Regulation):** Explicit consent trail, data subject rights (access, deletion), breach notification within 72 hours
- **Paystack / Flutterwave integration:** Dominant payment rails in Nigeria; billing must eventually reconcile with these
- **Telco/USSD patterns:** Low-bandwidth users may access via proxies; critical admin alerts should support SMS fallback
- **Multi-currency readiness:** NGN primary but Africa-ready means support for GHS, KES, ZAR, XOF
- **Time zones:** Africa/Lagos is correct default; Africa-ready means also supporting Africa/Nairobi, Africa/Johannesburg, Africa/Accra

### 2.5 Security Standards (OWASP, 2025)

- **PBKDF2-SHA256 at 310k iterations:** Already implemented — correct
- **Content-Security-Policy:** Critical missing header
- **Permissions-Policy:** Missing header (controls browser features)
- **Cross-Origin-Resource-Policy:** Missing
- **JWT jti claim + blocklist:** Missing (allows JWT reuse after logout)
- **Admin action confirmation:** High-impact actions (delete tenant, suspend partner) require typed confirmation
- **Session idle timeout:** Currently missing on frontend (no idle detection)
- **Credential stuffing protection:** Rate limiting exists but no CAPTCHA or device fingerprinting
- **Supply chain:** `pnpm audit` runs with `continue-on-error: true` — high/critical vulns should fail build

### 2.6 Performance Standards for Admin Dashboards

- **Lighthouse scores ≥ 95:** Current build is not verified against this target
- **Core Web Vitals:** LCP < 2.5s, INP < 200ms, CLS < 0.1
- **Code splitting:** Already configured in Vite (`manualChunks`) — good
- **Virtual scrolling:** Implemented for tenants but not for billing ledger, audit log, or operations metrics
- **Optimistic UI updates:** For status changes and module toggles — reduces perceived latency
- **Skeleton loading:** Implemented in Dashboard — needs to be consistent across all pages

### 2.7 Real-Time Infrastructure Patterns

- **WebSocket with reconnect backoff:** `useHealthData.ts` has WS + polling fallback — reconnect logic should have exponential backoff
- **Server-Sent Events (SSE) for health:** More reliable than WebSocket for unidirectional streams on Cloudflare Workers
- **Notification centre:** NotificationBell exists but `NOTIFICATIONS_KV` is unused — no actual notifications

---

## 3. SYNTHESIS AND GAP ANALYSIS

### 3.1 Critical Security Gaps (Must Fix)

| # | Gap | Risk Level | Root Cause |
|---|-----|-----------|------------|
| S1 | No Content-Security-Policy header | HIGH | Missing from security middleware |
| S2 | JWT has no jti / no logout blocklist | MEDIUM-HIGH | Stateless design without revocation |
| S3 | 2FA backend not implemented | HIGH | Frontend UI exists, backend missing |
| S4 | generateId() uses Math.random() | MEDIUM | Should use crypto.getRandomValues |
| S5 | TypeScript CI check `continue-on-error: true` | MEDIUM | Silent type-error accumulation |
| S6 | pnpm audit `continue-on-error: true` | HIGH | Known vulns silently ignored |
| S7 | Account_from/to nullable vs schema NOT NULL | LOW-MED | INSERT passes null for optional fields |

### 3.2 Architecture Gaps (Enhance)

| # | Gap | Impact |
|---|-----|--------|
| A1 | Pending mutations queue has no automatic replay | Offline writes silently lost |
| A2 | NOTIFICATIONS_KV completely unused | Platform has no notification system |
| A3 | SESSIONS_KV completely unused | Wasted binding, logout revocation impossible |
| A4 | deployments/refresh is mocked | No real Cloudflare API integration |
| A5 | No webhook outbound system | Tenants cannot react to platform events |
| A6 | GET /settings is hardcoded | Settings changes are ephemeral |
| A7 | Billing MTD/YTD identical calculation | Financial reporting inaccurate |
| A8 | Partner count ignores filters | Pagination total is wrong |
| A9 | API keys stored in CACHE_KV | Risk of eviction; no dedicated namespace |

### 3.3 UX / Feature Gaps

| # | Gap | Impact |
|---|-----|--------|
| U1 | No global command palette (Cmd+K) | Power users cannot navigate fast |
| U2 | No CSV/JSON export for any table | Admin cannot extract data |
| U3 | No bulk operations on tenants/partners | Tedious one-by-one management |
| U4 | No inline status editing in tables | Every change requires opening a modal |
| U5 | Notification centre UI exists, no data | NotificationBell is non-functional |
| U6 | No session idle timeout / warning | Security concern for shared devices |
| U7 | Virtual scrolling only on tenants | Billing ledger and audit log lag |
| U8 | No optimistic UI updates | Perceived latency on status changes |
| U9 | Missing empty states on many pages | Bad UX on fresh or zero-data deployments |
| U10 | Map component exists but no data | Map.tsx renders but shows nothing |

### 3.4 Operational Gaps

| # | Gap | Impact |
|---|-----|--------|
| O1 | Audit log not writing for auth failures | NDPR breach trail incomplete |
| O2 | No audit for partner/billing mutations | Compliance gap |
| O3 | Settings PUT uses wrong permission | Admin cannot manage settings with `manage:settings` |
| O4 | No multi-currency support in billing | Africa-ready requirement unmet |
| O5 | Feature flags only 4 flags | No room for new product flags without code change |
| O6 | No scheduled Cron jobs | No automated daily quota resets, no billing cycle automation |

---

## 4. TOP 20 ENHANCEMENTS + BUG FIXES

Listed here as a summary. Full task specs follow in Section 5.

| ID | Title | Category | Priority | Phase |
|----|-------|----------|----------|-------|
| T-01 | Fix cryptographically insecure ID generation | Bug | P0 | 1 |
| T-02 | Fix billing MTD/YTD calculation | Bug | P0 | 1 |
| T-03 | Fix partner pagination count ignoring filters | Bug | P0 | 1 |
| T-04 | Fix audit log endpoint path inconsistency | Bug | P0 | 1 |
| T-05 | Fix Settings GET hardcoded / Settings PUT permission | Bug | P0 | 1 |
| T-06 | Add Content-Security-Policy and missing security headers | Security | P0 | 1 |
| T-07 | Implement 2FA backend (TOTP setup, validate, disable) | Security | P0 | 1 |
| T-08 | Add JWT jti blocklist for logout revocation | Security | P1 | 1 |
| T-09 | Fix TypeScript and pnpm audit CI gates | DevOps | P1 | 1 |
| T-10 | Implement automatic offline mutation replay | Offline/PWA | P1 | 1 |
| T-11 | Implement Notifications system (KV + API + UI) | Feature | P1 | 1 |
| T-12 | Implement persistent Settings (read/write from KV) | Feature | P1 | 1 |
| T-13 | Add server-side audit logging middleware | Compliance | P1 | 1 |
| T-14 | Add global command palette (Cmd+K) | UX | P2 | 2 |
| T-15 | Add CSV/JSON export for all data tables | UX | P2 | 2 |
| T-16 | Add bulk operations for tenants and partners | UX | P2 | 2 |
| T-17 | Add session idle timeout with warning modal | Security/UX | P2 | 2 |
| T-18 | Add multi-currency support to billing | Africa-Ready | P2 | 2 |
| T-19 | Extend feature flags system (dynamic flags) | Governance | P2 | 2 |
| T-20 | Add Cloudflare API integration to deployments/refresh | Feature | P2 | 2 |
| T-21 | Add outbound webhook system for tenant events | Feature | P3 | 2 |
| T-22 | Implement virtual scrolling for billing ledger and audit log | Performance | P2 | 2 |

---

## 5. TASK BREAKDOWN

---

### T-01: Fix Cryptographically Insecure ID Generation

**Objective:** Replace `Math.random()` in the `generateId()` utility with `crypto.getRandomValues()`.

**Why It Matters:** `Math.random()` is not cryptographically secure. IDs for tenants, partners, billing entries, API keys, and audit events should be unpredictable to prevent enumeration attacks. In a Cloudflare Workers context, `crypto.getRandomValues()` is natively available and the correct solution.

**Repo Scope:** `workers/src/index.ts`

**Dependencies:** None

**Prerequisites:** None

**Impacted Modules:** All endpoints using `generateId()` — tenants, partners, billing entries, modules, health alerts, API keys, audit log, operations metrics

**Files to Change:**
- `workers/src/index.ts` — `generateId()` function (line ~304)

**Expected Output:** IDs are now generated using 6 random bytes from `crypto.getRandomValues()`, hex-encoded, producing a 12-character collision-resistant string.

**Acceptance Criteria:**
- `generateId('tenant')` returns a string like `tenant-a1b2c3d4e5f6`
- IDs are 12-char hex suffix (6 bytes × 2 hex chars)
- No `Math.random()` call exists in `generateId`
- All unit tests pass

**Tests Required:**
- Unit test: generateId always produces unique IDs across 10,000 calls
- Unit test: ID format matches `prefix-[0-9a-f]{12}`

**Risks:** None — pure upgrade, same format

**Governance:** Core Invariant: Build Once Use Infinitely (security in shared utility)

**Important Reminders:**
- Workers runtime provides `crypto.getRandomValues` natively
- `crypto.randomUUID()` is also available but produces UUID format — prefer hex for compact IDs
- Do not change the prefix convention (e.g., `tenant-`, `partner-`)

---

### T-02: Fix Billing MTD/YTD Calculation

**Objective:** Separate Monthly-To-Date (MTD) from Year-To-Date (YTD) in the billing summary query.

**Why It Matters:** `GET /billing/summary` currently returns the same value for both `mtd` and `ytd` fields because both use the total aggregate without any date filter. This is a financial reporting bug that will mislead operators about revenue trends.

**Repo Scope:** `workers/src/index.ts`

**Dependencies:** None

**Prerequisites:** D1 date filtering must be tested

**Impacted Modules:** Billing page, Dashboard metrics

**Files to Change:**
- `workers/src/index.ts` — `GET /billing/summary` handler (~line 1878)

**Expected Output:**
- `mtd`: sum of `REVENUE` entries since `date('now', 'start of month')`
- `ytd`: sum of `REVENUE` entries since `date('now', 'start of year')`
- `balance`: total revenue minus total payouts (all-time)

**Acceptance Criteria:**
- MTD and YTD are different values when entries span multiple months
- MTD = 0 at start of a new month (correct reset)
- KV cache is invalidated when new billing entries are created

**Tests Required:**
- Unit test: billing summary with entries across Jan-Apr returns correct MTD (April only) and YTD (Jan-Apr)
- Regression: existing `/billing/summary` response shape is unchanged

**Risks:** Cache TTL means stale data up to 900 seconds — acceptable

**Governance:** Core Invariant: Nigeria First (accurate kobo financial reporting)

---

### T-03: Fix Partner Pagination Count Ignoring Filters

**Objective:** Fix the `GET /partners` endpoint so the total count respects `status` and `tier` query filters.

**Why It Matters:** When a user filters partners by status (e.g., `ACTIVE`) or tier (e.g., `ENTERPRISE`), the `total` in the pagination response reflects the full unfiltered count. This breaks pagination math — pages are calculated incorrectly, and the UI shows wrong "Page X of Y" information.

**Repo Scope:** `workers/src/index.ts`

**Dependencies:** None

**Prerequisites:** None

**Files to Change:**
- `workers/src/index.ts` — `GET /partners` handler (~line 1004)

**Expected Output:** Count query uses same filters as list query.

**Acceptance Criteria:**
- `GET /partners?status=ACTIVE` returns count of only ACTIVE partners
- `GET /partners?tier=ENTERPRISE` returns count of only ENTERPRISE partners
- `GET /partners?status=ACTIVE&tier=ENTERPRISE` applies both filters to count

**Tests Required:**
- Unit test: filtered count matches filtered list length
- Edge case: no partners matching filter → total: 0, partners: []

**Risks:** None

---

### T-04: Fix Audit Log Endpoint Path Inconsistency

**Objective:** Resolve the path mismatch between the frontend calling `/audit-log` and the backend registering the endpoint at `/settings/audit-log`.

**Why It Matters:** The `AuditLog.tsx` page and `apiClient.getAuditLog()` call `/audit-log?...` but the backend handler is registered at `GET /settings/audit-log`. This means the Audit Log page always gets a 404 and never loads real data.

**Repo Scope:** `workers/src/index.ts` and `frontend/src/lib/api.ts`

**Dependencies:** None

**Prerequisites:** Understand which is the canonical path — prefer `/audit-log` as the dedicated path

**Files to Change:**
- `workers/src/index.ts` — register `GET /audit-log` (or alias `/settings/audit-log` to `/audit-log`)
- Verify `frontend/src/lib/api.ts` `getAuditLog()` method path

**Expected Output:** The Audit Log page loads data without 404.

**Acceptance Criteria:**
- `GET /audit-log` returns paginated entries
- `GET /settings/audit-log` still works (backward compat, via alias or kept as-is)
- AuditLog.tsx page displays entries

**Tests Required:**
- Integration test: GET /audit-log returns 200 with correct envelope
- UI test: AuditLog page renders rows from API

---

### T-05: Fix Settings GET Hardcoded / Settings PUT Permission

**Objective:** (a) Make `GET /settings` read persisted settings from KV, merging with defaults. (b) Fix `PUT /settings` which uses `write:tenants` permission instead of `manage:settings`.

**Why It Matters:**
- (a) Any settings changed via `PUT /settings` are stored in KV but never read back — every GET returns hardcoded defaults. This makes the settings UI appear to work but changes are lost.
- (b) A user with `manage:settings` permission but NOT `write:tenants` cannot save settings — wrong permission gate.

**Repo Scope:** `workers/src/index.ts`

**Dependencies:** None

**Files to Change:**
- `workers/src/index.ts` — `GET /settings` handler (~line 2011)
- `workers/src/index.ts` — `PUT /settings` permission check (~line 2039)

**Expected Output:**
- GET /settings reads `platform:settings` from KV, falls back to defaults if missing
- PUT /settings uses `manage:settings` permission

**Acceptance Criteria:**
- After `PUT /settings { maintenanceMode: true }`, subsequent `GET /settings` returns `maintenanceMode: true`
- A user with only `manage:settings` (not `write:tenants`) can PUT settings successfully

**Tests Required:**
- Integration test: PUT then GET round-trip
- Permission test: `manage:settings` role can PUT

---

### T-06: Add Content-Security-Policy and Missing Security Headers

**Objective:** Add `Content-Security-Policy`, `Permissions-Policy`, and `Cross-Origin-Resource-Policy` headers to the Workers security header middleware.

**Why It Matters:** The current security middleware sets 4 headers but is missing CSP — the most important defence against XSS. CSP is required for OWASP Top 10 compliance and is a standard expectation for any admin platform handling financial data.

**Repo Scope:** `workers/src/index.ts`

**Dependencies:** None

**Files to Change:**
- `workers/src/index.ts` — security headers middleware (~line 112)

**Expected Output:**
```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://*.webwaka.workers.dev wss:; font-src 'self'; frame-ancestors 'none';
Permissions-Policy: geolocation=(), microphone=(), camera=()
Cross-Origin-Resource-Policy: same-origin
```

**Acceptance Criteria:**
- All responses include `Content-Security-Policy` header
- `frame-ancestors 'none'` (replaces X-Frame-Options)
- No legitimate frontend features are blocked by CSP

**Tests Required:**
- Header presence test on all major endpoints
- Frontend smoke test: app loads without CSP violations in browser console

**Risks:** `unsafe-inline` is needed for Tailwind CSS inline styles — document why it is acceptable

---

### T-07: Implement 2FA Backend (TOTP Setup, Validate, Disable)

**Objective:** Build the complete TOTP (Time-based One-Time Password) backend for 2FA: setup endpoint (generate secret + QR URI), validate endpoint (check code, issue full JWT), status endpoint, and disable endpoint.

**Why It Matters:** The frontend has full 2FA UI (`TwoFactorSetup.tsx`, OTP input, `loginWithTotp()` in AuthContext) but the backend has no TOTP logic. This means 2FA is a UI illusion — it does not actually protect admin accounts.

**Repo Scope:** `workers/src/index.ts`, `workers/src/auth/password.ts`

**Dependencies:** T-08 (jti blocklist) is a complementary enhancement but not a hard dependency

**Prerequisites:**
- TOTP secret must be stored per-user in RBAC_DB (add column `totp_secret TEXT` to users table)
- TOTP algorithm: HOTP/TOTP (RFC 6238) using Web Crypto HMAC-SHA1
- QR code URI format: `otpauth://totp/WebWaka%20Admin:{email}?secret={base32secret}&issuer=WebWaka`

**Files to Change:**
- `workers/src/index.ts` — add `/auth/2fa/setup`, `/auth/2fa/validate`, `/auth/2fa/disable`, `/auth/2fa/status`
- `workers/migrations/` — add migration to add `totp_secret` and `totp_enabled` columns to users
- RBAC_DB schema update required

**Endpoints to Add:**
```
GET  /auth/2fa/status          — returns { enabled: bool }
POST /auth/2fa/setup           — generates TOTP secret, returns qrUri + base32secret
POST /auth/2fa/verify-setup    — validates first TOTP code, marks 2FA as enabled
POST /auth/2fa/validate        — validates TOTP code during login (session_token flow)
POST /auth/2fa/disable         — disables 2FA (requires current TOTP code)
```

**Expected Output:**
- Login with 2FA returns `{ requires_2fa: true, session_token: "..." }` when user has `totp_enabled = 1`
- `POST /auth/2fa/validate` exchanges session_token + TOTP code for full JWT cookie

**Acceptance Criteria:**
- A user with 2FA enabled cannot log in without providing a valid TOTP code
- TOTP codes are time-window validated (30-second window ± 1 window for clock drift)
- Session tokens expire in 5 minutes (short-lived, single-use intent)
- QR code URI is parseable by Google Authenticator and Authy

**Tests Required:**
- Unit test: TOTP code generation and validation
- Unit test: expired session token rejected
- Integration test: full 2FA login flow

**Risks:**
- TOTP requires server time accuracy — Cloudflare Workers use UTC system time, which is accurate
- Base32 encoding must be implemented (no npm package in Workers — use pure Web Crypto)

**Phase Split:**
- Phase 1: Setup endpoint, validate endpoint, enable/disable
- Phase 2: Backup codes (8-digit recovery codes)

---

### T-08: Add JWT jti Blocklist for Logout Revocation

**Objective:** Issue a `jti` (JWT ID) claim with every signed JWT, and store revoked JTIs in `SESSIONS_KV` on logout. The `getAuthPayload` verifier checks the KV blocklist before accepting a token.

**Why It Matters:** Currently, a JWT remains valid for 24 hours after logout. If an admin's JWT was intercepted before logout, it can be replayed. A jti-based blocklist in KV enables true stateless JWT with revocation at the cost of one KV read per request.

**Repo Scope:** `workers/src/index.ts`

**Dependencies:** None (SESSIONS_KV is already bound)

**Files to Change:**
- `workers/src/index.ts` — `signJWT()`, `verifyJWT()`, `getAuthPayload()`, `POST /auth/logout`, `POST /auth/refresh`

**Expected Output:**
- Every JWT has a `jti` claim (UUID or hex ID)
- On logout: store `jti` in `SESSIONS_KV` with TTL matching remaining token lifetime
- On every authenticated request: check if `jti` is in `SESSIONS_KV` (blocklisted)

**Acceptance Criteria:**
- POST /auth/logout → token blocked in < 1 second
- Replaying a logged-out token returns 401
- Re-login after logout issues new jti — old jti remains blocked

**Tests Required:**
- Integration test: logout then replay returns 401
- Unit test: jti is present in signed JWT payload
- Performance: KV read adds < 5ms to p99 request latency

**Risks:** KV eventual consistency means a token may be valid for seconds after logout in edge cases — acceptable for this threat model

---

### T-09: Fix TypeScript and pnpm Audit CI Gates

**Objective:** Remove `continue-on-error: true` from the TypeScript type-check step and the security audit steps in `ci.yml`. Fix all existing TypeScript errors first.

**Why It Matters:** The CI pipeline currently silently passes even when TypeScript has type errors or when `pnpm audit` finds high-severity vulnerabilities. This is a governance failure — the CI gives a false green light.

**Repo Scope:** `.github/workflows/ci.yml`, `frontend/src/**/*.ts{x}`, `workers/src/**/*.ts`

**Dependencies:** Must fix all TypeScript errors before removing `continue-on-error`

**Files to Change:**
- `.github/workflows/ci.yml` — remove `continue-on-error: true` from type-check and security audit steps
- Any TypeScript errors revealed once CI is strict

**Expected Output:**
- CI fails if TypeScript has errors
- CI fails if `pnpm audit` finds high/critical vulnerabilities

**Acceptance Criteria:**
- `pnpm tsc --noEmit` exits 0 in both frontend and workers
- `pnpm audit --audit-level=high` exits 0 or reports no high/critical issues
- CI pipeline is green on a clean branch

**Tests Required:**
- Create a branch with a deliberate type error — CI must fail
- Create a branch with a clean codebase — CI must pass

---

### T-10: Implement Automatic Offline Mutation Replay

**Objective:** Add a `useOfflineSync` hook that listens for the browser's `online` event and automatically replays all pending mutations from the Dexie `pendingMutations` store.

**Why It Matters:** The pending mutation queue in Dexie is built and populated correctly, but there is no mechanism to replay those mutations when connectivity is restored. Offline writes are silently lost unless the user manually retries. This breaks the "Offline First" core invariant.

**Repo Scope:** `frontend/src/hooks/`, `frontend/src/lib/db.ts`

**Dependencies:** None

**Files to Change:**
- New: `frontend/src/hooks/useOfflineSync.ts`
- `frontend/src/App.tsx` — integrate `useOfflineSync` at app level
- `frontend/src/lib/db.ts` — ensure `getPendingMutations` and `removePendingMutation` are correct

**Expected Output:**
```typescript
// useOfflineSync.ts
export function useOfflineSync() {
  useEffect(() => {
    const handleOnline = async () => {
      const mutations = await getPendingMutations()
      for (const mutation of mutations) {
        if (mutation.retries >= mutation.maxRetries) {
          await removePendingMutation(mutation.id!)
          continue
        }
        try {
          await fetch(mutation.url, { method: mutation.method, headers: mutation.headers, body: mutation.body, credentials: 'include' })
          await removePendingMutation(mutation.id!)
        } catch {
          await incrementMutationRetry(mutation.id!)
        }
      }
    }
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [])
}
```

**Acceptance Criteria:**
- Going offline then creating a tenant queues a mutation
- Coming back online triggers automatic retry within 2 seconds
- Failed retries increment counter; mutations exceeding maxRetries are dropped with a toast notification
- Online/offline state is reflected in OfflineBanner

**Tests Required:**
- Unit test: `useOfflineSync` replays mutations on `online` event
- Integration test: mock offline → create tenant → mock online → tenant appears in list

---

### T-11: Implement Notifications System (KV + API + UI)

**Objective:** Build an end-to-end platform notification system: (1) backend API to create/list/dismiss notifications using `NOTIFICATIONS_KV`, (2) frontend `useNotifications` hook that polls for notifications, (3) `NotificationBell` renders actual notifications.

**Why It Matters:** `NOTIFICATIONS_KV` is bound but completely unused. The `NotificationBell` component exists but shows no data. Admin operators need to be informed of critical events (tenant suspension, billing threshold, system alerts) in real time.

**Repo Scope:** `workers/src/index.ts`, `frontend/src/hooks/useNotifications.ts`, `frontend/src/components/NotificationBell.tsx`

**Dependencies:** None

**Files to Change:**
- `workers/src/index.ts` — add `/notifications` endpoints
- `frontend/src/hooks/useNotifications.ts` — implement polling and KV read
- `frontend/src/components/NotificationBell.tsx` — render real notifications

**Endpoints to Add:**
```
GET    /notifications           — list unread notifications for current user
POST   /notifications           — create a platform notification (internal)
PATCH  /notifications/:id/read  — mark a notification as read
DELETE /notifications/:id       — dismiss a notification
```

**KV Schema:**
```
Key: notif:{userId}:{notifId}
Value: { id, type, title, message, severity, createdAt, readAt }
TTL: 7 days
```

**Acceptance Criteria:**
- NotificationBell shows count badge when unread notifications exist
- Clicking bell opens dropdown with list of notifications
- Marking as read removes badge
- Creating a tenant (server-side) can optionally emit a notification

**Tests Required:**
- Unit test: GET /notifications returns correct unread count
- UI test: NotificationBell badge updates on new notification

---

### T-12: Implement Persistent Settings (Read/Write from KV)

**Objective:** Make `GET /settings` read from `FEATURE_FLAGS_KV` key `platform:settings`, merged with hardcoded defaults. Already fixed by T-05 for the permission bug — this task focuses on the full round-trip persistence.

**Why It Matters:** Platform operators need to change settings like `maintenanceMode`, `maxTenantCount`, and `sessionTimeout` and have those settings persist across worker restarts and deployments.

**Repo Scope:** `workers/src/index.ts`, `frontend/src/pages/Settings.tsx`

**Dependencies:** T-05 (prerequisite — fixes the permission bug first)

**Files to Change:**
- `workers/src/index.ts` — `GET /settings` and `PUT /settings`
- `frontend/src/pages/Settings.tsx` — verify UI correctly shows and saves settings

**Acceptance Criteria:**
- Settings persist across multiple GET /settings calls after a single PUT
- Maintenance mode banner appears on dashboard when `maintenanceMode: true`
- Settings schema is validated with Zod before KV write

---

### T-13: Add Server-Side Audit Logging Middleware

**Objective:** Add a Hono middleware that automatically writes to the audit log for all state-changing (POST, PUT, PATCH, DELETE) operations, capturing user ID, action, resource type, IP address, and timestamp.

**Why It Matters:** Currently audit logging is call-site opt-in (only tenant CRUD calls `logAuditEvent`). Partner updates, billing entries, settings changes, module toggles, and auth failures all produce no audit trail. This is a NDPR compliance gap.

**Repo Scope:** `workers/src/index.ts`

**Dependencies:** None

**Files to Change:**
- `workers/src/index.ts` — add audit middleware after auth middleware

**Expected Output:**
```typescript
app.use(['POST', 'PUT', 'PATCH', 'DELETE'], async (c, next) => {
  await next()
  if (c.res.status >= 200 && c.res.status < 300) {
    const payload = await getAuthPayload(c)
    const ip = c.req.header('CF-Connecting-IP') || 'unknown'
    // determine resource_type from URL path
    // write to RBAC_DB audit_log table
  }
})
```

**Acceptance Criteria:**
- Partner creation writes to audit_log
- Billing entry creation writes to audit_log
- Failed login attempts write to audit_log with action `AUTH_FAIL`
- Audit log entries include: user_id, action, resource_type, resource_id (if available), ip_address

**Tests Required:**
- Integration test: POST /partners → audit log entry created
- Integration test: failed login → AUTH_FAIL audit entry
- Unit test: middleware correctly extracts resource_type from URL

---

### T-14: Add Global Command Palette (Cmd+K)

**Objective:** Implement a keyboard-driven command palette using the existing `cmdk` library that allows navigation to any page, quick tenant search, and common actions (create tenant, export data, toggle theme).

**Why It Matters:** Power admin users managing hundreds of tenants need keyboard-first navigation. Every world-class admin platform (Linear, Vercel, GitHub, Notion) has a command palette. `cmdk` is already in the package.json.

**Repo Scope:** `frontend/src/`

**Dependencies:** None (cmdk already installed)

**Files to Change:**
- New: `frontend/src/components/CommandPalette.tsx`
- `frontend/src/App.tsx` or `DashboardLayout.tsx` — register Cmd+K listener
- `frontend/src/components/DashboardLayout.tsx` — include CommandPalette

**Expected Output:**
- Press Cmd+K (or Ctrl+K on Windows) → modal opens with fuzzy search
- Navigation commands: "Go to Tenants", "Go to Billing", etc.
- Tenant search: type tenant name → opens tenant detail
- Actions: "Create Tenant", "Dark Mode", "Logout"

**Acceptance Criteria:**
- Cmd+K opens palette in < 100ms
- Results update as user types (< 50ms debounce)
- Escape closes palette
- Selected command executes navigation or action

**Tests Required:**
- Unit test: palette renders and responds to keyboard input
- Accessibility test: palette is keyboard-navigable with arrow keys

---

### T-15: Add CSV/JSON Export for All Data Tables

**Objective:** Add an "Export" dropdown button to the header of TenantManagement, Billing, AuditLog, PartnerManagement, and OperationsOverview pages allowing export to CSV or JSON with currently applied filters.

**Why It Matters:** Admin operators frequently need to extract data for external reporting, accountants, compliance teams, and management. There is currently no way to export any data from the admin.

**Repo Scope:** `frontend/src/pages/`, `frontend/src/lib/`

**Dependencies:** None

**Files to Change:**
- New: `frontend/src/lib/export.ts` — shared CSV and JSON export utility
- `frontend/src/pages/TenantManagement.tsx` — add export button
- `frontend/src/pages/Billing.tsx` — add export button
- `frontend/src/pages/AuditLog.tsx` — add export button
- `frontend/src/pages/PartnerManagement.tsx` — add export button

**Expected Output:**
```typescript
// lib/export.ts
export function exportToCSV(data: Record<string, unknown>[], filename: string): void
export function exportToJSON(data: Record<string, unknown>[], filename: string): void
```

**Acceptance Criteria:**
- Export respects current filter/search state
- CSV has correct headers from data keys
- Kobo amounts are formatted as NGN in CSV (human-readable)
- Downloaded file has timestamp in filename

**Tests Required:**
- Unit test: `exportToCSV` produces correct CSV string
- Unit test: `exportToJSON` produces valid JSON

---

### T-16: Add Bulk Operations for Tenants and Partners

**Objective:** Add multi-select checkboxes to TenantManagement and PartnerManagement tables, with a contextual action bar for bulk suspend, bulk activate, and bulk export.

**Why It Matters:** Managing 100+ tenants one-by-one is extremely tedious. Bulk operations are essential for any admin platform at scale.

**Repo Scope:** `frontend/src/pages/TenantManagement.tsx`, `frontend/src/pages/PartnerManagement.tsx`

**Dependencies:** T-15 (bulk export uses same export utility)

**Files to Change:**
- `frontend/src/pages/TenantManagement.tsx`
- `frontend/src/pages/PartnerManagement.tsx`
- New: `frontend/src/components/BulkActionBar.tsx`

**Acceptance Criteria:**
- Select-all checkbox selects all visible rows
- Contextual action bar appears when ≥ 1 row is selected
- Bulk suspend shows confirmation dialog listing affected tenant names
- Bulk operations run in sequence with progress indicator

**Tests Required:**
- Unit test: select-all selects all rows in current page
- Integration test: bulk suspend calls PUT for each selected tenant

---

### T-17: Add Session Idle Timeout with Warning Modal

**Objective:** Implement a frontend idle timeout that shows a warning modal after 25 minutes of inactivity, then auto-logs-out after a 5-minute countdown if no activity is detected.

**Why It Matters:** Admin dashboards on shared devices risk session hijacking. OWASP recommends idle timeout for high-privilege sessions. The current setup has no idle detection at all.

**Repo Scope:** `frontend/src/hooks/`, `frontend/src/contexts/AuthContext.tsx`

**Dependencies:** None

**Files to Change:**
- New: `frontend/src/hooks/useIdleTimeout.ts`
- `frontend/src/contexts/AuthContext.tsx` — integrate idle timeout
- New: `frontend/src/components/IdleWarningModal.tsx`
- `frontend/src/App.tsx` — include IdleWarningModal

**Expected Output:**
```typescript
// useIdleTimeout.ts tracks mousemove, keydown, click, scroll
// After 25 min no activity: dispatch 'idle:warning'
// After 30 min: call logout()
```

**Acceptance Criteria:**
- Warning modal appears at 25 minutes with countdown
- Clicking "Stay Logged In" resets the timer
- At 30 minutes: auto logout, redirect to /login
- Activity events reset timer: mouse move, click, keydown, scroll

**Tests Required:**
- Unit test: timer resets on activity event
- Unit test: logout called after timeout

---

### T-18: Add Multi-Currency Support to Billing

**Objective:** Extend the billing system to support GHS (Ghana Cedis), KES (Kenya Shilling), ZAR (South African Rand), and XOF (West African CFA franc) alongside NGN. All storage remains in kobo-equivalent smallest units; currency conversion rates are fetched from a configurable source.

**Why It Matters:** WebWaka aims to be Africa-ready. Nigerian-only billing blocks expansion to Ghana, Kenya, South Africa, and Francophone West Africa markets.

**Repo Scope:** `workers/src/index.ts`, `frontend/src/lib/commissionCalculator.ts`, `frontend/src/i18n/`

**Dependencies:** None

**Files to Change:**
- `workers/src/index.ts` — extend `BillingEntrySchema` with optional `currency` field
- `frontend/src/lib/commissionCalculator.ts` — add currency-aware formatting
- `frontend/src/i18n/index.ts` — extend `formatKobo` to `formatAmount` with currency param

**Acceptance Criteria:**
- Billing entries can specify `currency: "GHS" | "KES" | "ZAR" | "XOF" | "NGN"`
- Display correctly formats amounts in selected currency
- Commission calculations remain in base units (kobo-equivalent)

**Tests Required:**
- Unit test: `formatAmount(1000, 'GHS')` returns `GH₵10.00`
- Unit test: billing entry with currency `GHS` persists and reads back correctly

---

### T-19: Extend Feature Flags System (Dynamic Flags)

**Objective:** Replace the hardcoded 4-flag schema in `FeatureFlagSetSchema` with a dynamic system where flags can be added, removed, and described without backend code changes. Store flag definitions in KV.

**Why It Matters:** Adding a new feature flag currently requires a backend code change, a new Zod schema field, and a frontend UI change. A dynamic system allows product governance to add flags through the admin UI itself.

**Repo Scope:** `workers/src/index.ts`, `frontend/src/pages/FeatureFlagManager.tsx`

**Dependencies:** T-12 (persistent settings pattern as a reference)

**Files to Change:**
- `workers/src/index.ts` — new `GET /feature-flag-definitions`, `POST /feature-flag-definitions`, `DELETE /feature-flag-definitions/:key`
- `frontend/src/pages/FeatureFlagManager.tsx` — dynamic flag rendering from definitions

**Acceptance Criteria:**
- A super admin can add a new flag definition (key, label, description, defaultValue)
- New flags appear in the FeatureFlagManager UI immediately
- Existing 4 flags continue to work as before (backward compat)

**Tests Required:**
- Integration test: add flag definition → appears in list → can be toggled per tenant

---

### T-20: Integrate Real Cloudflare API for Deployments Refresh

**Objective:** Replace the mocked `POST /deployments/refresh` handler with a real Cloudflare REST API call to fetch live worker and pages deployment status.

**Why It Matters:** The Deployment Manager shows no real data — it always returns the same mock state. Operators cannot see actual deployment health, last pipeline status, or commit SHAs.

**Repo Scope:** `workers/src/index.ts`, `wrangler.toml`

**Dependencies:** `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` secrets must be available as Worker environment variables

**Files to Change:**
- `workers/src/index.ts` — `POST /deployments/refresh` handler
- `workers/wrangler.toml` — document required env vars

**Expected Output:** Calls `https://api.cloudflare.com/client/v4/accounts/{account_id}/workers/scripts` and `https://api.cloudflare.com/client/v4/accounts/{account_id}/pages/projects` — maps results to deployments table.

**Acceptance Criteria:**
- Deployment refresh shows live worker status
- API errors are gracefully handled (Cloudflare API down → return stale data with warning)

**Tests Required:**
- Integration test with mocked Cloudflare API response

---

### T-21: Add Outbound Webhook System for Tenant Events

**Objective:** Allow tenants to register webhook URLs that receive platform events (tenant suspended, billing threshold exceeded, module enabled/disabled). Store webhook configs in `TENANTS_DB` and deliver via Cloudflare Queues or async fetch.

**Why It Matters:** Tenant operators need to react to platform events in their own systems. Without webhooks, they must poll the API — which is inefficient and misses events.

**Repo Scope:** `workers/src/index.ts`, `workers/wrangler.toml`

**Dependencies:** T-13 (audit log), Cloudflare Queues (new binding needed)

**Files to Change:**
- `workers/src/index.ts` — webhook CRUD endpoints + delivery on events
- `workers/wrangler.toml` — add Queue binding
- `workers/migrations/` — add `tenant_webhooks` table

**Endpoints to Add:**
```
GET    /tenants/:id/webhooks        — list webhook configs for a tenant
POST   /tenants/:id/webhooks        — register a webhook URL + events
DELETE /tenants/:id/webhooks/:wid   — unregister a webhook
POST   /tenants/:id/webhooks/:wid/test — send a test event
```

**Acceptance Criteria:**
- Webhook registered for `tenant.suspended` receives a POST when tenant is suspended
- Delivery includes HMAC-SHA256 signature header for verification
- Failed deliveries are retried 3 times via Queue

---

### T-22: Virtual Scrolling for Billing Ledger and Audit Log

**Objective:** Apply `@tanstack/react-virtual` virtualizer to the Billing ledger table and Audit Log table, matching the pattern already implemented for TenantManagement.

**Why It Matters:** Billing ledger and Audit Log can have thousands of entries. Without virtualisation, rendering all rows causes UI lag and browser memory pressure. `@tanstack/react-virtual` is already installed.

**Repo Scope:** `frontend/src/pages/Billing.tsx`, `frontend/src/pages/AuditLog.tsx`

**Dependencies:** None (library already installed)

**Files to Change:**
- `frontend/src/pages/Billing.tsx`
- `frontend/src/pages/AuditLog.tsx`

**Acceptance Criteria:**
- Tables with 1,000+ rows render in < 100ms
- Scroll is smooth (60fps) on mid-range Android device
- Row click actions work correctly with virtualisation

**Tests Required:**
- Performance test: render 1,000 rows, measure frame rate

---

## 6. QA PLANS FOR EVERY TASK

---

### QA-01: ID Generation (T-01)

**What to Verify:**
- `generateId('tenant')` never produces a Math.random-based ID
- Format: `tenant-{12 hex chars}`
- IDs created in concurrent requests are unique

**Edge Cases:**
- Rapid burst of 100 IDs in one request — no collisions
- Worker cold start — first ID is still valid

**Regressions:**
- All existing endpoints that use `generateId` still return valid IDs
- Existing IDs in the database are not affected (only new IDs use new generator)

**Cross-Repo Verification:**
- If `webwaka-commerce-api` creates records using IDs from this API, verify format compatibility

**Deployment Check:**
- No environment variable required for this change
- Deploy to staging first, verify IDs in newly created test records

**Done Means:**
- Zero `Math.random` calls in `generateId`
- All unit tests pass
- Staging smoke test: create tenant, view ID format

---

### QA-02: Billing MTD/YTD (T-02)

**What to Verify:**
- MTD reflects only current calendar month entries
- YTD reflects only current calendar year entries
- Balance = total revenue - total payouts (all-time)

**Edge Cases:**
- First day of new month: MTD = 0, YTD = all previous months this year
- First day of new year: both MTD and YTD = 0
- Empty billing DB: all values = 0

**Bug Hunting:**
- Confirm KV cache key is invalidated when new billing entries are added
- Verify `date('now', 'start of month')` works correctly in D1 SQLite

**Regression:**
- Response shape unchanged: `{ mtd, ytd, balance, lastUpdated }`

**Done Means:**
- MTD and YTD are different values when test data spans months
- Billing page and Dashboard both display correct figures

---

### QA-03: Partner Pagination Count (T-03)

**What to Verify:**
- `GET /partners?status=ACTIVE` returns `total` = count of ACTIVE partners only
- `GET /partners?tier=ENTERPRISE` returns `total` = count of ENTERPRISE partners only
- Unfiltered `GET /partners` returns total count of all partners

**Edge Cases:**
- No partners matching filter: `total: 0, partners: []`
- All partners match filter: total matches list length

**Regression:**
- Pagination still works (correct page/limit/offset math)
- Unfiltered behaviour unchanged

**Done Means:**
- Test: seed 10 ACTIVE, 5 SUSPENDED partners → filtered count = 10

---

### QA-04: Audit Log Path (T-04)

**What to Verify:**
- `GET /audit-log` returns 200 with `{ entries: [], pagination: {} }` envelope
- AuditLog.tsx page renders entries without console errors
- `GET /settings/audit-log` still returns 200 (backward compat)

**Edge Cases:**
- Empty audit log: returns `entries: [], pagination.total: 0`
- Filters: `?action=CREATE_TENANT` returns only matching entries

**Regression:**
- No other frontend page or hook calls the wrong path
- POST /settings/audit-log still writes entries correctly

---

### QA-05: Settings Fix (T-05)

**What to Verify:**
- After `PUT /settings { maintenanceMode: true }`, `GET /settings` returns `maintenanceMode: true`
- A user with `manage:settings` permission (not `write:tenants`) can PUT settings
- A user with only `read:settings` gets 403 on PUT

**Edge Cases:**
- KV write fails: PUT returns 500, GET still returns previous value
- Unknown setting key: allowed through `.passthrough()` in Zod schema

**Regression:**
- All hardcoded defaults are still present when no KV key exists yet

---

### QA-06: Security Headers (T-06)

**What to Verify:**
- All API responses include `Content-Security-Policy` header
- CSP does not block any frontend resources (no console CSP violations)
- `Permissions-Policy` restricts geolocation, microphone, camera
- `X-Frame-Options: DENY` still present (or `frame-ancestors 'none'` in CSP)

**Edge Cases:**
- CORS preflight response (OPTIONS): check if CSP is correctly applied or intentionally skipped
- Error responses (404, 500): must also include security headers

**Tool:** Use `curl -I https://api.webwaka.workers.dev/health` to verify headers

**Done Means:**
- `Content-Security-Policy` appears in every response header
- No CSP violations in browser console when running full app

---

### QA-07: 2FA Backend (T-07)

**What to Verify:**
- `POST /auth/2fa/setup` returns a valid `otpauth://` URI
- QR code URI is parseable by Authenticator apps
- `POST /auth/2fa/verify-setup` rejects invalid codes
- Login with 2FA enabled returns `requires_2fa: true`
- `POST /auth/2fa/validate` with valid code → issues full JWT cookie
- `POST /auth/2fa/validate` with expired code (> 90 seconds old) → rejected

**Edge Cases:**
- Clock drift ± 30 seconds: code should still be accepted
- Wrong session_token: 401
- Expired session_token (> 5 min): 401
- Code reuse: same code cannot be used twice within a window

**Cross-Repo:**
- If `webwaka-commerce-api` shares the RBAC_DB users table, verify migration applies there too

**Done Means:**
- Full 2FA login flow tested end-to-end with a real authenticator app
- Unit tests for TOTP generation and validation

---

### QA-08: JWT Blocklist (T-08)

**What to Verify:**
- After POST /auth/logout, a GET /auth/me with the same cookie returns 401
- jti is present in decoded JWT payload
- New login after logout produces a new jti
- KV TTL matches remaining token lifetime (not fixed 24h)

**Edge Cases:**
- Logout with no valid token: graceful 200 (logout is idempotent)
- KV unavailable: fail open (token still considered valid) — document this behaviour

**Performance:**
- Measure p99 latency of GET /auth/me before and after adding KV lookup
- KV read should add < 5ms

**Done Means:**
- Replaying a logged-out JWT returns 401 within 1 second of logout

---

### QA-09: CI Gates (T-09)

**What to Verify:**
- TypeScript `--noEmit` exits non-zero when type error is introduced
- `pnpm audit --audit-level=high` fails if a high vuln is present
- Clean branch: CI is fully green

**Regression:**
- No legitimate features broken by removing `continue-on-error`

**Done Means:**
- CI blocks merge on type errors
- CI blocks merge on high/critical security vulnerabilities

---

### QA-10: Offline Mutation Replay (T-10)

**What to Verify:**
- Going offline, creating a tenant queues a mutation in Dexie
- Going back online replays the mutation and tenant appears in list
- Failed replay increments retry counter
- Mutations exceeding maxRetries are cleaned up

**Edge Cases:**
- Multiple pending mutations: replay in order (FIFO)
- Server returns 409 Conflict on replay: remove mutation, show toast error
- Browser refresh while offline: mutations still in IndexedDB on reload

**Done Means:**
- End-to-end test: network offline → create tenant → network online → tenant in list

---

### QA-11: Notifications System (T-11)

**What to Verify:**
- NotificationBell shows correct unread count
- Marking as read removes from unread list
- Notifications are per-user (userId-scoped KV keys)
- 7-day TTL on notifications (stale notifications auto-removed)

**Edge Cases:**
- No notifications: bell shows no badge
- 99+ notifications: bell shows "99+" badge
- Notification created for non-existent user: 404 handled gracefully

---

### QA-12: Persistent Settings (T-12)

**What to Verify:**
- PUT → GET round-trip persists all fields
- Default values appear when KV key is absent
- Maintenance mode change reflects in UI immediately after refresh

---

### QA-13: Audit Log Middleware (T-13)

**What to Verify:**
- Every POST/PUT/DELETE that succeeds writes to audit_log
- GET requests do NOT write to audit_log
- Failed requests (4xx, 5xx) do NOT write successful-operation entries
- Auth failures write AUTH_FAIL entry

**Edge Cases:**
- resource_id extraction from URL params: `DELETE /tenants/:id` → resource_id = id
- Middleware error must not break the primary response

---

### QA-14: Command Palette (T-14)

**What to Verify:**
- Cmd+K opens palette on macOS
- Ctrl+K opens palette on Windows/Linux
- Navigation commands route correctly
- Search results appear within 50ms of typing
- Escape closes palette

**Accessibility:**
- Palette is navigable with arrow keys
- Selected item has visible focus ring
- Screen reader announces palette opening

---

### QA-15: CSV/JSON Export (T-15)

**What to Verify:**
- CSV has correct headers
- Kobo amounts formatted as NGN human-readable strings
- JSON is valid and parseable
- Filename includes timestamp

**Edge Cases:**
- Empty dataset: CSV has headers only, JSON is empty array
- 10,000 rows: export completes without browser timeout (may require chunked export)

---

### QA-16: Bulk Operations (T-16)

**What to Verify:**
- Select-all selects all rows on current page
- Deselect-all clears selection
- Bulk suspend shows confirmation with affected names
- Bulk action calls individual PUT for each item

**Edge Cases:**
- Bulk action on 50+ tenants: progress indicator shown
- One tenant fails: continue with others, show partial failure summary

---

### QA-17: Idle Timeout (T-17)

**What to Verify:**
- Warning modal appears at 25 minutes of inactivity
- "Stay Logged In" resets timer
- At 30 minutes: logout + redirect to /login
- Activity (mouse/key/scroll) resets timer

**Edge Cases:**
- Tab in background: still triggers timeout
- Multiple tabs: timeout in one tab should not log out others (per-tab timer)

---

### QA-18: Multi-Currency (T-18)

**What to Verify:**
- `formatAmount(1000, 'GHS')` returns correct GHS formatting
- Billing entries with `currency: 'GHS'` persist and read correctly
- NGN (default) behaviour unchanged

---

### QA-19: Dynamic Feature Flags (T-19)

**What to Verify:**
- Adding new flag definition → appears in UI
- Toggling new flag per tenant → persisted in KV
- Deleting flag definition → flag removed from UI (existing toggle values remain)

---

### QA-20: Cloudflare API Deployments (T-20)

**What to Verify:**
- Deployment refresh calls Cloudflare API (verify via worker logs)
- Returns live worker status
- API error is gracefully handled (stale data + warning)

---

### QA-21: Webhook System (T-21)

**What to Verify:**
- Webhook registered → receives events
- HMAC signature header present and verifiable
- Test event endpoint delivers immediately
- Failed webhook delivery retried 3 times

---

### QA-22: Virtual Scrolling (T-22)

**What to Verify:**
- 1,000-row table renders in < 100ms
- Scrolling is smooth (60fps)
- Row click actions work
- Pagination still works alongside virtualization

---

## 7. IMPLEMENTATION PROMPTS FOR EVERY TASK

---

### IMPL-PROMPT-01: Fix Cryptographically Insecure ID Generation

```
IMPLEMENTATION PROMPT — T-01
Repo: webwaka-super-admin-v2
Target file: workers/src/index.ts

CONTEXT:
You are working on the webwaka-super-admin-v2 repository. This repo is the central 
super-admin control plane for the WebWaka multi-tenant platform ecosystem. The backend 
runs on Cloudflare Workers using Hono framework. This repo is NOT standalone — it 
depends on and integrates with webwaka-commerce-api and other suite repos.

OBJECTIVE:
Replace the `generateId(prefix)` function which uses Math.random() with a 
cryptographically secure implementation using crypto.getRandomValues().

CURRENT IMPLEMENTATION (lines ~304-311 in workers/src/index.ts):
function generateId(prefix: string): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let id = prefix + '-'
  for (let i = 0; i < 12; i++) {
    id += chars[Math.floor(Math.random() * chars.length)]
  }
  return id
}

REQUIRED IMPLEMENTATION:
Replace with:
function generateId(prefix: string): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6))
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
  return `${prefix}-${hex}`
}

DEPENDENCIES: None
ECOSYSTEM CAVEAT: This repo is not standalone. IDs are referenced across multiple 
repos via the Commerce Worker service binding. Keep the prefix-hex format compatible.

IMPORTANT REMINDERS:
- Build Once Use Infinitely: this utility is used across all endpoints
- Nigeria First: financial IDs (billing entries, commissions) must be tamper-resistant
- Do not change the prefix convention
- Cloudflare Workers has native crypto.getRandomValues() — no import needed
- This is a workers/ change only — no frontend changes required

DELIVERABLES:
1. Updated generateId() function in workers/src/index.ts
2. Unit test in workers/src/__tests__/layer2-qa.test.ts verifying format and uniqueness

ACCEPTANCE CRITERIA:
- No Math.random() in generateId
- Format: prefix-[0-9a-f]{12}
- 10,000 calls produce 10,000 unique IDs

GOVERNANCE DOCS TO CONSULT: replit.md (security notes), CODEBASE_INVENTORY.md

AVOID: Do not use crypto.randomUUID() (UUID format is incompatible with existing prefix format)
```

---

### IMPL-PROMPT-02: Fix Billing MTD/YTD Calculation

```
IMPLEMENTATION PROMPT — T-02
Repo: webwaka-super-admin-v2
Target file: workers/src/index.ts

CONTEXT:
You are working on the webwaka-super-admin-v2 repository. This is the Cloudflare Workers 
backend (Hono framework) that manages billing for the WebWaka multi-tenant platform. 
All monetary values are stored as INTEGER KOBO (Nigeria First invariant). This repo is 
NOT standalone.

OBJECTIVE:
Fix the GET /billing/summary endpoint so MTD and YTD are calculated separately with 
correct date filters.

CURRENT IMPLEMENTATION (~line 1878):
The summary query does not filter by date for MTD or YTD — both fields use the same 
aggregate across all ledger entries.

REQUIRED FIX:
Replace the single query with three:
1. MTD query: WHERE entry_type = 'REVENUE' AND created_at >= date('now', 'start of month')
2. YTD query: WHERE entry_type = 'REVENUE' AND created_at >= date('now', 'start of year')  
3. Balance query: total REVENUE - total PAYOUT (all-time, no date filter)

DEPENDENCIES: None
ECOSYSTEM CAVEAT: Billing data may also be read by webwaka-commerce-api via internal 
service calls. The response shape { mtd, ytd, balance, lastUpdated } must not change.

IMPORTANT REMINDERS:
- Nigeria First: All monetary values are integer kobo — no floats
- KV cache must be invalidated after new billing entries (already done via cache key delete)
- D1 SQLite date functions: use date('now', 'start of month') and date('now', 'start of year')
- Cache TTL is 900 seconds for billing summary

DELIVERABLES:
1. Updated GET /billing/summary handler in workers/src/index.ts
2. Verify KV cache invalidation is correct

ACCEPTANCE CRITERIA:
- MTD returns only current month revenue in kobo
- YTD returns only current year revenue in kobo
- Balance = all-time revenue minus all-time payouts

AVOID: Do not break the response envelope shape. Do not introduce floating-point math.
```

---

### IMPL-PROMPT-03: Fix Partner Pagination Count

```
IMPLEMENTATION PROMPT — T-03
Repo: webwaka-super-admin-v2
Target file: workers/src/index.ts

CONTEXT:
You are working on the webwaka-super-admin-v2 Cloudflare Workers API. The GET /partners 
endpoint supports filtering by status and tier but the COUNT query ignores these filters.

OBJECTIVE:
Fix the partner count query to apply the same status/tier filters as the list query.

CURRENT IMPLEMENTATION (~lines 1004-1038):
The count query is:
  SELECT COUNT(*) as total FROM partners
This ignores status and tier filters applied to the list query.

REQUIRED FIX:
Build the count query with the same WHERE conditions as the list query:
  let countQuery = 'SELECT COUNT(*) as total FROM partners WHERE 1=1'
  const countParams: any[] = []
  if (status) { countQuery += ' AND status = ?'; countParams.push(status) }
  if (tier)   { countQuery += ' AND tier = ?';   countParams.push(tier)   }

DEPENDENCIES: None
ECOSYSTEM CAVEAT: The PartnerManagement frontend page depends on this pagination total 
for page count calculation. Fixing this may change the visible page count in the UI.

IMPORTANT REMINDERS:
- Multi-Tenant: ensure the query does not inadvertently expose partners from other tenants
- The existing test in workers/src/__tests__/layer2-qa.test.ts should be updated

DELIVERABLES:
1. Updated GET /partners handler count query
2. Unit test verifying filtered count equals filtered list length
```

---

### IMPL-PROMPT-04: Fix Audit Log Endpoint Path Inconsistency

```
IMPLEMENTATION PROMPT — T-04
Repo: webwaka-super-admin-v2
Files: workers/src/index.ts, frontend/src/lib/api.ts

CONTEXT:
The webwaka-super-admin-v2 has a path mismatch: the frontend AuditLog page calls 
GET /audit-log but the backend registers the handler at GET /settings/audit-log.

OBJECTIVE:
Register GET /audit-log as the canonical path and ensure backward compat with 
/settings/audit-log.

REQUIRED CHANGE:
Option A (preferred): Add a second route registration:
  app.get('/audit-log', async (c) => { /* same handler as /settings/audit-log */ })

Option B: Keep /settings/audit-log and update frontend to use /settings/audit-log path.

Use Option A (do not break existing path, add the new canonical path).

VERIFY in frontend/src/lib/api.ts:
  getAuditLog() calls '/audit-log?' — this is already correct. The fix is backend-only.

DELIVERABLES:
1. New GET /audit-log route in workers/src/index.ts (same handler, avoid duplication — extract to named function)
2. Smoke test: curl GET /audit-log returns 200 with correct envelope
3. Smoke test: AuditLog page loads without 404 errors
```

---

### IMPL-PROMPT-05: Fix Settings Hardcoded GET and Wrong Permission

```
IMPLEMENTATION PROMPT — T-05
Repo: webwaka-super-admin-v2
Target file: workers/src/index.ts

CONTEXT:
Two bugs in the Settings endpoints:
1. GET /settings returns hardcoded JSON, ignoring any KV-persisted settings
2. PUT /settings uses requirePermission 'write:tenants' but should use 'manage:settings'

OBJECTIVE:
(a) Make GET /settings read from FEATURE_FLAGS_KV key 'platform:settings', merge with defaults
(b) Fix PUT /settings to use requirePermission(c, 'manage:settings')

REQUIRED FIX for GET (~line 2011):
  const raw = await c.env.FEATURE_FLAGS_KV.get('platform:settings')
  const stored = raw ? JSON.parse(raw) : {}
  const defaults = { apiRateLimit: 1000, sessionTimeout: 3600, maintenanceMode: false, maxTenantCount: 10000, ... }
  return c.json(apiResponse(true, { ...defaults, ...stored }))

REQUIRED FIX for PUT (~line 2039):
  Change: await requirePermission(c, 'write:tenants')
  To:     await requirePermission(c, 'manage:settings')

DELIVERABLES:
1. Updated GET /settings handler
2. Updated PUT /settings permission check
3. Round-trip integration test: PUT { maintenanceMode: true } then GET returns { maintenanceMode: true }
```

---

### IMPL-PROMPT-06: Add Content-Security-Policy and Missing Security Headers

```
IMPLEMENTATION PROMPT — T-06
Repo: webwaka-super-admin-v2
Target file: workers/src/index.ts

CONTEXT:
The security middleware (~line 112) sets 4 headers but is missing Content-Security-Policy,
Permissions-Policy, and Cross-Origin-Resource-Policy. This is an OWASP compliance gap.

OBJECTIVE:
Add the missing security headers to the existing security header middleware.

REQUIRED ADDITIONS:
In the security headers middleware (after existing c.res.headers.set calls):

  c.res.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline'; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: https:; " +
    "connect-src 'self' https://*.webwaka.workers.dev https://*.webwaka.app wss:; " +
    "font-src 'self'; " +
    "frame-ancestors 'none'; " +
    "object-src 'none';"
  )
  c.res.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()')
  c.res.headers.set('Cross-Origin-Resource-Policy', 'same-origin')

NOTE: 'unsafe-inline' is required for Tailwind CSS v4 inline styles in the SPA frontend.
Document this in a code comment.

DELIVERABLES:
1. Updated security header middleware
2. Curl verification showing all headers present
3. Browser test: no CSP violations in console with the full React app running
```

---

### IMPL-PROMPT-07: Implement 2FA Backend (TOTP)

```
IMPLEMENTATION PROMPT — T-07
Repo: webwaka-super-admin-v2
Target files: workers/src/index.ts, workers/migrations/013_add_totp.sql

CONTEXT:
The frontend has full 2FA UI (TwoFactorSetup.tsx, loginWithTotp in AuthContext, OTP input).
The backend has no TOTP implementation. Login does not check totp_enabled. This is a 
security gap — 2FA is a UI illusion. The RBAC_DB users table needs totp_secret and 
totp_enabled columns.

OBJECTIVE:
Implement complete TOTP 2FA backend: setup, verify-setup, validate (during login), 
status, and disable endpoints. Also update the login flow to issue a session_token 
when the user has 2FA enabled.

ECOSYSTEM CAVEAT: RBAC_DB is shared with the RBAC layer. The migration must be 
idempotent (IF NOT EXISTS). Do not break existing login flow for users without 2FA.

ALGORITHM:
- TOTP uses HMAC-SHA1 (RFC 6238) with 30-second time steps
- Secret is 20 random bytes, base32-encoded for human readability
- QR URI: otpauth://totp/WebWaka%20Admin:{email}?secret={base32secret}&issuer=WebWaka&algorithm=SHA1&digits=6&period=30

REQUIRED ENDPOINTS:
1. GET  /auth/2fa/status      — { enabled: bool }
2. POST /auth/2fa/setup       — generate secret, return { qrUri, secret }
3. POST /auth/2fa/verify-setup — verify first code, set totp_enabled = 1
4. POST /auth/2fa/validate    — during login, exchange session_token + code for JWT cookie
5. POST /auth/2fa/disable     — verify code, set totp_enabled = 0, clear totp_secret

LOGIN FLOW CHANGE:
After password verification: if totp_enabled = 1, do NOT issue JWT cookie yet.
Instead: store session_token (random 32 bytes hex) in SESSIONS_KV with 5-min TTL + user info,
return { requires_2fa: true, session_token }.
Frontend then calls POST /auth/2fa/validate with the session_token + TOTP code.
On success: issue JWT cookie as normal.

MIGRATION (013_add_totp.sql):
ALTER TABLE users ADD COLUMN totp_secret TEXT;
ALTER TABLE users ADD COLUMN totp_enabled INTEGER NOT NULL DEFAULT 0;

IMPORTANT REMINDERS:
- TOTP clock drift: accept codes from current window ± 1 window (90-second total validity)
- Timing-safe comparison for TOTP codes (already have the pattern from password.ts)
- Session tokens must be single-use — delete from KV after successful validation
- Cloudflare Workers runtime: no Node.js crypto — use Web Crypto API (HMAC-SHA1)
- The TOTP secret must be securely stored (encrypted-at-rest via D1 server-side encryption)

DELIVERABLES:
1. All 5 2FA endpoints in workers/src/index.ts
2. Updated /auth/login to detect totp_enabled
3. Migration file 013_add_totp.sql
4. Unit tests for TOTP generation and time-window validation
```

---

### IMPL-PROMPT-08: JWT jti Blocklist

```
IMPLEMENTATION PROMPT — T-08
Repo: webwaka-super-admin-v2
Target file: workers/src/index.ts

CONTEXT:
Currently logout clears the HttpOnly cookie but the JWT remains cryptographically 
valid for 24 hours. SESSIONS_KV is bound but unused. This task adds a jti (JWT ID) 
claim and blocklist to enable true logout token revocation.

OBJECTIVE:
1. Add jti claim to every signed JWT (random 16-byte hex)
2. On POST /auth/logout: store jti in SESSIONS_KV with TTL = remaining token lifetime
3. In getAuthPayload: after JWT verification, check SESSIONS_KV for jti; if found, return null

REQUIRED CHANGES:
In signJWT():
  const jti = Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b => b.toString(16).padStart(2,'0')).join('')
  fullPayload includes: { ...payload, jti, iat, exp }

In getAuthPayload():
  After verifyJWT() succeeds:
    const blocked = await c.env.SESSIONS_KV.get(`blocklist:${payload.jti}`)
    if (blocked) return null

In POST /auth/logout:
  const payload = await getAuthPayload(c)
  if (payload?.jti && payload?.exp) {
    const ttl = Math.max(1, payload.exp - Math.floor(Date.now() / 1000))
    await c.env.SESSIONS_KV.put(`blocklist:${payload.jti}`, '1', { expirationTtl: ttl })
  }

IMPORTANT REMINDERS:
- KV is eventually consistent: there's a small window (< 60s) where a jti may not be globally blocked
- This is acceptable — document the trade-off
- POST /auth/refresh must issue a new JWT with a new jti (invalidating the old one's cookie)
- Do not break existing auth flow for clients using Bearer token fallback

DELIVERABLES:
1. Updated signJWT, getAuthPayload, POST /auth/logout in workers/src/index.ts
2. Integration test: logout → replay → 401
```

---

### IMPL-PROMPT-09: Fix CI Gates

```
IMPLEMENTATION PROMPT — T-09
Repo: webwaka-super-admin-v2
Target file: .github/workflows/ci.yml

CONTEXT:
The CI pipeline has continue-on-error: true on the TypeScript type-check step and the 
security audit steps. This means the pipeline passes even with type errors or known 
high/critical vulnerabilities. This is a governance failure.

OBJECTIVE:
1. Remove continue-on-error: true from the TypeScript type-check step
2. Remove continue-on-error: true from the pnpm audit steps
3. Fix all existing TypeScript errors that are revealed
4. Ensure pnpm audit passes at --audit-level=high

FIRST STEP — Discover errors:
  Run: pnpm tsc --noEmit (in frontend/ and workers/)
  Run: pnpm audit --audit-level=high (in frontend/ and workers/)
  
Fix all TypeScript errors found before removing continue-on-error.
Update vulnerable packages if any high/critical issues found.

IMPORTANT REMINDERS:
- CI/CD Native Development: the CI must be a reliable gate, not a rubber stamp
- Do not simply suppress errors with @ts-ignore without understanding them
- Each type error must be genuinely fixed
- If a dep has no fix yet, add an override or document in PR

DELIVERABLES:
1. Updated .github/workflows/ci.yml with no continue-on-error on type-check and audit
2. All TypeScript errors fixed
3. pnpm audit passes at high level
4. CI green on a clean branch
```

---

### IMPL-PROMPT-10: Automatic Offline Mutation Replay

```
IMPLEMENTATION PROMPT — T-10
Repo: webwaka-super-admin-v2
Target files: frontend/src/hooks/useOfflineSync.ts (new), frontend/src/App.tsx

CONTEXT:
The pending mutation queue in Dexie (frontend/src/lib/db.ts) stores failed requests 
during offline periods. The functions getPendingMutations, removePendingMutation, and 
incrementMutationRetry exist. However, nothing automatically replays these mutations 
when connectivity is restored. This breaks the "Offline First" core invariant.

OBJECTIVE:
Create a useOfflineSync hook that listens for the browser online event and replays 
all pending mutations in FIFO order. Integrate it at the app root level.

REQUIRED IMPLEMENTATION:
// frontend/src/hooks/useOfflineSync.ts
import { useEffect } from 'react'
import { getPendingMutations, removePendingMutation, incrementMutationRetry } from '@/lib/db'
import { toast } from 'sonner'

export function useOfflineSync() {
  useEffect(() => {
    const handleOnline = async () => {
      const mutations = await getPendingMutations()
      if (mutations.length === 0) return
      
      toast.info(`Syncing ${mutations.length} pending action(s)...`)
      
      let succeeded = 0
      let failed = 0
      
      for (const mutation of mutations) {
        if (mutation.retries >= mutation.maxRetries) {
          await removePendingMutation(mutation.id!)
          failed++
          continue
        }
        try {
          const res = await fetch(mutation.url, {
            method: mutation.method,
            headers: mutation.headers,
            body: mutation.body,
            credentials: 'include',
          })
          if (res.ok) {
            await removePendingMutation(mutation.id!)
            succeeded++
          } else {
            await incrementMutationRetry(mutation.id!)
            failed++
          }
        } catch {
          await incrementMutationRetry(mutation.id!)
          failed++
        }
      }
      
      if (succeeded > 0) toast.success(`${succeeded} action(s) synced successfully`)
      if (failed > 0) toast.error(`${failed} action(s) failed to sync`)
    }
    
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [])
}

In frontend/src/App.tsx, call useOfflineSync() inside AppRouter or the top-level App component.

IMPORTANT REMINDERS:
- Offline First: this hook is the critical bridge between Dexie queue and actual API
- PWA First: test with Chrome DevTools → Network → Offline
- Mutations include credentials: 'include' to send the HttpOnly cookie
- FIFO order: getPendingMutations returns by timestamp — maintain order

DELIVERABLES:
1. frontend/src/hooks/useOfflineSync.ts
2. Integration into frontend/src/App.tsx
3. Unit test verifying replay on 'online' event
```

---

### IMPL-PROMPT-11: Implement Notifications System

```
IMPLEMENTATION PROMPT — T-11
Repo: webwaka-super-admin-v2
Target files: workers/src/index.ts, frontend/src/hooks/useNotifications.ts, 
             frontend/src/components/NotificationBell.tsx

CONTEXT:
NOTIFICATIONS_KV is bound to the Workers runtime but completely unused. The NotificationBell 
component renders but has no data. This task implements a full end-to-end notification system.

OBJECTIVE:
1. Add notification CRUD endpoints to the Workers API
2. Implement polling in the existing useNotifications hook
3. Wire up NotificationBell to show real notifications

KV SCHEMA:
  Key:   notif:{userId}:{notifId}
  Value: JSON { id, type, title, message, severity: 'info'|'warning'|'critical', createdAt, readAt }
  TTL:   604800 (7 days)

BACKEND ENDPOINTS TO ADD:
  GET    /notifications                — list all notifs for current user (from KV prefix scan)
  POST   /notifications                — create notif (admin-to-admin, or system event)
  PATCH  /notifications/:id/read       — set readAt = now
  DELETE /notifications/:id            — remove from KV

FRONTEND (useNotifications.ts):
  Poll GET /notifications every 30 seconds
  Expose: { notifications, unreadCount, markAsRead, dismiss }

FRONTEND (NotificationBell.tsx):
  Show badge with unreadCount
  Dropdown list of notifications with severity icons
  "Mark all as read" button

IMPORTANT REMINDERS:
- Nigeria First: notification messages must support all 4 locale strings (en/yo/ig/ha)
- Multi-Tenant: notifications are scoped per userId from JWT — never leak across users
- The KV prefix scan (list()) returns up to 1000 keys — filter client-side by userId prefix
- Governance: any system alert that creates a notification must also write to audit_log

DELIVERABLES:
1. Notification endpoints in workers/src/index.ts
2. Updated frontend/src/hooks/useNotifications.ts
3. Updated frontend/src/components/NotificationBell.tsx
4. Unit test: GET /notifications returns correct unread count
```

---

### IMPL-PROMPT-12: Persistent Settings

```
IMPLEMENTATION PROMPT — T-12
Repo: webwaka-super-admin-v2
Target file: workers/src/index.ts

CONTEXT:
Depends on T-05 being implemented first. T-05 fixes the permission bug and the 
hardcoded GET. This task adds the full round-trip test and ensures the Settings page 
UI reflects persisted settings.

OBJECTIVE:
Verify and finalize the end-to-end persistent settings flow. Add a Zod validation step 
in GET /settings that merges KV-stored settings with defaults and validates the merged 
object. Add a maintenance mode banner to the Dashboard if maintenanceMode is true.

DELIVERABLES:
1. Validation of merged settings object in GET /settings
2. Maintenance mode banner in frontend/src/pages/Dashboard.tsx when maintenanceMode: true
3. Integration test: PUT then GET round-trip
```

---

### IMPL-PROMPT-13: Server-Side Audit Logging Middleware

```
IMPLEMENTATION PROMPT — T-13
Repo: webwaka-super-admin-v2
Target file: workers/src/index.ts

CONTEXT:
Audit logging is currently opt-in at call sites. Many sensitive operations (partner 
updates, billing entries, settings changes, module toggles, auth failures) produce 
no audit trail. This is an NDPR compliance gap.

OBJECTIVE:
Add a Hono middleware that automatically writes to the RBAC_DB audit_log table for 
all state-changing requests that succeed.

REQUIRED MIDDLEWARE:
Place after the CORS and security headers middleware, before route handlers:

app.use('*', async (c, next) => {
  await next()
  
  const method = c.req.method
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return
  if (c.res.status < 200 || c.res.status >= 300) return
  
  // Skip audit-log endpoint itself to avoid recursion
  const path = new URL(c.req.url).pathname
  if (path.includes('/audit-log') || path.includes('/settings/audit-log')) return
  
  try {
    const payload = await getAuthPayload(c)
    const userId = payload?.sub || 'anonymous'
    const ip = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown'
    const resourceType = path.split('/').filter(Boolean)[0] || 'unknown'
    const resourceId = path.split('/').filter(Boolean)[1] || null
    const action = `${method}_${resourceType.toUpperCase()}`
    const id = generateId('al')
    
    await c.env.RBAC_DB.prepare(
      'INSERT INTO audit_log (id, user_id, action, resource_type, resource_id, ip_address, created_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)'
    ).bind(id, userId, action, resourceType, resourceId, ip).run()
  } catch (err) {
    // Audit log failure must NEVER block the primary response
    console.error('Audit log write failed:', err)
  }
})

IMPORTANT REMINDERS:
- Thoroughness Over Speed: the middleware must not block or throw for the primary response
- Nigeria First / NDPR: auth failure events (failed logins) must also be logged
- Multi-Tenant: resource_id from URL helps identify which tenant/partner was affected
- Add auth failure logging separately in the POST /auth/login handler

DELIVERABLES:
1. Audit middleware in workers/src/index.ts
2. AUTH_FAIL logging in POST /auth/login handler
3. Integration tests verifying audit entries for POST /partners, DELETE /tenants/:id
```

---

### IMPL-PROMPT-14: Global Command Palette

```
IMPLEMENTATION PROMPT — T-14
Repo: webwaka-super-admin-v2
Target files: frontend/src/components/CommandPalette.tsx (new), 
             frontend/src/components/DashboardLayout.tsx

CONTEXT:
cmdk is already installed (package.json). The admin dashboard has 13 routes and 
potentially hundreds of tenants. Power users need keyboard-first navigation.
The command palette should integrate with the existing Wouter router and tenant list from TenantContext.

OBJECTIVE:
Build a command palette component using cmdk that opens on Cmd+K / Ctrl+K.

COMMANDS TO INCLUDE:
Navigation: Dashboard, Tenants, Billing, Modules, Health, Analytics, Settings, Partners, 
            Operations, Deployments, Feature Flags, Audit Log
Actions: Create Tenant, Export Data, Toggle Dark Mode, Logout
Dynamic: Search tenants by name (from TenantContext.tenants)

IMPLEMENTATION:
Use shadcn/ui Command component (which wraps cmdk). 
The existing frontend/src/components/ui/command.tsx is already the shadcn Command wrapper.

// CommandPalette.tsx
import { Command, CommandDialog, CommandInput, CommandList, CommandItem, CommandGroup } from '@/components/ui/command'
import { useLocation } from 'wouter'
import { useTenant } from '@/contexts/TenantContext'
import { useTranslation } from '@/hooks/useTranslation'

// Register global keyboard handler in DashboardLayout.tsx:
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault()
      setOpen(true)
    }
  }
  document.addEventListener('keydown', handler)
  return () => document.removeEventListener('keydown', handler)
}, [])

IMPORTANT REMINDERS:
- Mobile First: on mobile, the palette can be triggered by a floating search button
- Nigeria First: all command labels must use the useTranslation hook for i18n
- PWA First: the command palette should work offline (navigation works, data commands may fail)
- Accessibility: use CommandDialog which manages aria attributes

DELIVERABLES:
1. frontend/src/components/CommandPalette.tsx
2. Integration in DashboardLayout.tsx with Cmd+K listener
3. All navigation commands working with Wouter hash routing
4. Tenant search working from TenantContext
```

---

### IMPL-PROMPT-15: CSV/JSON Export

```
IMPLEMENTATION PROMPT — T-15
Repo: webwaka-super-admin-v2
Target files: frontend/src/lib/export.ts (new), 
             frontend/src/pages/TenantManagement.tsx,
             frontend/src/pages/Billing.tsx,
             frontend/src/pages/AuditLog.tsx,
             frontend/src/pages/PartnerManagement.tsx

CONTEXT:
No data export functionality exists. Operators need to extract data for reporting, 
compliance, and accounting purposes.

OBJECTIVE:
Create a shared export utility and add Export dropdown buttons to data tables.

EXPORT UTILITY (frontend/src/lib/export.ts):
export function exportToCSV(data: Record<string, unknown>[], filename: string): void {
  if (data.length === 0) return
  const headers = Object.keys(data[0])
  const rows = data.map(row => headers.map(h => {
    const val = row[h]
    if (typeof val === 'string' && val.includes(',')) return `"${val.replace(/"/g, '""')}"`
    return String(val ?? '')
  }).join(','))
  const csv = [headers.join(','), ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `${filename}-${new Date().toISOString().split('T')[0]}.csv`
  link.click()
}

export function exportToJSON(data: Record<string, unknown>[], filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `${filename}-${new Date().toISOString().split('T')[0]}.json`
  link.click()
}

IMPORTANT REMINDERS:
- Nigeria First: kobo amounts must be formatted as NGN display values in CSV exports
  (use formatKoboAsNGN from lib/commissionCalculator.ts)
- Multi-Tenant: export only data visible to the current user's permissions
- Do not export password hashes, TOTP secrets, or API key plaintext values

DELIVERABLES:
1. frontend/src/lib/export.ts
2. Export button in TenantManagement, Billing, AuditLog, PartnerManagement
3. Unit test: exportToCSV with kobo amounts produces NGN-formatted CSV
```

---

### IMPL-PROMPT-16: Bulk Operations for Tenants and Partners

```
IMPLEMENTATION PROMPT — T-16
Repo: webwaka-super-admin-v2
Target files: frontend/src/pages/TenantManagement.tsx, 
             frontend/src/pages/PartnerManagement.tsx,
             frontend/src/components/BulkActionBar.tsx (new)

CONTEXT:
Managing 100+ tenants/partners one-by-one is inefficient. This task adds multi-select 
and bulk operations to the two main management pages.

OBJECTIVE:
Add row checkboxes, a BulkActionBar component (shown when selection > 0), and bulk 
suspend/activate/export actions. Bulk actions make individual API calls with a progress counter.

REQUIRED STATE:
const [selected, setSelected] = useState<Set<string>>(new Set())
const toggleAll = () => selected.size === items.length 
  ? setSelected(new Set()) 
  : setSelected(new Set(items.map(i => i.id)))

BULK ACTION BAR:
// BulkActionBar.tsx
- Shows "X selected" count
- Buttons: Suspend All, Activate All, Export Selected
- Suspend All: opens AlertDialog listing tenant names, requires typed "CONFIRM" to proceed
- Each action runs sequentially with a progress counter toast

IMPORTANT REMINDERS:
- Multi-Tenant: bulk operations must respect VALID_TRANSITIONS (from TenantContext)
- Governance: each individual PUT call triggers the audit middleware (T-13)
- UI consistency: use existing shadcn components (Checkbox, AlertDialog, Button)
- Mobile First: BulkActionBar stacks vertically on mobile

DELIVERABLES:
1. frontend/src/components/BulkActionBar.tsx
2. Multi-select UI in TenantManagement.tsx and PartnerManagement.tsx
3. Bulk suspend/activate integration with TenantContext.updateTenant
```

---

### IMPL-PROMPT-17: Session Idle Timeout

```
IMPLEMENTATION PROMPT — T-17
Repo: webwaka-super-admin-v2
Target files: frontend/src/hooks/useIdleTimeout.ts (new),
             frontend/src/components/IdleWarningModal.tsx (new),
             frontend/src/App.tsx

CONTEXT:
Admin sessions on shared devices have no idle timeout. An unattended browser could 
give full super-admin access indefinitely. This task implements a 25-minute warning 
followed by 5-minute forced logout.

OBJECTIVE:
Build useIdleTimeout hook tracking user activity, IdleWarningModal for the warning,
and integrate into the App level.

IMPLEMENTATION:
// useIdleTimeout.ts
const IDLE_WARNING_MS = 25 * 60 * 1000  // 25 minutes
const IDLE_LOGOUT_MS  = 30 * 60 * 1000  // 30 minutes

Events to track: 'mousemove', 'keydown', 'click', 'scroll', 'touchstart'

const reset = useCallback(() => {
  lastActivity.current = Date.now()
  clearWarning()
}, [])

useEffect(() => {
  const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart']
  events.forEach(e => window.addEventListener(e, reset, { passive: true }))
  
  const interval = setInterval(() => {
    const idle = Date.now() - lastActivity.current
    if (idle >= IDLE_LOGOUT_MS) { logout(); clearInterval(interval) }
    else if (idle >= IDLE_WARNING_MS) { setShowWarning(true) }
  }, 10_000) // check every 10 seconds
  
  return () => {
    events.forEach(e => window.removeEventListener(e, reset))
    clearInterval(interval)
  }
}, [logout, reset])

// IdleWarningModal.tsx
Shows countdown from 5:00 to 0:00, "Stay Logged In" button resets timer

IMPORTANT REMINDERS:
- Only activate when isAuthenticated === true (check from AuthContext)
- Mobile First: touchstart event must also reset the timer
- The warning modal must be accessible (focus trap, screen reader announcement)

DELIVERABLES:
1. frontend/src/hooks/useIdleTimeout.ts
2. frontend/src/components/IdleWarningModal.tsx
3. Integration in frontend/src/App.tsx
```

---

### IMPL-PROMPT-18: Multi-Currency Billing Support

```
IMPLEMENTATION PROMPT — T-18
Repo: webwaka-super-admin-v2
Target files: workers/src/index.ts, frontend/src/lib/commissionCalculator.ts,
             frontend/src/i18n/index.ts

CONTEXT:
WebWaka is Africa-ready by design but billing is hardcoded to NGN/kobo. 
Expansion to Ghana, Kenya, South Africa, and Francophone West Africa requires 
multi-currency support.

OBJECTIVE:
Add optional currency field to billing entries, extend formatKobo to support 
multiple currencies.

BACKEND (workers/src/index.ts):
Extend BillingEntrySchema:
  currency: z.enum(['NGN', 'GHS', 'KES', 'ZAR', 'XOF']).optional().default('NGN')
Add currency column to the INSERT if provided.

FRONTEND (i18n/index.ts):
Rename formatKobo to formatAmount, add currency parameter:
export function formatAmount(amount: number, currency: 'NGN'|'GHS'|'KES'|'ZAR'|'XOF' = 'NGN', locale?: SupportedLocale): string

Currency config:
  NGN: symbol ₦, subunit kobo (100 kobo = ₦1)
  GHS: symbol GH₵, subunit pesewa (100 pesewa = GH₵1)
  KES: symbol KSh, subunit cent (100 cent = KSh1)
  ZAR: symbol R, subunit cent (100 cent = R1)
  XOF: symbol CFA, 1 CFA = 1 unit (no subunit — but store in units for consistency)

IMPORTANT REMINDERS:
- Nigeria First: NGN remains the default; this is additive, not a replacement
- Build Once Use Infinitely: formatAmount should be in a shared location, usable by all pages
- Do not break existing formatKobo callers — provide backward-compatible alias

DELIVERABLES:
1. Extended BillingEntrySchema in workers/src/index.ts
2. formatAmount function in frontend/src/i18n/index.ts
3. backward-compatible formatKobo alias
4. Unit tests for each currency format
```

---

### IMPL-PROMPT-19: Dynamic Feature Flags

```
IMPLEMENTATION PROMPT — T-19
Repo: webwaka-super-admin-v2
Target files: workers/src/index.ts, frontend/src/pages/FeatureFlagManager.tsx

CONTEXT:
Feature flags are hardcoded to exactly 4 flags in the Zod schema. Adding a new flag 
requires backend code change + deployment. A dynamic system allows new flags to be 
created via the admin UI.

OBJECTIVE:
Add flag definition management endpoints and update the FeatureFlagManager UI to 
render dynamic flag definitions from the API.

BACKEND ENDPOINTS:
GET  /feature-flag-definitions        — list all flag definitions from KV
POST /feature-flag-definitions        — create a flag definition { key, label, description, defaultValue }
DELETE /feature-flag-definitions/:key — remove a flag definition

KV KEY: platform:flag-definitions
VALUE: JSON array of { key, label, description, defaultValue, createdAt, createdBy }

FRONTEND:
FeatureFlagManager.tsx should fetch /feature-flag-definitions and render 
checkboxes dynamically, instead of hardcoded 4-flag layout.
The existing 4 flags (advanced_analytics, ai_recommendations, multi_currency, offline_mode)
become the default definitions in KV on first run.

IMPORTANT REMINDERS:
- Governance-Driven Execution: flag definitions are a governance document — log creation/deletion
- Multi-Tenant: flag definitions are platform-wide; per-tenant values are in FEATURE_FLAGS_KV per tenant

DELIVERABLES:
1. Three new endpoints in workers/src/index.ts
2. Updated FeatureFlagManager.tsx with dynamic rendering
3. Default flag seeding on first GET (if KV key absent, seed with 4 existing flags)
```

---

### IMPL-PROMPT-20: Real Cloudflare API Deployment Refresh

```
IMPLEMENTATION PROMPT — T-20
Repo: webwaka-super-admin-v2
Target file: workers/src/index.ts

CONTEXT:
POST /deployments/refresh is mocked. It returns the same static data regardless of 
actual Cloudflare deployment state. Operators cannot see live deployment health.

OBJECTIVE:
Call the real Cloudflare REST API for Workers and Pages status. Requires 
CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID environment variables.

IMPLEMENTATION:
In POST /deployments/refresh:

const accountId = c.env.CLOUDFLARE_ACCOUNT_ID
const apiToken = c.env.CLOUDFLARE_API_TOKEN

if (!accountId || !apiToken) {
  // Fallback: return stale data from DB with a warning
  return c.json(apiResponse(true, { warning: 'Cloudflare API not configured', ... }))
}

const [workersRes, pagesRes] = await Promise.allSettled([
  fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts`, {
    headers: { 'Authorization': `Bearer ${apiToken}` }
  }),
  fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects`, {
    headers: { 'Authorization': `Bearer ${apiToken}` }
  })
])

// Map Cloudflare API response to deployments table update

IMPORTANT REMINDERS:
- Cloudflare-First: use Cloudflare REST API, not external scraping
- Secrets must be set via wrangler secret put CLOUDFLARE_API_TOKEN
- Fail gracefully: if API call fails, return stale data with a 'stale: true' flag
- Do not log the API token — only log the account ID and response status

DELIVERABLES:
1. Updated POST /deployments/refresh in workers/src/index.ts
2. Graceful fallback for missing credentials
3. wrangler.toml documentation update for required env vars
```

---

### IMPL-PROMPT-21: Outbound Webhook System

```
IMPLEMENTATION PROMPT — T-21
Repo: webwaka-super-admin-v2
Target files: workers/src/index.ts, workers/wrangler.toml, workers/migrations/014_webhooks.sql

CONTEXT:
Tenant operators need to receive real-time events from the platform. Without webhooks,
they must poll — which is inefficient. This is a Phase 2 feature requiring Cloudflare Queues.

OBJECTIVE:
Build a webhook management and delivery system.

MIGRATION (014_webhooks.sql):
CREATE TABLE IF NOT EXISTS tenant_webhooks (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  url TEXT NOT NULL,
  events TEXT NOT NULL, -- JSON array of event types
  secret TEXT NOT NULL, -- HMAC signing secret (never expose in GET response)
  active INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ENDPOINTS:
GET    /tenants/:id/webhooks        — list (never expose secret field)
POST   /tenants/:id/webhooks        — register { url, events: ['tenant.suspended', ...] }
DELETE /tenants/:id/webhooks/:wid   — unregister
POST   /tenants/:id/webhooks/:wid/test — deliver test event { type: 'test', timestamp }

DELIVERY:
When a webhook-triggering event occurs (tenant status change, module toggle, billing threshold):
  1. Look up webhooks for tenant with matching event type
  2. Build payload: { event, tenant_id, timestamp, data }
  3. Sign with HMAC-SHA256: X-WebWaka-Signature: sha256={hex}
  4. POST to webhook URL with 5-second timeout
  5. Log delivery result to audit_log

IMPORTANT REMINDERS:
- Build Once Use Infinitely: webhook delivery logic should be a reusable function
- Event-Driven: this is the foundation of the WebWaka event-driven architecture
- Security: HMAC signature uses the per-webhook secret, never the JWT secret
- Retry: failed deliveries should be retried (implement basic retry with backoff)
```

---

### IMPL-PROMPT-22: Virtual Scrolling for Billing and Audit Log

```
IMPLEMENTATION PROMPT — T-22
Repo: webwaka-super-admin-v2
Target files: frontend/src/pages/Billing.tsx, frontend/src/pages/AuditLog.tsx

CONTEXT:
@tanstack/react-virtual is already installed. TenantManagement already uses useVirtualizer.
Billing ledger and Audit Log can have thousands of entries and currently render all of 
them, causing performance lag.

OBJECTIVE:
Apply useVirtualizer to the Billing ledger table and Audit Log table, matching the 
pattern from TenantManagement.tsx.

REFERENCE PATTERN (from TenantManagement.tsx):
  const parentRef = useRef<HTMLDivElement>(null)
  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56,
    overscan: 10,
  })

Apply the same pattern to:
- Billing.tsx: billing ledger entries table
- AuditLog.tsx: audit log entries table

IMPORTANT REMINDERS:
- Mobile First: test on low-memory Android (emulate in DevTools)
- Row click actions (view detail, copy ID) must work correctly with virtualization
- Virtualization works alongside server-side pagination — combine both

DELIVERABLES:
1. Virtualizer applied to Billing.tsx ledger table
2. Virtualizer applied to AuditLog.tsx entries table
3. Performance test: 1,000 rows render in < 100ms
```

---

## 8. QA PROMPTS FOR EVERY TASK

---

### QA-PROMPT-01: QA for ID Generation Fix

```
QA PROMPT — T-01
Repo: webwaka-super-admin-v2

CONTEXT:
T-01 replaced Math.random() in generateId() with crypto.getRandomValues(). 
You are the QA agent for this change. The repo is NOT standalone — it integrates 
with webwaka-commerce-api via service binding.

OBJECTIVE:
Verify the new generateId() function is cryptographically secure, correct in format,
and that all existing endpoints still function correctly.

WHAT TO TEST:
1. Format: generate 100 IDs with prefix 'tenant' — all must match regex /^tenant-[0-9a-f]{12}$/
2. Uniqueness: generate 10,000 IDs — collision rate must be 0
3. Security: no Math.random call exists in generateId (grep the file)
4. Endpoint smoke tests: POST /tenants, POST /partners, POST /billing/entry — all return valid IDs
5. Existing records: IDs in TENANTS_DB are not affected by this change (read-only test)

EDGE CASES:
- generateId called from concurrent requests — no race conditions
- generateId called during Worker cold start — still works

REGRESSIONS TO CATCH:
- Any endpoint that returns an ID now uses the new 12-char hex format
- No endpoint suddenly returns undefined or null ID

CROSS-REPO:
- If Commerce Worker creates records with IDs from this API, verify format is still compatible

DEPLOYMENT CHECK:
- Deploy to staging first
- After deploy: create one tenant, one partner, one billing entry — verify ID format

DONE MEANS:
- Zero Math.random calls in generateId
- 100% unique IDs in 10,000 sample
- All existing endpoint integration tests pass
- Staging smoke test green
```

---

### QA-PROMPT-02: QA for Billing MTD/YTD Fix

```
QA PROMPT — T-02
Repo: webwaka-super-admin-v2

CONTEXT:
T-02 fixed GET /billing/summary to separately calculate MTD and YTD.

WHAT TO TEST:
1. Seed billing_db with: 3 REVENUE entries in January, 2 in March, 1 today (April)
2. GET /billing/summary — MTD must equal only April entry amount
3. GET /billing/summary — YTD must equal all 6 entries
4. Add a new billing entry — KV cache is invalidated, next GET shows updated values
5. Response shape unchanged: { mtd, ytd, balance, lastUpdated }

EDGE CASES:
- January 1st: YTD = 0, MTD = 0 (new year reset)
- March 1st: YTD includes Jan-Feb, MTD = 0 (new month reset)
- Empty billing DB: mtd: 0, ytd: 0, balance: 0

BUG HUNTING:
- Verify D1 date functions work correctly (date('now', 'start of month'))
- Verify KV cache TTL (900s) is correct for billing summary

REGRESSIONS:
- Balance calculation (all-time revenue minus payouts) is unchanged
- Dashboard page still shows correct revenue figure

DONE MEANS:
- MTD and YTD are different values when test data spans months
- Billing page shows correct figures for both
```

---

### QA-PROMPT-03: QA for Partner Pagination Count

```
QA PROMPT — T-03
Repo: webwaka-super-admin-v2

WHAT TO TEST:
1. Seed: 10 ACTIVE/STARTER, 5 SUSPENDED/PROFESSIONAL, 3 CHURNED/ENTERPRISE partners
2. GET /partners → total: 18
3. GET /partners?status=ACTIVE → total: 10
4. GET /partners?tier=PROFESSIONAL → total: 5
5. GET /partners?status=ACTIVE&tier=STARTER → total: 10 (ACTIVE+STARTER)
6. GET /partners?status=CHURNED&tier=PROFESSIONAL → total: 0 (none match)

REGRESSIONS:
- Pagination still works: page=1&limit=5 returns 5 items, page=2&limit=5 returns next 5
- List response shape unchanged
```

---

### QA-PROMPT-04: QA for Audit Log Path Fix

```
QA PROMPT — T-04
Repo: webwaka-super-admin-v2

WHAT TO TEST:
1. GET /audit-log → 200 OK with { entries: [], pagination: {} } envelope
2. GET /settings/audit-log → still 200 OK (backward compat)
3. POST /settings/audit-log → writes entry, GET /audit-log shows it
4. AuditLog.tsx page → loads without 404 console errors
5. apiClient.getAuditLog() → calls correct path, returns data

REGRESSIONS:
- No other page/hook calls the wrong path
- Auth still required: GET /audit-log without token → 401

DONE MEANS:
- AuditLog page shows real entries
- No 404 errors in browser network tab
```

---

### QA-PROMPT-05: QA for Settings Fix

```
QA PROMPT — T-05
Repo: webwaka-super-admin-v2

WHAT TO TEST:
1. PUT /settings { maintenanceMode: true } with manage:settings permission → 200 OK
2. GET /settings → { maintenanceMode: true, ...defaults }
3. PUT /settings with write:tenants permission only → still 200 (because write:tenants is a superset)
4. GET /settings when KV is empty → returns all default values (no error)
5. PUT /settings with unknown key { customKey: 'value' } → persisted (passthrough)

REGRESSIONS:
- Settings page UI shows updated values after PUT
- Hardcoded defaults still present when no KV key exists

DONE MEANS:
- Settings persist across requests
- Permission check uses manage:settings
```

---

### QA-PROMPT-06: QA for Security Headers

```
QA PROMPT — T-06
Repo: webwaka-super-admin-v2

WHAT TO TEST:
1. curl -I GET /health → response headers include Content-Security-Policy, Permissions-Policy, Cross-Origin-Resource-Policy
2. curl -I GET /tenants → same headers present
3. Browser test: load full React app, open Console → zero CSP violation errors
4. curl -I OPTIONS /tenants (preflight) → CORS headers correct, CSP present
5. Error response (GET /nonexistent → 404) → CSP header still present

TOOLS: curl, browser DevTools Network tab, SecurityHeaders.com scan

REGRESSIONS:
- CORS headers still work correctly after adding CSP
- API responses not broken for any endpoint

DONE MEANS:
- All responses have Content-Security-Policy
- No CSP violations in browser with full app running
```

---

### QA-PROMPT-07: QA for 2FA Backend

```
QA PROMPT — T-07
Repo: webwaka-super-admin-v2

WHAT TO TEST:
1. GET /auth/2fa/status (no 2FA set up) → { enabled: false }
2. POST /auth/2fa/setup → returns { qrUri: 'otpauth://...', secret: '...' }
3. Parse qrUri with Google Authenticator or Authy — must show WebWaka Admin account
4. POST /auth/2fa/verify-setup with valid TOTP code → { enabled: true }
5. POST /auth/login (user with 2FA enabled) → { requires_2fa: true, session_token: '...' }
6. POST /auth/2fa/validate with valid code + session_token → sets HttpOnly cookie, 200 OK
7. POST /auth/2fa/validate with wrong code → 401
8. POST /auth/2fa/validate with expired session_token (> 5 min) → 401
9. POST /auth/2fa/validate with already-used session_token → 401 (single use)
10. POST /auth/2fa/disable with valid TOTP code → { enabled: false }
11. Login after disabling 2FA → no session_token, direct JWT cookie

EDGE CASES:
- Clock drift: test with system time ± 25 seconds
- Wrong session_token format: 400
- Setup without completing verify-setup: totp_enabled remains 0

REGRESSIONS:
- Login for users WITHOUT 2FA still works as before (no session_token, direct JWT)
- /auth/refresh still works after 2FA login

DONE MEANS:
- Full 2FA flow tested with a real authenticator app
- Unit tests for TOTP generation and validation pass
```

---

### QA-PROMPT-08: QA for JWT jti Blocklist

```
QA PROMPT — T-08
Repo: webwaka-super-admin-v2

WHAT TO TEST:
1. Login → decode JWT cookie (via jwt.io or test helper) → verify jti field present
2. GET /auth/me with valid JWT → 200 OK
3. POST /auth/logout → 200 OK
4. GET /auth/me with same JWT after logout → 401 (blocked jti)
5. Login again → new jti in new JWT
6. Verify SESSIONS_KV contains blocklist:{jti} key with TTL (wrangler kv key list)

EDGE CASES:
- Logout twice with same token: idempotent (second logout → still 200)
- KV unavailable: fail open (token still valid) — document this behaviour

PERFORMANCE:
- Measure GET /auth/me latency before vs after adding KV read
- Target: < 5ms added latency at p99

DONE MEANS:
- Replaying a logged-out JWT returns 401
- jti present in every JWT
- Latency within budget
```

---

### QA-PROMPT-09: QA for CI Gates

```
QA PROMPT — T-09
Repo: webwaka-super-admin-v2

WHAT TO TEST:
1. Introduce deliberate TS error in frontend/src/App.tsx → push to CI → CI fails (no continue-on-error)
2. Revert TS error → CI passes
3. Check pnpm audit: run pnpm audit --audit-level=high in frontend/ and workers/
4. If any high/critical found: verify CI fails
5. Clean branch (no errors, no vulns): CI is fully green end-to-end

REGRESSIONS:
- Existing TypeScript types are all still valid (no new errors introduced)
- CI pipeline still runs all jobs (frontend, workers, security, e2e)

DONE MEANS:
- CI blocks on type errors
- CI blocks on high/critical vulns
- Clean branch: CI fully green
```

---

### QA-PROMPT-10: QA for Offline Mutation Replay

```
QA PROMPT — T-10
Repo: webwaka-super-admin-v2

WHAT TO TEST:
1. Chrome DevTools → Network → set Offline
2. Create a new tenant via TenantManagement form → verify toast "Saved for sync" or similar
3. Check IndexedDB → Application tab → webwaka-admin-db → pendingMutations → entry visible
4. Set Network back to Online
5. Within 3 seconds: verify toast "Syncing 1 pending action(s)..."
6. After sync: tenant appears in tenant list
7. Verify pendingMutations table is empty

EDGE CASES:
- Server returns 409 on replay → mutation removed, toast error shown
- maxRetries (3) exceeded → mutation removed, toast error
- Multiple pending mutations → all replayed in FIFO order
- Browser refresh while offline → mutations still in IndexedDB on reload

REGRESSIONS:
- Online behaviour (no mutations in queue) → no effect on normal operation
- OfflineBanner still shows/hides correctly

DONE MEANS:
- End-to-end offline → online sync works
- No mutations silently lost
```

---

### QA-PROMPT-11: QA for Notifications System

```
QA PROMPT — T-11
Repo: webwaka-super-admin-v2

WHAT TO TEST:
1. GET /notifications (no notifications) → { notifications: [], unreadCount: 0 }
2. POST /notifications { title: 'Test', message: 'Hello', severity: 'info' } → 201
3. GET /notifications → { unreadCount: 1, notifications: [{ ... }] }
4. NotificationBell badge shows "1" in UI
5. PATCH /notifications/:id/read → readAt set
6. GET /notifications → unreadCount: 0
7. DELETE /notifications/:id → notification removed from list
8. 7-day TTL: notifications created > 7 days ago auto-removed from KV

EDGE CASES:
- 100 notifications → badge shows "99+"
- Notification for non-existent user → 404
- Cross-user: UserA's notification not visible to UserB

DONE MEANS:
- NotificationBell shows real data
- Unread count is accurate
- Cross-user isolation confirmed
```

---

### QA-PROMPT-12: QA for Persistent Settings

```
QA PROMPT — T-12
Repo: webwaka-super-admin-v2

WHAT TO TEST:
1. PUT /settings { maintenanceMode: true, apiRateLimit: 500 }
2. GET /settings → maintenanceMode: true, apiRateLimit: 500
3. Restart worker (deploy a trivial change) → GET /settings still returns maintenanceMode: true
4. Settings page UI shows updated values after refresh
5. maintenanceMode: true → Dashboard shows maintenance banner

DONE MEANS:
- Settings persist across worker restarts
- UI reflects settings correctly
```

---

### QA-PROMPT-13: QA for Audit Log Middleware

```
QA PROMPT — T-13
Repo: webwaka-super-admin-v2

WHAT TO TEST:
1. POST /partners (create new partner) → GET /audit-log shows POST_PARTNERS entry
2. PUT /tenants/:id (update tenant) → GET /audit-log shows PUT_TENANTS entry
3. DELETE /tenants/:id → GET /audit-log shows DELETE_TENANTS entry
4. GET /tenants → NO new audit log entry (GETs not logged)
5. POST /auth/login with wrong password → AUTH_FAIL entry in audit log
6. POST /auth/login with correct password → LOGIN_SUCCESS entry in audit log
7. Middleware error (DB write fails) → primary response still succeeds (200)

EDGE CASES:
- Unauthenticated request (no JWT) → user_id = 'anonymous'
- 4xx response → no audit entry written for failed state changes
- /audit-log endpoint itself → no recursive audit entry

DONE MEANS:
- All state-changing operations have audit trail
- Auth failures logged
- Middleware never blocks primary response
```

---

### QA-PROMPT-14: QA for Command Palette

```
QA PROMPT — T-14
Repo: webwaka-super-admin-v2

WHAT TO TEST:
1. Press Cmd+K (macOS) → palette opens within 100ms
2. Press Ctrl+K (Windows/Linux) → palette opens
3. Type "Ten" → "Go to Tenants" command appears in < 50ms
4. Press Enter on "Go to Tenants" → navigates to /tenants hash route
5. Type tenant name → matching tenants appear in results
6. Press Escape → palette closes
7. Arrow keys → navigate through results
8. Click outside palette → closes

ACCESSIBILITY:
- Screen reader test: palette opening announced
- Focus trapped inside palette while open
- All items reachable via keyboard

MOBILE:
- On mobile: floating search button opens palette
- Touch interaction works correctly

DONE MEANS:
- All navigation commands work
- Tenant search works from TenantContext
- Fully keyboard-navigable
```

---

### QA-PROMPT-15: QA for CSV/JSON Export

```
QA PROMPT — T-15
Repo: webwaka-super-admin-v2

WHAT TO TEST:
1. TenantManagement: click Export → Download CSV → open in spreadsheet → correct headers and data
2. TenantManagement: click Export → Download JSON → parse JSON → valid structure
3. Billing: Export CSV → kobo amounts shown as ₦ NGN strings (not raw kobo integers)
4. AuditLog: Export CSV → all columns present
5. Apply filter first (e.g., active tenants only) → export respects filter

EDGE CASES:
- Empty table: CSV has headers only, JSON is []
- Tenant name with commas: properly quoted in CSV
- Large dataset (1,000 rows): export completes without browser freeze

DONE MEANS:
- CSV parseable by Excel and Google Sheets
- JSON parseable by JSON.parse
- Kobo amounts formatted as NGN
- Filename includes date
```

---

### QA-PROMPT-16: QA for Bulk Operations

```
QA PROMPT — T-16
Repo: webwaka-super-admin-v2

WHAT TO TEST:
1. TenantManagement: check 3 tenants → BulkActionBar appears with "3 selected"
2. Click "Select All" → all visible tenants selected
3. Click "Suspend All" → AlertDialog opens listing 3 tenant names
4. Confirm → all 3 tenants PUT with status SUSPENDED
5. List updates to show SUSPENDED status for all 3
6. Deselect all → BulkActionBar disappears

EDGE CASES:
- Bulk suspend an already-SUSPENDED tenant → VALID_TRANSITIONS check fails → show per-tenant error
- 50 tenants selected → progress toast shows "Suspending 50 tenants (12/50)..."
- One tenant fails → continue with others, final summary shows partial failure

DONE MEANS:
- Multi-select works
- Bulk actions use VALID_TRANSITIONS
- Confirmation dialog lists affected names
```

---

### QA-PROMPT-17: QA for Idle Timeout

```
QA PROMPT — T-17
Repo: webwaka-super-admin-v2

WHAT TO TEST (use browser DevTools to manipulate time):
1. Set idle timer to 5 seconds for testing
2. Stop mouse movement → after 5s warning modal appears
3. Click "Stay Logged In" → timer resets, modal closes
4. Stop activity again → after timeout → auto logout, redirect to /login
5. Move mouse → timer resets (no logout)

EDGE CASES:
- Background tab: timer still runs (setInterval not throttled by visibility)
- Multiple tabs: each tab has independent timer (not cross-tab)
- Mobile: touchstart resets timer correctly

ACCESSIBILITY:
- Warning modal has role="alertdialog"
- Focus moves to "Stay Logged In" button automatically
- Countdown is announced to screen readers

DONE MEANS:
- Timeout fires correctly at configured interval
- "Stay Logged In" resets timer
- Auto-logout works after full idle period
```

---

### QA-PROMPT-18: QA for Multi-Currency Billing

```
QA PROMPT — T-18
Repo: webwaka-super-admin-v2

WHAT TO TEST:
1. POST /billing/entry { ..., currency: 'GHS', amount_kobo: 10000 } → 201 OK
2. GET /billing/ledger → entry shows currency: 'GHS'
3. formatAmount(10000, 'GHS') → 'GH₵100.00' (or locale equivalent)
4. formatAmount(10000, 'NGN') → '₦100' (unchanged from before)
5. formatKoboAsNGN(10000) → still works (backward compat alias)
6. POST /billing/entry with invalid currency 'USD' → 400 validation error

REGRESSIONS:
- Existing NGN billing entries unchanged
- Commission calculator still works (always in NGN/kobo)

DONE MEANS:
- Multi-currency entries persist and display correctly
- NGN behaviour unchanged
- All unit tests for formatAmount pass
```

---

### QA-PROMPT-19: QA for Dynamic Feature Flags

```
QA PROMPT — T-19
Repo: webwaka-super-admin-v2

WHAT TO TEST:
1. GET /feature-flag-definitions → returns 4 default flags
2. POST /feature-flag-definitions { key: 'beta_ui', label: 'Beta UI', defaultValue: false } → 201
3. GET /feature-flag-definitions → now 5 flags (including beta_ui)
4. FeatureFlagManager UI → shows 5 flags including beta_ui
5. Toggle beta_ui for a tenant → persisted in KV
6. DELETE /feature-flag-definitions/beta_ui → removed from list
7. FeatureFlagManager UI → 4 flags again

REGRESSIONS:
- Existing 4 flags (advanced_analytics, ai_recommendations, multi_currency, offline_mode) still work
- Per-tenant flag values still persist independently of definitions

DONE MEANS:
- New flags can be created via UI
- All 4 existing flags still work
```

---

### QA-PROMPT-20: QA for Cloudflare API Deployments

```
QA PROMPT — T-20
Repo: webwaka-super-admin-v2

WHAT TO TEST:
1. Set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID in wrangler secrets
2. POST /deployments/refresh → returns live worker status from Cloudflare API
3. Worker logs show Cloudflare API call (check wrangler tail)
4. Cloudflare API unavailable (wrong token) → graceful fallback: returns stale data + { warning: '...' }
5. Missing env vars → returns stale data + { warning: 'Cloudflare API not configured' }

REGRESSIONS:
- GET /deployments still works (returns stale data from DB)
- Deployment Manager UI still renders without crashing

DONE MEANS:
- Live deployment status appears after refresh
- Graceful fallback confirmed
```

---

### QA-PROMPT-21: QA for Webhook System

```
QA PROMPT — T-21
Repo: webwaka-super-admin-v2

WHAT TO TEST:
1. POST /tenants/:id/webhooks { url: 'https://webhook.site/...', events: ['tenant.suspended'] } → 201
2. GET /tenants/:id/webhooks → registered webhook listed (secret NOT in response)
3. POST /tenants/:id/webhooks/:wid/test → delivery arrives at webhook.site
4. Verify X-WebWaka-Signature header present in delivered webhook
5. Suspend a tenant → webhook fires automatically for that tenant's registered URL
6. DELETE /tenants/:id/webhooks/:wid → webhook removed, no more deliveries

EDGE CASES:
- Webhook URL returns 500 → retry up to 3 times
- Webhook URL unreachable → timeout after 5 seconds, retry
- Tenant has no webhooks → no delivery attempt made

SECURITY:
- Verify HMAC signature: recreate HMAC-SHA256 from payload using known secret → must match
- Secret never appears in GET response

DONE MEANS:
- Webhooks delivered successfully
- HMAC signature verifiable
- Failed deliveries retried
```

---

### QA-PROMPT-22: QA for Virtual Scrolling

```
QA PROMPT — T-22
Repo: webwaka-super-admin-v2

WHAT TO TEST:
1. Seed billing ledger with 1,000 entries
2. Open Billing page → initial render completes in < 100ms (Chrome DevTools Performance)
3. Scroll through all 1,000 entries → smooth, no jank (60fps in DevTools)
4. Click on a row → row action (view detail) works correctly
5. Seed audit log with 1,000 entries → same tests for AuditLog page

MOBILE TEST:
6. Chrome DevTools → emulate Moto G4 (low-end Android)
7. Scroll 1,000 rows → still smooth

REGRESSIONS:
- Pagination still works alongside virtualization
- Filter/search still narrows visible rows correctly

DONE MEANS:
- 1,000 rows render in < 100ms
- Scroll is smooth on low-end device emulation
- Row actions work with virtualization
```

---

## 9. PRIORITY ORDER

| Rank | Task | Category | Rationale |
|------|------|----------|-----------|
| 1 | T-01 | Bug/Security | Crypto: all new records at risk |
| 2 | T-06 | Security | CSP missing from all responses |
| 3 | T-07 | Security | 2FA is currently non-functional |
| 4 | T-04 | Bug | Audit Log page shows nothing |
| 5 | T-05 | Bug | Settings changes don't persist |
| 6 | T-02 | Bug | Financial reporting is inaccurate |
| 7 | T-03 | Bug | Pagination is broken for filtered views |
| 8 | T-09 | DevOps | CI silently hides errors |
| 9 | T-13 | Compliance | NDPR: audit trail incomplete |
| 10 | T-08 | Security | JWT revocation on logout |
| 11 | T-10 | Offline/PWA | Offline writes silently lost |
| 12 | T-11 | Feature | Notifications non-functional |
| 13 | T-12 | Feature | Settings fully persistent |
| 14 | T-17 | Security/UX | Idle timeout |
| 15 | T-22 | Performance | Virtual scrolling for large tables |
| 16 | T-14 | UX | Command palette |
| 17 | T-15 | UX | Data export |
| 18 | T-16 | UX | Bulk operations |
| 19 | T-18 | Africa-Ready | Multi-currency |
| 20 | T-19 | Governance | Dynamic feature flags |
| 21 | T-20 | Feature | Real Cloudflare API |
| 22 | T-21 | Feature | Webhook system |

---

## 10. DEPENDENCIES MAP

```
T-07 (2FA Backend)
  → requires migration 013_add_totp (done within T-07)
  → T-08 (jti blocklist) is complementary but not a hard dependency

T-12 (Persistent Settings) → requires T-05 (fix permission + hardcoded GET first)

T-16 (Bulk Operations) → T-15 (Export) for bulk export action

T-19 (Dynamic Flags) → T-12 (Persistent Settings, as reference pattern)

T-21 (Webhooks) → T-13 (Audit Middleware, webhooks log delivery to audit)

T-11 (Notifications) → standalone, but pairs well with T-13 (system events create notifications)

All other tasks: no blocking dependencies (can run in parallel)
```

---

## 11. PHASE 1 / PHASE 2 SPLIT

### Phase 1 — Critical Fixes + Security (P0-P1)

These tasks must be completed before any Phase 2 work. They address security vulnerabilities, broken features, compliance gaps, and CI integrity.

| Task | Description |
|------|-------------|
| T-01 | Cryptographically secure ID generation |
| T-02 | Billing MTD/YTD calculation fix |
| T-03 | Partner pagination count fix |
| T-04 | Audit log endpoint path fix |
| T-05 | Settings GET/PUT fix |
| T-06 | Content-Security-Policy headers |
| T-07 | 2FA backend implementation |
| T-08 | JWT jti blocklist |
| T-09 | CI TypeScript and audit gates |
| T-10 | Offline mutation replay |
| T-11 | Notifications system |
| T-12 | Persistent settings |
| T-13 | Server-side audit logging middleware |

**Phase 1 Exit Criteria:**
- All P0 bugs fixed and in production
- 2FA functional end-to-end
- CI gates enforce TypeScript and security
- Offline mutations replay automatically
- Audit trail complete for all operations

### Phase 2 — Enhancements + Africa-Readiness (P2-P3)

These tasks enhance the platform significantly and should be prioritized after Phase 1 is complete.

| Task | Description |
|------|-------------|
| T-14 | Command palette (Cmd+K) |
| T-15 | CSV/JSON data export |
| T-16 | Bulk operations |
| T-17 | Session idle timeout |
| T-18 | Multi-currency billing support |
| T-19 | Dynamic feature flags |
| T-20 | Real Cloudflare API for deployments |
| T-21 | Outbound webhook system |
| T-22 | Virtual scrolling for billing and audit log |

**Phase 2 Exit Criteria:**
- All P2 enhancements complete
- Multi-currency billing tested in staging with GHS, KES entries
- Webhook system tested with real delivery endpoints
- Performance audit: Lighthouse scores ≥ 90

---

## 12. REPO CONTEXT AND ECOSYSTEM NOTES

### This Repo is NOT Standalone

The `webwaka-super-admin-v2` is one component in a multi-repo platform architecture. Any agent implementing tasks in this repo must be aware of the following cross-repo contracts:

**Upstream Dependencies (repos this repo calls):**
- `webwaka-commerce-api` — via `COMMERCE_WORKER` service binding, used in tenant provisioning (T-FND-03 pattern in `POST /tenants`)
- `webwaka-transport-api`, `webwaka-education-api`, etc. — not yet bound, but provisioning design accounts for them

**Downstream Consumers (repos that call this repo):**
- None explicitly bound today, but suite-specific repos may call the super-admin API for tenant validation and module status

**Shared Data Contracts:**
- `RBAC_DB` users table — the super-admin and commerce API may share RBAC. Any schema migration (e.g., T-07's TOTP columns) must be idempotent and not break the commerce API's queries
- Tenant IDs — used across all repos; the format change in T-01 (hex suffix) is backward-compatible since existing IDs are untouched

**Cross-Repo Invariants:**
- Multi-Tenant: `tenant_id` must be present in every cross-repo call
- Event-Driven: direct DB access across repos is forbidden; use service bindings or Queues
- Build Once Use Infinitely: `@webwaka/core` npm package is referenced in workers/ but not resolvable in this environment (excluded from pnpm workspace) — do not add workers-only logic that belongs in core

**What Lives Elsewhere:**
- Payment gateway integration (Paystack/Flutterwave) → likely `webwaka-commerce-api`
- Tenant-facing admin portals → separate tenant admin repos
- Mobile app push notifications → mobile repo
- Sector-specific business logic (transport scheduling, education enrollments) → respective suite repos

---

## 13. GOVERNANCE AND REMINDER BLOCK

Every agent implementing a task in this repo must uphold these principles:

### Core Invariants (from platform design)

1. **Build Once Use Infinitely** — Any utility function (ID generation, commission calculation, currency formatting, audit logging) must be reusable across all endpoints and pages. No duplicated logic.

2. **Mobile / PWA / Offline First** — Every UI change must be tested on mobile viewport. Offline mode must remain functional. Service worker must not be broken.

3. **Nigeria First, Africa Ready** — All monetary values in integer kobo. NGN is the default currency. Platform must gracefully support GHS, KES, ZAR, XOF. NDPR compliance required for any user data.

4. **Vendor Neutral AI** — The `ai_vendor` field and AI quota system must never hardcode a single AI provider. OpenRouter and multiple vendors must remain options.

5. **Multi-Tenant Tenant-as-Code** — Every database query that could return user data must include `tenant_id` filtering. `tenant_id` is always from the verified JWT, never from request headers or query params.

6. **Event-Driven** — No direct database access across repo boundaries. Use Cloudflare Service Bindings and Queues for cross-repo communication.

7. **Thoroughness Over Speed** — Do not skip edge cases. Do not introduce `any` types without justification. Do not leave `console.log` debug statements in production code.

8. **Zero Skipping Policy** — Every task must be fully implemented with acceptance criteria met. Partial implementations must be documented as such.

9. **Governance-Driven Execution** — Consult `replit.md`, `CODEBASE_INVENTORY.md`, and `ACTUAL_IMPLEMENTATION_AUDIT.md` before making architectural decisions. Do not contradict documented design decisions without explicit justification.

10. **CI/CD Native Development** — Every code change must pass the CI pipeline. TypeScript must compile cleanly. Tests must pass. Security audit must pass.

11. **Cloudflare-First Deployment** — All infrastructure uses Cloudflare primitives: D1, KV, Workers, Queues, Service Bindings, Pages. No Node.js-specific APIs in Workers code.

### Security Reminders (apply to every task)

- Never log JWT tokens, TOTP secrets, API keys, or password hashes
- Never return sensitive fields (totp_secret, password_hash, key plaintext) in API responses
- Always use `credentials: 'include'` on all frontend API calls
- Always validate input with Zod before processing
- Never trust tenant_id from request params — always from verified JWT
- Rate limit all state-changing endpoints

---

## 14. EXECUTION READINESS NOTES

### Environment Setup

The Replit environment has:
- Node.js 20 via NixOS
- pnpm 10.26.1
- Frontend dependencies installed (487 packages)
- Workers excluded from pnpm workspace (requires Cloudflare infrastructure)
- `Start application` workflow running `cd frontend && pnpm dev` on port 5000
- Demo credentials: `admin@webwaka.com` / `password`

### What Cannot Be Tested in Replit

- Workers API (requires Cloudflare D1, KV, Workers runtime)
- 2FA TOTP validation (requires running worker)
- Webhook delivery (requires external URL)
- Cloudflare API integration (requires API token)
- Service binding to COMMERCE_WORKER

### What Can Be Tested in Replit

- All frontend changes (React, TypeScript, Tailwind, Vite)
- Frontend unit tests (Vitest)
- Frontend build (`pnpm build`)
- TypeScript type checking (`pnpm tsc --noEmit`)
- CSS/UX changes (visible at port 5000)
- Client-side offline simulation (Chrome DevTools → Network → Offline)
- Dexie/IndexedDB (IndexedDB available in browser)

### Staging / Production Testing

For backend changes (workers/), use:
```bash
wrangler dev --env staging          # local dev with remote KV/D1
wrangler deploy --env staging       # deploy to staging
curl https://webwaka-super-admin-api-staging.webwaka.workers.dev/health
```

### Implementation Sequence (recommended)

1. Run all Phase 1 tasks in dependency order (T-01, T-04, T-05, T-02, T-03, T-06, T-09, T-13, T-08, T-07, T-10, T-11, T-12)
2. Validate Phase 1 in staging environment
3. Run Phase 2 tasks in priority order
4. Full E2E Playwright test suite on staging before production

### Testing Checklist Before Any Deploy

```
[ ] pnpm tsc --noEmit (frontend) — exits 0
[ ] pnpm tsc --noEmit (workers)  — exits 0
[ ] pnpm test --run (workers unit tests) — all pass
[ ] pnpm audit --audit-level=high — exits 0
[ ] pnpm build (frontend) — builds successfully
[ ] wrangler deploy --env staging — deploys successfully
[ ] Smoke test: GET /health → { status: "HEALTHY" }
[ ] Smoke test: Login → JWT cookie set
[ ] Smoke test: GET /tenants → list returned
[ ] Smoke test: Browser → no CSP violations in console
[ ] Smoke test: Lighthouse Performance ≥ 90
```

---

*End of WEBWAKA-SUPER-ADMIN-V2-DEEP-RESEARCH-TASKBOOK.md*
*Document generated: 2026-04-04*
*Repo: webwaka-super-admin-v2*
*Classification: Platform Taskbook — Implementation + QA Ready*
