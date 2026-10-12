# F00: Platform foundations
Priority: Must     Build step: 1 (before any feature)     Depends on: none
Source: AGENTS.md sections 3 to 7, PRD v1.1 sections 5 and 6, ADR-0003

## User story
As a developer, I need the shared plumbing in place so every feature follows the same rules.

## Acceptance criteria
**Workspace and CI**
- pnpm workspace with the layout in AGENTS.md section 5. `pnpm install`, `dev`, `lint`, `typecheck`, `test`, `test:e2e`, `contracts:gen` all work from the root.
- `pnpm dev` starts everything with fake providers and seeded demo data (two tenants, each with owner, admin, employee).
- GitHub Actions: lint, typecheck, unit, contract tests, build, security scan, preview deploy. PR pipeline 15 minutes or less at p90.
- **CI gates (from the first PR that adds the relevant code):** cross-tenant isolation tests for every service; ESLint module-boundary rule; ui-kit contrast test; Lighthouse budgets on `apps/web-public` (performance 90 or more, accessibility 95 or more, page weight 300 KB or less before media) from Step 3; axe accessibility checks on every new screen.
- Conventional Commits enforced. Automated versions and changelogs. Dependabot or Renovate for shared packages.

**Service plumbing**
- Feature flags: server and client evaluation, per-tenant overrides. Flags in this phase include `payment_after_first_card`, `card_admin_approval`, `student_plan`. *(Deferred from Step 1 Foundation — owned by Step 2 / Step 5; see decisions.md [2026-10-12])*
- Transactional outbox: write the state change and the event in one database transaction; a worker publishes at least once. Worker also makes the signed HTTPS calls in ADR-0003 (retry with backoff, idempotent). *(Deferred from Step 1 Foundation — owned by Step 2 / Step 3; Step 1 uses FakeEventBus; see decisions.md [2026-10-12])*
- Idempotency: write endpoints accept `Idempotency-Key`, store the response for 24 hours, return the same response on replay, and reject the same key with a different body (422). *(Durable Redis/DB idempotency store deferred to Step 2 / Step 5; Step 1 implements in-memory caching and single-send interceptors; see decisions.md [2026-10-12])*
- Correlation ID: `X-Correlation-ID` created at the gateway or edge if missing, passed to logs, traces, events and outbound calls.
- Errors: `application/problem+json` with `type`, `title`, `status`, `detail`, `correlationId`. Lists use cursor pagination.
- Telemetry: OpenTelemetry traces, structured JSON logs without personal data, Sentry for errors. A log-scrubbing test fails if a phone number or email appears in test logs. *(OpenTelemetry & Sentry deferred to Step 12 Hardening; structured JSON logs and correlation IDs active in Step 1)*
- i18n: English and Hindi message catalogues, no hard-coded strings (lint rule), Indian number formatting. *(Hindi catalogue deferred to Step 3 / Step 12; English i18n base established in Step 1)*
- Config: all environment-specific values in config (including `SHORTLINK_BASE_DOMAIN`, default `obg.in`, and `PUBLIC_BASE_URL`). No domain is hard-coded.
- Secrets: read from a vault or environment, never committed. Pre-commit secret scan.

**Media service** *(Deferred from Step 1 Foundation — owned by Step 2 F09 Brand kit & Step 3 F10 Cards; see decisions.md [2026-10-12])*
- Upload with allowed types (images: PNG, JPEG, WebP, SVG sanitised; documents: PDF), size limits (images 5 MB, PDF 25 MB), virus scan, EXIF removal, resizing and WebP/AVIF variants, stored in S3 ap-south-1 behind CDN. Signed upload URLs. Per-tenant prefix.

**Provider interfaces with fake adapters**
- `Notifier` (email, SMS, WhatsApp, push, in-app), `OtpSender`, `PaymentGateway` (Razorpay), `GstVerifier`, `Courier`, `UrlSafetyChecker`, `BotChallenge` (Turnstile), `KeyService` (KMS), `EventBus`, `PlanLimits`. *(Production Google/Microsoft OAuth JWKS verifiers deferred to Step 12 Hardening; Step 1 uses FakeOAuthVerifier strictly for non-production tests/local dev and enforces production refusal; see decisions.md [2026-10-12])*
- Fakes are deterministic, record calls for assertions, and can simulate failure and delay. No real provider is called in tests.
- `PlanLimits.getForTenant(tenantId)` is configurable per tenant in test and dev (default Business). Starter and Business limits can both be tested.

**Analytics ingestion stub** *(Deferred from Step 1 Foundation — owned by Step 3 / Step 8 Analytics; see decisions.md [2026-10-12])*
- `POST /analytics/events` accepts batches (up to 100), validates the schema, stores to a local queue, and replays when the sink is down. Edge workers and web apps use it. It never blocks a user action.

**Contracts**
- OpenAPI 3.1 for Steps 1 to 3 endpoints and event schemas with version field, in `packages/api-contracts`. Generated TypeScript clients. Pact or schema contract tests in CI. Contracts for later steps are written at the start of each step.

**Dashboard shell** (`apps/web-app`) *(Full navigation shell with Charcoal rail, module registry, offline banner deferred to Step 2 Organisation; Step 1 delivered the minimal AuthFlow login/MFA shell; see decisions.md [2026-10-12])*
- Root layout, Charcoal left rail, top bar with company switcher and search, module registry, route guard, feature-flag and i18n providers, API client with token refresh, global error boundary that renders problem+json clearly, offline banner.

## States to design
Loading skeleton, global error, offline, no permission, session expired.

## Tests required
Outbox publishes at least once and survives a crash (deferred to Step 2/3); idempotency replay and mismatch; scrubbing test; fake adapter failure modes; PlanLimits per tenant; module boundary lint.

## Out of scope
Kubernetes, Kafka, real provider integrations.
