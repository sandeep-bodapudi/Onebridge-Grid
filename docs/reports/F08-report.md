# Feature Completion Report: F08 - Seats and People

**Date**: 2026-10-13  
**Feature**: F08: Seats and people  
**Priority**: Must  
**Modules**: `packages/api-contracts`, `services/organization`, `packages/ui-kit`, `apps/web-app`  
**Status**: Completed, Verified, and Tested (All Quality Gates 100% Green)  

---

## 1. Acceptance Criteria Traceability Matrix

| AC # | Requirement Summary | Implementation Details | Test Coverage | Status |
|---|---|---|---|:---:|
| **AC-1** | A seat holds title, branch, department, team, manager, status and the card, QR and chip bindings. A person is assigned to a seat. | Implemented `SeatProps` in `services/organization/src/domain/seat.ts`, `MongoSeatRepository`, and CRUD endpoints in `SeatsController` / `SeatsService`. A seat stores `title`, `branchId`, `departmentId`, `teamId`, `managerSeatId`, `personId`, `status`, `isReadOnly`, and `cardBinding` (`cardId`, `cardUrl`, `qrCodeUrl`, `nfcChipId`). | `services/organization/tests/seats.spec.ts` (`AC-1: Seat attributes and bindings`) | **PASS** |
| **AC-2** | Reassigning a seat to another person keeps the card URL, QR, NFC binding, analytics history and leads. | In `SeatsService.assignSeat`, reassignment replaces `personId` while strictly preserving `cardBinding` unchanged. Offboarded seats are reactivated to `active` upon reassignment to a new person. Publishes `seat.assigned` with `bindingsPreserved: true`, `previousPersonId`, and new `personId`, and emits `seat.status_changed` if status changed. Card URLs, QR codes, and past leads remain company assets attached to the permanent seat. | `services/organization/tests/seats.spec.ts` (`AC-2: Seat reassignment preserves bindings and history`, `Reassignment of Offboarded Seats & CardBinding Immutability`) | **PASS** |
| **AC-3** | Seat statuses: `invited`, `active`, `inactive`, `offboarded`. | Implemented valid seat statuses: `vacant`, `invited`, `active`, `inactive`, `offboarded`. Endpoints validate status changes, enforce allowed transitions, and allow filtering by status in `GET /orgs/:tenantId/seats?status=...`. Invalid statuses reject with 400 Bad Request ProblemDetails. Soft-archiving updates status to `offboarded`. Reassigning an offboarded seat transitions status back to `active`. | `services/organization/tests/seats.spec.ts` (`AC-3: Seat statuses`, `Reassignment of Offboarded Seats & CardBinding Immutability`) | **PASS** |
| **AC-4** | Seat limit comes from the plan. Over-limit seats become read-only, never deleted. | In `SeatsService.createSeat`, verifies existing seat count against plan limit (Starter: 5 default or configurable via `maxSeats`, Business: 1,000, Enterprise: unlimited). Seats created or existing when over-limit receive `isReadOnly: true`. Over-limit seats reject mutations and reassignments with 403 Forbidden ProblemDetails. Over-limit seats are **never deleted**. | `services/organization/tests/seats.spec.ts` (`AC-4: Plan seat limits and over-limit read-only behaviour`) | **PASS** |
| **AC-5** | Seat ID format `<BusinessID>-E<nnnn>` (e.g. `OB-7KQ2MX-E0001`). | Derived seat IDs are minted monotonically via `CounterService.generateDerivedId(tenantId, 'seat')` using Crockford Base32 business ID and 4-digit zero-padded sequential numbers (`formatSeatId` in `packages/shared/src/business-id.ts`). Never reused. | `services/organization/tests/seats.spec.ts` (`AC-5: Seat ID format OB-XXXXXX-Ennnn`) | **PASS** |
| **AC-6** | An admin can create a seat without a person (vacant) and assign later. | Creating a seat without providing a `personId` automatically defaults status to `vacant`. Administrators can subsequently invoke `POST /orgs/:tenantId/seats/:seatId/assign` to bind a person, transitioning the seat status to `active`. | `services/organization/tests/seats.spec.ts` (`AC-6: Vacant seat creation and delayed assignment`) | **PASS** |

---

## 2. Architecture & Security Rules Verification (AGENTS.md Section 3)

| Rule | Requirement | Verification | Status |
|---|---|---|:---:|
| **Tenant Isolation** | Every DB document and query carries `tenantId` in repo layer, never only in controllers. | `MongoSeatRepository` extends `TenantScopedRepository<SeatProps>`. Every find, count, replace, and insert query scopes by `TenantContext.getTenantId()`. Cross-tenant tests verify Tenant B receives 403 Forbidden when attempting to access Tenant A seats. | **PASS** |
| **Server-Side Authorisation** | Authorisation is checked server-side by tenant and role scope. | `SeatsController.checkTenantAndRole` checks that `x-tenant-id` matches the route parameter and enforces `owner` or `admin` role for all write operations (`createSeat`, `updateSeat`, `assignSeat`, `archiveSeat`). Unauthorized requests return 403 Forbidden. | **PASS** |
| **Company Asset Ownership** | Seats belong to the company; offboarding and reassignments preserve leads and card identity. | Reassignment strictly preserves `cardBinding` (`cardId`, `cardUrl`, `qrCodeUrl`, `nfcChipId`). Leads and analytics remain bound to the seat. Departed employees keep only their own public card details. `PATCH /seats/:seatId` strictly disallows mutating `cardBinding`. | **PASS** |
| **No Personal Data in Logs/Events** | No personal data in logs, push payloads, or analytics event names. | Audit log records and domain events (`seat.created`, `seat.updated`, `seat.assigned`, `seat.status_changed`, `audit.recorded`) contain only IDs and title tokens. No phone, email, or visitor PII is included. | **PASS** |
| **Idempotency & Replay Protection** | Write endpoints support idempotency keys. Events are at-least-once. | All write endpoints (`POST /seats`, `PATCH /seats/:seatId`, `POST /seats/:seatId/assign`, `POST /seats/:seatId/archive`) accept `Idempotency-Key` and invoke `handleIdempotency`. Replays return cached responses; payload mismatches return 422 Unprocessable Entity ProblemDetails. | **PASS** |
| **Design Tokens & Accessibility** | Use tokens from `packages/ui-kit`. Orange is never text. Touch targets $\ge 44\text{px}$. | Built `SeatsManagement` in `packages/ui-kit` using token classes (`bg-bridge-orange text-charcoal`, `text-deep-orange`, `rounded-16`). Heading order follows strict `<h1>` $\rightarrow$ `<h2>` sequence. Automated `axe` tests pass with 0 violations. | **PASS** |
| **i18n & Localization** | English and Hindi support in Phase 1 without hard-coded strings. | Created `defaultSeatsLabelsEn` and `seatsLabelsHi` covering all states, actions, banners, and tooltips. Verified in unit tests. | **PASS** |

---

## 3. UI States Designed & Verified

The `SeatsManagement` component in `packages/ui-kit` and `SeatsFeature` in `apps/web-app` implement all states:

1. **Empty State**: Renders empty state card with explanatory copy and prominent `+ Add seat` button when zero seats exist.
2. **Loading State**: Accessible skeleton pulse respecting reduced motion (`motion-reduce:animate-none`, `animate-pulse`, `rounded-12`, `rounded-16`).
3. **Error State**: Accessible error banner (`role="alert"`) informing the user of network or server failures.
4. **Offline State**: Non-blocking offline banner (`role="status"`) indicating cached seat data is displayed.
5. **Over-Limit Read-Only Banner**: Highlighted warning banner (`role="region"`) displayed when seats reach or exceed plan limit, informing admin that seats are read-only and providing an upgrade action.
6. **Vacant Seat Card**: Visual card indicating vacant status chip (`StatusChip status="warning"`), empty person notice, and prominent 44px "Assign person" button.
7. **Active Seat Card with Bindings**: Card rendering title, hierarchy (branch, dept, team), active status chip, assigned person, bound digital card URL, and bound NFC chip ID.
8. **Read-Only Seat Presentation**: Read-only badge (`Read-only (Plan limit)`), disabled modification controls, and clear explanatory banner.
9. **Assign/Reassign Accessible Dialog Modal**: Accessible modal (`role="dialog"`, `aria-modal="true"`) prompting person ID input, clarifying that bindings, URLs, and QR codes remain preserved.

---

## 4. Contract Changes

### `packages/api-contracts/openapi.yaml`
- Added endpoints:
  - `GET /orgs/{tenantId}/seats`
  - `POST /orgs/{tenantId}/seats`
  - `GET /orgs/{tenantId}/seats/{seatId}`
  - `PATCH /orgs/{tenantId}/seats/{seatId}`
  - `POST /orgs/{tenantId}/seats/{seatId}/assign`
  - `POST /orgs/{tenantId}/seats/{seatId}/archive`
- Added schemas:
  - `SeatCardBinding`: `cardId`, `cardUrl`, `qrCodeUrl`, `nfcChipId`
  - `Seat`: `id`, `tenantId`, `title`, `branchId`, `departmentId`, `teamId`, `managerSeatId`, `personId`, `status`, `isReadOnly`, `cardBinding`, `createdAt`, `updatedAt`
  - `CreateSeatRequest`
  - `UpdateSeatRequest`
  - `AssignSeatRequest`
  - `PaginatedSeats`

### `packages/api-contracts/events.yaml`
- Added event schemas:
  - `seat.created`
  - `seat.updated`
  - `seat.assigned` (`bindingsPreserved: true`, `previousPersonId`, `personId`)
  - `seat.status_changed`

---

## 5. Files Created and Modified

### `packages/api-contracts`
- [openapi.yaml](file:///d:/Onebridge%20projects/Onebridge%20grid/packages/api-contracts/openapi.yaml): Added seat endpoints, parameters, security schemes, and schemas.
- [events.yaml](file:///d:/Onebridge%20projects/Onebridge%20grid/packages/api-contracts/events.yaml): Added seat event schemas.
- [src/api-types.ts](file:///d:/Onebridge%20projects/Onebridge%20grid/packages/api-contracts/src/api-types.ts): Regenerated TypeScript contract definitions.
- [src/index.ts](file:///d:/Onebridge%20projects/Onebridge%20grid/packages/api-contracts/src/index.ts): Exported new contract types.

### `services/organization`
- [src/domain/seat.ts](file:///d:/Onebridge%20projects/Onebridge%20grid/services/organization/src/domain/seat.ts): `SeatProps`, `SeatStatus`, `CardBindingProps`, `CreateSeatDto`, `UpdateSeatDto` (disallows arbitrary `cardBinding` overwrites).
- [src/infrastructure/mongo-seat.repository.ts](file:///d:/Onebridge%20projects/Onebridge%20grid/services/organization/src/infrastructure/mongo-seat.repository.ts): Tenant-scoped seat repository with index creation; strictly typed `replaceOne` filter parameter for clean TypeScript build.
- [src/application/seats.service.ts](file:///d:/Onebridge%20projects/Onebridge%20grid/services/organization/src/application/seats.service.ts): Application service orchestrating seat creation, derived ID generation, plan limits, reassignment binding preservation, reactivation of offboarded seats upon assignment, status transitions, soft archiving, and audit logging.
- [src/presentation/seats.controller.ts](file:///d:/Onebridge%20projects/Onebridge%20grid/services/organization/src/presentation/seats.controller.ts): REST presentation controller with role authorization and idempotency support across all write endpoints (`createSeat`, `updateSeat`, `assignSeat`, `archiveSeat`).
- [src/organization.module.ts](file:///d:/Onebridge%20projects/Onebridge%20grid/services/organization/src/organization.module.ts): Registered `MongoSeatRepository`, `SeatsService`, and `SeatsController`.
- [src/index.ts](file:///d:/Onebridge%20projects/Onebridge%20grid/services/organization/src/index.ts): Exported domain, repository, service, and controller.
- [tests/seats.spec.ts](file:///d:/Onebridge%20projects/Onebridge%20grid/services/organization/tests/seats.spec.ts): 18 integration tests covering AC-1 through AC-6, cross-tenant isolation, authorization, idempotency replay and 422 mismatch validation on all mutations, offboarded seat reactivation, and cardBinding immutability.

### `packages/ui-kit`
- [src/components/SeatsManagement.tsx](file:///d:/Onebridge%20projects/Onebridge%20grid/packages/ui-kit/src/components/SeatsManagement.tsx): Accessible UI component implementing all states, cards, banners, and modal dialog.
- [src/components/index.tsx](file:///d:/Onebridge%20projects/Onebridge%20grid/packages/ui-kit/src/components/index.tsx): Exported `SeatsManagement` and labels.
- [tests/components.spec.tsx](file:///d:/Onebridge%20projects/Onebridge%20grid/packages/ui-kit/tests/components.spec.tsx): Added tests for all visual states, Hindi localization, and axe accessibility.

### `apps/web-app`
- [src/api-client.ts](file:///d:/Onebridge%20projects/Onebridge%20grid/apps/web-app/src/api-client.ts): Added `listSeats`, `getSeat`, `createSeat`, `updateSeat`, `assignSeat`, and `archiveSeat`.
- [src/features/seats/SeatsFeature.tsx](file:///d:/Onebridge%20projects/Onebridge%20grid/apps/web-app/src/features/seats/SeatsFeature.tsx): Feature container connecting UI to backend API.
- [src/features/seats/SeatsFeature.spec.tsx](file:///d:/Onebridge%20projects/Onebridge%20grid/apps/web-app/src/features/seats/SeatsFeature.spec.tsx): Feature unit tests.
- [src/features/seats/index.ts](file:///d:/Onebridge%20projects/Onebridge%20grid/apps/web-app/src/features/seats/index.ts): Feature public export.
- [app/dashboard/page.tsx](file:///d:/Onebridge%20projects/Onebridge%20grid/apps/web-app/app/dashboard/page.tsx): Mounted `SeatsFeature` on the organization dashboard.

---

## 6. Verification & Quality Gates Summary

All quality gate commands were executed from the repo root and passed with 100% success (0 errors, 0 warnings):

1. **`pnpm lint`**: Clean across the entire repository. Restricted imports strictly respected (no direct MongoDB imports outside shared).
2. **`pnpm typecheck`**: Clean across all 15 workspaces (`tsc --noEmit` exited with code 0).
3. **`pnpm test`**:
   - `services/organization/tests/seats.spec.ts`: 18 / 18 passed
   - `services/organization`: 83 / 83 passed
   - `services/identity`: 124 / 124 passed
   - `packages/ui-kit`: 18 / 18 passed (including axe accessibility)
   - `apps/web-app`: 49 / 49 passed
   - Workspace root tests: 7 / 7 passed
   - Total workspace tests: 281 / 281 passed with 0 failures.
