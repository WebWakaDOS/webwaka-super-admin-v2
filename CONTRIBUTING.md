# Contributing to WebWaka Super Admin V2

## Prerequisites

- Node.js 20+
- pnpm 9+
- Cloudflare account with Wrangler CLI installed (`npm i -g wrangler`)

## Local development setup

```bash
# 1. Install dependencies
pnpm install

# 2. Copy env vars
cp .env.example frontend/.env.local
# Edit frontend/.env.local and set VITE_API_URL=http://localhost:8787

# 3. Apply D1 migrations locally
cd workers
wrangler d1 migrations apply rbac_staging --local
wrangler d1 migrations apply tenants_staging --local
wrangler d1 migrations apply billing_staging --local
wrangler d1 migrations apply modules_staging --local
wrangler d1 migrations apply health_staging --local

# 4. Set secrets for local Workers dev
wrangler secret put JWT_SECRET   # paste a 32-char random hex string

# 5. Start Workers API (port 8787)
pnpm wrangler dev --port 8787

# 6. In another terminal, start frontend (port 5173)
cd ../frontend && pnpm dev
```

## Project structure

```
webwaka-super-admin-v2/
├── frontend/          # React 19 + Vite + TypeScript SPA
│   ├── src/
│   │   ├── pages/     # Route-level page components
│   │   ├── components/# Shared UI components
│   │   ├── hooks/     # Custom React hooks
│   │   ├── contexts/  # React Context providers
│   │   ├── lib/       # API clients and utilities
│   │   └── locales/   # i18n translation files (en, yo, ig, ha)
│   └── public/        # Static assets + PWA manifest + sw.js
├── workers/           # Hono Cloudflare Workers API
│   ├── src/index.ts   # All API routes and middleware
│   ├── migrations/    # D1 SQL migration files
│   └── wrangler.toml  # Workers + D1 + KV configuration
└── packages/          # Shared internal packages (types, utils)
```

## Branching strategy

| Branch | Purpose |
|--------|---------|
| `main` | Production-ready code; protected |
| `feature/*` | New features |
| `fix/*` | Bug fixes |
| `chore/*` | Tooling, deps, docs |

PRs must pass all checks before merging to main.

## Commit convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add billing commissions endpoint
fix: correct session KV key prefix
chore: update wrangler to v4
docs: add CONTRIBUTING guide
```

## Workers secrets (DO NOT commit)

All secrets are managed via Cloudflare dashboard or `wrangler secret put`:

| Secret | Description |
|--------|-------------|
| `JWT_SECRET` | HS256 signing key — min 32 chars |

Set per environment:
```bash
wrangler secret put JWT_SECRET --env staging
wrangler secret put JWT_SECRET --env production
```

## Deployment

This project deploys **exclusively to Cloudflare**. Do NOT use Replit deployments.

```bash
# Deploy to staging
pnpm --filter workers wrangler deploy --env staging

# Deploy frontend (Cloudflare Pages)
cd frontend && pnpm build
# Then upload dist/ via Cloudflare Pages dashboard or wrangler pages deploy
```

## Code style

- TypeScript strict mode enabled
- No `any` unless wrapped with a comment explaining why
- Zod for all external input validation
- All API errors return `{ success: false, error: "..." }`
- All API successes return `{ success: true, data: { ... } }`

## Adding a new API endpoint

1. Add route in `workers/src/index.ts`
2. Use `requireAuth(c)` or `requirePermission(c, 'action:resource')` for auth
3. Validate input with Zod before touching the database
4. Return `apiResponse(true, data)` on success
5. Add the corresponding method to `frontend/src/lib/api-client.ts`
6. Add a D1 migration if the schema changes

## Adding a D1 migration

```bash
# Create the migration file
wrangler d1 migrations create <database_name> <migration_name>
# e.g.: wrangler d1 migrations create rbac_staging add_audit_indexes

# Apply locally for testing
wrangler d1 migrations apply rbac_staging --local

# Apply to staging
wrangler d1 migrations apply rbac_staging --env staging
```
