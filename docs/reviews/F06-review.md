# F06: Company Onboarding and Profile — Audit & Review

**Date:** 2026-10-13  
**Auditor:** Independent Code Agent (Adversarial Audit)  
**Target:** Feature F06 (`services/organization`, `packages/api-contracts`, `apps/web-app`, `packages/shared`, `packages/ui-kit`)  
**Status:** Audit Complete  

---

## Verification Commands & Quality Gates

The quality gate commands mandated by `AGENTS.md` Section 6 were executed independently:

```bash
pnpm lint
pnpm typecheck
pnpm test
```

| Command | Exit Code | Result | Details |
|---|:---:|:---:|---|
| `pnpm lint` | 0 | **Pass** | 0 problems, 0 errors, 0 warnings across all 15 workspace projects |
| `pnpm typecheck` | 0 | **Pass** | 14 workspace projects typechecked cleanly with `tsc --noEmit` (0 errors) |
| `pnpm test` | 0 | **Pass** | 231 tests passed across 40 test suites in 6 packages/services |

### Test Breakdown by Module
- `packages/api-contracts`: 2 / 2 passed
- `packages/shared`: 28 / 28 passed
- `packages/ui-kit`: 7 / 7 passed
- `services/identity`: 124 / 124 passed
- `services/organization`: 29 / 29 passed
- `apps/web-app`: 34 / 34 passed
- Root scripts & workspace: 7 / 7 passed

---

## 1. Acceptance Criteria Check

A criterion counts as **Verified** only if a test would fail when the behaviour breaks.

| AC # | Requirement | Status | Evidence (Test Name / File & Line) |
|---|---|:---:|---|
| **AC-1** | `POST /orgs` mints `tenantId` (ULID) and `businessId` (ADR-0001) and creates Owner membership in Identity before response returns; rollback on failure; client refreshes token | **Verified** (Backend) / **Not verified** (Client Token Refresh) | `organization.service.spec.ts:53` (`creates company, mints tenantId (ULID) and businessId (OB-XXXXXX), and creates Owner membership in Identity`), `organization.service.spec.ts:88` (`rolls back and fails with 503 if synchronous call to Identity fails`), and `organization-http.spec.ts:61`.<br>*(Defect: `OnboardingFlow.tsx` and `api-client.ts` do not trigger client token refresh after company creation).* |
| **AC-2** | Sign up, then enter company name, industry, size, city. GSTIN is optional at signup and required for verification badge | **Verified** | `organization.service.spec.ts:139` (`accepts optional GSTIN at signup if valid`), `organization.service.spec.ts:153` (`rejects invalid GSTIN format with an error`), `organization-http.spec.ts:93` (`returns 400 Bad Request on missing required fields`), `organization-http.spec.ts:105` (`returns 400 Bad Request on invalid GSTIN format`), and `OnboardingFlow.spec.tsx:54-112`. |
| **AC-3** | Fields: legal and display name, logo, cover, brand colours, industry, size, about, website, addresses, GSTIN, social links. Role scope on edits (Owner & Admin only); cross-tenant isolation | **Wrong** | `organization.service.spec.ts:166` tests field updates and line 205 tests role checking when `{ role: 'employee' }` is passed explicitly.<br>**Critical Defect:** In `nest-organization.controller.ts:115-126` and `138-156`, if a caller omits `x-tenant-id` and `x-user-role`, `effectiveTenantId` is `undefined`, the 403 isolation check is bypassed, `tenantToRun` defaults to `:id`, and `role` defaults to `'owner'` (`tenant-auth.guard.ts:21`). Any unauthenticated caller can read and deface any company profile! |
| **AC-4** | Changes reach all cards within 60 seconds (event `org.branding_updated`) | **Verified** | `organization.service.spec.ts:217` (`emits org.branding_updated when brandColours, logo, or cover change`) and `organization-http.spec.ts:209` (`updates profile and emits org.branding_updated when brand colours or logo change`). Event schema in `packages/api-contracts/events.yaml:168-219`.<br>*(Minor Defect: `correlationId` on the emitted event is hardcoded to `'unknown'` in `organization.service.ts:309`).* |
| **AC-5** | Plan selection exists as a step; position controlled by flag `payment_after_first_card`; payment uses fake provider until Step 5 | **Verified** (UI) | `OnboardingFlow.spec.tsx:116` (`renders plan options and allows selecting Business plan`) and `OnboardingFlow.spec.tsx:129` (`respects payment_after_first_card flag by showing brand setup before plan selection`). `OnboardingFlow.tsx:138-143`. Backend is plan-agnostic. |
| **AC-6** | Slug is unique. Changing it keeps a permanent 301 from the old slug | **Verified** | `organization.service.spec.ts:254` (`prevents registration with an existing active slug or historical slug`), `organization.service.spec.ts:269` (`keeps previous slugs in previousSlugs array and resolves with 301 redirect`), `organization-http.spec.ts:287` (`returns 301 Moved Permanently with Location header when queried with a previous slug`), and line 316 (404 on unknown slug). |
| **AC-7** | Target: first card live in under 10 minutes (median). Track `time_to_first_card` | **Not verified** | Method `recordFirstCardPublished()` exists in `organization.service.ts:352` and is tested in `organization.service.spec.ts:339`, but **has no HTTP controller route**, **is absent from `packages/api-contracts/openapi.yaml`**, and is **never called by `api-client.ts` or `OnboardingFlow.tsx`**. The duration is computed in React local state (`OnboardingFlow.tsx:188`) and dropped without telemetry or server persistence. |

---

## 2. Rule Violations (AGENTS.md Section 3)

Every rule in `AGENTS.md` Section 3 was checked individually:

1. **tenantId on every database document and query:** **Fail**. `MongoOrganizationRepository.save()` performs raw collection queries `this.collection.findOne({ id: org.id })` and `this.collection.replaceOne({ id: org.id }, docToSave)` without `tenantId` in the query filter (`mongo-organization.repository.ts:53, 61`); `findByAnySlug()` queries the raw collection across all tenants without `tenantId` (`mongo-organization.repository.ts:36`).
2. **Server-side authorisation checked by tenant and role scope:** **Fail**. `TenantAuthGuard` always returns `true` (`tenant-auth.guard.ts:31`), accepting spoofed headers; when headers are omitted, `NestOrganizationController` defaults role to `'owner'` and tenant to the URL parameter `:id`, allowing unauthorized callers to read and edit any tenant profile (`nest-organization.controller.ts:115-126, 138-156`).
3. **Seats belong to company (offboarding rules):** **Pass** (N/A to F06 company onboarding; seats are handled in F08).
4. **No personal data in logs, push payloads or analytics event names:** **Pass**. Logs do not contain personal data; domain events emit IDs and business names (`events.yaml:108-125`).
5. **Phone and email of visitors encrypted at rest / offline key:** **Pass** (N/A to F06; visitor lead data is handled in F13).
6. **Access token in memory only, refresh token in httpOnly cookie, no localStorage:** **Pass**. `api-client.ts:12-16` stores tokens exclusively in memory; no `localStorage` or `sessionStorage` used.
7. **Student ID images in separate encrypted bucket with 30-day deletion:** **Pass** (N/A to F06; student verification handled in F27).
8. **Record consent with timestamp and notice version:** **Pass** (N/A to F06 signup; share-back consent handled in F13/F14).
9. **Short links are immutable:** **Pass** (N/A to F06; handled in edge shortlink F11).
10. **Disabled and unactivated chips resolve to neutral page:** **Pass** (N/A to F06; handled in F16).
11. **Contract first (OpenAPI/AsyncAPI before code):** **Fail**. `CreateOrganizationRequest` in `openapi.yaml:703-716` omits `creatorPersonId`, yet `nest-organization.controller.ts:57` accepts it in the body and `organization.service.ts:26` requires it; `PATCH /orgs/{id}` in `openapi.yaml:521-532` omits `X-User-Role` parameter; `recordFirstCardPublished` endpoint is completely absent from `openapi.yaml`.
12. **Write endpoints accept an idempotency key (consumers idempotent):** **Fail**. Neither `POST /orgs` nor `PATCH /orgs/:id` integrates `IdempotencyInterceptor` or caching; calling `POST /orgs` repeatedly with the same `Idempotency-Key` does not replay cached responses and attempts to create duplicate records.
13. **Modules never read each other's database collections:** **Pass**. `services/organization` does not access Identity collections; calls `HttpIdentityInternalClient` over HTTP (`identity-internal.client.ts:21-54`).
14. **Errors use application/problem+json, lists paginated, correlation ID on every request:** **Pass** on RFC 7807 problem+json and pagination (no lists in F06); **Fail** on event correlation ID: `updateOrganization()` hardcodes `correlationId: 'unknown'` on both `org.updated` and `org.branding_updated` domain events (`organization.service.ts:292, 309`).
15. **Additive changes only:** **Pass**. All database schemas and event structures are additive.
16. **Anything user-visible and unfinished goes behind a feature flag:** **Fail**. `payment_after_first_card` exists only as a local UI component prop in `OnboardingFlow.tsx:101`; no shared feature flag evaluation exists on the backend.
17. **Use tokens from packages/ui-kit (no hard-coded colour, radius, spacing):** **Fail**. `OnboardingFlow.tsx` uses arbitrary utilities `min-h-[300px]` (line 205), `max-w-[140px]` (line 550), and `text-[10px]` (line 570) instead of design tokens from `@onebridge/ui-kit`.
18. **Orange is a fill, never a text colour (charcoal on orange, Deep Orange on light bg):** **Pass**. Buttons carry charcoal text; all orange text uses `text-deep-orange`; `contrast.ts:75-78` forces charcoal text on vibrant orange backgrounds.
19. **Brand-kit colours chosen by customers must pass contrast check:** **Pass**. `validateBrandContrast()` computes WCAG AA luminance ratio and auto-adjusts to charcoal or white with warning if `< 4.5:1` (`contrast.ts:55-93`).
20. **Touch targets are 44 px or more, status never colour alone:** **Pass**. Form inputs and buttons use `min-h-[44px]` or `w-44 h-44`; `StatusChip` renders text words (`Selected`, `Ready`).
21. **Respect prefers-reduced-motion (arcs become 150 ms fade):** **Fail**. `OnboardingFlow.tsx:372, 543` specifies `transition-all` and `transition-colors duration-200` without `motion-reduce:transition-none` or reduced-motion handling.
22. **Copy: sentence case, plain words, active verbs, informative errors:** **Fail**. `OnboardingFlowLabels` in `OnboardingFlow.spec.tsx:8-51` uses Title Case for headings and labels (`Company Details`, `Select Your Plan`, `Brand Identity`, `Create Your First Card`) instead of sentence case.
23. **English and Hindi in Phase 1, no hard-coded strings (i18n layer), Indian number format:** **Fail**. `OnboardingFlow.tsx` contains 12+ hardcoded English strings (e.g. `Step X of Y`, `employees`, `(Optional)`, `Selected`, `Contrast Check:`, `Passes AA`, `Auto-adjusted`, `First Member`, `Ready`) and is not integrated with i18n dictionaries.

---

## 3. Invented Behaviour

1. **Uncontracted `creatorPersonId` in HTTP Request Body:** `NestOrganizationController.createOrganization` accepts `creatorPersonId` in the JSON request body, which is not defined in OpenAPI `CreateOrganizationRequest`.
2. **Fake Header Authentication & Default Owner Elevation:** `TenantAuthGuard` accepts unverified `X-User-Role` and `X-User-Id` headers and automatically falls back to granting the `'owner'` role and `personId: 'anonymous'` when headers are absent (`tenant-auth.guard.ts:21-29`).
3. **Dead Backend Method `recordFirstCardPublished()`:** `OrganizationService.recordFirstCardPublished` was implemented with zero HTTP route binding, zero OpenAPI specification, and zero frontend caller (`organization.service.ts:352-375`).
4. **Hardcoded Fallback `'anonymous_owner'`:** When `creatorPersonId` and headers are absent in `createOrganization`, the controller defaults `creatorPersonId` to `'anonymous_owner'`, creating an owner membership for a dummy user.
5. **Hardcoded Form Defaults in UI:** `OnboardingFlow.tsx:116-129` hardcodes form defaults (`industry: 'Technology'`, `size: '1-10'`, `firstCardRole: 'Founder'`, `#1B2A4A`, `#F68713`) without a spec requirement.

---

## 4. Missing States or Tests

1. **Missing Unauthenticated Request Negative Tests:**
   - No test verifies rejection of unauthenticated `GET /orgs/:id` requests.
   - No test verifies rejection of unauthenticated `PATCH /orgs/:id` requests.
2. **Missing HTTP Integration Tests for `recordFirstCardPublished` (AC-7):**
   - No test exercises recording of first card publication over HTTP because the endpoint does not exist.
3. **Missing Idempotency Tests (Rule 12):**
   - No test verifies that replaying `POST /orgs` or `PATCH /orgs/:id` with the same `Idempotency-Key` returns the cached response.
4. **Missing UI Upload Failure States:**
   - F06 specification explicitly requires: *"States to design: upload failures"*. In `OnboardingFlow.tsx`, logo input is a simple text URL without file upload handling, upload progress, or upload failure error states.
5. **Missing Reduced Motion Tests:**
   - No test verifying `prefers-reduced-motion` compliance in `OnboardingFlow.tsx`.
6. **Missing i18n / Hindi Localization Tests:**
   - No test verifying rendering under Hindi locale.

---

## 5. Report Accuracy (`docs/reports/F06-report.md`)

1. **Inaccurate Claim on AC-3 (Report line 16):**
   - *Claim:* "Server checks X-Tenant-Id and X-User-Role (blocks Employee edits with 403; denies cross-tenant access)."
   - *Reality:* The server only checks `X-Tenant-Id` if provided. If omitted, `effectiveTenantId` is undefined, the isolation check is bypassed, and the request executes as `owner` on the target organization.
2. **Inaccurate Claim on AC-7 (Report line 20):**
   - *Claim:* "`timeToFirstCardSeconds` calculated and tracked upon first card completion. `organization.service.spec.ts`, `OnboardingFlow.spec.tsx` PASS."
   - *Reality:* `recordFirstCardPublished` has no HTTP controller endpoint, is not in `openapi.yaml`, and is never called by the frontend. Local state computation in React does not constitute tracking.
3. **Inaccurate Claim on Section 2.1 Repository Partitioning (Report lines 26-27):**
   - *Claim:* "`MongoOrganizationRepository` extends `TenantScopedRepository` ... Requires active `TenantContext` on all read/write operations; throws `TenantIsolationError` if context is absent or tenant IDs mismatch."
   - *Reality:* `MongoOrganizationRepository.save()` bypasses `TenantScopedRepository` by querying the raw MongoDB collection `this.collection.findOne({ id: org.id })` and `this.collection.replaceOne({ id: org.id }, docToSave)` without `tenantId` in the query filters. `findByAnySlug()` also queries raw MongoDB directly without `TenantContext`.
4. **Omission on Idempotency (Report line 48):**
   - Report claimed quality gates passed, but omitted that `IdempotencyInterceptor` was never wired into `services/organization`.

---

## 6. Verdict & Required Fixes

**Verdict:** **Reject**

The implementation contains a critical authorization bypass allowing unauthenticated defacement of company profiles, repository queries that bypass `tenantId` filter scoping, un-wired AC-7 tracking with missing HTTP endpoints, and multiple violations of Section 3 rules (idempotency, design tokens, and i18n).

### Required Fixes:

1. **Fix Critical Authorization Bypass in `NestOrganizationController`**:
   - In `nest-organization.controller.ts:115-126` and `138-156`, reject requests where caller authentication/tenant is absent with `401 Unauthorized` or `403 Forbidden`.
   - Never fall back to `tenantToRun = id` or default `role = 'owner'` when headers are missing.
2. **Fix `TenantAuthGuard`**:
   - Replace the fake header guard with proper session/Bearer token verification or reject unauthenticated access. Remove default elevation to `'owner'`.
3. **Enforce `tenantId` in `MongoOrganizationRepository.save()`**:
   - Replace raw `this.collection.findOne({ id: org.id })` and `this.collection.replaceOne({ id: org.id }, docToSave)` with calls that include `tenantId` in the query filter, or use `TenantScopedRepository`'s scoped methods.
4. **Implement AC-7 HTTP Endpoint and OpenAPI Contract**:
   - Add `POST /orgs/{id}/first-card` to `packages/api-contracts/openapi.yaml`.
   - Add `@Post(':id/first-card')` in `NestOrganizationController` calling `orgService.recordFirstCardPublished(id)`.
   - Wire `api-client.ts` and `OnboardingFlow.tsx` to invoke this endpoint upon first card publication.
5. **Align Contract on `POST /orgs`**:
   - Align OpenAPI `CreateOrganizationRequest` with implementation: extract `creatorPersonId` securely from authenticated session (`req.user.personId`) rather than accepting an uncontracted body field.
6. **Integrate `IdempotencyInterceptor` on Write Endpoints (Rule 12)**:
   - Wire `IdempotencyInterceptor` with cache store on `POST /orgs` and `PATCH /orgs/:id` to ensure replayed requests return cached responses and reject body mismatches with 422 ProblemDetails.
7. **Fix Correlation ID on Domain Events**:
   - Pass `correlationId` through `updateOrganization()` and attach it to `org.updated` and `org.branding_updated` domain events instead of hardcoding `'unknown'`.
8. **Fix i18n and Remove Hardcoded English Strings (Rule 23)**:
   - Move all hardcoded strings in `OnboardingFlow.tsx` (`Step X of Y`, `employees`, `(Optional)`, `Selected`, `Contrast Check:`, `Passes AA`, `Auto-adjusted`, `First Member`, `Ready`) to i18n label dictionaries and add Hindi translation support.
9. **Eliminate Non-Token CSS Values (Rule 17)**:
   - Replace `min-h-[300px]`, `max-w-[140px]`, and `text-[10px]` with design tokens from `@onebridge/ui-kit`.
10. **Add Missing Security and Negative Tests**:
    - Add integration tests verifying that requests to `GET /orgs/:id` and `PATCH /orgs/:id` without valid authentication and matching tenant context are rejected with 401/403.
    - Add integration tests for idempotency replay on `POST /orgs`.
