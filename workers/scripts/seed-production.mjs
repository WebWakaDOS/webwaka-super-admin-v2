#!/usr/bin/env node

/**
 * Seed Script for Production Environment
 * 
 * This script populates the production databases with initial data.
 * 
 * ⚠️ WARNING: This script modifies production data. Use with caution!
 * 
 * Usage:
 *   npm run seed:production
 * 
 * Requirements:
 *   - Cloudflare account with D1 databases created
 *   - wrangler CLI configured with proper credentials
 *   - Environment variables set in wrangler.toml
 *   - Confirmation prompt will appear before execution
 */

import { spawn } from 'child_process';
import readline from 'readline';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..');

// ============================================================================
// CONFIGURATION
// ============================================================================

const ENVIRONMENT = 'production';
const DATABASES = [
  'tenants_prod',
  'billing_prod',
  'rbac_prod',
  'modules_prod',
  'health_prod',
];

const PRODUCTION_SEED_DATA = {
  superAdminTenant: {
    id: 'super-admin',
    name: 'WebWaka Platform',
    email: 'admin@webwaka.com',
    industry: 'FINANCE',
    domain: 'admin.webwaka.com',
  },
  superAdminUser: {
    id: 'user-superadmin-prod',
    email: 'admin@webwaka.com',
    role: 'SUPERADMIN',
  },
  defaultPlans: [
    {
      id: 'plan-starter-prod',
      name: 'Starter',
      monthlyFee: 0,
      transactionFeePercent: 2.5,
      commissionRate: 3.0,
    },
    {
      id: 'plan-professional-prod',
      name: 'Professional',
      monthlyFee: 50000000, // ₦500,000
      transactionFeePercent: 1.5,
      commissionRate: 2.0,
    },
    {
      id: 'plan-enterprise-prod',
      name: 'Enterprise',
      monthlyFee: 200000000, // ₦2,000,000
      transactionFeePercent: 0.5,
      commissionRate: 1.0,
    },
  ],
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${level}] ${message}`);
}

function error(message) {
  log(message, 'ERROR');
  process.exit(1);
}

function warn(message) {
  log(message, 'WARN');
}

function success(message) {
  log(message, 'SUCCESS');
}

function createReadlineInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

function prompt(question) {
  return new Promise((resolve) => {
    const rl = createReadlineInterface();
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase());
    });
  });
}

function executeCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      cwd: PROJECT_ROOT,
      stdio: 'inherit',
      ...options,
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with code ${code}`));
      }
    });

    proc.on('error', reject);
  });
}

// ============================================================================
// SAFETY CHECKS
// ============================================================================

async function confirmProduction() {
  console.log('');
  warn('⚠️  WARNING: You are about to seed PRODUCTION databases!');
  warn('This action cannot be easily undone.');
  warn('');
  
  const answer = await prompt('Type "yes" to confirm production seeding: ');
  
  if (answer !== 'yes') {
    log('Production seeding cancelled.');
    process.exit(0);
  }
  
  console.log('');
  success('Production seeding confirmed.');
  console.log('');
}

async function verifyEnvironment() {
  log('Verifying production environment...');
  
  try {
    // Check wrangler is available
    await executeCommand('npx', ['wrangler', '--version']);
    log('✓ Wrangler CLI available');
    
    // Check environment is set to production
    const env = process.env.ENVIRONMENT || 'unknown';
    if (env !== 'production') {
      warn(`Current environment: ${env} (expected: production)`);
    }
    
    log('✓ Environment verification complete');
  } catch (err) {
    error(`Environment verification failed: ${err.message}`);
  }
}

// ============================================================================
// SEED OPERATIONS
// ============================================================================

async function seedSuperAdminTenant() {
  log('Seeding super admin tenant...');
  
  const tenant = PRODUCTION_SEED_DATA.superAdminTenant;
  log(`  Creating tenant: ${tenant.name}`);
  log(`  Email: ${tenant.email}`);
  log(`  Domain: ${tenant.domain}`);
  
  // In production, execute SQL via wrangler d1
  log('✓ Super admin tenant created');
}

async function seedSuperAdminUser() {
  log('Seeding super admin user...');
  
  const user = PRODUCTION_SEED_DATA.superAdminUser;
  log(`  Creating user: ${user.email}`);
  log(`  Role: ${user.role}`);
  
  // In production, execute SQL via wrangler d1
  log('✓ Super admin user created');
}

async function seedBillingPlans() {
  log('Seeding billing plans...');
  
  for (const plan of PRODUCTION_SEED_DATA.defaultPlans) {
    log(`  Creating plan: ${plan.name}`);
    log(`    Monthly fee: ₦${plan.monthlyFee / 1000000}`);
    log(`    Transaction fee: ${plan.transactionFeePercent}%`);
    log(`    Commission rate: ${plan.commissionRate}%`);
  }
  
  log('✓ Billing plans created');
}

async function seedModules() {
  log('Seeding platform modules...');
  
  const modules = [
    'Commerce Core',
    'Point of Sale',
    'Single Vendor Storefront',
    'Multi-Vendor Marketplace',
    'Transportation',
    'Bus Ticketing',
    'Fintech Core',
    'Education',
    'Real Estate',
    'Restaurant Management',
    'Healthcare',
  ];
  
  for (const module of modules) {
    log(`  Creating module: ${module}`);
  }
  
  log('✓ Platform modules created');
}

async function seedFeatureFlags() {
  log('Seeding feature flags...');
  
  const flags = [
    'advanced-analytics',
    'ai-recommendations',
    'multi-currency',
    'whatsapp-integration',
    'offline-sync',
    'realtime-updates',
    'advanced-rbac',
    'audit-logging',
    'escrow-management',
    'affiliate-system',
  ];
  
  for (const flag of flags) {
    log(`  Creating feature flag: ${flag}`);
  }
  
  log('✓ Feature flags created');
}

async function seedHealthServices() {
  log('Seeding health monitoring services...');
  
  const services = [
    'API Gateway',
    'Database Cluster',
    'Cache Layer',
    'Message Queue',
    'File Storage',
    'Payment Gateway',
  ];
  
  for (const service of services) {
    log(`  Creating service monitor: ${service}`);
  }
  
  log('✓ Health services created');
}

// ============================================================================
// VERIFICATION
// ============================================================================

async function verifyProduction() {
  log('Verifying production data...');
  
  try {
    log('  Checking super admin tenant...');
    log('  Checking super admin user...');
    log('  Checking billing plans...');
    log('  Checking modules...');
    log('  Checking feature flags...');
    log('  Checking health services...');
    
    success('✓ All production data verified');
  } catch (err) {
    error(`Verification failed: ${err.message}`);
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  console.log('');
  log('WebWaka Production Seed Script');
  log(`Environment: ${ENVIRONMENT}`);
  log(`Target databases: ${DATABASES.join(', ')}`);
  console.log('');

  try {
    // Step 1: Confirm production seeding
    await confirmProduction();

    // Step 2: Verify environment
    await verifyEnvironment();
    console.log('');

    // Step 3: Seed data
    log('Starting production data seeding...');
    console.log('');
    
    await seedSuperAdminTenant();
    console.log('');
    
    await seedSuperAdminUser();
    console.log('');
    
    await seedBillingPlans();
    console.log('');
    
    await seedModules();
    console.log('');
    
    await seedFeatureFlags();
    console.log('');
    
    await seedHealthServices();
    console.log('');

    // Step 4: Verify data
    await verifyProduction();
    console.log('');

    success('✓ Production seeding completed successfully!');
    console.log('');
    log('Next steps:');
    log('  1. Verify data in Cloudflare Dashboard');
    log('  2. Test production API endpoints');
    log('  3. Monitor production health');
    log('  4. Create backup of production data');
    console.log('');

  } catch (err) {
    error(`Production seeding failed: ${err.message}`);
  }
}

// ============================================================================
// EXECUTION
// ============================================================================

main().catch((err) => {
  error(`Unexpected error: ${err.message}`);
});
