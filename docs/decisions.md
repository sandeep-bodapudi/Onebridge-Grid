# Decisions Log

## Agent Decisions

- **[2026-10-09] F05 Dark Mode Palette**: (Agent proposal, pending approval) As no specific dark mode palette was provided by design, the agent proposed generating a standard accessible dark palette (inverting light backgrounds to dark grays/blacks and adjusting text for contrast).
- **[2026-10-09] F05 Visual Snapshot Testing**: (Agent proposal, pending approval) As no specific SaaS provider (like Chromatic) was mandated, the agent proposed using Vitest HTML/DOM snapshot testing and `jest-axe` for accessibility validation locally.
- **[2026-10-09] F05 Self-Hosted Fonts Strategy**: (Agent proposal, pending approval) The agent proposed that UI Kit define `@font-face` rules pointing to `/fonts/` and consuming applications (`web-app`, `web-public`) host font assets in their respective `public/fonts` directories.
- **[2026-10-11] F01 Token & TOTP Crypto**: Used Node.js built-in crypto module (HMAC-SHA256 for JWT signing, HMAC-SHA1 for RFC 6238 TOTP, SHA-256 for OTP challenge hashing) ensuring deterministic zero external runtime dependencies.
- **[2026-10-11] F02 Tenancy Header and Scope Modeling**: Used `X-Tenant-Id` header for explicit active tenant designation on authenticated requests (defaults to primary membership on `GET /me` if omitted). Modeled membership scope with optional `branchId`, `departmentId`, and `teamId`, evaluating against the PRD v1.0 Section 15 matrix.
- **[2026-10-11] Inclusion of services/media**: (Agent proposal, pending approval) `docs/features/F00-platform.md` specifies Media service functions (types, size limits, fake virus scan, EXIF stripping, resizing, signed URLs, per-tenant prefix), but `services/media` was omitted from AGENTS.md Section 5. Proposed retaining `services/media` as a dedicated service module.
- **[2026-10-11] Repository Partitioning Model: TenantScopedRepository vs. GlobalRepository (Class A - Approved)**: All repository access in OneBridge Grid is strictly bifurcated to prevent cross-tenant data leakage: (1) `TenantScopedRepository<T>` is the default base class for all business entities (memberships, organizations, branches, seats, cards, leads, audit entries). It resolves and injects `tenantId` exclusively from `TenantContext.getTenantId()`. Any query without active tenant context throws `TenantIsolationError`. Raw MongoDB collections are never exposed to service layers. (2) `GlobalRepository<T>` is an allowlist-only base class restricted to platform-level entities that inherently exist outside or across tenant boundaries (`Person`, `Session`, `OtpChallenge`, `IssuedIdRegistry`). A dedicated test (`collection-classification.spec.ts`) verifies every MongoDB collection against this allowlist and fails the build on any unclassified collection.
- **[2026-10-12] Step 1 Foundation Scope Alignment & Deferred F00 Platform Capabilities**:
  - **Decision**: Step 1 Foundation is formally closed on a reduced, verified foundation: workspace/CI, `ui-kit` with WCAG AA contrast validation, complete authentication (`services/identity` with phone OTP, RFC 6238 TOTP MFA for Business Owner/Admin, rotating session families with HttpOnly cookies, and account-takeover protected OAuth linking), tenancy isolation framework (`TenantScopedRepository` vs. `GlobalRepository`), fake adapters (`FakeOtpSender`, `FakeEventBus`), dev seed (2 tenants, 6 persons, 6 memberships), and Playwright E2E login verification.
  - **Deferred Items from F00**:
    1. *Transactional Outbox & durable worker*: Deferred to **Step 2 (Organisation)** / **Step 3 (Cards)** where multi-service domain events are first emitted. Step 1 relies on `FakeEventBus`.
    2. *Media Service (`services/media` upload, resize, EXIF strip, virus scan, signed URLs)*: Deferred to **Step 2 (F09 Brand kit)** and **Step 3 (F10 Cards)** where image/document assets are introduced.
    3. *Feature Flag Evaluation Engine*: Deferred to **Step 2 / Step 5 (Billing)** where tenant-level flags (`payment_after_first_card`) are first evaluated.
    4. *Analytics Ingestion Stub (`POST /analytics/events`)*: Deferred to **Step 3 (Cards visitor telemetry)** / **Step 8 (Analytics)**.
    5. *Full Dashboard Shell (`apps/web-app` left rail, company switcher, search, global error boundary)*: Deferred to **Step 2 (Organisation and seats)**. Step 1 delivered the minimal login & MFA auth container (`AuthFlow`) and RBAC view.
    6. *Hindi i18n catalogue*: Deferred to **Step 3 / Step 12**.
    7. *OpenTelemetry & Sentry*: Deferred to **Step 12 (Hardening)**.
  - **Rationale (Why)**:
    - *Dependency*: Step 1 focuses on identity and tenant isolation primitives. Media, analytics ingestion, company switcher, and outbox event dispatch have no consumers in Step 1.
    - *Risk*: Implementing complex outbox workers, media pipelines, or telemetry sinks prematurely introduces infrastructural dependencies and distracting surface area before domain models are established.
    - *Time & Pragmatism*: Guarantees a fully verified, green foundation (100% CI pass across lint, typecheck, unit, integration with real MongoDB, and E2E) without speculative code.

