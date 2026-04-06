# WebWaka Super Admin V2

A React + Vite super admin dashboard for the WebWaka multi-tenant platform.

## Project Overview

This is a single-page application (SPA) built with React 19, TypeScript, and Vite. It provides a super admin interface for managing tenants, billing, modules, system health, deployments, and more.

The backend is designed to run on Cloudflare Workers (D1 + KV) — the workers package is not set up in this environment as it requires Cloudflare infrastructure.

## Architecture

- **Frontend**: React 19 + TypeScript + Vite (located in `frontend/`)
- **Backend**: Cloudflare Workers + Hono (located in `workers/`) — Cloudflare-only
- **Package Manager**: pnpm workspaces (only frontend in workspace; workers excluded due to missing Cloudflare deps)
- **Routing**: Wouter with hash-based location
- **UI**: Radix UI + Tailwind CSS v4 + shadcn/ui components
- **Charts**: Recharts
- **Forms**: React Hook Form + Zod
- **State**: React Context (AuthContext, TenantContext, ThemeContext)

## Pages & Features (20+ Implementations + 8 WA-SA Enhancements)

### Core
- **Dashboard** `/` — Overview metrics
- **Analytics** `/analytics` — Revenue and usage charts
- **System Health** `/health` — Service status monitoring with SLA tracking, alert threshold rules, alert acknowledgment

### Tenant Management
- **Tenants** `/tenants` — CRUD with virtual scroll + bulk ops
- **Onboarding Wizard** `/onboarding` — **Enhanced**: 5-step wizard (KYC/Compliance step), provisioning state machine (PENDING_VERIFICATION→PROVISIONING→ACTIVE|FAILED), idempotency key, real-time log stream, multi-region selector (WA-SA-001)
- **Tenant Impersonation** `/impersonation` — Secure admin-as-tenant sessions with audit log
- **Inactive Tenants** `/inactive-tenants` — Pruner with bulk archive/notify

### Security & Compliance
- **Fraud Alerts** `/fraud-alerts` — Resolution center with severity-based triage
- **KYC Queue** `/kyc-queue` — Manual identity verification review
- **RBAC Editor** `/rbac` — Role and permission management
- **Audit Log** `/audit-log` — Platform-wide action history

### Billing
- **Billing** `/billing` — **Enhanced**: Real-time MRR/ARR/churn metrics, revenue AreaChart, auto-refresh (30s/1m/5m/manual), billing health indicators, tabbed layout (WA-SA-002)
- **Subscription Plans** `/subscription-plans` — Plan CRUD with feature management

### AI & Intelligence
- **AI Usage** `/ai-usage` — Token consumption dashboard by tenant and model

### Platform Ops
- **Modules** `/modules` — **Enhanced**: Version history drawer, dependency management with conflict detection, changelog per module, update badges, search/filter (WA-SA-003)
- **Feature Flags** `/feature-flags` — **Enhanced**: A/B Experiments tab — create multi-variant experiments, rollout percentage controls, declare winner, pause/resume/end lifecycle (WA-SA-004)
- **Custom Domains** `/custom-domains` — Domain request approval and SSL tracking
- **Webhooks** `/webhooks` — Endpoint management and delivery log replay
- **Platform Config** `/platform-config` — **Enhanced**: Multi-Region section — enable/disable regions, geo-routing toggle, D1 cross-region replication, primary/default region selectors (WA-SA-007)
- **Settings** `/settings` — **Enhanced**: Granular API key permission scopes (14 scopes + superuser), environment labels, scope badges, two-step key revocation (WA-SA-006)
- **Data Export** `/data-export` — **Enhanced**: Data Retention Policies tab — 8 category policies, NDPR compliance enforcement, schedule config, manual run, edit dialog (WA-SA-008)
- **Bulk Notifications** `/bulk-notifications` — Email/SMS campaigns
- **Deployments** `/deployments` — Release management
- **Partners** `/partners` — Partner ecosystem
- **Builder Admin** `/builder-admin` — UI builder administration

### Mobile Responsive Layout (#20)
- Sidebar collapses to a slide-over on mobile with dark overlay
- Hamburger icon added to Header for mobile toggle
- Sidebar nav organized into collapsible sections

## Key Files

- `frontend/src/App.tsx` — Main router and app shell
- `frontend/src/contexts/AuthContext.tsx` — Authentication state
- `frontend/src/contexts/TenantContext.tsx` — Tenant management state
- `frontend/vite.config.ts` — Vite configuration (port 5000, allowedHosts: true)
- `pnpm-workspace.yaml` — Only includes `frontend` (workers excluded)

## Running Locally

The workflow `Start application` runs `cd frontend && pnpm dev` on port 5000.

Demo credentials (from login page):
- Email: admin@webwaka.com
- Password: password

## Deployment

Configured as a static site deployment:
- Build: `cd frontend && pnpm build`
- Public dir: `frontend/dist`

## Pages / Routes

- `/` — Dashboard
- `/tenants` — Tenant Management
- `/tenant-provisioning` — Tenant Provisioning
- `/billing` — Billing
- `/modules` — Module Registry
- `/health` — System Health
- `/analytics` — Analytics
- `/settings` — Settings
- `/partners` — Partner Management
- `/operations` — Operations Overview
- `/deployments` — Deployment Manager
- `/audit-log` — Audit Log
- `/ai-usage` — AI Usage Dashboard (requires `view:billing`)
- `/fraud-alerts` — Fraud Alert Resolution Center (requires `manage:security`)
- `/onboarding` — Automated Onboarding Wizard
- `/kyc-queue` — KYC Document Queue
- `/subscription-plans` — Subscription Plans Manager
- `/bulk-notifications` — Bulk Notification Center
- `/custom-domains` — Custom Domain Manager
- `/data-export` — Data Export Center
- `/rbac` — RBAC Role Editor
- `/webhooks` — Webhook Manager
- `/platform-config` — Platform Configuration
- `/inactive-tenants` — Inactive Tenant Monitor
- `/impersonation` — Tenant Impersonation

## Testing

- **Framework**: Vitest + @testing-library/react + jsdom
- **Config**: `frontend/vitest.config.ts` (jsdom environment, setupFiles: `src/test-setup.ts`)
- **Setup file**: `frontend/src/test-setup.ts` — Pointer Events polyfill (Radix UI), Recharts stub
- **Run**: `cd frontend && pnpm test`
- **QA-certified tests** (`SUP_QA_CERTIFICATION_1775282239137.md`):
  - `AIUsage.test.tsx` — 20 tests, all passing (QA-SUP-1)
  - `FraudAlerts.test.tsx` — 21 tests, all passing (QA-SUP-2)
  - `OnboardingWizard.test.tsx` — 18 tests, all passing (QA-SUP-3)

## Security

- **JWT storage**: Admin JWTs are stored in `HttpOnly; SameSite=Strict` cookies set by the Workers backend — never in `localStorage`. JavaScript cannot read or write the token.
- **Cookie auth flow**: Login/refresh set `Set-Cookie`; logout clears it with `Max-Age=0`. The `Secure` flag is added in production/staging automatically.
- **All fetch calls** use `credentials: 'include'` so the browser sends the cookie on every API request.
- **CORS**: `Access-Control-Allow-Credentials: true` is set on all responses; origin is always reflected (never wildcard) so credentials are accepted by the browser.
- **Auth middleware** (`getAuthPayload`): reads from cookie first, falls back to `Authorization: Bearer` for backwards compat with the test suite.
- **Tenant status enum**: Canonical values are `ACTIVE | SUSPENDED | TRIAL | CHURNED`. Migration 012 maps legacy `PROVISIONING→TRIAL`, `ARCHIVED→CHURNED`.

## Notes

- The `workers/` package has a dependency on `@webwaka/core` which references a local path that doesn't exist. Workers are excluded from the pnpm workspace.
- The `OfflineBanner` component was created during import setup (was missing from repo).
- The `@tanstack/react-virtual` package was added during import setup (was missing from package.json).
