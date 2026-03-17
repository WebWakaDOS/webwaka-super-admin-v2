# Cloudflare Infrastructure Setup Guide - WebWaka Super Admin v2

**Document Version:** 1.0  
**Last Updated:** March 17, 2026  
**Status:** COMPREHENSIVE SETUP GUIDE

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Phase 1: Create D1 Databases](#phase-1-create-d1-databases)
4. [Phase 2: Create KV Namespaces](#phase-2-create-kv-namespaces)
5. [Phase 3: Update wrangler.toml](#phase-3-update-wranglertoml)
6. [Phase 4: Run Migrations](#phase-4-run-migrations)
7. [Phase 5: Seed Data](#phase-5-seed-data)
8. [Phase 6: Verify Infrastructure](#phase-6-verify-infrastructure)
9. [Troubleshooting](#troubleshooting)
10. [References](#references)

---

## Overview

This guide provides comprehensive instructions for setting up Cloudflare D1 (SQLite databases) and KV (key-value store) infrastructure for the WebWaka Super Admin v2 application. The setup creates separate staging and production environments with complete isolation and proper resource management.

### Infrastructure Architecture

The WebWaka Super Admin v2 uses a multi-database approach for strict data separation and compliance:

| Resource Type | Staging | Production | Purpose |
|---------------|---------|------------|---------|
| **D1 Databases** | 5 | 5 | Persistent data storage (tenants, billing, RBAC, modules, health) |
| **KV Namespaces** | 4 | 4 | Caching and session management |
| **Total Resources** | 9 | 9 | Complete isolation between environments |

### Compliance Requirements

All infrastructure setup MUST enforce the 7 Core Invariants:

- ✅ **Build Once Use Infinitely** - Single infrastructure code for all environments
- ✅ **Mobile First** - Edge-native performance for mobile users
- ✅ **PWA First** - Service worker support with offline capabilities
- ✅ **Offline First** - KV caching enables offline functionality
- ✅ **Nigeria First** - Optimized for Nigerian network conditions
- ✅ **Africa First** - Pan-African deployment ready
- ✅ **Vendor Neutral AI** - No vendor lock-in, open standards

---

## Prerequisites

Before starting infrastructure setup, ensure you have:

### 1. Required Tools

```bash
# Install Wrangler CLI (Cloudflare Workers command-line tool)
npm install -g wrangler

# Verify installation
wrangler --version
# Expected output: wrangler 4.70.0 or higher
```

### 2. Cloudflare Account

- Active Cloudflare account with billing enabled
- Account ID: `a5f5864b726209519e0c361f2bb90e79` (from your account)
- API Token with D1 and KV permissions

### 3. Credentials

You will need:
- **CLOUDFLARE_ACCOUNT_ID** - Your Cloudflare account ID
- **CLOUDFLARE_API_TOKEN** - API token with D1 and KV permissions

### 4. Node.js Environment

```bash
# Verify Node.js version
node --version
# Expected: v18.0.0 or higher

# Verify pnpm is installed
pnpm --version
# Expected: 8.0.0 or higher
```

### 5. Git Configuration

```bash
# Verify git is configured
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

---

## Phase 1: Create D1 Databases

D1 is Cloudflare's SQLite database service. We will create 5 databases for each environment (staging and production).

### 1.1 Set Environment Variables

First, export your Cloudflare credentials:

```bash
export CLOUDFLARE_ACCOUNT_ID="a5f5864b726209519e0c361f2bb90e79"
export CLOUDFLARE_API_TOKEN="h1-qHdA-R9b2Y3QNdDLLK3OQ7yQu05dccp0eGNgw"
```

### 1.2 Create Staging D1 Databases

Create 5 databases for the staging environment:

```bash
# Database 1: TENANTS_DB (Tenant registry and multi-tenancy core)
wrangler d1 create tenants_staging

# Database 2: BILLING_DB (Immutable ledger, commissions, escrow)
wrangler d1 create billing_staging

# Database 3: RBAC_DB (Roles, permissions, audit log)
wrangler d1 create rbac_staging

# Database 4: MODULES_DB (Module registry, feature flags)
wrangler d1 create modules_staging

# Database 5: HEALTH_DB (Service health, metrics, alerts)
wrangler d1 create health_staging
```

**Important:** Note the database IDs returned by each command. They will look like:
```
✅ Successfully created D1 database 'tenants_staging'
📝 Binding name: tenants_staging
🔗 Database ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

Save these IDs for use in Phase 3 (updating wrangler.toml).

### 1.3 Create Production D1 Databases

Create 5 databases for the production environment:

```bash
# Database 1: TENANTS_DB (Production)
wrangler d1 create tenants_prod

# Database 2: BILLING_DB (Production)
wrangler d1 create billing_prod

# Database 3: RBAC_DB (Production)
wrangler d1 create rbac_prod

# Database 4: MODULES_DB (Production)
wrangler d1 create modules_prod

# Database 5: HEALTH_DB (Production)
wrangler d1 create health_prod
```

Again, save all the database IDs returned.

### 1.4 Verify D1 Databases

List all created databases:

```bash
wrangler d1 list
```

Expected output:
```
┌─────────────────────────────────────────────────────┬──────────────────────────────────────┐
│ name                                                │ id                                   │
├─────────────────────────────────────────────────────┼──────────────────────────────────────┤
│ tenants_staging                                     │ xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx │
│ billing_staging                                     │ xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx │
│ rbac_staging                                        │ xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx │
│ modules_staging                                     │ xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx │
│ health_staging                                      │ xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx │
│ tenants_prod                                        │ xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx │
│ billing_prod                                        │ xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx │
│ rbac_prod                                           │ xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx │
│ modules_prod                                        │ xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx │
│ health_prod                                         │ xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx │
└─────────────────────────────────────────────────────┴──────────────────────────────────────┘
```

---

## Phase 2: Create KV Namespaces

KV namespaces provide fast, distributed key-value storage for caching and session management.

### 2.1 Create Staging KV Namespaces

Create 4 KV namespaces for staging:

```bash
# Namespace 1: SESSIONS_KV (JWT session storage, 24-hour TTL)
wrangler kv:namespace create "webwaka_sessions_staging" --preview false

# Namespace 2: FEATURE_FLAGS_KV (Feature flag cache, 1-hour TTL)
wrangler kv:namespace create "webwaka_flags_staging" --preview false

# Namespace 3: CACHE_KV (Computed summaries, 15-minute TTL)
wrangler kv:namespace create "webwaka_cache_staging" --preview false

# Namespace 4: NOTIFICATIONS_KV (Rate limits and retry queues, 5-minute TTL)
wrangler kv:namespace create "webwaka_notifications_staging" --preview false
```

**Important:** Note the namespace IDs returned. They will look like:
```
✅ Successfully created namespace 'webwaka_sessions_staging'
📝 Namespace ID: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 2.2 Create Production KV Namespaces

Create 4 KV namespaces for production:

```bash
# Namespace 1: SESSIONS_KV (Production)
wrangler kv:namespace create "webwaka_sessions_prod" --preview false

# Namespace 2: FEATURE_FLAGS_KV (Production)
wrangler kv:namespace create "webwaka_flags_prod" --preview false

# Namespace 3: CACHE_KV (Production)
wrangler kv:namespace create "webwaka_cache_prod" --preview false

# Namespace 4: NOTIFICATIONS_KV (Production)
wrangler kv:namespace create "webwaka_notifications_prod" --preview false
```

Save all the namespace IDs returned.

### 2.3 Verify KV Namespaces

List all created namespaces:

```bash
wrangler kv:namespace list
```

Expected output:
```
┌──────────────────────────────────────────────────────┬──────────────────────────────────────┐
│ title                                                │ id                                   │
├──────────────────────────────────────────────────────┼──────────────────────────────────────┤
│ webwaka_sessions_staging                             │ xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx     │
│ webwaka_flags_staging                                │ xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx     │
│ webwaka_cache_staging                                │ xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx     │
│ webwaka_notifications_staging                        │ xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx     │
│ webwaka_sessions_prod                                │ xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx     │
│ webwaka_flags_prod                                   │ xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx     │
│ webwaka_cache_prod                                   │ xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx     │
│ webwaka_notifications_prod                           │ xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx     │
└──────────────────────────────────────────────────────┴──────────────────────────────────────┘
```

---

## Phase 3: Update wrangler.toml

Now that all D1 databases and KV namespaces are created, update `workers/wrangler.toml` with the actual resource IDs.

### 3.1 Gather All Resource IDs

Create a spreadsheet or document with all IDs:

```
STAGING ENVIRONMENT:
- TENANTS_DB: [ID from Phase 1.2]
- BILLING_DB: [ID from Phase 1.2]
- RBAC_DB: [ID from Phase 1.2]
- MODULES_DB: [ID from Phase 1.2]
- HEALTH_DB: [ID from Phase 1.2]
- SESSIONS_KV: [ID from Phase 2.1]
- FEATURE_FLAGS_KV: [ID from Phase 2.1]
- CACHE_KV: [ID from Phase 2.1]
- NOTIFICATIONS_KV: [ID from Phase 2.1]

PRODUCTION ENVIRONMENT:
- TENANTS_DB: [ID from Phase 1.3]
- BILLING_DB: [ID from Phase 1.3]
- RBAC_DB: [ID from Phase 1.3]
- MODULES_DB: [ID from Phase 1.3]
- HEALTH_DB: [ID from Phase 1.3]
- SESSIONS_KV: [ID from Phase 2.2]
- FEATURE_FLAGS_KV: [ID from Phase 2.2]
- CACHE_KV: [ID from Phase 2.2]
- NOTIFICATIONS_KV: [ID from Phase 2.2]
```

### 3.2 Update wrangler.toml

Replace all placeholder IDs in `workers/wrangler.toml` with actual IDs:

```toml
# Example - replace with your actual IDs:
[[env.staging.d1_databases]]
binding = "TENANTS_DB"
database_name = "tenants_staging"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"  # Replace with actual ID

[[env.staging.kv_namespaces]]
binding = "SESSIONS_KV"
id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"  # Replace with actual ID
preview_id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"  # Replace with actual preview ID
```

**Critical:** Replace ALL placeholder IDs with actual IDs from your Cloudflare account.

---

## Phase 4: Run Migrations

Migrations initialize the database schemas with all required tables, indexes, and constraints.

### 4.1 Run Staging Migrations

```bash
cd /home/ubuntu/webwaka-super-admin-v2/workers

# Run all migrations for staging environment
wrangler d1 migrations apply tenants_staging --env staging
wrangler d1 migrations apply billing_staging --env staging
wrangler d1 migrations apply rbac_staging --env staging
wrangler d1 migrations apply modules_staging --env staging
wrangler d1 migrations apply health_staging --env staging
```

### 4.2 Run Production Migrations

```bash
# Run all migrations for production environment
wrangler d1 migrations apply tenants_prod --env production
wrangler d1 migrations apply billing_prod --env production
wrangler d1 migrations apply rbac_prod --env production
wrangler d1 migrations apply modules_prod --env production
wrangler d1 migrations apply health_prod --env production
```

### 4.3 Verify Migrations

Check that all tables were created:

```bash
# Check staging database schema
wrangler d1 execute tenants_staging --env staging --command ".tables"

# Check production database schema
wrangler d1 execute tenants_prod --env production --command ".tables"
```

---

## Phase 5: Seed Data

Seed scripts populate databases with initial data for testing and development.

### 5.1 Seed Staging Data

```bash
cd /home/ubuntu/webwaka-super-admin-v2/workers

# Run staging seed script
pnpm run seed:staging
```

This will:
- Create 3 demo tenants
- Create test users with various roles
- Seed commission structure (5-level hierarchy)
- Create sample transaction data

### 5.2 Seed Production Data

```bash
# Run production seed script (requires confirmation)
pnpm run seed:production
```

This will:
- Create super admin tenant
- Create super admin user
- Seed billing plans (Starter, Professional, Enterprise)
- Seed all platform modules
- Seed feature flags
- Seed health monitoring services

---

## Phase 6: Verify Infrastructure

Verify that all infrastructure is properly set up and operational.

### 6.1 Verify D1 Databases

```bash
# List all databases
wrangler d1 list

# Query staging database
wrangler d1 execute tenants_staging --env staging --command "SELECT COUNT(*) as tenant_count FROM tenants;"

# Query production database
wrangler d1 execute tenants_prod --env production --command "SELECT COUNT(*) as tenant_count FROM tenants;"
```

### 6.2 Verify KV Namespaces

```bash
# List all namespaces
wrangler kv:namespace list

# Put test value in staging KV
wrangler kv:key put --namespace-id=[staging_kv_id] test_key "test_value"

# Get test value from staging KV
wrangler kv:key get --namespace-id=[staging_kv_id] test_key
```

### 6.3 Test API Endpoints

```bash
# Deploy to staging first
cd /home/ubuntu/webwaka-super-admin-v2/workers
wrangler deploy --env staging

# Test health endpoint
curl https://webwaka-super-admin-api-staging.webwaka.workers.dev/health

# Test login endpoint
curl -X POST https://webwaka-super-admin-api-staging.webwaka.workers.dev/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@webwaka.com","password":"password"}'
```

---

## Troubleshooting

### Issue: "Authentication error [code: 10000]"

**Solution:** Your API token doesn't have D1 permissions. Create a new token with D1 and KV permissions:

1. Go to [Cloudflare API Tokens](https://dash.cloudflare.com/a5f5864b726209519e0c361f2bb90e79/api-tokens)
2. Click "Create Token"
3. Select "Custom Token"
4. Add permissions: "D1 Edit", "KV Edit", "Workers Scripts Write"
5. Copy the new token and update `CLOUDFLARE_API_TOKEN`

### Issue: "Database not found"

**Solution:** Verify the database_id in wrangler.toml matches the actual database ID:

```bash
# List databases and verify IDs
wrangler d1 list

# Check wrangler.toml has correct ID
grep "database_id" workers/wrangler.toml
```

### Issue: "KV namespace not found"

**Solution:** Verify the namespace ID in wrangler.toml matches the actual namespace ID:

```bash
# List namespaces and verify IDs
wrangler kv:namespace list

# Check wrangler.toml has correct ID
grep "id =" workers/wrangler.toml
```

### Issue: "Migrations failed to apply"

**Solution:** Verify migration files exist and are valid SQL:

```bash
# Check migration files
ls -la workers/migrations/

# Verify SQL syntax
cat workers/migrations/001_init_tenants.sql
```

---

## References

1. [Cloudflare D1 Documentation](https://developers.cloudflare.com/d1/)
2. [Cloudflare KV Documentation](https://developers.cloudflare.com/workers/runtime-apis/kv/)
3. [Wrangler CLI Documentation](https://developers.cloudflare.com/workers/wrangler/)
4. [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)

---

**Document Status:** ✅ COMPLETE  
**Last Reviewed:** March 17, 2026  
**Next Review:** After infrastructure deployment
