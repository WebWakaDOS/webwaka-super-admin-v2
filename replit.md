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

## Notes

- The `workers/` package has a dependency on `@webwaka/core` which references a local path that doesn't exist. Workers are excluded from the pnpm workspace.
- The `OfflineBanner` component was created during import setup (was missing from repo).
- The `@tanstack/react-virtual` package was added during import setup (was missing from package.json).
