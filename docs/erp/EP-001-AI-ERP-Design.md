Title: EP-001 AI ERP Architecture and Design

1. Executive Summary
- Build an AI-enabled ERP modeled on NetSuite patterns using Svelte/SvelteKit frontend and TypeScript backend.
- Key capabilities: multi-tenant, multi-company, metadata-driven forms/fields/workflows, offline-first, intercompany, AI services, modular packaging.

2. Architecture Overview
- Frontend: Svelte/SvelteKit + TypeScript, PWA (Service Worker, IndexedDB via Dexie), form renderer from metadata, shared zod validations, @tanstack/svelte-query caching, Capacitor for mobile.
- Backend: TypeScript (NestJS/Fastify), GraphQL (metadata introspection), REST (transactions), PostgreSQL core + JSONB custom fields, row-level security by tenant/company, Kafka/RabbitMQ events, OpenSearch search, optional vector store for RAG.
- AI Layer: copilot actions with guardrails, demand/reorder forecasts, AP OCR and 3-way match, anomaly detection, conversational BI.
- Packaging/Deployment: module bundles, environments (dev/test/stage/prod), CI/CD, feature flags, canary releases.

3. Tenancy & Company Model
- tenant_id: UUID per tenant.
- company_code (area_id): string unique within tenant.
- Company registry: code, currency, timezone, languages, fiscal calendar, tax regime, number series, data residency.
- Ownership: shared inventory with company_code scoping; intercompany policies.

4. Database Schema (PostgreSQL)
- Tables: tenants, companies, users, user_company_access, roles, permissions_policy, items, locations, inventory, sales_orders, sales_order_lines, purchase_orders, goods_receipts, deliveries, invoices, ap_invoices, payments, gl_entries, number_series, audit_log, metadata_forms, metadata_fields, workflows, scripts, events_outbox.
- Indexing: composite keys (tenant_id, company_code), GIN on JSONB custom_fields, covering indices for common queries.
- Row-level security policies enforce session-scoped tenant and allowed companies.

5. Customization Metadata
- form: name, entityType, version, layout (sections/tabs/sublists), assignedRoles, assignedCompanies, visibilityConditions.
- field: key, dataType, ui attributes, validation schema (zod shape JSON), visibility conditions, defaulting rules, custom flag.
- workflow: states, transitions, guards, notifications, version.
- scripts: client/user-event/scheduled/map-reduce/rest-extension, quota policy, audit.

6. APIs
- GraphQL: form(entityType, version), formsAssigned(companyCode, role), create/update metadata.
- REST: transactional endpoints for create/update/submit/approve/post per entity; idempotency keys; webhooks on events.
- Authentication: OIDC/SAML SSO; JWT with tenant and company scopes; MFA; refresh tokens.
- Authorization: RBAC/ABAC enforced server-side at field/action level.

7. Offline-First Design
- IndexedDB stores: entities (snapshots), mutations (queued writes), sync_state.
- Service Worker: cache UI shell and metadata; background sync.
- Conflict resolution: protected fields are server authoritative; auto-merge non-overlapping fields; user resolution UI.
- Number series: temporary reservation at submit; final assignment at post; uniqueness guaranteed.

8. Intercompany & Consolidation
- Intercompany rules: allowed pairs, markup, automatic counter-documents.
- Flows: SO in A triggers PO in B; shipments adjust inventory both sides; elimination entries for consolidation.
- Consolidation: periodic aggregation, currency translation, eliminations; reporting.

9. AI Capabilities
- Copilot: natural-language to ERP actions with explain/confirm and citations.
- Forecasting: demand, lead times, reorder proposals.
- AP OCR: extract from invoices, match to PO/GRN, route exceptions.
- Anomaly detection: pricing outliers, duplicates, fraud-like patterns.
- Conversational BI: NL queries to charts; variance explanations.

10. Search & RAG
- OpenSearch indices per tenant/company; vector store for semantic search of docs/policies.
- Secure RAG with guardrails; citations; prompt hygiene for PII/finance.

11. Observability & SLAs
- Logging with tenant/company/entity/action; metrics (latency, error rates, sync success); tracing (OpenTelemetry).
- Alerts: SLA breaches, sync failures, posting retries, model drift.

12. Security & Compliance
- Encryption at rest/in transit; secrets vault; per-tenant/company keys.
- Audit: immutable event log with before/after snapshots.
- Data residency, retention, DR plans, accessibility, i18n.

13. Milestones
- Phase 0 (Discovery, 2–3w): requirements, registry, forms/workflows, offline policy, integrations.
- Phase 1 (Foundation, 4w): auth, RBAC/ABAC, core DB, audit, APIs.
- Phase 2 (Customization, 4–5w): metadata CRUD, GraphQL introspection, Svelte renderer, shared validations.
- Phase 3 (Offline MVP, 3–4w): SW, IndexedDB, sync, conflict UI.
- Phase 4 (Core Modules, 6–8w): P2P, O2C, Inventory/Costing, approvals, search.
- Phase 5 (AI MVP, 4–6w): OCR/matching, copilot PO, forecasting, anomaly alerts.
- Phase 6 (Intercompany, 3–4w): counter-docs, eliminations, consolidation.
- Phase 7 (Mobile, 2–3w): Capacitor packaging, mobile sync.
- Phase 8 (Hardening, 3–4w): performance, security, observability, i18n, A11y.
- Phase 9 (Go-Live, ongoing): canary, feature flags, training, support.

14. Acceptance Criteria
- Metadata-driven forms per role/company; client/server validation.
- Offline create/edit with reliable sync and conflict handling.
- Posting generates correct inventory and GL movements; idempotency and series uniqueness.
- AI MVP measurable impact on AP and forecasting; copilot audited.
- Intercompany flows and consolidation accurate.
- Security: strict row-level enforcement; PII masked; complete audit.

15. Appendices
- JSON templates: company registry, forms, workflows, integration inventory, offline policy.
- DDL snippets; GraphQL/REST contracts; flow narratives.

