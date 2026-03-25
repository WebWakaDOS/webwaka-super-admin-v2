# Contributing to WebWaka Super Admin V2

## Prerequisites

- Node.js 20+
- pnpm 9+
- Cloudflare account with Wrangler CLI installed (`npm i -g wrangler`)
- Access to the GitHub repository

## Local development setup

```bash
# 1. Clone and install dependencies
git clone https://github.com/WebWakaDOS/webwaka-super-admin-v2.git
cd webwaka-super-admin-v2
pnpm install  # installs root + workspace deps

# 2. Copy env vars
cp .env.example frontend/.env.local
# Edit frontend/.env.local and set VITE_API_URL=http://localhost:8787

# 3. Apply D1 migrations locally (creates SQLite files under .wrangler/)
cd workers
wrangler d1 migrations apply rbac_staging --local
wrangler d1 migrations apply tenants_staging --local
wrangler d1 migrations apply billing_staging --local
wrangler d1 migrations apply modules_staging --local
wrangler d1 migrations apply health_staging --local

# 4. Seed local databases with test data
node workers/scripts/seed-local.mjs
# Default credentials: superadmin@webwaka.dev / WebWaka@2025!

# 5. Set required secrets for local Workers dev
echo "your-32-char-hex-secret" | wrangler secret put JWT_SECRET

# 6. Start Workers API (port 8787) — terminal 1
cd workers && wrangler dev --port 8787

# 7. Start frontend (port 5175) — terminal 2
cd frontend && pnpm dev --port 5175
```

## Running tests

### Unit tests (Vitest — 138 tests total)

```bash
cd workers
pnpm test               # watch mode
pnpm test --run         # single run (CI mode)

# Test files:
# src/__tests__/endpoints.test.ts   — 20 tests (API endpoint contract)
# src/__tests__/auth.test.ts        — 17 tests (login, bcrypt, KV TTL, JWT)
# src/__tests__/tenants.test.ts     — 22 tests (CRUD, soft-delete, pagination)
# src/__tests__/rbac.test.ts        — 52 tests (full permission matrix, 5 roles)
# src/__tests__/billing.test.ts     — 27 tests (kobo, ledger, MLM commissions)
```

### E2E tests (Playwright)

```bash
# Start the dev server first (in a separate terminal):
cd frontend && pnpm dev --port 5175

# Run all E2E tests (Desktop Chrome + Mobile Chrome/Pixel 5):
cd frontend && pnpm exec playwright test

# Run a specific spec:
pnpm exec playwright test e2e/tenant-lifecycle.spec.ts
pnpm exec playwright test e2e/partner-onboarding.spec.ts
pnpm exec playwright test e2e/super-admin-v2.spec.ts

# View the HTML report after a run:
pnpm exec playwright show-report
```

Playwright config: `frontend/playwright.config.ts`
E2E specs: `frontend/e2e/`

## Project structure

```
webwaka-super-admin-v2/
├── frontend/                   # React 19 + Vite + TypeScript SPA
│   ├── src/
│   │   ├── pages/              # Route-level page components
│   │   ├── components/         # Shared UI components
│   │   │   ├── DashboardLayout.tsx  # Mobile sidebar drawer
│   │   │   ├── Sidebar.tsx     # Responsive sidebar with overlay
│   │   │   └── Header.tsx      # Header with lang switcher + user menu
│   │   ├── hooks/              # Custom React hooks
│   │   ├── contexts/           # React Context providers (auth, i18n)
│   │   ├── lib/                # api.ts — unified API client
│   │   └── locales/            # i18n translation files (en, yo, ig, ha)
│   ├── public/
│   │   ├── manifest.webmanifest # PWA manifest
│   │   └── sw.js               # Service worker (offline support)
│   ├── e2e/                    # Playwright E2E specs
│   └── playwright.config.ts    # Playwright configuration
├── workers/                    # Hono Cloudflare Workers API
│   ├── src/
│   │   ├── index.ts            # All API routes and middleware (~2100 lines)
│   │   └── __tests__/          # Vitest unit tests (138 tests)
│   ├── migrations/             # D1 SQL migration files + seed SQL
│   ├── scripts/
│   │   └── seed-local.mjs      # Seeds all 4 local D1 databases
│   └── wrangler.toml           # Workers + D1 + KV configuration
└── IMPLEMENTATION_REPORT.md    # Completed roadmap audit
```

## Branching strategy

| Branch | Purpose |
|--------|---------|
| `master` | Production-ready; protected |
| `feature/*` | New features |
| `fix/*` | Bug fixes |
| `chore/*` | Tooling, deps, docs |

PRs must pass all CI checks (`frontend`, `workers`, `security`) before merging.

## Commit convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add billing commissions endpoint
fix: correct session KV key prefix
test: add rbac permission matrix tests
chore: update wrangler to v4
docs: add CONTRIBUTING guide
```

Types: `feat`, `fix`, `test`, `chore`, `docs`, `perf`, `refactor`

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

## API conventions

- All API errors return `{ success: false, error: "..." }`
- All API successes return `{ success: true, data: { ... } }`
- All monetary values are in **kobo** (integer) — 1 NGN = 100 kobo
- Partner onboarding requires `ndpr_consent: true` (NDPR compliance)
- Authentication: `Authorization: Bearer <token>` header
- Session TTL: 24 hours (stored in KV as `session:<token>`)

## Adding a new API endpoint

1. Add route in `workers/src/index.ts`
2. Use `requireAuth(c)` or `requirePermission(c, 'action:resource')` for auth
3. Validate input with Zod before touching the database
4. Return `apiResponse(true, data)` on success
5. Add the corresponding method to `frontend/src/lib/api.ts`
6. Add a D1 migration if the schema changes
7. Write a Vitest test in `workers/src/__tests__/`

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

## Deployment

This project deploys **exclusively to Cloudflare**. Do NOT use Replit deployments.

```bash
# Deploy Workers to staging
cd workers && wrangler deploy --env staging

# Deploy Workers to production
cd workers && wrangler deploy --env production

# Build frontend
cd frontend && pnpm build

# Deploy frontend to Cloudflare Pages (staging branch)
wrangler pages deploy dist --project-name webwaka-super-admin --branch staging

# Or use the CI pipeline — push to master triggers automatic deploy
```

## CI pipeline

GitHub Actions runs on every push and PR:

| Job | What it does |
|-----|-------------|
| `frontend` | Type-check + Vite production build |
| `workers` | Type-check + 138 Vitest unit tests |
| `security` | pnpm audit (high severity) + gitleaks secret scan |
| `e2e` | Playwright Desktop + Mobile (requires `PLAYWRIGHT_BASE_URL` var) |
| `deploy-staging` | Wrangler deploy (master only) |

## Nigeria First — Development invariants

| Invariant | Rule |
|-----------|------|
| Currency | All amounts in **kobo** (integer) — `z.number().int()` |
| NDPR | Partner onboarding requires `ndpr_consent: true` |
| Locale | Default `en-NG`; support Yoruba, Igbo, Hausa |
| MLM | 5-level commission system (levels 1–5) |
| Phone | Nigerian format `+234-XXX-XXX-XXXX` |
