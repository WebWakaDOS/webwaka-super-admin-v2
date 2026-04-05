# ⚠️ Action Required — Post-Fix Manual Steps

This document tracks fixes that were applied automatically and those that require
manual action (e.g., creating Cloudflare D1 databases that can't be done via API).

**Applied by automated review — 2026-04-05**

---

## 🔴 CRITICAL — Create New D1 Databases

Several repos were sharing the same D1 database (`ee93377c-8000-45d6-ae54-f0d4c588bf04`,
originally the institutional DB). Each vertical needs its own isolated database to prevent
table name collisions and cross-vertical data mixing.

Run these commands to create the required databases, then update the `REPLACE_WITH_...`
placeholders in each repo's `wrangler.toml`:

### webwaka-fintech
```bash
wrangler d1 create webwaka-fintech-db-staging
wrangler d1 create webwaka-fintech-db-prod
# Then update wrangler.toml: REPLACE_WITH_FINTECH_STAGING_DB_ID / REPLACE_WITH_FINTECH_PROD_DB_ID
```

### webwaka-services
```bash
wrangler d1 create webwaka-services-db-staging
wrangler d1 create webwaka-services-db-prod
# Then update wrangler.toml: REPLACE_WITH_SERVICES_STAGING_DB_ID / REPLACE_WITH_SERVICES_PROD_DB_ID
```

### webwaka-production (manufacturing suite)
```bash
wrangler d1 create webwaka-production-db-staging
wrangler d1 create webwaka-production-db-prod
# Then update wrangler.toml: REPLACE_WITH_PRODUCTION_STAGING_DB_ID / REPLACE_WITH_PRODUCTION_PROD_DB_ID
```

### webwaka-real-estate
```bash
wrangler d1 create webwaka-real-estate-db-staging
wrangler d1 create webwaka-real-estate-db-prod
# Then update wrangler.toml: REPLACE_WITH_REAL_ESTATE_DB_ID (appears in both staging + prod)
```

### webwaka-professional
```bash
wrangler d1 create webwaka-professional-db-staging
wrangler d1 create webwaka-professional-db-prod
# Then update wrangler.toml: REPLACE_WITH_PROFESSIONAL_DB_ID
```

After creating each DB, apply its migrations:
```bash
wrangler d1 migrations apply <db-name> --env staging --remote
wrangler d1 migrations apply <db-name> --env production --remote
```

---

## 🔴 CRITICAL — Create Production KV Namespaces for Logistics

`webwaka-logistics` production KV namespaces were using the same IDs as dev.
Create dedicated production KV namespaces:

```bash
wrangler kv:namespace create SESSIONS_KV --env production
wrangler kv:namespace create EVENTS --env production
# Then update wrangler.toml: REPLACE_WITH_PRODUCTION_SESSIONS_KV_ID / REPLACE_WITH_PRODUCTION_EVENTS_KV_ID
```

---

## 🟡 IMPORTANT — Set Missing Secrets

### webwaka-logistics
```bash
wrangler secret put JWT_SECRET --env staging
wrangler secret put JWT_SECRET --env production
wrangler secret put INTER_SERVICE_SECRET --env staging
wrangler secret put INTER_SERVICE_SECRET --env production
```

### All repos using INTER_SERVICE_SECRET (shared value across org)
Ensure the same `INTER_SERVICE_SECRET` value is set in:
- webwaka-fintech, webwaka-services, webwaka-institutional, webwaka-production,
  webwaka-real-estate, webwaka-professional, webwaka-ai-platform, webwaka-central-mgmt

---

## 🟡 IMPORTANT — Verify GitHub Secrets

Two repos (`webwaka-fintech`, `webwaka-services`) were using `CF_API_TOKEN` in CI
but all other repos use `CLOUDFLARE_API_TOKEN`. These have been updated to use
`CLOUDFLARE_API_TOKEN`. Verify this secret exists in both repos' GitHub settings:

- Go to: https://github.com/WebWakaDOS/webwaka-fintech/settings/secrets/actions
- Go to: https://github.com/WebWakaDOS/webwaka-services/settings/secrets/actions
- Ensure `CLOUDFLARE_API_TOKEN` is set (not just `CF_API_TOKEN`)

---

## 🟡 IMPORTANT — webwaka-logistics: Add Staging Env to wrangler.toml

A staging env block has been added to `wrangler.toml`. You still need to:
1. Create the staging DB: `wrangler d1 create webwaka-logistics-db-staging`
   (or point to the existing logistics DB — it already has its own isolated DB `62d267a4`)
2. The staging env currently reuses the same D1 ID as production — this is fine for
   logistics (it has its own DB) but KV namespaces should differ.

---

## 🟢 Already Fixed Automatically

| Fix | Repo | Commit |
|-----|------|--------|
| `verifyJwt` → `verifyJWT` + remove tenant-from-header in vendor auth | webwaka-commerce | 51163c8 |
| Workflow name + `CF_API_TOKEN` → `CLOUDFLARE_API_TOKEN` + console.log enforcement | webwaka-fintech | 715f06e |
| Workflow name + `CF_API_TOKEN` → `CLOUDFLARE_API_TOKEN` + console.log enforcement | webwaka-services | 15e1c32 |
| Fix wrong migration filename `001_commerce_schema.sql` → glob loop | webwaka-logistics | feee857 |
| Add staging env, fix KV ID collision, document secrets | webwaka-logistics | d489b1f |
| Admin migration endpoint: `JWT_SECRET` → `INTER_SERVICE_SECRET`, remove from PUBLIC_ROUTES | webwaka-logistics | 4bc84fc |
| Remove hardcoded `CLOUDFLARE_ACCOUNT_ID` from wrangler.toml vars | webwaka-ui-builder | b4d8bb0 |
| Dedicated fintech DB (was pointing to institutional DB) | webwaka-fintech | 2e9e0c8f |
| Dedicated services DB (was pointing to institutional DB, staff table collision) | webwaka-services | 9591714 |
| Dedicated production DB (manufacturing, was pointing to institutional DB) | webwaka-production | 7588744 |
| Dedicated real-estate DB (was pointing to institutional DB) | webwaka-real-estate | 184bb3f |
| Dedicated professional DB (was pointing to institutional DB) | webwaka-professional | 7b283f9 |

---

## 🔵 Known Issues (Not Yet Fixed — Larger Refactors)

1. **webwaka-logistics**: Inline JWT verification (crypto.subtle) should be replaced
   with `jwtAuthMiddleware` from `@webwaka/core` for consistency. Currently works but
   diverges from org standard.

2. **webwaka-super-admin-v2**: Does not use `@webwaka/core` for JWT — rolls its own
   auth. JWT format must be verified to be compatible with other services (same algorithm,
   payload shape) if cross-service token validation is needed.

3. **webwaka-core CHANGELOG**: Missing entries for v1.1.0–v1.3.0 and v1.6.x.
   Package is at v1.6.1 but changelog only documents through v1.5.0.

4. **webwaka-commerce `vendorAuthMiddleware`**: The sync endpoint `/api/sync/sync`
   is in PUBLIC_ROUTES but accepts tenant-scoped data — verify that the server-side
   tenant validation is robust before relying on this pattern.
