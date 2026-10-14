# Feature Completion Report: F03 - OneBridge Business ID

**Date**: 2026-10-13  
**Feature**: F03: OneBridge Business ID  
**Modules**: `packages/shared`, `packages/api-contracts`, `packages/ui-kit`, `services/organization`, `apps/web-app`  
**Status**: Completed, Verified, and Remediated (Post-Review Green)  

---

## 1. Acceptance Criteria Traceability Matrix

| AC # | Requirement Summary | Implementation Details | Test Coverage | Status |
|---|---|---|---|:---:|
| **AC-1** | Format `OB-<6 char base32>` (Crockford base32 excluding I, L, O, U). Unique across platform, immutable, never reused even after deletion. | Implemented in `packages/shared/src/business-id.ts` via `generateBase32BusinessId()` and `validateBusinessId()`. Enforced immutability in `services/organization/src/application/organization.service.ts` (`updateOrganization`). Schema validated in `packages/api-contracts/openapi.yaml` and `events.yaml`. | `packages/shared/tests/business-id.spec.ts`, `services/organization/tests/business-id-f03.spec.ts` | **PASS** |
| **AC-2** | Minted by Organization service during `POST /orgs` with opaque `tenantId` (ULID). Uses append-only issued-ID registry (`issued_id_registries`). Retries safely on collision. | Organization service mints `tenantId` (ULID) and generates `businessId` via `IssuedIdRegistryRepository.claimId('business_id', businessId, tenantId)`. In case of collision, retries up to 5 attempts before raising a conflict error. Registry is append-only and global across tenants. | `services/organization/tests/business-id-f03.spec.ts`, `services/organization/tests/organization.service.spec.ts` | **PASS** |
| **AC-3** | Shown in admin settings, the admin left rail footer, and the public profile with a copy button. | Implemented reusable `BusinessIdDisplay` in `packages/ui-kit` supporting 4 variants (`'settings'`, `'rail'`, `'public'`, `'badge'`) with clipboard copy, toast / text feedback, `aria-live="polite"` screen reader announcement, WCAG AA contrast, and $\ge 44\text{px}$ touch target. Automated `jest-axe` accessibility coverage added. Wired into `apps/web-app/src/features/business-id` and mounted in `apps/web-app/app/dashboard/page.tsx` with clean `isEmpty` fallback. | `packages/ui-kit/tests/components.spec.tsx`, `apps/web-app/src/features/business-id/BusinessIdDisplay.spec.tsx` | **PASS** |
| **AC-4** | Branch, department, and seat IDs derive from it (`-B03`, `-D07`, `-E0142`). Monotonic counters never reuse numbers. | Registered `counters` collection in `collection-registry.ts`. Implemented `MongoCounterRepository` leveraging atomic `$inc` sequence allocation per tenant, unique compound index on `{ tenantId: 1, type: 1 }` ensured on application bootstrap via `OnModuleInit`, and `CounterService` with `generateDerivedId(tenantId, type)`. Formatters `formatBranchId`, `formatDepartmentId`, `formatSeatId`, `validateDerivedId`, and `parseDerivedId` added to `@onebridge/shared`. | `packages/shared/tests/business-id.spec.ts`, `services/organization/tests/business-id-f03.spec.ts` | **PASS** |
| **AC-5** | Students use `OB-S<6 char base32>` (Should, built in F27). Minted by Identity with own registry (ADR-0001). | Added `generateBase32StudentId()` and `validateStudentId()` in `@onebridge/shared`. Distinct format ensures student IDs never clash with company Business IDs. Registered for F27 student onboarding usage. | `packages/shared/tests/business-id.spec.ts` | **PASS** |

---

## 2. Architecture & Design Rules Verification

Every rule in `AGENTS.md` Section 3 was verified during implementation:

1. **Tenant Isolation**:
   - `counters` collection is explicitly classified as `'tenant-scoped'` in `packages/shared/src/mongo/collection-registry.ts`.
   - `MongoCounterRepository` extends `TenantScopedRepository` ensuring `tenantId` is passed and checked on all operations.
   - Unique compound index `{ tenantId: 1, type: 1 }` strictly verified and enforced.
   - Tested in `services/organization/tests/business-id-f03.spec.ts` with multi-tenant counter verification (Tenant A counter 1 does not affect Tenant B counter 1).

2. **Server-Side Authorisation & Immutability**:
   - `businessId` cannot be updated or overwritten in `OrganizationService.updateOrganization()`; any attempt to pass a changed `businessId` is ignored and rejected.
   - `issued_id_registries` is an allowlisted global collection and append-only.

3. **No Direct `mongodb` Imports Outside `packages/shared`**:
   - All repositories and test suites import `connectMongo` and `MongoConnectionHandle` exclusively from `@onebridge/shared`. Zero violations of ESLint custom rule.

4. **Design Tokens & Accessibility**:
   - Copy buttons meet minimum touch target size ($\ge 44\text{px}$).
   - Color tokens used from `packages/ui-kit`: `#A04E08` (Deep Orange) for icons/text on light backgrounds, Charcoal for text on orange buttons. Orange is never used as text.
   - Screen reader accessibility supported via `aria-live="polite"` feedback on clipboard copy.
   - Automated `jest-axe` tests pass with zero violations across all variants (`settings`, `rail`, `public`, `badge`).

5. **Contract First**:
   - `openapi.yaml` and `events.yaml` updated with regex patterns for `businessId`.
   - TypeScript typings regenerated with `pnpm contracts:gen`.

---

## 3. Files Created and Modified

### `packages/api-contracts`
- [openapi.yaml](file:///d:/Onebridge%20projects/Onebridge%20grid/packages/api-contracts/openapi.yaml): Added strict regex pattern `^OB-[0-9A-HJKMNP-TV-Z]{6}$` to `businessId` in `OrganizationResponse`.
- [events.yaml](file:///d:/Onebridge%20projects/Onebridge%20grid/packages/api-contracts/events.yaml): Added pattern `^OB-[0-9A-HJKMNP-TV-Z]{6}$` to `businessId` in `org.created` event payload.
- [api-types.ts](file:///d:/Onebridge%20projects/Onebridge%20grid/packages/api-contracts/src/generated/api-types.ts): Regenerated contract types.

### `packages/shared`
- [business-id.ts](file:///d:/Onebridge%20projects/Onebridge%20grid/packages/shared/src/business-id.ts): Added Student ID generator and validator; Added Derived ID formatters (`formatBranchId`, `formatDepartmentId`, `formatSeatId`) and validators/parsers (`validateDerivedId`, `parseDerivedId`).
- [collection-registry.ts](file:///d:/Onebridge%20projects/Onebridge%20grid/packages/shared/src/mongo/collection-registry.ts): Registered `counters` as `'tenant-scoped'`.
- [business-id.spec.ts](file:///d:/Onebridge%20projects/Onebridge%20grid/packages/shared/tests/business-id.spec.ts): Added 12 comprehensive unit tests for Business ID, Student ID, and derived ID sequence formatting and parsing.

### `packages/ui-kit`
- [BusinessIdDisplay.tsx](file:///d:/Onebridge%20projects/Onebridge%20grid/packages/ui-kit/src/components/BusinessIdDisplay.tsx): Created multi-variant UI component (`'settings'`, `'rail'`, `'public'`, `'badge'`) with clipboard copy, touch target compliance, screen reader support, and design tokens.
- [index.tsx](file:///d:/Onebridge%20projects/Onebridge%20grid/packages/ui-kit/src/components/index.tsx): Exported component and type definitions.
- [components.spec.tsx](file:///d:/Onebridge%20projects/Onebridge%20grid/packages/ui-kit/tests/components.spec.tsx): Added unit tests for rendering variants, copy click handler, accessible state, and automated `jest-axe` zero violations test across all 4 display variants.

### `services/organization`
- [counter.ts](file:///d:/Onebridge%20projects/Onebridge%20grid/services/organization/src/domain/counter.ts): Domain entity and type definition for monotonic counters.
- [mongo-counter.repository.ts](file:///d:/Onebridge%20projects/Onebridge%20grid/services/organization/src/infrastructure/mongo-counter.repository.ts): Tenant-scoped MongoDB repository using atomic `$inc` sequence increments and compound unique index `{ tenantId: 1, type: 1 }`.
- [counter.service.ts](file:///d:/Onebridge%20projects/Onebridge%20grid/services/organization/src/application/counter.service.ts): Application service for generating derived IDs.
- [organization.service.ts](file:///d:/Onebridge%20projects/Onebridge%20grid/services/organization/src/application/organization.service.ts): Protected `businessId` immutability.
- [organization.module.ts](file:///d:/Onebridge%20projects/Onebridge%20grid/services/organization/src/organization.module.ts): Injected `MongoCounterRepository` and `CounterService`. Implemented `OnModuleInit` to guarantee database indexes are automatically created on service startup.
- [app.ts](file:///d:/Onebridge%20projects/Onebridge%20grid/services/organization/src/app.ts): Registered counter dependencies in NestJS factory.
- [index.ts](file:///d:/Onebridge%20projects/Onebridge%20grid/services/organization/src/index.ts): Exported domain and application classes.
- [business-id-f03.spec.ts](file:///d:/Onebridge%20projects/Onebridge%20grid/services/organization/tests/business-id-f03.spec.ts): 10 comprehensive integration and domain tests covering collision retry, immutability, monotonic counter isolation, derived ID generation, and unique compound index constraint enforcement.

### `apps/web-app`
- [BusinessIdDisplay.tsx](file:///d:/Onebridge%20projects/Onebridge%20grid/apps/web-app/src/features/business-id/BusinessIdDisplay.tsx): Feature wrappers for Admin Settings card, Admin Rail footer, and Public profile badge.
- [index.ts](file:///d:/Onebridge%20projects/Onebridge%20grid/apps/web-app/src/features/business-id/index.ts): Module exports.
- [BusinessIdDisplay.spec.tsx](file:///d:/Onebridge%20projects/Onebridge%20grid/apps/web-app/src/features/business-id/BusinessIdDisplay.spec.tsx): 8 unit tests verifying rendering in settings, rail, and public modes, clipboard copy, accessibility, and clean empty state display without synthetic ID fallback.
- [page.tsx](file:///d:/Onebridge%20projects/Onebridge%20grid/apps/web-app/app/dashboard/page.tsx): Mounted `AdminSettingsBusinessIdCard` and `AdminRailFooter` with clean `isEmpty` handling (removed uncontracted ULID slicing fallback).

---

## 4. Verification & Quality Gates

All quality gates passed with zero warnings and zero errors across the entire workspace:

| Quality Gate | Command | Result |
|---|---|:---:|
| **Lint** | `pnpm lint` | **PASSED** (0 problems, 0 errors, 0 warnings) |
| **Typecheck** | `pnpm typecheck` | **PASSED** (All 14 projects clean) |
| **Shared Unit Tests** | `pnpm --filter @onebridge/shared test` | **PASSED** (9 test files, 35 tests passed) |
| **UI Kit Tests** | `pnpm --filter @onebridge/ui-kit test` | **PASSED** (2 test files, 9 tests passed including `axe`) |
| **Web App Tests** | `pnpm --filter web-app test` | **PASSED** (4 test files, 44 tests passed) |
| **Organization Tests** | `pnpm --filter @onebridge/organization test` | **PASSED** (4 test files, 46 tests passed) |
| **Full Workspace Test Suite** | `pnpm test` | **PASSED** (44 test suites, 267 tests passed) |

---

## 5. Review Findings Remediation Summary

Per [docs/reviews/F03-review.md](file:///d:/Onebridge%20projects/Onebridge%20grid/docs/reviews/F03-review.md):

1. **Remediated Synthetic ULID Slicing Fallback**: Removed `(activeOrgId ? OB-${activeOrgId.slice(0, 6)} : '')` in `apps/web-app/app/dashboard/page.tsx:59`. The component now passes `isEmpty={!businessId}`, correctly showing the designed empty fallback ("No Business ID available") whenever `businessId` is absent.
2. **Added Automated `axe` Accessibility Test**: Verified zero accessibility violations with `jest-axe` across `settings`, `rail`, `public`, and `badge` variants in `packages/ui-kit/tests/components.spec.tsx`.
3. **Guaranteed Production Index Startup**: Implemented `OnModuleInit` in `OrganizationModule` to guarantee database index creation (`counters`, `organizations`, `issued_id_registries`) upon service startup, preventing duplicate sequence documents under concurrent operations.
