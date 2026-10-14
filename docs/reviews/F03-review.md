# F03: OneBridge Business ID — Audit & Review

**Date:** 2026-10-13  
**Auditor:** Independent Code Agent (Adversarial Audit)  
**Target:** Feature F03 (`packages/shared`, `packages/api-contracts`, `packages/ui-kit`, `services/organization`, `apps/web-app`)  
**Status:** Audit Complete  

---

## Verification Commands & Quality Gates

The quality gate commands mandated by `AGENTS.md` Section 6 were executed independently:

```bash
pnpm lint
pnpm typecheck
npx cross-env TEMP=D:\temp TMP=D:\temp pnpm test
```

| Command | Exit Code | Result | Details |
|---|:---:|:---:|---|
| `pnpm lint` | 0 | **Pass** | 0 problems, 0 errors, 0 warnings across all 15 workspace projects |
| `pnpm typecheck` | 0 | **Pass** | 14 workspace projects typechecked cleanly with `tsc --noEmit` (0 errors) |
| `pnpm test` | 0 | **Pass** | 264 tests passed across 44 test suites in 6 packages/services |

### Test Breakdown by Module
- `packages/api-contracts`: 2 / 2 passed (1 file)
- `packages/shared`: 35 / 35 passed (9 files)
- `packages/ui-kit`: 8 / 8 passed (2 files)
- `services/identity`: 124 / 124 passed (23 files)
- `services/organization`: 45 / 45 passed (4 files)
- `apps/web-app`: 43 / 43 passed (4 files)
- Root scripts & workspace: 7 / 7 passed (2 files)

---

## 1. Acceptance Criteria Check

A criterion counts as **Verified** only if a test would fail when the behaviour breaks.

| AC # | Requirement | Status | Evidence (Test Name / File & Line) |
|---|---|:---:|---|
| **AC-1** | Format `OB-<6 char base32>`, for example `OB-7KQ2MX`. Unique across the platform, immutable, never reused, even after deletion. | **Verified** | `packages/shared/src/business-id.ts:47-58` and `packages/shared/tests/business-id.spec.ts:17-38` (`generates a valid Business ID matching OB-<6 char base32>`, `generates unique Business IDs across multiple calls`, `rejects invalid Business ID formats`).<br>`services/organization/tests/business-id-f03.spec.ts:65` (`asserts Business ID uniqueness across concurrent creations (AC-1)` with 20 parallel creations).<br>`services/organization/tests/business-id-f03.spec.ts:88` (`asserts Business ID is immutable and cannot be updated via PATCH /orgs/:id (AC-1)`).<br>`services/organization/tests/business-id-f03.spec.ts:119` (`asserts Business ID is never reused even after organization deletion (AC-1)` via append-only `issued_id_registries`). |
| **AC-2** | Minted by the Organization service during `POST /orgs`, together with the opaque `tenantId` (ADR-0001). Uses an append-only issued-ID registry. Retries safely on collision. | **Verified** | `services/organization/src/application/organization.service.ts:127-147` generates opaque `ulid()` tenantId and mints `candidateId` with retry budget.<br>`services/organization/src/infrastructure/mongo-issued-id.repository.ts:18-38` claims in `issued_id_registries` with unique index catch.<br>`services/organization/tests/business-id-f03.spec.ts:150` (`retries safely up to 5 times when candidate Business ID collides (AC-2)`).<br>`services/organization/tests/business-id-f03.spec.ts:175` (`throws 503 Service Unavailable when 5 collision retries are exhausted (AC-2)`). |
| **AC-3** | Shown in admin settings, the admin left rail footer and the public profile with a copy button. | **Verified** (Component) / **Defect** (Page consumer) | `packages/ui-kit/src/components/BusinessIdDisplay.tsx:102, 165, 205` implements variants `settings`, `rail`, `public`, `badge`.<br>`packages/ui-kit/tests/components.spec.tsx:47` (`BusinessIdDisplay renders Business ID with copy button and handles states`).<br>`apps/web-app/src/features/business-id/BusinessIdDisplay.spec.tsx:25-71` verifies settings card, rail footer, public profile, clipboard copy, `Copied!` confirmation, and `aria-live="polite"`.<br>**Defect in consumer:** In `apps/web-app/app/dashboard/page.tsx:59`, `profile.activeTenant?.businessId` falls back to `(activeOrgId ? OB-${activeOrgId.slice(0, 6)} : '')` because `GET /me` does not return `businessId`. This fabricates an un-minted synthetic pseudo-ID by slicing an opaque ULID. |
| **AC-4** | Branch, department and seat IDs derive from it (`-B03`, `-D07`, `-E0142`). Counters never reuse a number. | **Verified** | `packages/shared/src/business-id.ts:114-182` implements `formatBranchId`, `formatDepartmentId`, `formatSeatId`, `validateDerivedId`, `parseDerivedId`.<br>`services/organization/src/infrastructure/mongo-counter.repository.ts:14-43` implements atomic `$inc: { seq: 1 }` per tenant and entity type.<br>`services/organization/src/application/counter.service.ts:24-46` implements `generateDerivedId`.<br>`packages/shared/tests/business-id.spec.ts:77-142` tests formatting, two-digit and four-digit zero padding, validation, and parsing.<br>`services/organization/tests/business-id-f03.spec.ts:191-293` tests monotonic sequencing (`-B01`, `-D01`, `-E0001`), non-reuse after entity deletion, concurrency under 30 parallel increments, and cross-tenant counter isolation. |
| **AC-5** | Students use `OB-S<6 char base32>` (Should, built in F27). Minted by Identity with its own registry (ADR-0001). | **Verified** | `packages/shared/src/business-id.ts:98-112` implements `generateBase32StudentId()` and `validateStudentId()`.<br>`packages/shared/tests/business-id.spec.ts:59-75` tests generation matching `^OB-S[0-9A-HJKMNP-TV-Z]{6}$`, validation, rejection of invalid characters/lengths, and confirms student IDs never validate as company Business IDs. |

---

## 2. Rule Violations (AGENTS.md Section 3)

Every rule in `AGENTS.md` Section 3 was checked individually:

1. **tenantId on every database document and query:** **Pass**. `counters` collection is explicitly registered as `'tenant-scoped'` in `packages/shared/src/mongo/collection-registry.ts:83-88`; `MongoCounterRepository` extends `TenantScopedRepository<CounterDoc>` ensuring all queries scope and validate `tenantId`. `issued_id_registries` is an allowlisted global collection per ADR-0001. Cross-tenant isolation tested in `business-id-f03.spec.ts:261-292`.
2. **Server-side authorisation checked by tenant and role scope:** **Pass**. `businessId` immutability is enforced server-side in `OrganizationService.updateOrganization()` (`organization.service.ts:280-298`); attempts to patch `businessId` are ignored and cannot overwrite the issued ID (`business-id-f03.spec.ts:88-117`).
3. **Seats belong to company (offboarding rules):** **Pass** (N/A to F03; seats entity lifecycle handled in F08/F16).
4. **No personal data in logs, push payloads or analytics event names:** **Pass**. Emitted domain events (`org.created`, `org.updated`) contain only `orgId`, `businessId`, `creatorPersonId`, `name`, `slug` (`events.yaml:108-125`). No PII or visitor data.
5. **Phone and email of visitors encrypted at rest / offline key:** **Pass** (N/A to F03; visitor lead data handled in F13).
6. **Access token in memory only, refresh token in httpOnly cookie, no localStorage:** **Pass**. No `localStorage` or `sessionStorage` used for tokens, credentials, or IDs.
7. **Student ID images in separate encrypted bucket with 30-day deletion:** **Pass** (N/A to F03; student verification handled in F27).
8. **Record consent with timestamp and notice version:** **Pass** (N/A to F03; consent handled in F13/F14).
9. **Short links are immutable:** **Pass** (N/A to F03; handled in edge shortlink F11).
10. **Disabled and unactivated chips resolve to neutral page:** **Pass** (N/A to F03; handled in F21).
11. **Contract first (OpenAPI/AsyncAPI before code):** **Pass**. `packages/api-contracts/openapi.yaml:816` and `packages/api-contracts/events.yaml:122` updated with regex pattern `^OB-[0-9A-HJKMNP-TV-Z]{6}$`. Contracts regenerated with `pnpm contracts:gen`.
12. **Write endpoints accept an idempotency key (consumers idempotent):** **Pass**. `POST /orgs` handles `Idempotency-Key` and uses `CacheStore` (`nest-organization.controller.ts:80-100, 147-165`).
13. **Modules never read each other's database collections:** **Pass**. `services/organization` does not access Identity collections; communicates only via `HttpIdentityInternalClient` over HTTP.
14. **Errors use application/problem+json, lists paginated, correlation ID on every request:** **Pass**. `GlobalExceptionFilter` maps errors to RFC 7807 problem+json; `correlationId` passed through all service calls and emitted events.
15. **Additive changes only:** **Pass**. All changes to OpenAPI schemas, event schemas, and shared utilities are strictly additive.
16. **Anything user-visible and unfinished goes behind a feature flag:** **Pass**.
17. **Use tokens from packages/ui-kit (no hard-coded colour, radius, spacing):** **Pass** on `BusinessIdDisplay.tsx` (`rounded-12`, `p-16`, `bg-sand/30`, `text-charcoal`, `text-deep-orange`, etc.). **Minor Defect** on `apps/web-app/app/dashboard/page.tsx:68-75` where leftover inline styles exist (`backgroundColor: '#F3F4F6'`).
18. **Orange is a fill, never a text colour (charcoal on orange, Deep Orange on light bg):** **Pass**. In `BusinessIdDisplay.tsx:141, 192, 275`, orange buttons use `'bg-bridge-orange text-charcoal'`. Offline indicator text on light backgrounds uses `'text-deep-orange'` (`#A04E08`, lines 119, 261). Zero instances of orange as text.
19. **Brand-kit colours chosen by customers must pass contrast check:** **Pass**.
20. **Touch targets are 44 px or more, status never colour alone:** **Pass**. All copy buttons in `BusinessIdDisplay.tsx` enforce `min-h-[44px] min-w-[44px]`. Offline indicator provides text "Offline". Copied confirmation provides checkmark icon and text "Copied!".
21. **Respect prefers-reduced-motion (arcs become 150 ms fade):** **Pass**. Button transitions enforce `motion-reduce:transition-none` (`BusinessIdDisplay.tsx:138, 189, 227, 272`).
22. **Copy: sentence case, plain words, active verbs, informative errors:** **Pass**. Labels default to `'Business ID'`, `'Copy'`, `'Copied!'`, `'No Business ID available'`.
23. **English and Hindi in Phase 1, no hard-coded strings (i18n layer), Indian number format:** **Pass**. `BusinessIdDisplay` accepts a `labels` prop (`BusinessIdDisplayLabels`) for external i18n translation.

---

## 3. Invented Behaviour

1. **Synthetic Business ID Slicing in `apps/web-app/app/dashboard/page.tsx:59`**:
   ```typescript
   const businessId = profile.activeTenant?.businessId || (activeOrgId ? `OB-${activeOrgId.slice(0, 6)}` : '');
   ```
   `activeOrgId` is a 26-character internal ULID. When `profile.activeTenant?.businessId` is absent (which it currently is from `GET /me`), the code fabricates a pseudo Business ID by slicing the first 6 characters of the ULID (`OB-${activeOrgId.slice(0, 6)}`). This synthetic ID was not minted via the registry, violates uniqueness guarantees, and produces misleading data in the UI.
2. **Redundant Internal Delegate Method on `OrganizationService`**:
   `OrganizationService.generateDerivedId(tenantId, type)` in `services/organization/src/application/organization.service.ts:79-84` delegates directly to `CounterService.generateDerivedId(tenantId, type)`. While internal and not exposed over HTTP, callers can and should use `CounterService` directly.

---

## 4. Missing States or Tests

1. **Missing `jest-axe` Automated Accessibility Check on `BusinessIdDisplay`**:
   In `packages/ui-kit/tests/components.spec.tsx`, `ActionButton` (line 12) and `StatusChip` (line 20) are tested with `await axe(container)` and `toHaveNoViolations()`, but `BusinessIdDisplay` (line 47) omitted this automated accessibility test.
2. **Missing Production Startup Call for `MongoCounterRepository.createIndexes()`**:
   `MongoCounterRepository.createIndexes()` creates the unique compound index `{ tenantId: 1, type: 1 }`. This method is called in test fixtures (`business-id-f03.spec.ts:32`), but is not invoked during application bootstrap (`services/organization/src/app.ts` / `main.ts`). In production MongoDB, un-indexed collections could permit duplicate counter documents under concurrent upsert operations.
3. **Missing Component Mount Integration Test for `DashboardPage`**:
   `apps/web-app/app/dashboard/page.tsx` mounts `AdminSettingsBusinessIdCard` and `AdminRailFooter`, but no test renders `DashboardPage` to verify that the cards render correctly when identity loads.

---

## 5. Report Accuracy

- **Partial Inaccuracy in AC-3 Claim**: `docs/reports/F03-report.md` states: *"Wired into `apps/web-app/src/features/business-id` and mounted in `apps/web-app/app/dashboard/page.tsx`"*. While the components are mounted, because `GET /me` does not supply `businessId`, line 59 displays a synthetic sliced-ULID rather than the minted Business ID. The report does not disclose this fallback.
- **Accurate Test Counts**: All reported test counts match independent test execution exactly (35 shared tests, 8 ui-kit tests, 43 web-app tests, 45 organization tests; 264 total across the workspace).

---

## 6. Verdict & Required Fixes

**Verdict: Accept with fixes**

### Numbered List of Required Fixes:

1. **Remove Synthetic ULID Slicing Fallback in `apps/web-app/app/dashboard/page.tsx`**:
   Remove `(activeOrgId ? OB-${activeOrgId.slice(0, 6)} : '')` from line 59. Set `const businessId = profile.activeTenant?.businessId || '';` so that when `businessId` is empty or not yet loaded, `BusinessIdDisplay` cleanly displays its designed `isEmpty` fallback ("No Business ID available") rather than a fabricated fake ID.
2. **Add `axe(container)` Accessibility Test for `BusinessIdDisplay`**:
   In `packages/ui-kit/tests/components.spec.tsx`, add an `axe(container)` test assertion to verify that all variants of `BusinessIdDisplay` pass WCAG accessibility without violations.
3. **Ensure `MongoCounterRepository.createIndexes()` Is Invoked on Application Initialization**:
   Ensure `createIndexes()` is called on repository initialization in `services/organization` (or documented in the database migration checklist) so the unique index `{ tenantId: 1, type: 1 }` is strictly guaranteed in production environments.
