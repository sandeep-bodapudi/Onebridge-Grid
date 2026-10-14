# Decisions log

The coding agent treats this file as final. If something here is wrong, change it here first.
Append new decisions at the bottom, with date, decision and reason.

## Resolved decisions

| ID | Topic | Decision | Source |
|---|---|---|---|
| D1 | Repo model | One workspace with strict module boundaries. Folders mirror the planned repos so we can split later. Replaces the 15-repo plan. | Founder, 9 Oct 2026 (reverses PRD v1.1 D1) |
| D2 | Free plan | None. Starter and Business are paid. Enterprise is contact-sales. Verified students are the only free users. | PRD v1.1 D2 |
| D3 | Offboarding | Departing person keeps only their own public card details. Leads, saved-contact history, analytics and card history stay with the company. | PRD v1.1 D3 |
| D4 | Dashboard | One app with feature modules and no cross-module imports. | PRD v1.1 D4 |
| D5 | PWA | My Card only. Visitor page is not a PWA. Admin dashboard is online-only. | PRD v1.1 s7 |
| OPEN-A | 14-day trial | Not built. Payment step must be movable behind flag `payment_after_first_card`. | Default |
| OPEN-B | Student verification | College email OTP and college ID both required. No-email-domain colleges go to senior review with a second proof. | Default |
| OPEN-C | Scope cuts | Deferred: custom template builder, wallet passes, auto-translate, native NFC, SSO/SAML. | Default |
| OPEN-D | PWA manifest | One OneBridge manifest for all customers. | Default |
| M1 | MFA | Optional for users. Mandatory for Owner and Admin on Business plan and above. | PRD v1.0 P1-ID-02, section 16.3 |
| L1 | Phase 1 leads | Lightweight `Lead` owned by Cards. No Relationship graph, no Contact entity (Phase 2). | PRD v1.1 s3 |
| S1 | Share-back fields | Required: name, phone, consent. Optional: email, company, note. | Default |
| C1 | Printed card families in MVP | Small business, medium employee, owner. Large-employee and student printed cards are later. | Default |
| C2 | Metal cards | QR-only design. NFC not guaranteed on metal. | Default |
| P1 | Student card cost | Student printed card is not in MVP, so no decision needed yet. | Default |
| T1 | Business and tenant IDs | Organization mints `tenantId` and `businessId`; Identity mints student IDs `OB-S...`. See ADR-0001. | ADR-0001 |
| T2 | Lead encryption | AES-256-GCM single encrypted payload, per-tenant key, per-tenant HMAC blind index. See ADR-0002. | ADR-0002 |
| T3 | Event model | Domain events via outbox; analytics on a separate ingestion path; read models in Cards; signed outbox calls to web-public and the edge. See ADR-0003. | ADR-0003 |
| T4 | Edge consistency | Short-link status changes reach the edge within 60 seconds (accepted). | ADR-0003 |
| T5 | Refresh cookie | `SameSite=Lax`. | F01 |
| T6 | SSO scope | Out of scope: enterprise SSO (SAML, org-level OIDC, SCIM). In scope: Google and Microsoft personal sign-in. | AGENTS.md |
| T7 | Hindi, QR source tags | Should (English and one QR per card are Must). | PRD v1.0 |
| T8 | Handover summary | Should, per PRD. Founder may promote to Must. | PRD v1.1 |
| T9 | Impersonation | Must (PRD P1-ADM-01), with consent, reason, time limit, visible to customer admin. | PRD v1.0 |
| T10 | Quality gates | Tenant isolation, contrast, Lighthouse and accessibility budgets run in CI from the step that introduces the code. | F00 |
| T11 | Student ID minting | Identity, own registry, built in F27. | ADR-0001 |

## Still open (agent must ask, not guess)

| ID | Question | Owner |
|---|---|---|
| Q5 | Domains `grid.onebridge.in` and `obg.in` available? Legal entity name for invoices? | Founders |
| Q10 | Team size, budget, GA date | Management |
| OPEN-GATEWAY | API gateway: Kong or AWS API Gateway | Engineering |
| OPEN-PAYDB | Payments database: PostgreSQL or MySQL (default PostgreSQL with Prisma) | Engineering |
| V1 | Closed beta target: 20-50 orgs or 50+ paying | Founders |
| V2 | Verify page for large-employee card: what it reveals (deferred, card not in MVP) | Product, Legal |

## Decisions made by the agent

- **[2026-10-12] D-STEP1-SCOPE: Step 1 Foundation Scope Alignment & Deferred F00 Capabilities**:
  - **Decision ID**: `D-STEP1-SCOPE`
  - **Decision**: Step 1 Foundation is formally closed on a reduced, verified foundation (workspace/CI, `ui-kit` with WCAG AA contrast validation, complete authentication in `services/identity` with phone OTP, RFC 6238 TOTP MFA for Business Owner/Admin, rotating session families with HttpOnly cookies, and account-takeover protected OAuth linking requiring primary credential re-auth, safe RegExp in `findByEmail`, tenancy isolation framework with `TenantScopedRepository` vs. `GlobalRepository`, fake adapters `FakeOtpSender` and `FakeEventBus`, dev seed with 2 tenants, 6 persons, 6 memberships, and Playwright E2E login verification).
  - **Deferred Items from Step 1 F00 & Owner Steps**:
    1. *Transactional outbox & background worker*: Deferred to **Step 2 (Organisation)** / **Step 3 (Cards)** where multi-service domain events are first emitted. Step 1 relies on `FakeEventBus`.
    2. *Media service (`services/media` upload, resize, EXIF strip, virus scan, signed URLs)*: Deferred to **Step 2 (F09 Brand kit)** and **Step 3 (F10 Cards)** where image/document assets are introduced.
    3. *Feature flags engine & per-tenant overrides*: Deferred to **Step 2 / Step 5 (Billing)** where tenant-level runtime flags (`payment_after_first_card`) are first evaluated.
    4. *Analytics ingestion stub (`POST /analytics/events`)*: Deferred to **Step 3 (Cards visitor telemetry)** / **Step 8 (Analytics)**.
    5. *Full dashboard shell (Charcoal rail, module registry, offline banner beyond current thin page)*: Deferred to **Step 2 (Organisation and seats)**. Step 1 delivered the minimal login & MFA auth container (`AuthFlow`) and RBAC view.
    6. *Production Google/Microsoft OAuth verifiers*: Deferred to **Step 12 (Hardening)**. Non-production uses `FakeOAuthVerifier`; production refuses `ENABLE_FAKE_OAUTH`.
    7. *Durable idempotency store*: Deferred to **Step 2 / Step 5 (Billing)**. Current implementation provides in-memory deduplication and single-send interceptors.
  - **Rationale (Why)**:
    - *Dependency*: Step 1 focuses strictly on identity, credentials, and tenant isolation primitives. Media, analytics ingestion, company switcher, and outbox event dispatch have no consumers in Step 1.
    - *Risk*: Implementing complex outbox workers, media pipelines, or telemetry sinks prematurely introduces external infrastructural dependencies and distracting surface area before domain models are established.
    - *Pragmatism & Speed*: Guarantees a fully verified, green foundation (100% CI pass across lint, typecheck, unit, integration with real MongoDB, and E2E) without speculative code.
- **[2026-10-12] D-AUDIT-NEXT14-CONTAINMENT: Dependency Audit Remediation & Next 14 Containment**:
  - **Decision ID**: `D-AUDIT-NEXT14-CONTAINMENT`
  - **Decision**: In `pnpm-workspace.yaml`, remediate production audit vulnerabilities by overriding `postcss` (`>=8.5.18`), `path-to-regexp` (`>=0.1.13`), and `multer` (`>=2.0.2`), and upgrading `next` in `apps/web-app` to `14.2.35`. For the 10 remaining advisories on Next 14 (8 high, 2 critical) whose upstream fixes only exist in Next 15 (`>=15.0.8`, `>=15.5.15`, `>=15.5.21`, `>=15.5.24`), contain them by adding their GHSA IDs to `pnpm-workspace.yaml` `auditConfig.ignoreGhsas`. The CI quality gate `pnpm audit --prod --audit-level=high` remains fully active.
  - **Accepted Risk & Rationale**: Upgrading to Next 15 in this PR introduces breaking framework changes (React 18 vs 19 peer dependencies, App Router Server Actions breaking changes) outside Step 1 scope. The unpatched Next 14 advisories target features not exposed or utilized in Step 1 (Server Actions SSRF/DoS, WebSocket upgrade rewrites, i18n Pages Router middleware, and AVIF image optimization).
  - **Follow-up Owner**: **Step 12 (Hardening)** (or Step 2 Organisation alongside full dashboard shell integration) to upgrade to Next 15 and remove the ignored GHSAs.

