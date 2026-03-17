#!/usr/bin/env node

/**
 * WebWaka Super Admin v2 - Update wrangler.toml with Resource IDs
 * 
 * This script updates workers/wrangler.toml with actual D1 database IDs and KV namespace IDs
 * extracted from the INFRASTRUCTURE_RESOURCES.json file created by setup-infrastructure.mjs
 * 
 * Prerequisites:
 * - INFRASTRUCTURE_RESOURCES.json file must exist (created by setup-infrastructure.mjs)
 * - workers/wrangler.toml must exist
 * 
 * Usage:
 *   node scripts/update-wrangler-config.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.dirname(__dirname);

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = {
    info: '📋',
    success: '✅',
    error: '❌',
    warning: '⚠️',
    step: '→',
  }[type] || '•';

  console.log(`[${timestamp}] ${prefix} ${message}`);
}

function extractResourceIds(resourcesData) {
  log('Extracting resource IDs from infrastructure resources...', 'step');

  const resourceIds = {
    staging: {
      databases: {},
      namespaces: {},
    },
    production: {
      databases: {},
      namespaces: {},
    },
  };

  // Extract D1 database IDs
  for (const db of resourcesData.staging.databases) {
    if (db.success && db.output) {
      const match = db.output.match(/Database ID: ([\w-]+)/);
      if (match) {
        resourceIds.staging.databases[db.name] = match[1];
      }
    }
  }

  for (const db of resourcesData.production.databases) {
    if (db.success && db.output) {
      const match = db.output.match(/Database ID: ([\w-]+)/);
      if (match) {
        resourceIds.production.databases[db.name] = match[1];
      }
    }
  }

  // Extract KV namespace IDs
  for (const ns of resourcesData.staging.namespaces) {
    if (ns.success && ns.output) {
      const match = ns.output.match(/Namespace ID: ([\w]+)/);
      if (match) {
        resourceIds.staging.namespaces[ns.name] = match[1];
      }
    }
  }

  for (const ns of resourcesData.production.namespaces) {
    if (ns.success && ns.output) {
      const match = ns.output.match(/Namespace ID: ([\w]+)/);
      if (match) {
        resourceIds.production.namespaces[ns.name] = match[1];
      }
    }
  }

  return resourceIds;
}

function generateWranglerToml(resourceIds) {
  log('Generating wrangler.toml configuration...', 'step');

  const toml = `name = "webwaka-super-admin-api"
main = "src/index.ts"
compatibility_date = "2026-03-15"
compatibility_flags = ["nodejs_compat"]

# ============================================================================
# ENVIRONMENT: Staging
# ============================================================================
[env.staging]
name = "webwaka-super-admin-api-staging"
vars = { ENVIRONMENT = "staging" }

# D1 Database Bindings (Staging)
[[env.staging.d1_databases]]
binding = "TENANTS_DB"
database_name = "tenants_staging"
database_id = "${resourceIds.staging.databases['tenants_staging'] || 'tenants_staging_id'}"

[[env.staging.d1_databases]]
binding = "BILLING_DB"
database_name = "billing_staging"
database_id = "${resourceIds.staging.databases['billing_staging'] || 'billing_staging_id'}"

[[env.staging.d1_databases]]
binding = "RBAC_DB"
database_name = "rbac_staging"
database_id = "${resourceIds.staging.databases['rbac_staging'] || 'rbac_staging_id'}"

[[env.staging.d1_databases]]
binding = "MODULES_DB"
database_name = "modules_staging"
database_id = "${resourceIds.staging.databases['modules_staging'] || 'modules_staging_id'}"

[[env.staging.d1_databases]]
binding = "HEALTH_DB"
database_name = "health_staging"
database_id = "${resourceIds.staging.databases['health_staging'] || 'health_staging_id'}"

# KV Namespace Bindings (Staging)
[[env.staging.kv_namespaces]]
binding = "SESSIONS_KV"
id = "${resourceIds.staging.namespaces['webwaka_sessions_staging'] || 'webwaka_sessions_staging_id'}"
preview_id = "${resourceIds.staging.namespaces['webwaka_sessions_staging'] || 'webwaka_sessions_staging_preview_id'}"

[[env.staging.kv_namespaces]]
binding = "FEATURE_FLAGS_KV"
id = "${resourceIds.staging.namespaces['webwaka_flags_staging'] || 'webwaka_flags_staging_id'}"
preview_id = "${resourceIds.staging.namespaces['webwaka_flags_staging'] || 'webwaka_flags_staging_preview_id'}"

[[env.staging.kv_namespaces]]
binding = "CACHE_KV"
id = "${resourceIds.staging.namespaces['webwaka_cache_staging'] || 'webwaka_cache_staging_id'}"
preview_id = "${resourceIds.staging.namespaces['webwaka_cache_staging'] || 'webwaka_cache_staging_preview_id'}"

[[env.staging.kv_namespaces]]
binding = "NOTIFICATIONS_KV"
id = "${resourceIds.staging.namespaces['webwaka_notifications_staging'] || 'webwaka_notifications_staging_id'}"
preview_id = "${resourceIds.staging.namespaces['webwaka_notifications_staging'] || 'webwaka_notifications_staging_preview_id'}"

# ============================================================================
# ENVIRONMENT: Production
# ============================================================================
[env.production]
name = "webwaka-super-admin-api-prod"
vars = { ENVIRONMENT = "production" }

# D1 Database Bindings (Production)
[[env.production.d1_databases]]
binding = "TENANTS_DB"
database_name = "tenants_prod"
database_id = "${resourceIds.production.databases['tenants_prod'] || 'tenants_prod_id'}"

[[env.production.d1_databases]]
binding = "BILLING_DB"
database_name = "billing_prod"
database_id = "${resourceIds.production.databases['billing_prod'] || 'billing_prod_id'}"

[[env.production.d1_databases]]
binding = "RBAC_DB"
database_name = "rbac_prod"
database_id = "${resourceIds.production.databases['rbac_prod'] || 'rbac_prod_id'}"

[[env.production.d1_databases]]
binding = "MODULES_DB"
database_name = "modules_prod"
database_id = "${resourceIds.production.databases['modules_prod'] || 'modules_prod_id'}"

[[env.production.d1_databases]]
binding = "HEALTH_DB"
database_name = "health_prod"
database_id = "${resourceIds.production.databases['health_prod'] || 'health_prod_id'}"

# KV Namespace Bindings (Production)
[[env.production.kv_namespaces]]
binding = "SESSIONS_KV"
id = "${resourceIds.production.namespaces['webwaka_sessions_prod'] || 'webwaka_sessions_prod_id'}"
preview_id = "${resourceIds.production.namespaces['webwaka_sessions_prod'] || 'webwaka_sessions_prod_preview_id'}"

[[env.production.kv_namespaces]]
binding = "FEATURE_FLAGS_KV"
id = "${resourceIds.production.namespaces['webwaka_flags_prod'] || 'webwaka_flags_prod_id'}"
preview_id = "${resourceIds.production.namespaces['webwaka_flags_prod'] || 'webwaka_flags_prod_preview_id'}"

[[env.production.kv_namespaces]]
binding = "CACHE_KV"
id = "${resourceIds.production.namespaces['webwaka_cache_prod'] || 'webwaka_cache_prod_id'}"
preview_id = "${resourceIds.production.namespaces['webwaka_cache_prod'] || 'webwaka_cache_prod_preview_id'}"

[[env.production.kv_namespaces]]
binding = "NOTIFICATIONS_KV"
id = "${resourceIds.production.namespaces['webwaka_notifications_prod'] || 'webwaka_notifications_prod_id'}"
preview_id = "${resourceIds.production.namespaces['webwaka_notifications_prod'] || 'webwaka_notifications_prod_preview_id'}"

# ============================================================================
# Build Configuration
# ============================================================================
[build]
command = "npm run build"
cwd = "."

# ============================================================================
# Migrations Configuration
# ============================================================================
[migrations]
path = "migrations"

# ============================================================================
# Environment Variables (Shared)
# ============================================================================
[env.staging.vars]
ENVIRONMENT = "staging"
LOG_LEVEL = "debug"
CACHE_TTL = "300"

[env.production.vars]
ENVIRONMENT = "production"
LOG_LEVEL = "info"
CACHE_TTL = "3600"

# ============================================================================
# Observability
# ============================================================================
[observability]
enabled = true
`;

  return toml;
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  log('WebWaka Super Admin v2 - Update wrangler.toml Script', 'info');
  log('================================================', 'info');

  // Check if INFRASTRUCTURE_RESOURCES.json exists
  const resourcesFile = path.join(projectRoot, 'INFRASTRUCTURE_RESOURCES.json');
  if (!fs.existsSync(resourcesFile)) {
    log(`INFRASTRUCTURE_RESOURCES.json not found at ${resourcesFile}`, 'error');
    log('Run setup-infrastructure.mjs first to create this file', 'info');
    process.exit(1);
  }

  // Read infrastructure resources
  log('Reading INFRASTRUCTURE_RESOURCES.json...', 'step');
  const resourcesData = JSON.parse(fs.readFileSync(resourcesFile, 'utf-8'));
  log('Infrastructure resources loaded', 'success');

  // Extract resource IDs
  const resourceIds = extractResourceIds(resourcesData);

  // Generate new wrangler.toml
  const newWranglerToml = generateWranglerToml(resourceIds);

  // Backup existing wrangler.toml
  const wranglerPath = path.join(projectRoot, 'workers', 'wrangler.toml');
  const backupPath = path.join(projectRoot, 'workers', 'wrangler.toml.backup');

  if (fs.existsSync(wranglerPath)) {
    log(`Backing up existing wrangler.toml to ${backupPath}...`, 'step');
    fs.copyFileSync(wranglerPath, backupPath);
    log('Backup created', 'success');
  }

  // Write new wrangler.toml
  log(`Writing updated wrangler.toml to ${wranglerPath}...`, 'step');
  fs.writeFileSync(wranglerPath, newWranglerToml);
  log('wrangler.toml updated successfully', 'success');

  // Summary
  log('\n=== UPDATE COMPLETE ===', 'success');
  log('✅ wrangler.toml has been updated with actual resource IDs!', 'success');
  log('\nResource IDs configured:', 'info');
  log(`Staging D1 Databases: ${Object.keys(resourceIds.staging.databases).length}`, 'info');
  log(`Staging KV Namespaces: ${Object.keys(resourceIds.staging.namespaces).length}`, 'info');
  log(`Production D1 Databases: ${Object.keys(resourceIds.production.databases).length}`, 'info');
  log(`Production KV Namespaces: ${Object.keys(resourceIds.production.namespaces).length}`, 'info');
  log('\nNext steps:', 'info');
  log('1. Run migrations: pnpm run migrate:staging && pnpm run migrate:production', 'info');
  log('2. Seed data: pnpm run seed:staging && pnpm run seed:production', 'info');
  log('3. Deploy: pnpm run deploy', 'info');
}

main().catch((error) => {
  log(`Fatal error: ${error.message}`, 'error');
  process.exit(1);
});
