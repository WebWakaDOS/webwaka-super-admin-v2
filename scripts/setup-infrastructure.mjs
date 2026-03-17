#!/usr/bin/env node

/**
 * WebWaka Super Admin v2 - Automated Infrastructure Setup Script
 * 
 * This script automates the creation of Cloudflare D1 databases and KV namespaces
 * for both staging and production environments.
 * 
 * Prerequisites:
 * - Wrangler CLI installed globally
 * - CLOUDFLARE_ACCOUNT_ID environment variable set
 * - CLOUDFLARE_API_TOKEN environment variable set
 * 
 * Usage:
 *   node scripts/setup-infrastructure.mjs [--staging] [--production] [--all]
 * 
 * Examples:
 *   node scripts/setup-infrastructure.mjs --all        # Create all resources
 *   node scripts/setup-infrastructure.mjs --staging    # Create only staging resources
 *   node scripts/setup-infrastructure.mjs --production # Create only production resources
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

// ============================================================================
// CONFIGURATION
// ============================================================================

const D1_DATABASES = {
  staging: [
    { name: 'tenants_staging', description: 'Tenant registry and multi-tenancy core' },
    { name: 'billing_staging', description: 'Immutable ledger, commissions, escrow' },
    { name: 'rbac_staging', description: 'Roles, permissions, audit log' },
    { name: 'modules_staging', description: 'Module registry, feature flags' },
    { name: 'health_staging', description: 'Service health, metrics, alerts' },
  ],
  production: [
    { name: 'tenants_prod', description: 'Tenant registry and multi-tenancy core' },
    { name: 'billing_prod', description: 'Immutable ledger, commissions, escrow' },
    { name: 'rbac_prod', description: 'Roles, permissions, audit log' },
    { name: 'modules_prod', description: 'Module registry, feature flags' },
    { name: 'health_prod', description: 'Service health, metrics, alerts' },
  ],
};

const KV_NAMESPACES = {
  staging: [
    { name: 'webwaka_sessions_staging', description: 'JWT session storage, 24-hour TTL' },
    { name: 'webwaka_flags_staging', description: 'Feature flag cache, 1-hour TTL' },
    { name: 'webwaka_cache_staging', description: 'Computed summaries, 15-minute TTL' },
    { name: 'webwaka_notifications_staging', description: 'Rate limits and retry queues, 5-minute TTL' },
  ],
  production: [
    { name: 'webwaka_sessions_prod', description: 'JWT session storage, 24-hour TTL' },
    { name: 'webwaka_flags_prod', description: 'Feature flag cache, 1-hour TTL' },
    { name: 'webwaka_cache_prod', description: 'Computed summaries, 15-minute TTL' },
    { name: 'webwaka_notifications_prod', description: 'Rate limits and retry queues, 5-minute TTL' },
  ],
};

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

function executeCommand(command, description) {
  try {
    log(`${description}...`, 'step');
    const output = execSync(command, { encoding: 'utf-8', stdio: 'pipe' });
    log(`${description} - Success`, 'success');
    return { success: true, output };
  } catch (error) {
    log(`${description} - Failed: ${error.message}`, 'error');
    return { success: false, error: error.message };
  }
}

function checkPrerequisites() {
  log('Checking prerequisites...', 'step');

  // Check Wrangler CLI
  try {
    execSync('wrangler --version', { stdio: 'pipe' });
    log('Wrangler CLI found', 'success');
  } catch {
    log('Wrangler CLI not found. Install with: npm install -g wrangler', 'error');
    process.exit(1);
  }

  // Check environment variables
  if (!process.env.CLOUDFLARE_ACCOUNT_ID) {
    log('CLOUDFLARE_ACCOUNT_ID environment variable not set', 'error');
    process.exit(1);
  }

  if (!process.env.CLOUDFLARE_API_TOKEN) {
    log('CLOUDFLARE_API_TOKEN environment variable not set', 'error');
    process.exit(1);
  }

  log('All prerequisites met', 'success');
}

function createD1Databases(environment) {
  log(`Creating D1 databases for ${environment} environment...`, 'step');

  const databases = D1_DATABASES[environment];
  const results = [];

  for (const db of databases) {
    const result = executeCommand(
      `wrangler d1 create ${db.name}`,
      `Creating D1 database: ${db.name} (${db.description})`
    );
    results.push({ ...db, ...result });
  }

  return results;
}

function createKVNamespaces(environment) {
  log(`Creating KV namespaces for ${environment} environment...`, 'step');

  const namespaces = KV_NAMESPACES[environment];
  const results = [];

  for (const ns of namespaces) {
    const result = executeCommand(
      `wrangler kv namespace create ${ns.name}`,
      `Creating KV namespace: ${ns.name} (${ns.description})`
    );
    results.push({ ...ns, ...result });
  }

  return results;
}

function listResources() {
  log('Listing all created resources...', 'step');

  log('D1 Databases:', 'info');
  executeCommand('wrangler d1 list', 'Fetching D1 databases');

  log('\nKV Namespaces:', 'info');
  executeCommand('wrangler kv:namespace list', 'Fetching KV namespaces');
}

function createResourcesFile(stagingDatabases, stagingNamespaces, prodDatabases, prodNamespaces) {
  log('Creating resources.json file...', 'step');

  const resourcesFile = path.join(projectRoot, 'INFRASTRUCTURE_RESOURCES.json');

  const resources = {
    created_at: new Date().toISOString(),
    staging: {
      databases: stagingDatabases,
      namespaces: stagingNamespaces,
    },
    production: {
      databases: prodDatabases,
      namespaces: prodNamespaces,
    },
    instructions: [
      'Next steps:',
      '1. Review INFRASTRUCTURE_RESOURCES.json for database and namespace IDs',
      '2. Update workers/wrangler.toml with actual resource IDs',
      '3. Run: pnpm run migrate:staging',
      '4. Run: pnpm run migrate:production',
      '5. Run: pnpm run seed:staging',
      '6. Run: pnpm run seed:production',
    ],
  };

  fs.writeFileSync(resourcesFile, JSON.stringify(resources, null, 2));
  log(`Resources file created: ${resourcesFile}`, 'success');
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  log('WebWaka Super Admin v2 - Infrastructure Setup Script', 'info');
  log('================================================', 'info');

  // Parse command-line arguments
  const args = process.argv.slice(2);
  const setupStaging = args.includes('--staging') || args.includes('--all');
  const setupProduction = args.includes('--production') || args.includes('--all');

  if (!setupStaging && !setupProduction) {
    log('No environment specified. Use --staging, --production, or --all', 'warning');
    log('Example: node scripts/setup-infrastructure.mjs --all', 'info');
    process.exit(0);
  }

  // Check prerequisites
  checkPrerequisites();

  let stagingDatabases = [];
  let stagingNamespaces = [];
  let prodDatabases = [];
  let prodNamespaces = [];

  // Create staging resources
  if (setupStaging) {
    log('\n=== STAGING ENVIRONMENT ===', 'info');
    stagingDatabases = createD1Databases('staging');
    stagingNamespaces = createKVNamespaces('staging');
  }

  // Create production resources
  if (setupProduction) {
    log('\n=== PRODUCTION ENVIRONMENT ===', 'info');
    prodDatabases = createD1Databases('production');
    prodNamespaces = createKVNamespaces('production');
  }

  // List all resources
  log('\n=== RESOURCE VERIFICATION ===', 'info');
  listResources();

  // Create resources file
  log('\n=== SAVING RESOURCE INFORMATION ===', 'info');
  createResourcesFile(stagingDatabases, stagingNamespaces, prodDatabases, prodNamespaces);

  // Summary
  log('\n=== SETUP COMPLETE ===', 'success');
  log('✅ Infrastructure setup completed successfully!', 'success');
  log('\nNext steps:', 'info');
  log('1. Review INFRASTRUCTURE_RESOURCES.json for all resource IDs', 'info');
  log('2. Update workers/wrangler.toml with actual resource IDs', 'info');
  log('3. Run migrations: pnpm run migrate:staging && pnpm run migrate:production', 'info');
  log('4. Seed data: pnpm run seed:staging && pnpm run seed:production', 'info');
  log('5. Deploy: pnpm run deploy', 'info');
}

main().catch((error) => {
  log(`Fatal error: ${error.message}`, 'error');
  process.exit(1);
});
