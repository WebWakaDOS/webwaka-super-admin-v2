#!/usr/bin/env bash
# =============================================================================
# WebWaka Super Admin V2 — Production D1 + KV Provisioning
# =============================================================================
# Run this ONCE to create production Cloudflare D1 databases and KV namespaces.
# After running, paste the returned UUIDs into wrangler.toml [env.production].
#
# Prerequisites:
#   1. Install Wrangler: npm install -g wrangler
#   2. Authenticate: wrangler login
#   3. Confirm you are in the correct Cloudflare account
#
# Usage:
#   cd workers
#   bash scripts/provision-prod-dbs.sh
#
# =============================================================================

set -euo pipefail

ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-}"
if [ -z "$ACCOUNT_ID" ]; then
  echo "⚠  CLOUDFLARE_ACCOUNT_ID not set — wrangler will use the default account."
fi

echo ""
echo "=== Creating Production D1 Databases ==="
echo ""

echo "--- tenants_prod ---"
wrangler d1 create tenants_prod
echo ""

echo "--- billing_prod ---"
wrangler d1 create billing_prod
echo ""

echo "--- rbac_prod ---"
wrangler d1 create rbac_prod
echo ""

echo "--- modules_prod ---"
wrangler d1 create modules_prod
echo ""

echo "--- health_prod ---"
wrangler d1 create health_prod
echo ""

echo "=== Creating Production KV Namespaces ==="
echo ""

echo "--- SESSIONS_KV ---"
wrangler kv:namespace create SESSIONS_KV --env production
echo ""

echo "--- FEATURE_FLAGS_KV ---"
wrangler kv:namespace create FEATURE_FLAGS_KV --env production
echo ""

echo "--- CACHE_KV ---"
wrangler kv:namespace create CACHE_KV --env production
echo ""

echo "--- NOTIFICATIONS_KV ---"
wrangler kv:namespace create NOTIFICATIONS_KV --env production
echo ""

echo "============================================================"
echo "NEXT STEPS:"
echo "  1. Copy the database_id values above"
echo "  2. Paste them into wrangler.toml [env.production] section"
echo "  3. Apply migrations:"
echo ""
echo "  wrangler d1 migrations apply tenants_prod  --env production --remote"
echo "  wrangler d1 migrations apply billing_prod  --env production --remote"
echo "  wrangler d1 migrations apply rbac_prod     --env production --remote"
echo "  wrangler d1 migrations apply modules_prod  --env production --remote"
echo "  wrangler d1 migrations apply health_prod   --env production --remote"
echo ""
echo "  4. Set production secrets:"
echo "  wrangler secret put JWT_SECRET           --env production"
echo "  wrangler secret put BCRYPT_ROUNDS        --env production  # e.g. 12"
echo "============================================================"
