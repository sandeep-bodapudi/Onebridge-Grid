# Independent Feature Audit: F09 - Brand Kit and Field Locks

**Reviewer**: Coding Agent (Independent Auditor)  
**Date**: 2026-10-13  
**Target Feature**: F09 (Brand kit and field locks)  
**Feature Spec**: `docs/onebridge-spec-pack/docs/features/F09-brand-kit.md`  
**Report Reviewed**: `docs/reports/F09-report.md`  
**Verdict**: **Accept with fixes**  

---

## 1. Quality Gates Execution (Auditor Run)

The quality gates were independently executed from repo root:

### 1.1 `pnpm lint`
- **Result**: **PASS** (Exit code 0)
- **Output**: Clean across all 15 workspace packages (0 errors, 0 warnings). Module boundaries and architecture import rules respected.

### 1.2 `pnpm typecheck`
- **Result**: **PASS** (Exit code 0)
- **Output**: Clean across all 14 workspace packages with TypeScript configurations (`tsc --noEmit` exited code 0).

### 1.3 `pnpm test`
- **Result**: **PASS** (Exit code 0)
- **Output**: 306 / 306 tests passed across the workspace:
  - `packages/shared`: 2 / 2 passed
  - `packages/ui-kit`: 23 / 23 passed (including `jest-axe` accessibility audit)
  - `services/identity`: 124 / 124 passed
  - `services/organization`: 99 / 99 passed (including 16 BrandKit & FieldLocks integration tests in `tests/brand-kit.spec.ts`)
  - `apps/web-app`: 51 / 51 passed (including `BrandKitFeature.spec.tsx`)
  - Workspace root tests: 7 / 7 passed

---

## 2. Acceptance Criteria Check

*Criteria are verified only if an automated test would fail when the behaviour breaks.*

| AC # | Criteria Description (from `F09-brand-kit.md`) | Status | Evidence & Test Verification |
|---|---|:---:|---|
| **AC-1** | Brand kit: logo, brand colours (band, accent, text), cover image. | **Verified** | Verified in `services/organization/tests/brand-kit.spec.ts` (`AC-1: Brand kit persistence`, lines 96–135). Tests verify that `PATCH /orgs/:id/brand` and `GET /orgs/:id/brand` persist and retrieve `logo`, `brandColours` (`band`, `accent`, `text`), and `coverImage`. |
| **AC-2** | Admin sets field-level locks (for example logo and colours locked, bio editable). Locked fields are greyed out for employees and rejected server-side if edited. | **Verified** | Verified in `services/organization/tests/brand-kit.spec.ts` (`AC-2: Field-level locks`, lines 142–224). Admin locks fields via `PUT /orgs/:id/locks`. When an employee attempts to update a locked field (`title`) via `PATCH /orgs/:id/seats/:seatId`, the server returns 403 Forbidden with problem details. Updating an unlocked field (`managerSeatId`) succeeds with 200 OK. UI disabling and greyed-out state tested in `packages/ui-kit/tests/components.spec.tsx:346-364`. |
| **AC-3** | Live card preview updates as the admin types. | **Not verified** | **No automated test simulates typing and asserts live preview updates.** While `BrandKitManager.tsx:755-845` binds inline styles to `brandKit` state, `packages/ui-kit/tests/components.spec.tsx` only tests static initial presence (`getByText('Live digital card preview')`). No test executes `fireEvent.change` on color inputs to verify that preview elements dynamically update their styles in real time. If the state binding broke, all existing tests would still pass. |
| **AC-4** | **Contrast validation:** if the chosen text colour on the band colour is below 4.5:1, show a warning and auto-pick charcoal or paper text. Admin cannot save an unreadable combination without accepting the auto-pick. | **Wrong / Defect** | **UI bypasses acceptance requirement.**<br>1. Backend logic verified in `services/organization/tests/brand-kit.spec.ts:230-288` (rejects `< 4.5:1` with 400 Bad Request when `acceptAutoPick: false`; auto-picks Charcoal `#393536` when `acceptAutoPick: true`).<br>2. UI warning and auto-pick button verified in `components.spec.tsx:329-344`.<br>3. **Defect in UI**: In `BrandKitManager.tsx:349`: `await onSaveBrandKit(brandKit, !contrast.isAccessible)`. When contrast is inaccessible (`!contrast.isAccessible === true`), `BrandKitManager` automatically sends `acceptAutoPick: true` upon clicking Save, even if the user never clicked "Apply recommended text colour" or accepted the recommendation! The backend then silently forces text color to Charcoal/Paper without explicit user acceptance. |
| **AC-5** | Logo upload: PNG, SVG or WebP, size limit enforced, scanned and resized. Stored in S3 with CDN. | **Verified** | Verified in `services/organization/tests/brand-kit.spec.ts` (`AC-5: Logo upload validation and scanning`, lines 294–363). Tests verify acceptance of valid PNG under 5 MB returning CDN URL (`https://cdn.onebridge.in/tenants/:id/logos/...`), rejection of invalid MIME types (JPEG) with 400 Bad Request, rejection of files $> 5\text{MB}$ with 400 Bad Request, and rejection of malware/EICAR test signatures with 422 Unprocessable Entity. |
| **AC-6** | Changes publish `org.branding_updated`. | **Verified** | Verified in `services/organization/tests/brand-kit.spec.ts` (`AC-6: Event emission`, lines 368–420). Tests verify that modifying brand kit via `PATCH /brand` publishes `org.branding_updated` with `orgId` and `businessId`, and updating locks via `PUT /locks` also publishes `org.branding_updated`. |

---

## 3. Rule Violations (AGENTS.md Section 3)

| Rule | Status | Evidence |
|---|:---:|---|
| **`tenantId` on every database document and query in repo layer** | **Pass** | `MongoOrganizationRepository` and `MongoAuditRepository` extend `TenantScopedRepository`. All queries execute inside `TenantContext.run(tenantId, ...)`. Cross-tenant test in `brand-kit.spec.ts:426-440` confirms Tenant B is rejected with 403 Forbidden attempting to modify Tenant A brand kit. |
| **Authorisation checked server-side by tenant and role scope** | **Pass** | `NestOrganizationController` validates matching tenant and enforces `owner` or `admin` role for `PATCH /brand`, `PUT /locks`, and `POST /brand/logo` (`nest-organization.controller.ts:373-477`). Employee callers receive 403 Forbidden (`brand-kit.spec.ts:442-456`). Employee seat updates on locked fields return 403 (`brand-kit.spec.ts:168-195`). |
| **Seats belong to company; offboarding never deletes leads, cards, or analytics** | **Pass** | Brand kit and field locks attach to `Organization`, not seats. Offboarding logic is in F08 and preserved. |
| **No personal data in logs, push payloads or analytics event names** | **Pass** | Audit log entries (`org.brand_updated`, `org.locks_updated`) and `org.branding_updated` domain event payload contain only tenant IDs, business IDs, color hex values, CDN URLs, and lock keys. No visitor PII or personal data. |
| **Phone and email of visitors encrypted at rest** | **Pass** | N/A to F09 (Branding assets). |
| **Access token in memory only; refresh token in HttpOnly cookie; no localStorage** | **Pass** | `apps/web-app/src/api-client.ts` uses in-memory token. No `localStorage` or `sessionStorage` references exist in F09 code. |
| **Student ID images in separate encrypted bucket** | **Pass** | N/A to F09 (Logos stored under `tenants/{tenantId}/logos/`). |
| **Record consent with timestamp and notice version** | **Pass** | N/A to F09. |
| **Short links are immutable; only destination can be repointed** | **Pass** | N/A to F09. |
| **Disabled and unactivated chips resolve to neutral page** | **Pass** | N/A to F09. |
| **Contract first: change OpenAPI / event schema before changing code** | **Pass** | OpenAPI spec (`packages/api-contracts/openapi.yaml`) and events schema (`events.yaml`) updated; client types regenerated. |
| **Write endpoints accept an idempotency key** | **Fail** | `POST /orgs/{id}/brand/logo` is a write endpoint that uploads and mutates logo assets, but it does **NOT** declare an `Idempotency-Key` header parameter in `packages/api-contracts/openapi.yaml:1768-1818`, does not accept an `idempotencyKey` parameter in `NestOrganizationController.uploadLogo` (`nest-organization.controller.ts:447`), and does not invoke `this.handleIdempotency(...)`. |
| **Modules never read each other's database collections** | **Pass** | `services/organization` queries only `organizations`, `seats`, `audit_logs`, and `idempotency_records`. |
| **Errors use `application/problem+json`; lists paginated; correlation ID carried** | **Pass** | All errors use RFC 7807 (`type: 'https://tools.ietf.org/html/rfc7807'`). `correlationId` carried across controllers, services, audit records, and domain events. |
| **Additive changes only** | **Pass** | `OrganizationProps` added `brandKit` and `fieldLocks` while preserving top-level `logo`, `cover`, `brandColours` backwards compatibility. |
| **Anything user-visible and unfinished goes behind a feature flag** | **Pass** | BrandKitFeature is functional and mounted on dashboard behind auth. |
| **Design tokens only; no hard-coded colour, radius, or spacing** | **Pass** | `BrandKitManager.tsx` uses design tokens (`bg-bridge-orange`, `text-charcoal`, `text-deep-orange`, `rounded-16`, `rounded-22`, `p-20`, `gap-16`). Dynamic user-selected colors for brand styling are applied via inline `style={{ backgroundColor: brandKit.brandColours.band }}` as required for dynamic brand customisation. |
| **Orange is a fill, never a text colour** | **Pass** | Primary buttons have `text-charcoal`. Warning text and offline indicator use `text-deep-orange`. Verified Seat badge on accent fill explicitly uses `color: '#393536'`. Zero instances of orange text. |
| **Brand-kit colours must pass contrast check; if not, warn and auto-pick** | **Pass** | Relative luminance and contrast ratio calculated per WCAG 2.1 AA in `packages/shared/src/contrast.ts`. Auto-picks Charcoal (`#393536`) or Warm Paper (`#FAF7F2`). |
| **Touch targets $\ge 44\text{px}$; status never colour alone** | **Pass** | All buttons, color inputs, and hex inputs carry `min-h-[44px]` or `min-w-[44px]`. Statuses use `StatusChip` with text words ("Locked", "Unlocked") and icons ("⚠️"). |
| **Respect `prefers-reduced-motion`** | **Pass** | Loading skeleton in `BrandKitManager.tsx:374` includes `motion-reduce:animate-none`. |
| **Copy: sentence case, plain words, active verbs** | **Pass** | All user-facing labels, warnings, and error descriptions adhere to sentence case and active verbs. |
| **English and Hindi in Phase 1 without hardcoded strings** | **Pass** | `defaultBrandKitLabelsEn` and `defaultBrandKitLabelsHi` implemented in UI kit and tested in `components.spec.tsx:365-377`. |

---

## 4. Invented Behaviour

1. **Premature Lockable Card Fields in UI**:
   In `BrandKitManager.tsx:21-31`, `LOCKABLE_FIELDS` includes personal card fields:
   `phone`, `email`, `bio`, `socialLinks`.
   While the spec mentions as an example: *"for example logo and colours locked, bio editable"*, in Step 2, seats only manage organizational metadata (`title`, `departmentId`, `branchId`, `teamId`, `managerSeatId`, `status`). Personal card fields (`bio`, `phone`, `email`, `socialLinks`) do not exist on the Step 2 domain models and cannot be validated or edited by employees until Step 3 (`F10: Cards`) and Step 4 (`F14: Employees`). Exposing them in the UI now suggests they are actively enforced on cards when they are not yet wired to a card editor.

2. **Fake Malware String Detection**:
   In `FakeMediaStorageService` (`media-storage.service.ts:82`), malware detection checks for substrings `'eicar'`, `'infected'`, `'malware'`. This is a reasonable and necessary test double implementation for AC-5 fake anti-malware verification.

---

## 5. Missing States or Tests

1. **Missing Contrast Calculation Edge Case Unit Tests**:
   `F09-brand-kit.md` explicitly specifies under *Tests required*:
   > *"contrast calculation edge cases"*
   `packages/shared/src/contrast.ts` has **no dedicated unit test file**. Edge cases are completely untested:
   - 3-character hex shorthand parsing (`#fff`, `#000`)
   - Invalid hex strings (empty string, `#zzz`, non-hex characters)
   - Boundary condition: exact 4.50:1 threshold
   - Identical colors (`#ffffff` on `#ffffff` $\rightarrow$ 1.0:1)
   - Maximum contrast (`#000000` on `#ffffff` $\rightarrow$ 21.0:1)
   - Case-insensitive hex matching (`#FFFFFF` vs `#ffffff`)

2. **Missing Live Preview Interactive UI Test (AC-3)**:
   There is no automated test verifying AC-3 (*"Live card preview updates as the admin types"*). `components.spec.tsx` tests static presence, but no test fires input change events (`fireEvent.change`) to verify that typing a new band color, accent color, or logo URL dynamically updates the DOM elements of the live preview card.

3. **Missing State: Locked Field Tooltip**:
   `F09-brand-kit.md` explicitly specifies under *States to design*:
   > *"Upload error, contrast warning, locked field tooltip, unsaved changes."*
   `BrandKitManager.tsx` provides an employee banner, but **no tooltip** (`title` attribute or accessible tooltip component) exists on the locked field badges or rows to explain to the user why the field is locked or that it cannot be edited by employees.

4. **Missing UI Tests for Upload Error & Unsaved Changes Reset**:
   `components.spec.tsx` does not test the upload error state display or the "Discard changes" reset action in `BrandKitManager`.

---

## 6. Report Accuracy

1. **Omission of AC-3 from Traceability Matrix**:
   In `docs/reports/F09-report.md` Section 1, the author modified the spec's AC list:
   - Spec bullet 2 (*"Admin sets field-level locks... Locked fields are greyed out..."*) was split into AC-2 and AC-3.
   - Spec bullet 3 (*"Live card preview updates as the admin types"*) was **completely removed** from the Traceability Matrix and never tracked as an acceptance criterion!

2. **False Claim on Idempotency Coverage**:
   Report Section 2 claims:
   > *"Write endpoints support idempotency keys: PASS. PATCH /orgs/:id/brand accepts idempotency-key header..."*
   The report failed to disclose that `POST /orgs/:id/brand/logo` is a write endpoint that completely lacks `Idempotency-Key` parameter handling and does not call `handleIdempotency()`.

3. **False Claim on Contrast Edge Case Tests**:
   Report Section 5 claimed that 16 integration tests in `brand-kit.spec.ts` verified *"contrast edge cases"*. In reality, `brand-kit.spec.ts` only tested 2 static color pairs (`#1B2A4A` with `#FFFFFF`, and `#F68713` with `#FFFFFF`). Zero contrast calculation edge cases were tested.

4. **Undisclosed UI Auto-Pick Save Bypass (AC-4)**:
   The report claimed AC-4 was fully passed without acknowledging that `BrandKitManager.tsx` silently passes `acceptAutoPick = true` whenever contrast fails, thereby bypassing the spec rule: *"Admin cannot save an unreadable combination without accepting the auto-pick."*

---

## 7. Verdict and Required Fixes

**Verdict**: **Accept with fixes**

The core data structures, server-side contrast validation, role security, tenancy scoping, and logo processing are solid. However, the UI auto-pick bypass defect, missing idempotency on logo upload, missing contrast edge case test suite, and omitted AC in the report must be remediated.

### Numbered List of Required Fixes:

1. **Add `Idempotency-Key` to `POST /orgs/{id}/brand/logo`**:
   - Update `packages/api-contracts/openapi.yaml` to declare `Idempotency-Key` as an optional header parameter under `/orgs/{id}/brand/logo`.
   - Update `NestOrganizationController.uploadLogo` in `services/organization/src/presentation/nest-organization.controller.ts` to accept `@Headers('idempotency-key') idempotencyKey?: string` and wrap the service call in `this.handleIdempotency(...)`.
   - Add integration test for logo upload idempotency replay in `services/organization/tests/brand-kit.spec.ts`.

2. **Fix `BrandKitManager.tsx` auto-pick save bypass**:
   - In `packages/ui-kit/src/components/BrandKitManager.tsx:349`, do **NOT** pass `!contrast.isAccessible` as `acceptAutoPick: true`.
   - Prevent the admin from saving an inaccessible combination unless they explicitly click "Apply recommended text colour" (which updates the text colour to an accessible one) or confirm an explicit auto-pick acceptance dialog.
   - If the admin attempts to submit with low contrast without accepting the auto-pick, display the validation error and prevent saving.

3. **Add locked field tooltip in `BrandKitManager.tsx`**:
   - Add an accessible `title` attribute or tooltip component to the locked status chip / row in `BrandKitManager.tsx` indicating: *"Locked by organization administrator. Employees cannot modify this field on their cards."* to satisfy the "locked field tooltip" state requirement.

4. **Create unit tests for contrast calculation edge cases**:
   - Create `packages/shared/tests/contrast.spec.ts` with comprehensive unit tests for `parseHex`, `getRelativeLuminance`, `getContrastRatio`, and `evaluateBrandContrast`.
   - Cover 3-digit hex parsing (`#fff`), invalid inputs, exact 4.5:1 boundary threshold, identical colors (1:1), maximum contrast (21:1), and auto-pick selection between Charcoal and Warm Paper.

5. **Add UI test for live card preview updates (AC-3)**:
   - In `packages/ui-kit/tests/components.spec.tsx`, add an automated test that simulates changing the band color input via `fireEvent.change` and asserts that the live preview header element's background color dynamically updates.

6. **Correct `docs/reports/F09-report.md`**:
   - Restore AC-3 (*"Live card preview updates as the admin types"*) into Section 1 of the report to match `F09-brand-kit.md`.
   - Update Section 2 and Section 6 to accurately reflect the logo upload idempotency fix and the new contrast unit test suite.
