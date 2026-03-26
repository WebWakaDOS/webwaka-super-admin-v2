# Environment Setup: webwaka-super-admin-v2

**Date:** 2026-03-23  
**Repo:** https://github.com/WebWakaDOS/webwaka-super-admin-v2

---

## Overview

This repo uses **two runtime environments**:
1. **Replit** — Development execution only. Frontend runs at port 5000.
2. **Cloudflare** — Sole deployment target (Pages for frontend, Workers for API).

Secrets are **never** committed to code. They are managed via:
- **Cloudflare Workers:** `wrangler secret put <KEY>` or Cloudflare dashboard
- **GitHub Actions:** Repository → Settings → Secrets and Variables → Actions
- **Replit:** Replit Secrets panel (dev-only values)

---

## 1. Cloudflare Workers — Runtime Secrets

Set via `wrangler secret put <KEY> --env <staging|production>` or the Cloudflare dashboard:

| Secret Key | Required | Description | How to Obtain |
|------------|----------|-------------|---------------|
| `JWT_SECRET` | **YES** | HS256 signing secret for JWT tokens. Min 32 chars. | Generate: `openssl rand -hex 32` |

**Example:**
```bash
wrangler secret put JWT_SECRET --env staging
wrangler secret put JWT_SECRET --env production
```

---

## 2. Cloudflare Workers — wrangler.toml Bindings

These are **configuration values** (not secrets) set in `workers/wrangler.toml`. They reference provisioned Cloudflare resources:

### D1 Databases (must be provisioned first)

```bash
# Provision each database
wrangler d1 create tenants_staging
wrangler d1 create billing_staging
wrangler d1 create rbac_staging
wrangler d1 create modules_staging
wrangler d1 create health_staging

wrangler d1 create tenants_prod
wrangler d1 create billing_prod
wrangler d1 create rbac_prod
wrangler d1 create modules_prod
wrangler d1 create health_prod
```

Update `workers/wrangler.toml` with the real `database_id` values returned by the above commands.

| wrangler.toml Binding | Env | Database Name |
|----------------------|-----|--------------|
| `TENANTS_DB` | staging/prod | `tenants_staging` / `tenants_prod` |
| `BILLING_DB` | staging/prod | `billing_staging` / `billing_prod` |
| `RBAC_DB` | staging/prod | `rbac_staging` / `rbac_prod` |
| `MODULES_DB` | staging/prod | `modules_staging` / `modules_prod` |
| `HEALTH_DB` | staging/prod | `health_staging` / `health_prod` |

### KV Namespaces (must be provisioned first)

```bash
wrangler kv namespace create SESSIONS_KV --env staging
wrangler kv namespace create FEATURE_FLAGS_KV --env staging
wrangler kv namespace create CACHE_KV --env staging
wrangler kv namespace create NOTIFICATIONS_KV --env staging
# Repeat for production
```

Update `workers/wrangler.toml` with returned `id` values.

### Environment Variables (non-secret, in wrangler.toml)

| Variable | Staging | Production |
|----------|---------|-----------|
| `ENVIRONMENT` | `staging` | `production` |
| `LOG_LEVEL` | `debug` | `info` |
| `CACHE_TTL` | `300` | `3600` |

---

## 3. GitHub Actions Secrets

Set in GitHub → Repository → Settings → Secrets and Variables → Actions:

| Secret | Required | Description |
|--------|----------|-------------|
| `CLOUDFLARE_API_TOKEN` | **YES** | Cloudflare API token with Workers + Pages + D1 edit permissions |
| `CLOUDFLARE_ACCOUNT_ID` | **YES** | Your Cloudflare account ID (from dashboard → top right) |

**Creating Cloudflare API Token:**
1. Go to https://dash.cloudflare.com/profile/api-tokens
2. Click "Create Token"
3. Use "Edit Cloudflare Workers" template
4. Add permissions: `Cloudflare Pages: Edit`, `D1: Edit`
5. Copy token → paste into GitHub secret

---

## 4. Frontend — Vite Environment Variables

Set in `frontend/.env.local` (development) or as build-time env vars in CI:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_API_URL` | No | Auto-detected | Override API base URL. Set to your Workers URL in production CI. |

**Example for CI (Cloudflare Pages build):**
```yaml
env:
  VITE_API_URL: https://webwaka-super-admin-api.webwaka.workers.dev
```

**Example for local dev with real Workers:**
```bash
# frontend/.env.local
VITE_API_URL=https://webwaka-super-admin-api-staging.webwaka.workers.dev
```

---

## 5. Replit-Specific (Dev Only)

| Secret/Variable | Value | Purpose |
|-----------------|-------|---------|
| `GITHUB_PAT` | GitHub Personal Access Token | Push commits/branches to GitHub from Replit |

**Request from user:** Needs `repo` scope at minimum (`Contents: write`, `Pull requests: write`).

**Configure git with PAT:**
```bash
git remote set-url origin https://<GITHUB_PAT>@github.com/WebWakaDOS/webwaka-super-admin-v2.git
```

---

## 6. Full Setup Checklist

```
[ ] 1. Provision Cloudflare D1 databases (5 staging + 5 production)
[ ] 2. Provision Cloudflare KV namespaces (4 staging + 4 production)
[ ] 3. Update workers/wrangler.toml with real database_id and KV namespace id values
[ ] 4. Set JWT_SECRET via wrangler secret put (staging + production)
[ ] 5. Set CLOUDFLARE_API_TOKEN in GitHub Actions secrets
[ ] 6. Set CLOUDFLARE_ACCOUNT_ID in GitHub Actions secrets
[ ] 7. Run D1 migrations: wrangler d1 migrations apply --env staging
[ ] 8. Run seed scripts: node workers/scripts/seed-staging.mjs
[ ] 9. Provide GITHUB_PAT to Replit for push access
[ ] 10. Set VITE_API_URL in Cloudflare Pages environment variables (production build)
```

---

## 7. Cross-Repo Shared Utilities

| Repo | Dependency | Status |
|------|-----------|--------|
| `webwaka-core` | `signJWT` (JWT signing) | **Inlined** in `workers/src/index.ts` using Web Crypto API. Replace with `@webwaka/core` import when that repo is available. |

---

## Security Notes

- All monetary values are stored as **INTEGER KOBO** — never floats.
- NDPR consent is enforced at API level (`ndpr_consent` required for all partner creation).
- JWT tokens expire in 24 hours; sessions stored in KV with matching TTL.
- Passwords hashed with bcryptjs (pure JS, Worker-compatible).
- Audit log in RBAC_DB tracks all privileged operations.
