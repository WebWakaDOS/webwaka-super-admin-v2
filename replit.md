# WebWaka Super Admin v2

A production-ready, multi-tenant administration platform with an enterprise-grade React frontend.

## Project Overview

This is a monorepo containing a React frontend (originally targeting Cloudflare Pages) with a Hono API backend (targeting Cloudflare Workers). In the Replit environment, only the frontend runs locally. The backend (Cloudflare Workers) requires Cloudflare infrastructure and Wrangler CLI for deployment.

## Tech Stack

- **Frontend**: React 19, Vite 7, Tailwind CSS 4, shadcn/ui, Wouter (hash-based routing), Recharts
- **Package Manager**: pnpm (monorepo via pnpm-workspace.yaml)
- **Backend** (Cloudflare-only): Hono, Cloudflare Workers, D1 (SQL), KV store
- **Testing**: Vitest, Playwright

## Project Structure

```
frontend/          # React 19 SPA
  src/
    components/    # Reusable UI components (shadcn/ui based)
    contexts/      # Auth, Tenant, Theme providers
    hooks/         # Custom React hooks
    lib/           # API clients and utilities
    pages/         # Application views
    App.tsx        # Main entry and routing
  vite.config.ts   # Vite config (port 5000, host 0.0.0.0)
workers/           # Cloudflare Workers backend (not run locally)
scripts/           # Infrastructure scripts
docs/              # Documentation and reports
```

## Running in Replit

The `Start application` workflow runs: `cd frontend && pnpm dev`  
This starts the Vite dev server at port 5000 on all interfaces.

## Deployment

Configured as a **static** deployment:
- Build: `cd frontend && pnpm install && pnpm build`
- Public directory: `frontend/dist`

## Notes

- The workers package was removed from pnpm-workspace.yaml since it depends on `@webwaka/core` (a missing local package) and requires Cloudflare infrastructure (D1, KV, Wrangler) to run.
- The Vite server is configured with `allowedHosts: true` and `host: '0.0.0.0'` to work behind Replit's proxy.
- The frontend uses hash-based routing (wouter) for PWA/offline compatibility.
- API calls are proxied from `/api` to `localhost:8787` (Cloudflare Workers dev port) — without the backend running locally, API calls will fail gracefully.
