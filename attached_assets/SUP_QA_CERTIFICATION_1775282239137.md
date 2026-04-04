# WebWaka Super Admin (`webwaka-super-admin-v2`) QA Certification

**Prepared by:** Manus AI
**Date:** April 2026
**Target Repository:** `webwaka-super-admin-v2`

## 1. Audit Scope

This QA certification covers the implementation of the AI Usage Dashboard, Fraud Alert Resolution Center, and Automated Onboarding Workflow in `webwaka-super-admin-v2`.

## 2. Acceptance Criteria

| ID | Feature | Acceptance Criteria | Status |
| :--- | :--- | :--- | :--- |
| QA-SUP-1 | AI Usage Dashboard | `frontend/src/pages/AIUsage.tsx` successfully fetches and visualizes token consumption data from `webwaka-central-mgmt`. | PENDING |
| QA-SUP-2 | Fraud Alerts | `frontend/src/pages/FraudAlerts.tsx` displays unresolved alerts and allows authorized users to dismiss or suspend tenants. | PENDING |
| QA-SUP-3 | Onboarding Workflow | The onboarding wizard correctly provisions a new tenant across the selected vertical suites. | PENDING |
| QA-SUP-4 | Unit Tests | All new React components have passing unit tests in `frontend/src/**/*.test.tsx`. | PENDING |

## 3. Offline Resilience Testing

- The super admin dashboard is an internal tool and does not require strict offline-first capabilities.
- However, it must gracefully handle network timeouts and display appropriate error messages when external APIs (e.g., Cloudflare Pages, NIBSS) are unreachable.

## 4. Security & RBAC Validation

- Verify that the Fraud Alert Resolution Center requires the `manage:security` permission.
- Ensure that the AI Usage Dashboard requires the `view:billing` permission.
- Confirm that all API requests from the frontend include a valid JWT token.

## 5. Regression Guards

- Run `npm run test` to ensure 100% pass rate.
- Run `npm run build` to ensure no TypeScript compilation errors.
- Verify that the existing Builder Admin UI still functions correctly and can trigger deployments.
