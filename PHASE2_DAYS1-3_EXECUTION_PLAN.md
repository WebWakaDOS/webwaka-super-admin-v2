# PHASE 2 EXECUTION PLAN: Days 1-3 (Mar 18-20, 2026)
## Super Admin v2 Real Logic Implementation

**Status:** 🔴 IN PROGRESS  
**Deadline:** March 20, 2026 (EOD)  
**Lead Agent:** Backend Architect + webwaka-cloudflare-orchestrator  
**QA Verification:** webwaka-qa-governance  

---

## OBJECTIVE

Replace all hardcoded mock data in Super Admin v2 with real D1/KV integration, ensuring:
- ✅ Real tenant CRUD operations
- ✅ Real KPI metrics from D1 aggregations
- ✅ Real billing ledger with strict integer kobo
- ✅ Real module registry
- ✅ Real health service status
- ✅ 50+ Vitest tests with >90% coverage
- ✅ Full 5-Layer QA compliance
- ✅ Deployment to staging/production

---

## DAY 1 (MAR 18): DASHBOARD & TENANTS PAGES

### Task 1.1: Replace Dashboard Mock Data

**Current State:**
- Lines 22-44: Hardcoded revenueData, tenantDistribution, activityData
- Lines 49-52: Hardcoded KPI metrics (totalRevenue, totalCommissions, activeModules, platformHealth)
- Lines 196-216: Hardcoded recent activity events

**Target State:**
- revenueData: Query D1 billing_ledger table, aggregate by month
- tenantDistribution: Query D1 tenants table, count by status
- activityData: Query D1 transactions table, aggregate by hour
- KPI Metrics: Real calculations from D1 aggregations

**Implementation:**
1. Create `hooks/useDashboardData.ts` with useEffect hooks
2. Implement D1 queries:
   - `SELECT SUM(amount) as revenue, SUM(commission) as commission FROM billing_ledger WHERE created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH) GROUP BY MONTH(created_at)`
   - `SELECT status, COUNT(*) as count FROM tenants GROUP BY status`
   - `SELECT HOUR(created_at) as hour, COUNT(*) as transactions FROM transactions WHERE created_at >= DATE_SUB(NOW(), INTERVAL 1 DAY) GROUP BY HOUR(created_at)`
3. Implement error handling and loading states
4. Write 15+ unit tests

**Compliance:**
- ✅ No hardcoded data (Build Once Use Infinitely)
- ✅ Integer kobo in billing (Africa First)
- ✅ Real D1 queries (Nigeria First)
- ✅ No console.log (Zero Debug Leakage)

### Task 1.2: Implement Tenants CRUD Page

**Current State:**
- Mock tenant list with no CRUD operations
- No D1 integration

**Target State:**
- Real tenant list from D1 tenants table
- Create tenant: POST /api/tenants
- Read tenant: GET /api/tenants/:id
- Update tenant: PUT /api/tenants/:id
- Delete tenant: DELETE /api/tenants/:id

**Implementation:**
1. Create `components/TenantForm.tsx` for create/edit
2. Implement API client methods:
   - `apiClient.tenants.list()`
   - `apiClient.tenants.create(data)`
   - `apiClient.tenants.update(id, data)`
   - `apiClient.tenants.delete(id)`
3. Implement confirmation dialogs for delete
4. Write 15+ integration tests

**Compliance:**
- ✅ Real CRUD operations (Build Once Use Infinitely)
- ✅ API→D1 integration (L2 QA)
- ✅ Error handling (Governance)

### Task 1.3: Write Vitest Test Suite (Day 1)

**Coverage:**
- 15 Dashboard unit tests
- 15 Tenants CRUD tests
- 10 API client integration tests

**Requirements:**
- >90% code coverage
- All edge cases covered
- Mock D1 responses

**Files:**
- `__tests__/pages/Dashboard.test.tsx`
- `__tests__/pages/TenantManagement.test.tsx`
- `__tests__/hooks/useDashboardData.test.ts`

---

## DAY 2 (MAR 19): BILLING & MODULES PAGES

### Task 2.1: Implement Billing Ledger Page

**Current State:**
- Mock ledger data with no real transactions

**Target State:**
- Real ledger from D1 billing_ledger table
- Real commission calculations
- Real payment status tracking

**Implementation:**
1. Query D1 billing_ledger:
   - `SELECT * FROM billing_ledger WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 100`
   - Strict integer kobo (NO decimals)
2. Implement commission calculator:
   - Level 1: 5% of transaction
   - Level 2: 3% of Level 1
   - Level 3: 2% of Level 2
   - Level 4: 1% of Level 3
   - Level 5: 0.5% of Level 4
3. Write 15+ tests

**Compliance:**
- ✅ Integer kobo only (Africa First)
- ✅ Real D1 queries (Nigeria First)
- ✅ Commission hierarchy (CORE-8)

### Task 2.2: Implement Modules Registry Page

**Current State:**
- Mock module list with no real registry

**Target State:**
- Real modules from D1 modules table
- Real module status tracking
- Real feature flag integration

**Implementation:**
1. Query D1 modules:
   - `SELECT * FROM modules WHERE status = 'active'`
2. Integrate KV feature flags:
   - `FEATURE_FLAGS_KV.get('module_' + moduleId)`
3. Implement module enable/disable:
   - Update D1 modules table
   - Update KV feature flags
4. Write 15+ tests

**Compliance:**
- ✅ Real module registry (Build Once Use Infinitely)
- ✅ KV integration (L2 QA)
- ✅ Feature flag management (CORE-5)

### Task 2.3: Write Vitest Test Suite (Day 2)

**Coverage:**
- 15 Billing integration tests
- 15 Modules registry tests
- 10 Commission calculator tests

**Requirements:**
- >90% code coverage
- All commission levels tested
- Feature flag mocking

**Files:**
- `__tests__/pages/Billing.test.tsx`
- `__tests__/pages/ModuleRegistry.test.tsx`
- `__tests__/lib/commissionCalculator.test.ts`

---

## DAY 3 (MAR 20): HEALTH, SETTINGS & DEPLOYMENT

### Task 3.1: Implement Health Page

**Current State:**
- Mock health metrics with no real service status

**Target State:**
- Real service status from D1 health table
- Real uptime metrics
- Real error tracking

**Implementation:**
1. Query D1 health:
   - `SELECT * FROM health_checks WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)`
2. Implement health aggregations:
   - Service uptime percentage
   - Error rate calculation
   - Response time metrics
3. Write 10+ tests

**Compliance:**
- ✅ Real health data (Build Once Use Infinitely)
- ✅ D1 integration (L2 QA)

### Task 3.2: Implement Settings Page

**Current State:**
- Mock settings with no real configuration

**Target State:**
- Real settings from D1 settings table
- Real API key management
- Real webhook configuration

**Implementation:**
1. Query D1 settings:
   - `SELECT * FROM settings WHERE tenant_id = ?`
2. Implement settings update:
   - PUT /api/settings/:id
3. Implement API key generation:
   - Generate secure keys
   - Store in D1
4. Write 10+ tests

**Compliance:**
- ✅ Real settings management (Build Once Use Infinitely)
- ✅ Security compliance (CORE-6 RBAC)

### Task 3.3: Deploy to Staging & Production

**Deployment Steps:**
1. Build frontend: `npm run build`
2. Deploy to staging: `wrangler pages deploy --branch staging`
3. Deploy Workers to staging: `wrangler deploy --env staging`
4. Run health check: `curl https://staging.pages.dev/health`
5. Deploy to production: `wrangler pages deploy --branch main`
6. Deploy Workers to production: `wrangler deploy --env production`
7. Run production health check: `curl https://prod.pages.dev/health`

**Verification:**
- ✅ Pages deployed and accessible
- ✅ Workers API responding
- ✅ D1 queries executing
- ✅ KV operations working

### Task 3.4: Full 5-Layer QA Verification

**L1: Unit Tests**
- Run: `npm run test`
- Target: >90% coverage
- All tests passing

**L2: Integration Tests**
- Test API→D1 integration
- Test KV operations
- Test authentication

**L3: E2E Tests**
- Run: `npx playwright test`
- Test complete workflows
- Test all 6 pages

**L4: Performance Tests**
- Run: `npm run lighthouse`
- Target: Lighthouse 95+
- Check Core Web Vitals

**L5: Governance Tests**
- No console.log violations
- 7 Core Invariants compliance
- Blueprint match verification

### Task 3.5: Write Vitest Test Suite (Day 3)

**Coverage:**
- 10 Health page tests
- 10 Settings page tests
- 20 E2E workflow tests

**Requirements:**
- >90% code coverage
- All pages tested
- All CRUD operations tested

**Files:**
- `__tests__/pages/SystemHealth.test.tsx`
- `__tests__/pages/Settings.test.tsx`
- `__tests__/e2e/workflows.test.ts`

---

## DELIVERABLES (BY MARCH 20, EOD)

### Code Changes
- ✅ Dashboard.tsx: Real D1 queries + no mock data
- ✅ TenantManagement.tsx: Full CRUD implementation
- ✅ Billing.tsx: Real ledger + commission calculator
- ✅ ModuleRegistry.tsx: Real modules + feature flags
- ✅ SystemHealth.tsx: Real health metrics
- ✅ Settings.tsx: Real settings + API keys
- ✅ hooks/useDashboardData.ts: Data fetching hooks
- ✅ components/TenantForm.tsx: Tenant CRUD form
- ✅ lib/commissionCalculator.ts: Commission logic
- ✅ lib/api-client.ts: Updated with all endpoints

### Test Suite
- ✅ 50+ Vitest tests
- ✅ >90% code coverage
- ✅ All edge cases covered
- ✅ Mock D1/KV responses

### Deployment
- ✅ Staging: https://staging.pages.dev
- ✅ Production: https://prod.pages.dev
- ✅ Workers API: Staging + Production
- ✅ Health checks: All passing

### Verification
- ✅ No hardcoded data
- ✅ No console.log violations
- ✅ All 7 Core Invariants compliant
- ✅ 5-Layer QA passed
- ✅ Blueprint match verified

### Documentation
- ✅ Code comments for all new functions
- ✅ API endpoint documentation
- ✅ Test coverage report
- ✅ Deployment verification report

---

## COMPLIANCE CHECKLIST

**7 Core Invariants:**
- [ ] Build Once Use Infinitely: All features modular, src/core/ reuse
- [ ] Mobile/PWA/Offline First: PWA manifest + Service Worker
- [ ] Nigeria First: Yournotify/Termii, NGN kobo
- [ ] Africa First: Integer kobo (NO floats/decimals)
- [ ] Vendor Neutral AI: OpenRouter BYOK + Cloudflare fallback
- [ ] Zero Debug Leakage: No console.log in src/
- [ ] Phase 1 CORE Untouchable: CORE-5, CORE-6, CORE-7, CORE-8

**5-Layer QA:**
- [ ] L1: Unit Tests (Vitest 90%+)
- [ ] L2: Integration (API→D1/KV)
- [ ] L3: E2E (Playwright)
- [ ] L4: Performance (Lighthouse 95+)
- [ ] L5: Governance (Blueprint match)

**Deployment Standards:**
- [ ] develop → staging
- [ ] main → production
- [ ] CLOUDFLARE_API_TOKEN configured
- [ ] CLOUDFLARE_ACCOUNT_ID configured

---

## NEXT PHASES

**Days 4-7 (Mar 21-24):** CI/CD Repair + Feature Merges
**Days 8-10 (Mar 25-27):** 5 Missing Repos + D1 IDs
**Days 11-14 (Mar 28-Apr 1):** Console.log Cleanup + QA Governance

---

**EXECUTION STARTS NOW.** 🚀
