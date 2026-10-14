# Feature Completion Report: F06 - Company Onboarding and Profile

**Date**: 2026-10-13  
**Feature**: F06: Company Onboarding and Profile  
**Module**: `services/organization`, `packages/api-contracts`, `packages/shared`, `packages/ui-kit`, `apps/web-app`  
**Status**: Completed, Audited, Remediated, and Verified  

---

## 1. Acceptance Criteria Traceability Matrix

| AC # | Requirement Summary | Implementation Details | Test Coverage | Status |
|---|---|---|---|:---:|
| **AC-1** | Create company with tenantId & businessId; create synchronous Owner membership in Identity; emit `org.created` | `POST /orgs` mints ULID `tenantId`, mints `OB-<6 char base32>` `businessId` (ADR-0001), synchronously calls `HttpIdentityInternalClient.createMembership()`, emits `org.created` on event bus. On Identity failure, rolls back by voiding businessId registry and returns 503. | `organization.service.spec.ts` (happy path & rollback), `organization-http.spec.ts` (route & idempotency) | **PASS** |
| **AC-2** | Capture required fields (name, industry, size, city) and optional GSTIN validated with 15-char regex | Handled in `CreateOrganizationRequest` schema, `GSTIN_REGEX` validator in `domain/gstin-validator.ts`, and UI in `OnboardingFlow.tsx`. Validates 15-character statutory format. | `organization.service.spec.ts`, `organization-http.spec.ts`, `OnboardingFlow.spec.tsx` | **PASS** |
| **AC-3** | Complete profile fields (legalName, logo, cover, brandColours, industry, size, about, website, addresses, GSTIN, socialLinks); role scope (Owner & Admin only); cross-tenant isolation | `PATCH /orgs/:id` and `GET /orgs/:id` backed by `TenantScopedRepository`. Server strictly validates `X-Tenant-Id` and `X-User-Role`: missing headers or cross-tenant attempts return `403 Forbidden`; non-owner/non-admin roles return `403 Forbidden`. | `organization-http.spec.ts` (auth & role checks), `organization-isolation.spec.ts` (cross-tenant tests) | **PASS** |
| **AC-4** | Brand colour change emits `org.branding_updated` for 60s card propagation | Changes in `brandColours`, `logo`, or `cover` trigger `org.branding_updated` domain event emission with propagated `correlationId`. | `organization.service.spec.ts`, `organization-http.spec.ts` | **PASS** |
| **AC-5** | Plan selection step (Starter vs Business); step movable behind `payment_after_first_card` flag | `OnboardingFlow.tsx` renders plan selection step; when `paymentAfterFirstCard=true`, plan selection is deferred until after first card setup. Backend remains plan-agnostic. | `OnboardingFlow.spec.tsx` (plan selection & flag order) | **PASS** |
| **AC-6** | Unique slug with permanent 301 redirection on slug changes | `slug` checked against active and `previousSlugs` historical array. `GET /orgs/by-slug/:slug` returns 301 Moved Permanently with `Location` header on old slugs. | `organization.service.spec.ts`, `organization-http.spec.ts` (301 redirect & 404 tests) | **PASS** |
| **AC-7** | Target median under 10m: track `time_to_first_card` | `onboardingStartedAt` timestamp captured at creation; `POST /orgs/{id}/first-card` calculates `timeToFirstCardSeconds` and updates organization profile. Exposed in OpenAPI and invoked via `api-client.ts`. | `organization.service.spec.ts`, `organization-http.spec.ts`, `OnboardingFlow.spec.tsx` | **PASS** |

---

## 2. Audit Remediation Summary (F06-review.md Findings)

All 10 findings and rule violations identified during the adversarial audit have been remediated and tested:

1. **Authorization Bypass & Privilege Elevation Removed (`NestOrganizationController` & `TenantAuthGuard`)**:
   - Eliminated default elevation to `'owner'` and `'anonymous'`.
   - `GET /orgs/:id` and `PATCH /orgs/:id` strictly reject requests with missing `X-Tenant-Id` or mismatched tenant IDs with `403 Forbidden`.
   - `PATCH /orgs/:id` strictly rejects non-owner and non-admin roles with `403 Forbidden`.
   - Verified in `organization-http.spec.ts` (negative security tests).

2. **Repository `tenantId` Scoping Enforced (`MongoOrganizationRepository`)**:
   - Replaced raw MongoDB calls with `TenantScopedRepository` methods `this.findOne` and `this.replaceOne` ensuring `tenantId` is part of every query and replace filter.

3. **OpenAPI & Event Contract Alignment (`openapi.yaml` & `events.yaml`)**:
   - Added optional `creatorPersonId` to `CreateOrganizationRequest`.
   - Added `X-User-Role` and `X-Correlation-ID` header parameters to `PATCH /orgs/{id}`.
   - Added `POST /orgs/{id}/first-card` operation to `openapi.yaml`.
   - Regenerated TypeScript contracts via `pnpm contracts:gen`.

4. **Write Endpoint Idempotency (AGENTS.md Section 3 Rule 12)**:
   - Integrated idempotency handling on `POST /orgs` and `PATCH /orgs/:id` with `InMemoryCacheStore`.
   - Verified that replayed requests with matching `Idempotency-Key` return cached responses, while mismatched payloads return RFC 7807 `422 Unprocessable Entity`.

5. **AC-7 Endpoint & Frontend Client Integration**:
   - Implemented `@Post(':id/first-card')` in `NestOrganizationController`.
   - Added `recordFirstCardPublished(orgId)` in `apps/web-app/src/api-client.ts`.
   - Verified end-to-end in HTTP test suite and UI test suite.

6. **Event Correlation ID Propagation**:
   - `UpdateOrganizationDto` and `CallerContext` now carry `correlationId`.
   - Emitted `org.updated` and `org.branding_updated` domain events now preserve incoming `correlationId` (no longer hardcoded to `'unknown'`).

7. **i18n & Sentence Case Copy (AGENTS.md Section 3 Rules 22 & 23)**:
   - Extracted all UI strings into `apps/web-app/src/features/onboarding/i18n.ts`.
   - Added full Hindi (`hiOnboardingLabels`) and English (`enOnboardingLabels`) dictionary support.
   - Enforced sentence case on all headings, buttons, and helper text.
   - Verified with a dedicated Hindi localization rendering test in `OnboardingFlow.spec.tsx`.

8. **Design Tokens & Accessibility (AGENTS.md Section 3 Rules 17 & 21)**:
   - Replaced arbitrary Tailwind classes (`min-h-[300px]`, `max-w-[140px]`, `text-[10px]`) with ui-kit tokens.
   - Added `motion-reduce:transition-none` to interactive components and animated previews.
   - Verified in `OnboardingFlow.spec.tsx`.

9. **Contrast Validation & Brand Rules**:
   - Enforced WCAG AA contrast check on custom brand colours.
   - Adhered strictly to the OneBridge rule: *Orange is fill only, never a text colour*. Automatically falls back to Charcoal (`#393536`) on high-luminance colours.

10. **Test Coverage Expansion**:
    - Expanded `services/organization` test suite from 29 to 36 tests.
    - Expanded `apps/web-app` test suite from 34 to 36 tests.
    - Total workspace tests increased to 240 / 240 passing.

---

## 3. Test Suites & Quality Gates Summary

All quality gates mandated by `AGENTS.md` Section 6 passed with **0 errors and 0 warnings**:

```bash
pnpm contracts:gen    # Generated TypeScript types from OpenAPI 3.1 & events.yaml
pnpm lint             # 0 problems (0 errors, 0 warnings across all 15 projects)
pnpm typecheck        # 14 workspace projects checked, 0 errors
pnpm test             # 240 tests passing across 40 test suites
```

### Test Breakdown by Module
- **`services/organization`**: 36 / 36 passed (13 unit, 4 real-Mongo isolation, 19 HTTP integration)
- **`apps/web-app`**: 36 / 36 passed (10 auth, 8 RBAC UI, 18 OnboardingFlow)
- **`services/identity`**: 124 / 124 passed
- **`packages/shared`**: 28 / 28 passed
- **`packages/ui-kit`**: 7 / 7 passed
- **`packages/api-contracts`**: 2 / 2 passed
- **Workspace Root**: 7 / 7 passed
- **Total**: **240 / 240 passed**

---

## 4. Modified & Created Files

- **Contracts**:
  - `packages/api-contracts/openapi.yaml` (`POST /orgs`, `PATCH /orgs/{id}`, `POST /orgs/{id}/first-card`, `GET /orgs/by-slug/{slug}`)
  - `packages/api-contracts/events.yaml` (`org.created`, `org.updated`, `org.branding_updated`)
  - `packages/api-contracts/src/api-types.ts` (regenerated clients and types)
  - `packages/api-contracts/src/index.ts`
- **Shared**:
  - `packages/shared/src/business-id.ts` (Base32 Business ID generator and validator)
  - `packages/shared/tests/business-id.spec.ts`
- **UI Kit**:
  - `packages/ui-kit/src/components/index.tsx` (Prop passthrough for `ArchCard`, `EmptyState`, `OfflineBanner`)
- **Organization Service (`services/organization`)**:
  - `domain/organization.ts`, `domain/business-id-registry.ts`, `domain/gstin-validator.ts`
  - `infrastructure/mongo-organization.repository.ts` (tenant-scoped queries)
  - `infrastructure/mongo-issued-id.repository.ts`
  - `infrastructure/identity-internal.client.ts`
  - `application/organization.service.ts` (correlation ID propagation, first-card tracking)
  - `presentation/nest-organization.controller.ts` (strict auth, idempotency, first-card route)
  - `presentation/guards/tenant-auth.guard.ts` (no auto-elevation)
  - `organization.module.ts`, `app.ts`, `main.ts`, `index.ts`
  - Tests: `organization.service.spec.ts`, `organization-isolation.spec.ts`, `organization-http.spec.ts`
- **Frontend (`apps/web-app`)**:
  - `src/features/onboarding/OnboardingFlow.tsx` (tokenized, accessible, i18n-ready multi-step flow)
  - `src/features/onboarding/contrast.ts`
  - `src/features/onboarding/i18n.ts` (English sentence-case & Hindi dictionaries)
  - `src/features/onboarding/OnboardingFlow.spec.tsx` (18 unit & integration tests)
  - `src/features/onboarding/index.ts`
  - `src/api-client.ts` (`createOrganization`, `getOrganization`, `updateOrganization`, `resolveSlug`, `recordFirstCardPublished`)
- **Documentation & Review**:
  - `docs/reviews/F06-review.md` (Adversarial review findings)
  - `docs/reports/F06-report.md` (Updated completion report)
