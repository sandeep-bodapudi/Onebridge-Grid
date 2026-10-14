# Independent Feature Audit: F08 - Seats and People

**Reviewer**: Coding Agent (Independent Auditor)  
**Date**: 2026-10-13  
**Target Feature**: F08 (Seats and people)  
**Feature Spec**: `docs/onebridge-spec-pack/docs/features/F08-seats.md`  
**Report Reviewed**: `docs/reports/F08-report.md`  
**Verdict**: **Accept with fixes**  

---

## 1. Quality Gates Execution (Auditor Run)

The quality gates were independently executed from repo root:

### 1.1 `pnpm lint`
- **Result**: **PASS** (Exit code 0)
- **Output**: Clean across all packages. Zero ESLint errors, zero warnings. Architecture boundary rule prohibiting direct MongoDB imports outside `packages/shared` is respected.

### 1.2 `pnpm typecheck`
- **Result**: **FAIL** (Exit code 1)
- **Output**:
  ```
  services/organization typecheck: src/infrastructure/mongo-seat.repository.ts(18,29): error TS2345: Argument of type 'Filter<SeatProps> | undefined' is not assignable to parameter of type 'Filter<SeatProps>'.
    Type 'undefined' is not assignable to type 'Filter<SeatProps>'.
  ```
- **Finding**: In `services/organization/src/infrastructure/mongo-seat.repository.ts`, `SeatFilter` derived from `find` parameters includes `undefined`, causing `tsc` to fail on `this.replaceOne(filter, seat)`. The completion report falsely claimed `pnpm typecheck` was completely clean.

### 1.3 `pnpm test`
- **Result**: **PASS** (Exit code 0)
- **Output**: 276 / 276 tests passed across the workspace (Vitest executes via esbuild/swc without type checking, which masked the `tsc` compile failure):
  - `services/organization/tests/seats.spec.ts`: 13 / 13 passed
  - `services/organization`: 78 / 78 passed
  - `services/identity`: 124 / 124 passed
  - `packages/ui-kit`: 18 / 18 passed (including `jest-axe` accessibility)
  - `apps/web-app`: 49 / 49 passed
  - Workspace root tests: 7 / 7 passed

---

## 2. Acceptance Criteria Check

| AC # | Criteria Description | Status | Evidence & Test Verification |
|---|---|:---:|---|
| **AC-1** | A seat holds title, branch, department, team, manager, status and the card, QR and chip bindings. A person is assigned to a seat. | **Verified** | Verified in `services/organization/tests/seats.spec.ts` (`AC-1: Seat attributes and bindings`, lines 96–143). Test verifies persistence and retrieval of `title`, `branchId`, `departmentId`, `teamId`, `managerSeatId`, `personId`, `status`, and `cardBinding` (`cardId`, `cardUrl`, `qrCodeUrl`, `nfcChipId`). |
| **AC-2** | Reassigning a seat to another person keeps the card URL, QR, NFC binding, analytics history and leads. | **Verified** | Verified in `services/organization/tests/seats.spec.ts` (`AC-2: Seat reassignment preserves bindings and history`, lines 165–223). Reassignment to `person_priya` keeps `card_sales_reg_01`, `cardUrl`, `qrCodeUrl`, and `nfcChipId` identical, and verifies emission of `seat.assigned` with `bindingsPreserved: true`. |
| **AC-3** | Seat statuses: invited, active, inactive, offboarded. | **Verified** | Verified in `services/organization/tests/seats.spec.ts` (`AC-3: Seat statuses`, lines 230–283). Tests creation and transition through `invited`, `active`, `inactive`, and `offboarded` (via `POST /:seatId/archive`), status filtering, and rejection of invalid status with 400 Bad Request. |
| **AC-4** | Seat limit comes from the plan. Over-limit seats become read-only, never deleted. | **Verified** | Verified in `services/organization/tests/seats.spec.ts` (`AC-4: Plan seat limits and over-limit read-only behaviour`, lines 290–343). Verifies that 6th seat created on Starter (limit 5) receives `isReadOnly: true`, write mutations (patch & assign) fail with 403 Forbidden, and the over-limit seat is preserved in the database (never deleted). |
| **AC-5** | Seat ID format `<BusinessID>-E<nnnn>`. | **Verified** | Verified in `services/organization/tests/seats.spec.ts` (`AC-5: Seat ID format OB-XXXXXX-Ennnn`, lines 350–366). Derives monotonic IDs `OB-7KQ2MX-E0001` and `OB-7KQ2MX-E0002` via `CounterService`. |
| **AC-6** | An admin can create a seat without a person (vacant) and assign later. | **Verified** | Verified in `services/organization/tests/seats.spec.ts` (`AC-6: Vacant seat creation and delayed assignment`, lines 373–402). Seat created without `personId` receives status `vacant`, and subsequent assignment sets `personId` and updates status to `active`. |

---

## 3. Rule Violations (AGENTS.md Section 3)

| Rule | Status | Evidence |
|---|:---:|---|
| **`tenantId` on every database document and query in repo layer** | **Pass** | `MongoSeatRepository` extends `TenantScopedRepository<SeatProps>`. All repo methods scope by `TenantContext.getTenantId()`. Cross-tenant test lines 409–427 in `seats.spec.ts` confirms 403 Forbidden. |
| **Authorisation checked server-side by tenant and role scope** | **Pass** | `SeatsController.checkTenantAndRole` checks matching tenant and enforces `owner` or `admin` role on write endpoints (`seats.controller.ts:79-114`). Non-admin rejected with 403 (`seats.spec.ts:429-450`). |
| **Seats belong to company; offboarding never deletes leads, cards, or analytics** | **Pass** | Seats are never deleted (no delete endpoint); archiving updates status to `offboarded` and reassignment preserves card and lead bindings. |
| **No personal data in logs, push payloads or analytics event names** | **Pass** | Event payloads in `SeatsService` (`seat.created`, `seat.updated`, `seat.assigned`, `seat.status_changed`) contain only IDs and title tokens; zero visitor PII or contact numbers. |
| **Phone and email of visitors encrypted at rest** | **Pass** | N/A to F08 (Cards & Leads module). |
| **Access token in memory only; refresh token in HttpOnly cookie; no localStorage** | **Pass** | `apps/web-app/src/api-client.ts` maintains `inMemoryAccessToken`. No `localStorage` or `sessionStorage` references. |
| **Student ID images in separate encrypted bucket** | **Pass** | N/A to F08. |
| **Record consent with timestamp and notice version** | **Pass** | N/A to F08 (Claim notice in F14). |
| **Short links are immutable; only destination can be repointed** | **Pass** | Reassignment strictly preserves existing short link URLs (`seats.service.ts:342`). |
| **Disabled and unactivated chips resolve to neutral page** | **Pass** | N/A to F08. |
| **Contract first: change OpenAPI / event schema before changing code** | **Pass** | OpenAPI spec (`packages/api-contracts/openapi.yaml`) and events (`events.yaml`) updated; client types regenerated. |
| **Write endpoints accept an idempotency key** | **Fail** | `POST /orgs/:tenantId/seats` supports `Idempotency-Key` and is tested. However, write endpoints `PATCH /orgs/:tenantId/seats/:seatId`, `POST /orgs/:tenantId/seats/:seatId/assign`, and `POST /orgs/:tenantId/seats/:seatId/archive` do **NOT** accept an `Idempotency-Key` header or call `handleIdempotency`. |
| **Modules never read each other's database collections** | **Pass** | `services/organization` reads only its own domain collections and accesses Identity via internal HTTP client. |
| **Errors use `application/problem+json`; lists paginated; correlation ID carried** | **Pass** | Errors use RFC 7807 problem details; `listSeats` returns `PaginatedSeats` (`items`, `total`, `limit`, `offset`); `x-correlation-id` passed to audit logs and events. |
| **Additive changes only** | **Pass** | All contracts and schemas are strictly additive. |
| **Anything user-visible and unfinished goes behind a feature flag** | **Pass** | N/A; F08 is functional and mounted on dashboard behind auth. |
| **Design tokens only; no hard-coded colour, radius, or spacing** | **Pass** | `SeatsManagement.tsx` uses only design tokens (`bg-bridge-orange`, `text-charcoal`, `text-deep-orange`, `rounded-16`, `p-24`). |
| **Orange is a fill, never a text colour** | **Pass** | Checked all classes in `SeatsManagement.tsx`: primary buttons have `text-charcoal`; warning badges and text use `text-deep-orange`. Zero instances of orange text. |
| **Touch targets $\ge 44\text{px}$; status never colour alone** | **Pass** | All interactive buttons, selects, and inputs have `min-h-[44px]`. Statuses use text chips + icons. |
| **Respect `prefers-reduced-motion`** | **Pass** | Skeletons include `motion-reduce:animate-none`. |
| **Copy: sentence case, plain words, active verbs** | **Pass** | Plain active copy across all cards and modal dialogs. |
| **English and Hindi in Phase 1 without hardcoded strings** | **Pass** | `defaultSeatsLabelsEn` and `seatsLabelsHi` implemented in UI kit and tested. |

---

## 4. Invented Behaviour

1. **Route Hierarchy Deviation**:
   `F08-seats.md` specifies `POST /orgs/{id}/seats`, `PATCH /seats/{id}`, and `POST /seats/{id}:assign`. The implementation placed all routes under `@Controller('orgs/:tenantId/seats')` (`PATCH /orgs/{tenantId}/seats/{seatId}`, `POST /orgs/{tenantId}/seats/{seatId}/assign`). While this ensures tenant-scoping consistency with F06 and F07, it deviates from the root-level seat route specified in F08.md.
2. **`POST /orgs/:tenantId/seats/:seatId/archive` Endpoint**:
   `F08-seats.md` specifies the `offboarded` status, but did not specify an archive endpoint. The implementation invented a dedicated archive POST endpoint rather than relying solely on `PATCH /seats/{id}` with `status: 'offboarded'`.
3. **Card Binding Mutation in `PATCH /seats/{id}`**:
   `UpdateSeatDto` permits `cardBinding` updates via `PATCH`. The spec does not request mutable card bindings on seats (card designer is F10, NFC is F19). Allowing arbitrary `cardBinding` overrides could conflict with short link immutability.
4. **Static `isReadOnly` Flag on Seat Document**:
   The implementation bakes `isReadOnly: boolean` directly into MongoDB on seat creation. If an organization upgrades its plan, existing over-limit seats remain locked in read-only mode because the flag is static rather than dynamically evaluated against the current plan limit.

---

## 5. Missing States or Tests

1. **TypeScript Typecheck Defect**:
   `services/organization/src/infrastructure/mongo-seat.repository.ts:18` fails `tsc --noEmit` due to `Filter<SeatProps> | undefined` passed to `replaceOne`.
2. **Missing Idempotency Tests on Mutations**:
   No idempotency headers or replay protection tests exist for `updateSeat`, `assignSeat`, or `archiveSeat`.
3. **Missing Reassignment of Offboarded Seats**:
   When reassigning a seat whose status was `offboarded`, `assignSeat` currently leaves its status as `offboarded` (it only changes `vacant` to `active`). There is no test or handling for reactivating an offboarded seat upon new employee assignment.
4. **Missing UI Modal Submission Unit Test**:
   `components.spec.tsx` tests the modal's presence and accessibility, but does not simulate typing a person ID and submitting the form.

---

## 6. Report Accuracy

1. **Inaccurate Typecheck Claim**: The report stated "`pnpm typecheck`: Clean across all 15 workspaces (`tsc --noEmit` exited code 0)". In reality, `services/organization` fails `tsc --noEmit` with error TS2345 in `mongo-seat.repository.ts`.
2. **Inaccurate Idempotency Claim**: The report stated "Write endpoints accept an idempotency key." In reality, only `POST /orgs/{tenantId}/seats` accepts an idempotency key; `PATCH :seatId`, `POST :seatId/assign`, and `POST :seatId/archive` do not.

---

## 7. Verdict and Required Fixes

**Verdict**: **Accept with fixes**

### Numbered List of Required Fixes:

1. **Fix `mongo-seat.repository.ts` compilation error**:
   Properly type `filter` in `MongoSeatRepository` so it does not contain `undefined` when passed to `this.replaceOne(filter, seat)`, making `pnpm typecheck` 100% clean.
2. **Add `Idempotency-Key` handling to all write endpoints**:
   Update `SeatsController` to accept `@Headers('idempotency-key') idempotencyKey?: string` on `PATCH /orgs/:tenantId/seats/:seatId`, `POST /orgs/:tenantId/seats/:seatId/assign`, and `POST /orgs/:tenantId/seats/:seatId/archive`, wrapping their execution in `this.handleIdempotency(...)`. Add test coverage in `seats.spec.ts`.
3. **Reactivate offboarded seats upon reassignment**:
   In `SeatsService.assignSeat`, if the seat's status is `offboarded` or `vacant`, transition its status to `active` when a new person is assigned.
4. **Prevent arbitrary `cardBinding` overwrites in `updateSeat`**:
   Remove `cardBinding` from `UpdateSeatDto` (or disallow overriding existing URLs/chips) to preserve short link and NFC chip binding immutability.
5. **Update `docs/reports/F08-report.md`**:
   Update the completion report to accurately reflect quality gate outcomes after the fixes are verified.
