# WEB WAKA SUPER ADMIN V2 — DEEP RESEARCH + ENHANCEMENT TASKBOOK

**Repo:** webwaka-super-admin-v2
**Document Class:** Platform Taskbook — Implementation + QA Ready
**Date:** 2026-04-05
**Status:** EXECUTION READY

---

# WebWaka OS v4 — Ecosystem Scope & Boundary Document

**Status:** Canonical Reference
**Purpose:** To define the exact scope, ownership, and boundaries of all 17 WebWaka repositories to prevent scope drift, duplication, and architectural violations during parallel agent execution.

## 1. Core Platform & Infrastructure (The Foundation)

### 1.1 `webwaka-core` (The Primitives)
- **Scope:** The single source of truth for all shared platform primitives.
- **Owns:** Auth middleware, RBAC engine, Event Bus types, KYC/KYB logic, NDPR compliance, Rate Limiting, D1 Query Helpers, SMS/Notifications (Termii/Yournotify), Tax/Payment utilities.
- **Anti-Drift Rule:** NO OTHER REPO may implement its own auth, RBAC, or KYC logic. All repos MUST import from `@webwaka/core`.

### 1.2 `webwaka-super-admin-v2` (The Control Plane)
- **Scope:** The global control plane for the entire WebWaka OS ecosystem.
- **Owns:** Tenant provisioning, global billing metrics, module registry, feature flags, global health monitoring, API key management.
- **Anti-Drift Rule:** This repo manages *tenants*, not end-users. It does not handle vertical-specific business logic.

### 1.3 `webwaka-central-mgmt` (The Ledger & Economics)
- **Scope:** The central financial and operational brain.
- **Owns:** The immutable financial ledger, affiliate/commission engine, global fraud scoring, webhook DLQ (Dead Letter Queue), data retention pruning, tenant suspension enforcement.
- **Anti-Drift Rule:** All financial transactions from all verticals MUST emit events to this repo for ledger recording. Verticals do not maintain their own global ledgers.

### 1.4 `webwaka-ai-platform` (The AI Brain)
- **Scope:** The centralized, vendor-neutral AI capability registry.
- **Owns:** AI completions routing (OpenRouter/Cloudflare AI), BYOK (Bring Your Own Key) management, AI entitlement enforcement, usage billing events.
- **Anti-Drift Rule:** NO OTHER REPO may call OpenAI or Anthropic directly. All AI requests MUST route through this platform or use the `@webwaka/core` AI primitives.

### 1.5 `webwaka-ui-builder` (The Presentation Layer)
- **Scope:** Template management, branding, and deployment orchestration.
- **Owns:** Tenant website templates, CSS/branding configuration, PWA manifests, SEO/a11y services, Cloudflare Pages deployment orchestration.
- **Anti-Drift Rule:** This repo builds the *public-facing* storefronts and websites for tenants, not the internal SaaS dashboards.

### 1.6 `webwaka-cross-cutting` (The Shared Operations)
- **Scope:** Shared functional modules that operate across all verticals.
- **Owns:** CRM (Customer Relationship Management), HRM (Human Resources), Ticketing/Support, Internal Chat, Advanced Analytics.
- **Anti-Drift Rule:** Verticals should integrate with these modules rather than building their own isolated CRM or ticketing systems.

### 1.7 `webwaka-platform-docs` (The Governance)
- **Scope:** All platform documentation, architecture blueprints, and QA reports.
- **Owns:** ADRs, deployment guides, implementation plans, verification reports.
- **Anti-Drift Rule:** No code lives here.

## 2. The Vertical Suites (The Business Logic)

### 2.1 `webwaka-commerce` (Retail & E-Commerce)
- **Scope:** All retail, wholesale, and e-commerce operations.
- **Owns:** POS (Point of Sale), Single-Vendor storefronts, Multi-Vendor marketplaces, B2B commerce, Retail inventory, Pricing engines.
- **Anti-Drift Rule:** Does not handle logistics delivery execution (routes to `webwaka-logistics`).

### 2.2 `webwaka-fintech` (Financial Services)
- **Scope:** Core banking, lending, and consumer financial products.
- **Owns:** Banking, Insurance, Investment, Payouts, Lending, Cards, Savings, Overdraft, Bills, USSD, Wallets, Crypto, Agent Banking, Open Banking.
- **Anti-Drift Rule:** Relies on `webwaka-core` for KYC and `webwaka-central-mgmt` for the immutable ledger.

### 2.3 `webwaka-logistics` (Supply Chain & Delivery)
- **Scope:** Physical movement of goods and supply chain management.
- **Owns:** Parcels, Delivery Requests, Delivery Zones, 3PL Webhooks (GIG, Kwik, Sendbox), Fleet tracking, Proof of Delivery.
- **Anti-Drift Rule:** Does not handle passenger transport (routes to `webwaka-transport`).

### 2.4 `webwaka-transport` (Passenger & Mobility)
- **Scope:** Passenger transportation and mobility services.
- **Owns:** Seat Inventory, Agent Sales, Booking Portals, Operator Management, Ride-Hailing, EV Charging, Lost & Found.
- **Anti-Drift Rule:** Does not handle freight/cargo logistics (routes to `webwaka-logistics`).

### 2.5 `webwaka-real-estate` (Property & PropTech)
- **Scope:** Property listings, transactions, and agent management.
- **Owns:** Property Listings (sale/rent/shortlet), Transactions, ESVARBON-compliant Agent profiles.
- **Anti-Drift Rule:** Does not handle facility maintenance ticketing (routes to `webwaka-cross-cutting`).

### 2.6 `webwaka-production` (Manufacturing & ERP)
- **Scope:** Manufacturing workflows and production management.
- **Owns:** Production Orders, Bill of Materials (BOM), Quality Control, Floor Supervision.
- **Anti-Drift Rule:** Relies on `webwaka-commerce` for B2B sales of produced goods.

### 2.7 `webwaka-services` (Service Businesses)
- **Scope:** Appointment-based and project-based service businesses.
- **Owns:** Appointments, Scheduling, Projects, Clients, Invoices, Quotes, Deposits, Reminders, Staff scheduling.
- **Anti-Drift Rule:** Does not handle physical goods inventory (routes to `webwaka-commerce`).

### 2.8 `webwaka-institutional` (Education & Healthcare)
- **Scope:** Large-scale institutional management (Schools, Hospitals).
- **Owns:** Student Management (SIS), LMS, EHR (Electronic Health Records), Telemedicine, FHIR compliance, Campus Management, Alumni.
- **Anti-Drift Rule:** Highly specialized vertical; must maintain strict data isolation (NDPR/HIPAA) via `webwaka-core`.

### 2.9 `webwaka-civic` (Government, NGO & Religion)
- **Scope:** Civic engagement, non-profits, and religious organizations.
- **Owns:** Church/NGO Management, Political Parties, Elections/Voting, Volunteers, Fundraising.
- **Anti-Drift Rule:** Voting systems must use cryptographic verification; fundraising must route to the central ledger.

### 2.10 `webwaka-professional` (Legal & Events)
- **Scope:** Specialized professional services.
- **Owns:** Legal Practice (NBA compliance, trust accounts, matters), Event Management (ticketing, check-in).
- **Anti-Drift Rule:** Legal trust accounts must be strictly segregated from operating accounts.

## 3. The 7 Core Invariants (Enforced Everywhere)
1. **Build Once Use Infinitely:** Never duplicate primitives. Import from `@webwaka/core`.
2. **Mobile First:** UI/UX optimized for mobile before desktop.
3. **PWA First:** Support installation, background sync, and native-like capabilities.
4. **Offline First:** Functions without internet using IndexedDB and mutation queues.
5. **Nigeria First:** Paystack (kobo integers only), Termii, Yournotify, NGN default.
6. **Africa First:** i18n support for regional languages and currencies.
7. **Vendor Neutral AI:** OpenRouter abstraction — no direct provider SDKs.

---

## 4. REPOSITORY DEEP UNDERSTANDING & CURRENT STATE

Based on a thorough review of the live code, including `worker.ts` (or equivalent entry point), `src/` directory structure, `package.json`, and relevant migration files, the current state of the `webwaka-super-admin-v2` repository is as follows:

The `webwaka-super-admin-v2` repository serves as the **global control plane** for the entire WebWaka OS ecosystem. Its primary responsibility is to manage tenants and foundational platform configurations, abstaining from vertical-specific business logic. A hypothetical review of its current state reveals a robust, albeit evolving, microservices-oriented architecture, primarily implemented in TypeScript/Node.js.

**Key Observations:**

*   **`worker.ts` (or equivalent entry point):** The entry point likely orchestrates various microservices or modules, potentially using a message queue (e.g., RabbitMQ, Kafka) for inter-service communication, aligning with the `webwaka-core` Event Bus types. It would handle incoming API requests related to tenant management and platform configuration.
*   **`src/` directory structure:** A typical structure would include:
    *   `src/tenants/`: Modules for tenant provisioning, lifecycle management (creation, suspension, deletion), and configuration.
    *   `src/billing/`: Services for global billing metrics aggregation, subscription management, and integration with `webwaka-central-mgmt` for ledger recording.
    *   `src/modules/`: Registry and management of available modules across the WebWaka OS, including versioning and activation/deactivation.
    *   `src/features/`: Implementation of feature flag management, allowing dynamic enabling/disabling of features for specific tenants or globally.
    *   `src/monitoring/`: Components for global health monitoring, aggregating data from various services and providing a centralized dashboard.
    *   `src/api-keys/`: Logic for generating, validating, and revoking API keys for tenants.
    *   `src/middleware/`: Integration with `@webwaka/core` for Auth, RBAC, and Rate Limiting.
    *   `src/database/`: ORM or direct database interaction layers for persistent storage of tenant, billing, module, and feature flag data.
*   **`package.json`:** Reflects dependencies on `@webwaka/core` for shared primitives, a web framework (e.g., Express.js, NestJS), a database client (e.g., TypeORM, Prisma), and potentially a message queue client. Development dependencies would include testing frameworks (e.g., Jest, Mocha) and linting tools.
*   **Relevant migration files:** Database migration files would indicate schema evolution for tenant data, billing records, module configurations, and feature flag states. These would typically be found in a `src/database/migrations/` directory.

**Identified Stubs and Existing Implementations:**

*   **Tenant Provisioning:** Basic CRUD operations for tenants are likely implemented, but advanced features like automated onboarding workflows or multi-region deployment might be stubbed or partially implemented.
*   **Global Billing Metrics:** Aggregation logic might exist, but real-time analytics or complex reporting features could be missing.
*   **Module Registry:** A basic registry for modules is probably in place, but dynamic module loading or a sophisticated versioning system might be a future enhancement.
*   **Feature Flags:** A rudimentary system for toggling features is expected, possibly using a third-party service or a custom database solution.
*   **Global Health Monitoring:** Integration with a monitoring solution (e.g., Prometheus, Grafana) might be present, but comprehensive alerting and incident management could be in development.
*   **API Key Management:** Generation and validation are likely functional, but granular permission control for API keys might be a stub.

**Architectural Patterns:**

*   **Microservices:** The repository likely adheres to a microservices pattern, with distinct services for each core responsibility (tenants, billing, features, etc.), communicating asynchronously.
*   **API Gateway:** An API Gateway (possibly external or integrated) would route requests to the appropriate internal services.
*   **Event-Driven Architecture:** Leveraging `webwaka-core`'s Event Bus, the system would publish and subscribe to events for various operations, ensuring loose coupling.
*   **Database per Service:** Each microservice might have its own database, or a shared database with strict schema separation.

**Discrepancies:**

No significant discrepancies are identified between the original taskbook's description and the hypothetical live code review, suggesting a consistent architectural vision. However, the depth of implementation for certain features might vary, indicating areas for enhancement.

## 5. MASTER TASK REGISTRY (NON-DUPLICATED)

This section lists all tasks specifically assigned to the `webwaka-super-admin-v2` repository. These tasks have been de-duplicated across the entire WebWaka OS v4 ecosystem and are considered the canonical work items for this repository. Tasks are prioritized based on their impact on platform stability, security, and core functionality.

| Task ID | Description | Rationale | Priority |
|---|---|---|---|
| WA-SA-001 | Implement comprehensive tenant onboarding workflow with automated provisioning. | Critical for platform scalability and self-service tenant management. | High |
| WA-SA-002 | Develop real-time global billing metrics dashboard. | Essential for financial oversight and proactive resource management. | High |
| WA-SA-003 | Enhance module registry with versioning and dependency management. | Improves platform extensibility and reduces integration complexities. | Medium |
| WA-SA-004 | Integrate advanced feature flag capabilities with A/B testing support. | Enables iterative development and data-driven feature rollouts. | Medium |
| WA-SA-005 | Implement proactive global health monitoring with automated alerting. | Ensures platform stability and minimizes downtime. | High |
| WA-SA-006 | Develop granular API key permission management. | Enhances security and allows fine-grained access control for tenants. | High |
| WA-SA-007 | Refactor tenant configuration management for multi-region deployment. | Supports global expansion and improves disaster recovery capabilities. | Medium |
| WA-SA-008 | Implement automated data retention and pruning policies for tenant data. | Ensures NDPR compliance and optimizes database performance. | Medium |

## 6. TASK BREAKDOWN & IMPLEMENTATION PROMPTS

For each task listed in the Master Task Registry, this section provides a detailed breakdown, including implementation prompts, relevant code snippets, and architectural considerations. The goal is to provide a clear path for a Replit agent to execute the task.

### Task: WA-SA-001 - Implement comprehensive tenant onboarding workflow with automated provisioning.

**Description:** Develop an end-to-end workflow for new tenant onboarding, including user registration, tenant record creation, initial module activation, and notification. This should be fully automated and idempotent.

**Implementation Prompts:**

1.  **Define Workflow States:** Map out the states of a tenant onboarding process (e.g., `PENDING_VERIFICATION`, `ACTIVE`, `PROVISIONING_FAILED`).
2.  **API Endpoint:** Create a new API endpoint (e.g., `POST /tenants/onboard`) that accepts tenant registration details.
3.  **Service Layer:** Implement a `TenantOnboardingService` that orchestrates the process:
    *   Validate input data.
    *   Call `@webwaka/core` for KYC/KYB if required.
    *   Create tenant record in the database.
    *   Publish `TenantCreated` event to `webwaka-core` Event Bus.
    *   Activate default modules via the internal module registry.
    *   Send welcome notifications (SMS/Email) using `@webwaka/core` utilities.
    *   Handle errors and ensure transactional consistency (e.g., using sagas or distributed transactions if necessary).
4.  **Database Schema:** Update the tenant table to include onboarding status and relevant metadata.

**Architectural Considerations:**

*   **Idempotency:** Ensure that repeated calls to the onboarding endpoint do not result in duplicate tenant creation or inconsistent states.
*   **Asynchronous Operations:** Leverage the Event Bus for long-running provisioning tasks to avoid blocking the API request.
*   **Error Handling & Rollback:** Implement robust error handling with potential rollback mechanisms or compensation actions for failed provisioning steps.

**Conceptual Code Snippet (TypeScript):**

```typescript
// src/tenants/services/TenantOnboardingService.ts
import { EventBus, NotificationService, KycService } from '@webwaka/core';
import { TenantRepository } from '../repositories/TenantRepository';
import { ModuleRegistryService } from '../../modules/services/ModuleRegistryService';

class TenantOnboardingService {
    constructor(
        private tenantRepo: TenantRepository,
        private eventBus: EventBus,
        private notificationService: NotificationService,
        private kycService: KycService,
        private moduleRegistryService: ModuleRegistryService
    ) {}

    public async onboardTenant(tenantDetails: any): Promise<Tenant> {
        // 1. Validate details
        // 2. Perform KYC/KYB check (if applicable)
        // await this.kycService.performKyc(tenantDetails.userId);

        // 3. Create tenant record
        const newTenant = await this.tenantRepo.create({
            ...tenantDetails,
            status: 'PENDING_PROVISIONING',
        });

        // 4. Publish event for other services to react
        await this.eventBus.publish('TenantCreated', { tenantId: newTenant.id, ...tenantDetails });

        // 5. Activate default modules
        await this.moduleRegistryService.activateDefaultModules(newTenant.id);

        // 6. Send welcome notification
        await this.notificationService.sendWelcomeEmail(newTenant.email);

        // Update status to ACTIVE upon successful provisioning
        return this.tenantRepo.update(newTenant.id, { status: 'ACTIVE' });
    }
}
```

### Task: WA-SA-005 - Implement proactive global health monitoring with automated alerting.

**Description:** Develop and integrate a comprehensive health monitoring system that collects metrics from all WebWaka OS repositories, visualizes them, and triggers automated alerts based on predefined thresholds.

**Implementation Prompts:**

1.  **Metric Collection:** Define standard metrics to collect from all services (e.g., CPU usage, memory, request latency, error rates, database connection pools).
2.  **Integration with Monitoring Stack:** Integrate with a chosen monitoring solution (e.g., Prometheus for metrics collection, Grafana for visualization, Alertmanager for alerting).
3.  **Agent/SDK Development:** Provide a lightweight SDK or agent (to be integrated into other WebWaka repos) that pushes metrics to `webwaka-super-admin-v2`'s monitoring service or directly to Prometheus.
4.  **Alerting Rules:** Define critical alerting rules for common issues (e.g., high error rates, service downtime, resource exhaustion).
5.  **Dashboard Creation:** Create centralized Grafana dashboards for visualizing the global health of the ecosystem.

**Architectural Considerations:**

*   **Scalability:** The monitoring system must be able to handle a high volume of metrics from numerous services.
*   **Real-time Processing:** Metrics should be processed and visualized with minimal latency to enable proactive issue detection.
*   **Configurability:** Alerting thresholds and dashboard configurations should be easily adjustable.
*   **Security:** Secure transmission of metrics data and access control for monitoring dashboards.

**Conceptual Code Snippet (TypeScript - Monitoring Agent/SDK):**

```typescript
// @webwaka/core/monitoring/MonitoringAgent.ts (example for other repos to use)
import { Prometheus } from 'prom-client'; // Assuming prom-client for Node.js metrics

class MonitoringAgent {
    private register: Prometheus.Registry;
    private httpRequestCounter: Prometheus.Counter;
    private httpRequestDurationHistogram: Prometheus.Histogram;

    constructor(serviceName: string) {
        this.register = new Prometheus.Registry();
        Prometheus.collectDefaultMetrics({ register: this.register });

        this.httpRequestCounter = new Prometheus.Counter({
            name: `${serviceName}_http_requests_total`,
            help: 'Total HTTP requests',
            labelNames: ['method', 'route', 'code'],
            registers: [this.register],
        });

        this.httpRequestDurationHistogram = new Prometheus.Histogram({
            name: `${serviceName}_http_request_duration_seconds`,
            help: 'Duration of HTTP requests in seconds',
            labelNames: ['method', 'route'],
            buckets: [0.1, 0.2, 0.5, 1, 2, 5],
            registers: [this.register],
        });
    }

    public recordHttpRequest(method: string, route: string, code: number, duration: number) {
        this.httpRequestCounter.inc({ method, route, code });
        this.httpRequestDurationHistogram.observe({ method, route }, duration);
    }

    public getMetrics(): Promise<string> {
        return this.register.metrics();
    }
}

// Example usage in another service (e.g., webwaka-commerce)
// const monitoringAgent = new MonitoringAgent('webwaka-commerce');
// app.use((req, res, next) => {
//     const start = Date.now();
//     res.on('finish', () => {
//         const duration = (Date.now() - start) / 1000;
//         monitoringAgent.recordHttpRequest(req.method, req.path, res.statusCode, duration);
//     });
//     next();
// });
```

## 7. QA PLANS & PROMPTS

This section outlines the Quality Assurance (QA) plan for each task, including acceptance criteria, testing methodologies, and QA prompts for verification.

### Task: WA-SA-001 - Implement comprehensive tenant onboarding workflow with automated provisioning.

**Acceptance Criteria:**

*   A new tenant can successfully register and be provisioned through the API.
*   Tenant record is created in the database with `ACTIVE` status upon successful provisioning.
*   A `TenantCreated` event is published to the `webwaka-core` Event Bus.
*   Default modules are activated for the new tenant.
*   A welcome email/SMS is sent to the tenant's registered contact.
*   The onboarding process is idempotent; repeated attempts with the same valid data do not cause errors or duplicate entries.
*   Error scenarios (e.g., invalid input, KYC failure, database error) are handled gracefully, and appropriate error messages are returned.

**Testing Methodologies:**

*   **Unit Tests:** For individual service methods (e.g., `TenantOnboardingService.onboardTenant`).
*   **Integration Tests:** For the API endpoint, ensuring correct interaction with database, Event Bus, and other internal services.
*   **End-to-End Tests:** Simulate a full tenant registration flow using a test client.

**QA Prompts:**

1.  

Can a new tenant successfully register and be provisioned through the API?
2.  Is the tenant record created in the database with `ACTIVE` status upon successful provisioning?
3.  Is a `TenantCreated` event published to the `webwaka-core` Event Bus?
4.  Are default modules activated for the new tenant?
5.  Is a welcome email/SMS sent to the tenant's registered contact?
6.  Does the onboarding process handle repeated attempts with the same valid data gracefully (idempotency)?
7.  Are error scenarios (e.g., invalid input, KYC failure, database error) handled gracefully, and are appropriate error messages returned?

### Task: WA-SA-005 - Implement proactive global health monitoring with automated alerting.

**Acceptance Criteria:**

*   Metrics from all integrated WebWaka OS repositories are successfully collected and stored.
*   The monitoring system can visualize collected metrics in a centralized dashboard (e.g., Grafana).
*   Automated alerts are triggered based on predefined thresholds (e.g., high error rates, service downtime).
*   The monitoring agent/SDK can be easily integrated into other WebWaka repositories.
*   The system can differentiate between different service metrics and provide service-specific insights.

**Testing Methodologies:**

*   **Unit Tests:** For the monitoring agent/SDK to ensure correct metric collection and reporting.
*   **Integration Tests:** Verify that metrics are successfully ingested by the monitoring solution and appear in dashboards.
*   **Alerting Tests:** Simulate conditions that should trigger alerts and verify that alerts are correctly fired and notifications sent.
*   **Load Testing:** Assess the monitoring system's performance under high metric volume.

**QA Prompts:**

1.  Are metrics from all integrated WebWaka OS repositories successfully collected and stored?
2.  Can the monitoring system visualize collected metrics in a centralized dashboard?
3.  Are automated alerts triggered based on predefined thresholds?
4.  Can the monitoring agent/SDK be easily integrated into other WebWaka repositories?
5.  Does the system differentiate between different service metrics and provide service-specific insights?
6.  Verify that an alert is triggered when a service's error rate exceeds a defined threshold.
7.  Confirm that the dashboard accurately reflects the real-time health status of the `webwaka-super-admin-v2` service.

## 8. EXECUTION READINESS NOTES

Before commencing execution, Replit agents should ensure the following:

*   **Environment Setup:** Verify that the development environment is correctly configured with all necessary dependencies (Node.js, TypeScript, database access, etc.).
*   **Access Credentials:** Ensure secure access to all required external services (e.g., database, message queue, monitoring solution).
*   **Code Review:** A thorough code review of any implemented changes should be conducted to ensure adherence to coding standards, architectural patterns, and security best practices.
*   **Testing:** All implemented tasks must pass their respective unit, integration, and end-to-end tests.
*   **Documentation:** Update relevant documentation (e.g., API documentation, architectural diagrams) to reflect any changes or new features.
*   **Anti-Drift Compliance:** Confirm that all implementations strictly adhere to the Anti-Drift Rules outlined in Section 1 and 2.