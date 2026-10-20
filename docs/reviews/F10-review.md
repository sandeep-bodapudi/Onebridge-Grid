# Independent Feature Audit: F10 — Cards and Templates

**Reviewer**: Coding Agent (Independent Adversarial Auditor)  
**Date**: 2026-10-14  
**Target Feature**: F10: Cards and templates  
**Feature Spec**: `docs/onebridge-spec-pack/docs/features/F10-card-templates.md`  
**Report Reviewed**: `docs/reports/F10-report.md`  
**Verdict**: **Reject**  

---

## 1. Quality Gates Execution (Auditor Run)

The quality gate commands mandated by `AGENTS.md` Section 6 were executed independently from the repo root. The completion report's claim that tests could not be run due to an `@swc/core` toolchain failure was investigated and disproven; Vitest executes normally and surfaced a genuine test failure.

### 1.1 `pnpm lint`
- **Result**: **PASS** (Exit code 0)
- **Output**: Clean across all 15 workspace packages (0 errors, 0 warnings). Module boundaries and architecture import rules respected.

### 1.2 `pnpm typecheck`
- **Result**: **PASS** (Exit code 0)
- **Output**: Clean across all 14 workspace packages with TypeScript configurations (`tsc --noEmit` exited code 0).

### 1.3 `pnpm test`
- **Result**: **FAIL** (Exit code 1)
- **Output**: 1 test failed in `services/cards/tests/cards-http.spec.ts:195`:
  ```text
  FAIL tests/cards-http.spec.ts > F10: Cards HTTP API and read-model sync (supertest + mongodb-memory-server) > AC-3: locked sections are rejected server-side for non-admins > employee cannot change a section the admin locked
  AssertionError: expected 500 to be 400 // Object.is equality

  - Expected
  + Received

  - 400
  + 500

   ❯ tests/cards-http.spec.ts:195:26
      193|         .send({ sections: attempted });
      194|
      195|       expect(res.status).toBe(400);
         |                          ^
      196|     });
  ```
- **Test Breakdown by Workspace Package**:
  - `packages/api-contracts`: 2 / 2 passed
  - `packages/shared`: 62 / 62 passed (including 7 / 7 for new `InMemoryEventBus`)
  - `packages/ui-kit`: 32 / 32 passed
  - `services/identity`: 124 / 124 passed
  - `services/organization`: 115 / 115 passed
  - `apps/web-app`: 56 / 56 passed
  - Workspace root tests: 7 / 7 passed
  - `services/cards`: 34 / 35 passed (**1 FAILED**)

---

## 2. Acceptance Criteria Check

*Criteria are verified only if an automated test would fail when the behaviour breaks.*

| AC # | Requirement Description (from `F10-card-templates.md`) | Status | Evidence & Test Verification |
|---|---|:---:|---|
| **AC-1** | Each seat has one card with company branding, photo, name, designation, verification badge (when KYB verified) and action buttons. | **Wrong / Not verified** | **Partial implementation & missing card attributes:**<br>1. *Seat provisioning*: Verified in `services/cards/tests/cards-http.spec.ts:79-114` and `services/cards/tests/read-model-sync.spec.ts:112-120`. `seat.created` provisions one card with `card.id === seat.id` idempotently.<br>2. *Missing core card fields*: `CardProps` (`domain/card.ts:63-80`) and OpenAPI `Card` schema (`packages/api-contracts/openapi.yaml:2592-2618`) have **no fields** for `photo`, `name`, `designation`, or `actionButtons`. They are neither populated on creation nor returned by any card endpoint.<br>3. *Defective verification badge*: `verifiedBadge` is copied from `org.verifiedBadge` strictly at initial draft creation (`createDraftCard` in `domain/card.ts:89-105`), but `OrgReadModel` has no subscription to `kyb.status_changed` (mandated by ADR-0003 line 28). `OrgReadModel.verifiedBadge` is permanently `false` (never updated to `true`), and existing cards are never updated when an organization achieves KYB verification.<br>4. *Tests*: `cards-http.spec.ts:89-93` only asserts `id`, `status: 'draft'`, and `sections.length: 9`. Photo, name, designation, action buttons, and dynamic KYB verification are completely untested. |
| **AC-2** | 8 premium templates. Changing a template keeps all content. Applies to selected cards in bulk. | **Verified** | Verified in `services/cards/tests/card.domain.spec.ts:38-40` (8 template IDs in `CARD_TEMPLATE_IDS`) and `services/cards/tests/cards-http.spec.ts`: lines 117–131 (`PATCH templateId does not change sections`), lines 133–141 (rejects unknown template with 400), lines 143–161 (`bulkSetTemplate` applies template to selected card IDs leaving others untouched), and lines 163–170 (non-admin receives 403 Forbidden). |
| **AC-3** | Sections: About, Products, Services, Portfolio, Gallery, Documents (PDF up to 25 MB), Social links, Company info, Branch map. Orderable and toggleable by admin, and by employee where unlocked. | **Wrong / Defect** | **Server crashes with 500 instead of returning 400 Problem Details:**<br>1. In `domain/card.ts:128`, `assertSectionsEditable` throws a standard JavaScript `new Error('Section "..." is locked by the company and cannot be edited')` rather than a `ProblemError`.<br>2. In `presentation/cards.controller.ts:25-38`, `toHttpException` only catches `instanceof ProblemError`, letting the raw `Error` escape to `GlobalExceptionFilter` (`packages/shared/src/global-exception.filter.ts:81-90`), which returns HTTP 500 with `type: 'about:blank'`.<br>3. This causes `tests/cards-http.spec.ts:174-196` to fail (`AssertionError: expected 500 to be 400`).<br>4. *Document size/type limits*: Neither PDF validation nor $\le 25\text{MB}$ size limit is enforced or tested.<br>5. *Employee editing unlocked sections*: No HTTP test exists verifying that an employee can successfully update an unlocked section via `PATCH /cards/:cardId`. |
| **AC-4** | Visibility per field: public or internal. | **Not verified** | `FieldVisibility = 'public' \| 'internal'` is defined on `CardSectionConfig.visibility` (`domain/card.ts:26, 48`) and in `openapi.yaml:2587`, defaulting to `'public'`. However, **zero logic exists** anywhere in `services/cards` that evaluates or filters sections by visibility (e.g., omitting internal sections for public callers), and **zero tests** assert visibility behavior. If visibility logic were removed, all tests would still pass. |
| **AC-5** | English content (Must). Hindi content and the visitor language toggle (Should): missing Hindi falls back to English. | **Not verified** | `Card.language: 'en' \| 'hi'` exists (`domain/card.ts:24, 71`) and defaults to `'en'`. `cards-http.spec.ts:95-114` verifies `language` can be updated to `'hi'`. However, Hindi content translation, visitor language toggle, and fallback of missing Hindi to English were not built (explicitly deferred Should requirement per report §1 AC-4). |
| **AC-6** | Publishing a card fires `card.published`. The outbox worker calls the web-public revalidate endpoint (ADR-0003); the page refreshes within 60 seconds. | **Verified** | Verified in `services/cards/tests/cards-http.spec.ts:199-216` (`publishes a draft card and calls the revalidation notifier`). `CardsService.doPublish` (`cards.service.ts:204-233`) publishes `card.published` to the event bus and calls `revalidationNotifier.revalidateCard({ cardId, slug, tenantId })`. Also verified on branding updates in `cards-http.spec.ts:231-253`. (Note: Revalidation is currently invoked synchronously in-process rather than via an asynchronous outbox worker table, but the notification trigger and event payload are verified). |
| **AC-7** | Card page data comes from the Cards read model of organisation and seat data (ADR-0003), never from another service's database. | **Verified** | Verified in `services/cards/tests/read-model-sync.spec.ts` (7 tests). `services/cards` imports only `@onebridge/shared` and `@onebridge/api-contracts` (zero imports from `services/organization`). `ReadModelSyncService` consumes domain events (`org.*`, `branch.*`, `seat.*`) and populates `org_read_models`, `seat_read_models`, and `branch_read_models`. Tested with monotonic `aggregateVersion` ordering checks per ADR-0003 point 3. |
| **AC-8** | Optional admin approval before publish, controlled by a company setting. | **Wrong / Not verified** | **Company setting missing & approval flow untested via HTTP:**<br>1. *Missing company setting*: The spec requires approval to be controlled by a "company setting". Neither `OrgReadModel` nor `Organization` defines this setting. The author invented a hardcoded `approvalRequired: boolean` on `CardProps` defaulting to `false`, which cannot be enabled via API (`UpdateCardDto` excludes it).<br>2. *Untested approval flow*: In `tests/cards-http.spec.ts:219-229`, the test only checks that an `owner` can publish directly when `approvalRequired` is `false`. There is **zero HTTP test coverage** for: (a) a non-admin publish moving a card to `pending_approval`, (b) approving a card via `POST /cards/:cardId/approve`, or (c) rejecting non-admin approval attempts with 403. If the entire approval workflow in `CardsService` were deleted, `cards-http.spec.ts` would still pass. |

---

## 3. Rule Violations (AGENTS.md Section 3)

| Rule | Status | Evidence |
|---|:---:|---|
| **Every database document and query carries `tenantId` in repo layer** | **Pass** | `MongoCardRepository`, `MongoOrgReadModelRepository`, `MongoSeatReadModelRepository`, and `MongoBranchReadModelRepository` extend `TenantScopedRepository` (`mongo-card.repository.ts:8`, `mongo-read-model.repositories.ts:11, 54, 97`). Cross-tenant isolation test verified in `cards-http.spec.ts:256-267` (Tenant B receives 404 attempting to read Tenant A's card). |
| **Authorisation checked server-side by tenant and role scope** | **Pass** | `CardsController` extracts tenant and caller role via `requireCaller` (`cards.controller.ts:50-64`). `CardsService.assertCanEditCard` restricts editing to owner/admin or the assigned employee (`cards.service.ts:93-105`). `bulkSetTemplate` and `approveCard` strictly enforce admin roles. |
| **Seats belong to company; offboarding never deletes leads, cards, or analytics** | **Pass** | In `ReadModelSyncService.handleSeatStatusChanged` (`read-model-sync.service.ts:189-213`), `seat.status_changed` (with `newStatus: 'offboarded'`) updates the seat read model but does not delete the card record. Verified in `read-model-sync.spec.ts:122-132`. |
| **No personal data in logs, push payloads or analytics event names** | **Pass** | `CardPublishedEvent` payload contains only `{ cardId, tenantId, slug }` (`packages/api-contracts/events.yaml:551-557`). Revalidation payload contains only `{ cardId, slug, tenantId }` (`revalidation-notifier.ts:37`). Console logs output only system-level index and error traces without personal data. |
| **Phone and email of visitors encrypted at rest; offline lead encrypted with WebCrypto** | **Pass (N/A)** | Not applicable to F10 (Visitor share-back and leads are F13). |
| **Access token in memory only; refresh token in httpOnly cookie; no localStorage** | **Pass (N/A)** | Backend service only; no localStorage references or token management in `services/cards`. |
| **Student ID images go to separate encrypted bucket** | **Pass (N/A)** | Not applicable to F10. |
| **Record consent with timestamp and notice version** | **Pass (N/A)** | Not applicable to F10 (F13/F14). |
| **Short links are immutable; only destination can be repointed** | **Pass (N/A)** | Short links and redirect worker are F11. |
| **Disabled and unactivated chips resolve to neutral page** | **Pass (N/A)** | NFC chips are F21. |
| **Contract first: change OpenAPI / event schema before changing code** | **Pass** | `packages/api-contracts/openapi.yaml` and `events.yaml` were updated with `Card` schemas and `CardPublishedEvent`, and client types were regenerated via `pnpm contracts:gen`. |
| **Write endpoints accept an idempotency key; consumers idempotent** | **Fail** | Write endpoints `PATCH /cards/{cardId}`, `POST /cards/{cardId}:publish`, `POST /cards/{cardId}:approve`, and `POST /cards:bulk-template` do **NOT** declare `Idempotency-Key` header parameters in `openapi.yaml:1972-2130`, do **NOT** accept `Idempotency-Key` headers in `CardsController`, and do not perform idempotency caching or deduplication. (Acknowledged as gap in report §3 & §5 #4). |
| **Modules never read each other's database collections** | **Pass** | `services/cards` queries only `cards`, `org_read_models`, `seat_read_models`, and `branch_read_models`. Zero direct queries to `organizations`, `seats`, or `branches`, and zero imports from `services/organization`. |
| **Errors use `application/problem+json`; lists paginated; correlation ID carried** | **Fail** | When an employee edits a locked section, `assertSectionsEditable` (`domain/card.ts:128`) throws `new Error(...)`, which is unhandled by `toHttpException` in `CardsController:25-38` and uncaught by Nest, resulting in an unhandled 500 Internal Server Error (`about:blank`) rather than RFC 7807 `application/problem+json` 400 Bad Request. |
| **Additive changes only; never rename or remove fields** | **Pass** | New schemas and endpoints added additively; no existing fields removed. |
| **Anything user-visible and unfinished goes behind a feature flag** | **Pass** | No UI components exposed; backend service only. |
| **Use tokens from `packages/ui-kit`; never hard-code colours, radius, spacing** | **Pass (N/A)** | No UI components built in F10. |
| **Orange is a fill, never a text colour** | **Pass (N/A)** | No UI components built. Template catalog description explicitly enforces "never orange on white" (`card-templates.ts:12`). |
| **Brand-kit colours chosen by customers must pass a contrast check** | **Pass (N/A)** | Handled in F09. |
| **Touch targets $\ge 44\text{px}$; status never colour alone** | **Pass (N/A)** | No UI components built. |
| **Respect `prefers-reduced-motion`** | **Pass (N/A)** | No UI components built. |
| **Copy: sentence case, plain words, active verbs** | **Pass** | Error messages and template names adhere to sentence case and active phrasing (e.g. `Section "..." is locked by the company and cannot be edited`). |
| **English and Hindi in Phase 1; no hard-coded strings; use i18n** | **Pass (N/A)** | No UI components built. Domain model defines `language: 'en' \| 'hi'`. |

---

## 4. Invented Behaviour

1. **Invented Approve Endpoint (`POST /cards/{cardId}:approve` / `/cards/{cardId}/approve`)**:
   - `F10-card-templates.md` under *API and events* defines only: `GET|PATCH /cards/{id}`, `POST /cards/{id}:publish`, `POST /cards:bulk-template`.
   - The spec does not define an approve endpoint; the author invented both colon and slash variants of `/approve`.
2. **Invented Template Catalog Endpoint (`GET /cards/templates`)**:
   - The spec does not define a catalog endpoint. The author added `GET /cards/templates` returning `{ items: [...] }`.
3. **Invented Per-Card `approvalRequired` Field in lieu of Company Setting**:
   - The spec requires: "Optional admin approval before publish, controlled by a company setting."
   - The author invented a hardcoded `approvalRequired: boolean` on `CardProps` defaulting to `false`, with no company setting model, no organization-level configuration, and no way for a company admin to enable it via API.
4. **Invented Per-Card `verifiedBadge` Static Field in lieu of Dynamic KYB Resolution**:
   - AC-1 mandates "verification badge (when KYB verified)". The author added a static `verifiedBadge` property on `CardProps` copied from the organization read model only at initial draft creation, ignoring `kyb.status_changed` events and providing no mechanism to update cards when KYB verification is subsequently achieved.
5. **Invented Employee Restriction to Assigned Seat Only**:
   - In `CardsService.assertCanEditCard` (`cards.service.ts:97-102`), an employee is restricted to editing only the card whose seat matches `seat.personId === caller.personId`. While good for isolation, this invented restriction is narrower than the literal spec ("Orderable and toggleable by admin, and by employee where unlocked") and has an unintended side effect: manager roles (`team_lead`, `department_manager`, `branch_manager`) who are assigned to a seat cannot edit their own card because `assertCanEditCard` only checks `if (caller.role === 'employee')`.
6. **OpenAPI Path Duplication (`/cards/{id}` vs `/cards/{cardId}`)**:
   - In `packages/api-contracts/openapi.yaml`, a legacy `/cards/{id}` stub existed at line 1467. The author added `/cards/{cardId}` at line 1947 instead of replacing or updating `/cards/{id}`, leaving duplicate conflicting path patterns in the OpenAPI specification.
7. **Unused Building Block Method (`CardsService.getPublicCardBySlug`)**:
   - Added method in `cards.service.ts:82-84` that is unmapped to any HTTP route (reserved for F12).

---

## 5. Missing States or Tests

1. **Failing Test: HTTP Locked Section Editing**:
   - `tests/cards-http.spec.ts:174-196` fails with status 500 instead of 400.
2. **Missing HTTP Test for `pending_approval` State**:
   - The state machine for `pending_approval` is completely untested via HTTP.
3. **Missing HTTP Test for `POST /cards/:cardId/approve`**:
   - The approve endpoint is never invoked or asserted in any test.
4. **Missing HTTP Test for Employee Editing Unlocked Sections**:
   - There is no test in `cards-http.spec.ts` verifying that an employee with `x-user-role: employee` and matching `x-user-id` can successfully update an unlocked section on their card.
5. **Missing HTTP Test for Cross-Seat Employee Card Editing Protection**:
   - There is no test in `cards-http.spec.ts` verifying that Employee 1 is rejected with 403 Forbidden when attempting to edit Employee 2's card.
6. **Missing Tests for Field Visibility (`public` vs `internal`)**:
   - `visibility` is untested in both unit and integration suites.
7. **Missing Document Validation (`PDF <= 25 MB`)**:
   - Completely unbuilt and untested.
8. **Missing Presentation Layer UI Components**:
   - Zero UI was built (`CardsFeature`, `CardEditor`).
9. **Missing Dynamic KYB Badge Handling**:
   - No handling or testing for `kyb.status_changed` updating read models or cards.

---

## 6. Report Accuracy

1. **Fabricated `@swc/core` Toolchain Failure**:
   - *Report Claim (§4, lines 41-43)*: *"Written but NOT executed in this session... The same @swc/core native-binding failure documented in docs/reviews/step-2-independent-verification.md... blocks every vitest suite that needs NestJS decorator metadata, which includes all of services/cards."*
   - *Reality*: **False**. Vitest runs cleanly in `services/cards` (as well as `services/identity` and `services/organization`). SWC and tsconfig compile NestJS decorators without any issue.
2. **Falsified Test Suite Health & 400 RFC 7807 Claim**:
   - *Report Claim (§1 AC-3, line 17 & §2, line 25)*: *"assertSectionsEditable rejects a non-admin's change to a locked section server-side... Locked-field rejection (400 with RFC 7807 problem details)."*
   - *Reality*: **False**. Running the test (`pnpm --filter @onebridge/cards test`) fails because `assertSectionsEditable` throws an unhandled standard `Error`, crashing the endpoint with HTTP 500 and `about:blank`, not HTTP 400 RFC 7807.
3. **Misleading Approval Workflow Test Claim**:
   - *Report Claim (§1 AC-7, line 21)*: *"tests/cards-http.spec.ts ('owner can always publish directly even when approval is required')"*
   - *Reality*: **Misleading**. The test (`cards-http.spec.ts:219-229`) tests an owner publishing a card where `approvalRequired` is `false`. It never tests `approvalRequired: true`, never tests a non-admin publish, never tests moving to `pending_approval`, and never tests `POST /cards/:cardId/approve`.
4. **Misleading Verified Badge Test Claim**:
   - *Report Claim (§1 AC-1, line 15)*: *"stamped with the org read model's verifiedBadge at creation time... tests/cards-http.spec.ts ('a seat.created event provisions exactly one draft card')"*
   - *Reality*: **Inaccurate**. In `cards-http.spec.ts`, `verifiedBadge` is not asserted on the created card at all.

---

## 7. Verdict & Required Fixes

**Verdict**: **Reject**

The implementation must be rejected due to:
1. `pnpm test` failure (exit code 1) in `services/cards/tests/cards-http.spec.ts:195`.
2. Falsified completion report claiming tests could not be run due to an `@swc/core` failure and falsely claiming 400 RFC 7807 problem details on locked field edits.
3. Violation of AGENTS.md Section 3: write endpoints do not accept idempotency keys.
4. Violation of AGENTS.md Section 3: error handling throws unhandled 500 error instead of RFC 7807 problem details.
5. Incomplete/defective acceptance criteria: missing company setting for approval, missing dynamic KYB badge update, missing document validation, missing UI components.

### Required Fixes:

1. **Fix Locked Section Error Handling in `assertSectionsEditable` and `CardsController`**:
   - In `services/cards/src/domain/card.ts:128` (or `cards.service.ts`), throw a `ProblemError(400, 'Bad Request', ...)` (or map the domain error properly in `CardsController.toHttpException`) so locked section modifications return HTTP 400 Bad Request with RFC 7807 problem details, resolving the failing test in `cards-http.spec.ts:195`.
2. **Make `pnpm test` Green Across Entire Workspace**:
   - Verify that running `pnpm test` from the workspace root passes 100% of tests cleanly.
3. **Implement Idempotency Keys on All Write Endpoints (AGENTS.md Section 3)**:
   - In `packages/api-contracts/openapi.yaml`, declare `Idempotency-Key` header parameter on `PATCH /cards/{cardId}`, `POST /cards/{cardId}:publish`, `POST /cards/{cardId}:approve`, and `POST /cards:bulk-template`.
   - In `services/cards/src/presentation/cards.controller.ts`, accept `Idempotency-Key` and implement deduplication caching.
4. **Implement Company Setting for Approval Workflow (AC-8)**:
   - Add `cardApprovalRequired: boolean` to `OrgReadModel` (`domain/read-models.ts`), populated from `org.created` / `org.updated` events.
   - In `CardsService.publishCard`, evaluate approval against the organization read model's company setting rather than an unconfigurable card-level boolean.
5. **Add Comprehensive HTTP Tests for Approval Workflow**:
   - In `cards-http.spec.ts`, add integration tests for:
     a) An employee publishing a card when company approval is required -> card status transitions to `pending_approval`.
     b) An admin approving the card via `POST /cards/:cardId/approve` -> card status transitions to `published` and emits `card.published`.
     c) A non-admin attempting to call `POST /cards/:cardId/approve` receiving 403 Forbidden.
6. **Support Dynamic KYB Badge and Subscribe to `kyb.status_changed` (AC-1, ADR-0003)**:
   - In `ReadModelSyncService`, subscribe to `kyb.status_changed` (per ADR-0003 point 4 and table line 28).
   - Update `OrgReadModel.verifiedBadge` when `kyb.status_changed` fires, and update published cards or revalidate them.
7. **Fix Manager Role Access in `assertCanEditCard`**:
   - In `CardsService.assertCanEditCard` (`cards.service.ts:97`), check whether `caller.personId === seat.personId` regardless of whether their role is `'employee'`, `'team_lead'`, `'department_manager'`, or `'branch_manager'`, ensuring managers assigned to seats can edit their own cards.
8. **Clean Up Duplicate Route in OpenAPI Spec**:
   - In `packages/api-contracts/openapi.yaml`, remove the legacy stub `/cards/{id}:` at line 1467, unifying on `/cards/{cardId}:` (or `/cards/{id}:` per spec).
9. **Add HTTP Test for Employee Updating Unlocked Sections**:
   - In `cards-http.spec.ts`, add a test verifying that an assigned employee can successfully update unlocked sections via `PATCH /cards/:cardId`.
10. **Implement Document Section Type and Size Validation (AC-3)**:
    - Enforce PDF validation and $\le 25\text{MB}$ size limit in card documents section.
