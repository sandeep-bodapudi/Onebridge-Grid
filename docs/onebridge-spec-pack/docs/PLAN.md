# OneBridge Grid: Phase 1 Implementation Plan (final)

This plan holds **order, dependencies and exit gates only**. Requirements live in `docs/features/*.md`. If this file and a feature file differ, the feature file wins.

Authority order: AGENTS.md, `decisions.md`, `adr/`, `features/`, this plan, PRDs, UI/UX spec. No month schedule: build by dependency and finish each step before the next.

## Steps

| Step | Features (in order) | Exit gate (all must be true before the next step) |
|---|---|---|
| 1 Foundation (Reduced) | F00 platform (foundation subset), F05 ui-kit, F01 auth, F02 tenancy and roles | `pnpm lint typecheck test` green in CI. Tenant-isolation test framework works (`TenantScopedRepository` & `GlobalRepository`). Fake providers (`FakeOtpSender`, `FakeEventBus`) and seeded demo data run with `pnpm dev`. Contrast test passes. Login works end to end with fake OTP (including MFA for Owner and safe OAuth link confirmation). *(Deferred from Step 1: outbox, media service, feature flags, analytics ingestion, full dashboard shell; see Dependency notes and decisions.md [2026-10-12]).* |
| 2 Organisation | F06 company (mints IDs, ADR-0001), F03 Business ID, F07 structure, F08 seats, F09 brand kit, F04 audit log | A new company can sign up, get an Owner membership before the first response returns, create branches and seats, set a brand kit with contrast protection, and see audit entries. |
| 3 Cards | F10 cards, F11 short links and QR, F12 visitor page, F13 share-back and leads | A published card is reachable by short link, visitor page meets the budgets in CI, share-back creates an encrypted lead (ADR-0002), analytics events use the ingestion path, read models update from events. |
| 4 Employees | F14 invite and claim, F15 import and bulk, F16 offboarding | Invite to live card works with the privacy notice recorded. 1,000-row import under 60 s. Offboarding revokes access within 60 s and leads stay. |
| 5 Billing | F17 plans, F18 invoices and lapse | Fake `PlanLimits` replaced by real. Webhook replay is safe. Lapse timeline correct. |
| 6 NFC and print | F20 artwork and proofs, F19 catalogue and orders, F21 activation and lost | Order cannot be paid before proof approval. Print PDFs verified. Disabled chip leaks nothing. |
| 7 Notifications | F22 | New-lead notification under 10 s on the fake provider. Fallback routing tested. No PII in payloads. |
| 8 Analytics | F23 | Dashboards role-scoped. Replay after outage works. Retention job works. |
| 9 My Card PWA | F24 | Offline QR in airplane mode. Wipe tested for every trigger. Budgets pass in CI. Device-lab matrix run. |
| 10 Ops console | F25 | KYB decision flips the verified badge. NFC order moves from placed to delivered. Impersonation limits enforced. |
| 11 Public profile | F26 | Profile and enquiry work with encryption and spam protection. |
| 12 Student plan and hardening | F27 (Should), F28 | `docs/launch-report.md` complete. Launch checklist signed. |

## Dependency notes
- F06 creates the Business ID; F03 is the specification of the ID rules and is built together with F06.
- F20 (artwork) before F19 (orders): orders need proofs.
- Web push: **subscription** in F24, **sending** in F22. Until F24 exists, the push channel is a fake.
- Until Step 5, `PlanLimits` is a fake that can be set per tenant. Until Step 7, `Notifier` is a fake. Until Step 8, analytics ingestion is a stub that queues events. Until Step 10, KYB status is set by a test fixture.
- Contracts: write OpenAPI and event schemas for Steps 1 to 3 in Step 1. Write each later step's contracts at the start of that step, with approval, before code.

### Step 1 Foundation Scope & Deferred Items (see decisions.md [2026-10-12])
Step 1 closes on a verified reduced foundation (workspace, tokens, ui-kit with contrast check, auth with OTP/MFA/sessions/OAuth linking protection, tenancy isolation framework, fake providers + seed, and E2E login). Non-blocking platform subsystems from F00 are explicitly deferred to later consuming steps:
- **Transactional outbox & background worker**: Deferred to **Step 2 (Organisation)** and **Step 3 (Cards)**, where multi-entity transactional event publishing is first consumed. Step 1 uses `FakeEventBus`.
- **Media service (`services/media`)**: Deferred to **Step 2 (F09 Brand kit)** and **Step 3 (F10 Cards)**, where logos and card media uploads are introduced.
- **Feature flag evaluation engine**: Deferred to **Step 2 / Step 5 (Billing)**, where per-tenant runtime flags (`payment_after_first_card`) are first evaluated.
- **Analytics ingestion stub (`POST /analytics/events`)**: Deferred to **Step 3 (Cards visit telemetry)** and **Step 8 (Analytics)**.
- **Full Dashboard Shell (`apps/web-app` left rail, company switcher, search, error boundary)**: Deferred to **Step 2 (Organisation and seats)**. Step 1 delivered the minimal login & MFA auth container (`AuthFlow`) and RBAC view required for end-to-end authentication.
- **Hindi i18n message catalogue**: Deferred to **Step 3 / Step 12**. English foundation established first.
- **OpenTelemetry & Sentry**: Deferred to **Step 12 (Hardening)**. Structured JSON logs and correlation IDs are active in Step 1.

## Quality gates in CI (from the step that introduces the code)
Cross-tenant isolation tests (every service). Module-boundary lint. ui-kit contrast test. Lighthouse budgets and axe checks on `apps/web-public` (Step 3) and My Card (Step 9). Log-scrubbing test for personal data. Contract tests.

## Events
See the catalogue in `docs/adr/ADR-0003-events-and-data-flow.md`.

## Out of scope
See AGENTS.md section 10.

## Open questions
See `docs/decisions.md` (Still open). Anything that blocks a step goes to `docs/questions.md`.
