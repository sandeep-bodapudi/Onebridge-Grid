# Independent Feature Audit: F13 — Share-back and Leads

**Reviewer**: Coding Agent (Independent Adversarial Auditor)  
**Date**: 2026-10-15  
**Target Feature**: F13: Share-back and leads  
**Feature Spec**: `docs/onebridge-spec-pack/docs/features/F13-shareback-leads.md`  
**Report Reviewed**: `docs/reports/F13-report.md`  
**Verdict**: **Accept with fixes**  

---

## 1. Quality Gates Execution (Auditor Run)

The quality gate commands mandated by `AGENTS.md` Section 6 were executed independently from the repository root:

### 1.1 `pnpm lint`
- **Result**: **PASS** (Exit code 0)
- **Output**: Clean across all 15 workspace packages (0 errors, 0 warnings). Module boundaries and architecture import rules respected.

### 1.2 `pnpm typecheck`
- **Result**: **PASS** (Exit code 0)
- **Output**: Clean across all 14 workspace packages with TypeScript configurations (`tsc --noEmit` exited code 0).

### 1.3 `pnpm test`
- **Result**: **PASS** (Exit code 0)
- **Output**: 74 test files, 577 tests passed across all packages:
  - `edge/shortlink`: 1 file, 6 passed
  - `packages/api-contracts`: 1 file, 2 passed
  - `packages/shared`: 17 files, 95 passed
  - `packages/ui-kit`: 3 files, 58 passed
  - `services/cards`: 9 files, 101 passed
  - `services/identity`: 23 files, 124 passed
  - `services/organization`: 8 files, 115 passed
  - `apps/web-app`: 9 files, 61 passed
  - `apps/web-public`: 1 file, 10 passed
  - Workspace root tests: 2 files, 7 passed

---

## 2. Acceptance Criteria Check

*Criteria are marked Verified only if an automated test would fail when the behaviour breaks.*

| AC # | Requirement Description (from `F13-shareback-leads.md`) | Status | Evidence & Test Verification |
|---|---|:---:|---|
| **AC-1** | Form fields: name and phone required; email, company, note optional; consent checkbox required with a link to the privacy notice. | **Verified** | Verified in `packages/ui-kit/tests/visitor-card.spec.tsx:219-259` ("renders arched-top share-back container with all form fields and privacy link", "validates required fields (name, phone, consent) before submit (AC-1)") and `services/cards/tests/shareback-http.spec.ts:131-173` ("rejects missing name, phone, or unchecked consent with 400 Problem Details"). Form inputs and labels are rendered in `packages/ui-kit/src/components/VisitorCard.tsx:620-765`. *(Minor validation gap: `services/cards/src/application/shareback.service.ts:192` does not validate email format when provided, despite `format: email` in `openapi.yaml`).* |
| **AC-2** | Submitting creates a `Lead` owned by the seat's company. The lead keeps its source (QR tag, NFC or link). | **Verified** | Verified in `services/cards/tests/shareback-http.spec.ts:189-220` ("creates encrypted Lead owned by seat company, records consent, notifies owner < 10s, and emits events with zero PII") and `apps/web-public/tests/visitor-page.spec.tsx:288-336` ("forwards share-back submission to cards service with client IP header"). Persisted via `MongoLeadRepository` with `ownerSeatId`, `source`, and `sourceTag`. |
| **AC-3** | Consent is recorded with timestamp, notice version and card. | **Verified** | Verified in `services/cards/tests/lead.domain.spec.ts:17-48` and `services/cards/tests/shareback-http.spec.ts:221-226`. `LeadConsent` value object records `granted: true`, ISO-8601 `timestamp`, `noticeVersion`, and `cardId`. |
| **AC-4** | Owner is notified in under 10 seconds (notification delivery built in step 7; use the event and a fake notifier until then). | **Verified** | Verified in `services/cards/tests/shareback-http.spec.ts:252-277`. `FakeLeadNotifier.notifyOwner` records delivery with latency measurement ($< 10\text{s}$, actual $< 10\text{ms}$). Domain events `shareback.submitted` and `lead.created` are emitted with ZERO visitor PII. |
| **AC-5** | Lead personal data is encrypted per ADR-0002 (one encrypted payload, per-tenant key, blind index for duplicates). | **Verified** | Verified in `packages/shared/tests/lead-encryption.spec.ts:1-120` (10 tests covering roundtrip encryption/decryption, AAD mismatch, tamper detection, unique IVs) and `services/cards/tests/shareback-http.spec.ts:227-251` (asserts raw database document in Mongo contains NO plaintext name, phone, or email). |
| **AC-6** | Spam protection: Cloudflare Turnstile or equivalent, rate limits per IP and per card, duplicate detection by phone within 24 hours. | **Verified** | Verified in `services/cards/tests/shareback-http.spec.ts:280-368` (24-hour duplicate phone on same card returns original confirmation with 200 without second lead or notification; Turnstile failure returns 400; IP rate limiting returns 429 with `Retry-After` header) and `packages/shared/tests/rate-limiter.spec.ts:1-55`. |
| **AC-7** | On success the page shows an arc animation and a clear confirmation. Reduced motion shows a fade. | **Not verified (Incomplete Test)** | The visual arc animation (`animate-arc-success`), confirmation copy, manual dismiss button, and reduced-motion fade (`tokens.css:98-101`) are implemented in `VisitorCard.tsx:576-612` and tested in `visitor-card.spec.tsx:261-309`. However, the **3-second auto-dismiss timer** (`VisitorCard.tsx:204-211`) has **zero test coverage**: the test only clicks the manual dismiss button (`fireEvent.click(dismissBtn)`). If the 3-second `setTimeout` hook were deleted, all tests would still pass. |
| **AC-8** | Leads stay with the company when the seat is offboarded or reassigned. | **Verified** | Verified in `services/cards/tests/shareback-http.spec.ts:371-403` ("leads stay with the company when the seat is offboarded or reassigned"). Lead aggregate carries immutable `tenantId` and survives seat status changes in the read model. |

---

## 3. Rule Violations (AGENTS.md Section 3)

| Rule | Status | Evidence |
|---|:---:|---|
| **Every database document and query carries `tenantId` in repo layer** | **PASS** | `MongoLeadRepository` extends `TenantScopedRepository<LeadDoc>` (`mongo-lead.repository.ts:8`). Duplicate lookups and ID lookups strictly enforce `tenantId: this.getActiveTenantId()`. Collection `leads` is registered as `tenant-scoped` in `packages/shared/src/mongo/collection-registry.ts:73-77`. |
| **Authorisation checked server-side by tenant and role scope** | **PASS** | `PublicCardsController.handleShareback` resolves published card, validates tenant existence, and scopes lead creation strictly to the card's company tenant. Private lead access in future modules will enforce RBAC. |
| **Seats belong to company; offboarding never deletes leads, cards, or analytics** | **PASS** | Verified in `shareback-http.spec.ts:371-403`. Offboarding a seat in `MongoSeatReadModelRepository` leaves all leads intact under the company's tenant ID. |
| **No personal data in logs, push payloads or analytics event names** | **PASS** | Verified in `shareback-http.spec.ts:258-277`. `shareback.submitted` and `lead.created` domain events carry only metadata (`leadId`, `cardId`, `ownerSeatId`, `source`, `sourceTag`, `consent.timestamp`, `consent.noticeVersion`). Zero visitor PII (name, phone, email) in event payloads. |
| **Phone and email of visitors are encrypted at rest** | **PASS** | Enforced per ADR-0002 in `packages/shared/src/lead-encryption.ts`. AES-256-GCM encryption with per-tenant 256-bit DEK, random 96-bit IV, and AAD = `${tenantId}\|${leadId}`. Raw Mongo documents store ciphertext only. |
| **Access token in memory only; refresh token in httpOnly cookie; no localStorage** | **PASS** | Public shareback posts directly over HTTPS; zero tokens or visitor PII stored in localStorage. |
| **Student ID images go to separate encrypted bucket** | **PASS** | N/A for F13 (student plan is F27). |
| **Record consent with timestamp and notice version** | **PASS** | Recorded in `LeadConsent` (`lead.ts:19-24`, `shareback.service.ts:215-220`) with ISO timestamp, notice version (`v1.0`), and card ID. |
| **Short links are immutable. Only destination can be re-pointed** | **PASS** | N/A for F13 (handled in F11). |
| **Disabled and unactivated chips resolve to neutral page with NO personal data** | **PASS** | Verified in F12 / `public-cards.controller.ts:44-52` (returns 404 for non-published cards). |
| **Contract first: change OpenAPI / event schema before code** | **PASS** | Added `POST /public/c/{slug}/shareback`, `SharebackRequest`, `SharebackResponse`, `SharebackSubmittedEvent`, and `LeadCreatedEvent` to `openapi.yaml` and `events.yaml`. |
| **Write endpoints accept an idempotency key** | **FAIL** | In `packages/api-contracts/openapi.yaml:2472-2477`, `POST /public/c/{slug}/shareback` declares header parameter `Idempotency-Key`. However, in `services/cards/src/presentation/public-cards.controller.ts:128-219`, `handleShareback` **completely ignores the `Idempotency-Key` header**. It does not inspect, validate, cache, or replay responses using `CacheStore` / `handleIdempotency` (unlike `CardsController` in F10). Duplicate requests with altered bodies are not rejected with 422 Problem Details. |
| **Modules never read each other's database collections** | **PASS** | Cards service accesses only `cards`, `leads`, and local read models (`org_read_models`, `seat_read_models`). |
| **Errors use `application/problem+json`** | **PASS** | Verified in `public-cards.controller.ts:33-87` and `apps/web-public/app/api/shareback/route.ts:18,52`. Statuses 400, 404, 429, and 500 return RFC 7807 problem details with `application/problem+json`. 429 responses include `Retry-After` header. |
| **Additive changes only** | **PASS** | Additive schema changes in `openapi.yaml` and `events.yaml`. |
| **Anything user-visible and unfinished goes behind a feature flag** | **PASS** | Shareback form is isolated within public card page. |
| **Use tokens from `packages/ui-kit`. Never hard-code a colour, radius or spacing value** | **PASS** | Uses design tokens: `bg-bridge-orange`, `text-charcoal`, `text-deep-orange`, `rounded-arch`, `rounded-22`, `border-sand-border`. |
| **Orange is a fill, never a text colour** | **PASS** | In `VisitorCard.tsx:760`, submit button uses `bg-bridge-orange text-charcoal`. Privacy notice link uses `text-deep-orange` (`#A04E08`) for contrast compliance. |
| **Brand-kit colours chosen by customers must pass a contrast check** | **PASS** | Verified in F09/F10. |
| **Touch targets are 44 px or more. Status is never colour alone** | **PASS** | All inputs, submit button (`min-h-[44px] h-12`), and dismiss button (`min-h-[44px]`) meet $\ge 44\text{px}$. Status includes icons (⚠️, arc checkmark) and explicit text. |
| **Respect `prefers-reduced-motion`: arcs become a 150 ms fade** | **PASS** | `packages/ui-kit/src/styles/tokens.css:98-101` explicitly disables `animate-arc-success` and applies `transition: opacity 150ms ease-out !important` under `@media (prefers-reduced-motion: reduce)`. |
| **Copy: sentence case, plain words, active verbs** | **PASS** | English copy uses sentence case ("Share your details", "Send contact", "Details shared"). |
| **English and Hindi in Phase 1. No hard-coded strings; use the i18n layer** | **PASS** | Bilingual copy dictionary in `VisitorCard.tsx:80-171`. |

---

## 4. Invented Behaviour

1. **Unrequested Enum Expansion in Domain Model (`LeadSource`)**:
   - `F13-shareback-leads.md` § Data defines: `source [shareback | manual | company_enquiry]`.
   - `services/cards/src/domain/lead.ts:17` and `openapi.yaml:2463` expanded the enum to `'qr' | 'nfc' | 'link' | 'shareback' | 'manual' | 'company_enquiry'`. While justified by AC-2 ("The lead keeps its source (QR tag, NFC or link)"), this was not explicitly reconciled with the Data model section of the spec.
2. **Dual Route Paths in Public Controller**:
   - `PublicCardsController` defines both `POST :orgSlug/:cardSlug/shareback` and `POST :slug/shareback` to support slash-separated slugs. (Acceptable, matches F12 pattern).
3. **Event Schema Version Discrepancy**:
   - In `packages/api-contracts/events.yaml:644,671`, `SharebackSubmittedEvent` and `LeadCreatedEvent` specify `version: { type: string, const: "1.0.0" }`.
   - In `services/cards/src/application/shareback.service.ts:156,229,251`, events are emitted with `version: '1.0'`.

---

## 5. Missing States or Tests

1. **Missing Automated Test for 3-Second Auto-Dismiss (AC-7)**:
   - `VisitorCard.tsx:204-211` configures a 3-second auto-dismiss `useEffect` timer when `sharebackStatus === 'success'`.
   - In `packages/ui-kit/tests/visitor-card.spec.tsx:261-309`, the test only tests manual dismissal with `fireEvent.click(dismissBtn)`. There is no test using fake timers (`vi.useFakeTimers()`, `vi.advanceTimersByTime(3000)`) to assert that the success banner auto-dismisses after 3 seconds.
2. **Missing Email Format Validation**:
   - `packages/api-contracts/openapi.yaml:3211-3212` specifies `format: email` for `SharebackRequest.email`.
   - In `services/cards/src/application/shareback.service.ts:192`, arbitrary strings (e.g., `"not-an-email"`) are accepted and encrypted without validation.
3. **Missing Idempotency Handling & Test**:
   - `POST /public/c/{slug}/shareback` accepts an `Idempotency-Key` per `openapi.yaml`, but the handler does not cache responses or detect conflicting payloads with 422 Problem Details. No tests exist in `shareback-http.spec.ts` for idempotency replay or payload mismatch.

---

## 6. Report Accuracy (Audit of `docs/reports/F13-report.md`)

| Report Claim | Actual Code Reality | Auditor Finding |
|---|---|:---:|
| **§1 AC-6 Rate Limits**: "RateLimiter per IP (5 submissions / 10 minutes) and per card (30 submissions / 10 minutes)" | In `services/cards/src/application/shareback.service.ts:109-126`, IP rate limit is **5 submissions / 15 minutes** (`15 * 60 * 1000`) and card rate limit is **20 submissions / 60 minutes** (`60 * 60 * 1000`). | **Inaccurate Claim in Report** |
| **§1 AC-7 Auto-Dismiss**: "Submitting displays a success arc animation that fades after 3 seconds, or can be dismissed immediately... Verification / Test: visitor-card.spec.tsx" | `visitor-card.spec.tsx` only tests clicking the manual dismiss button (`fireEvent.click(dismissBtn)`). The 3-second auto-dismiss timer is never asserted. | **Incomplete Test Claim** |
| **§2 Architecture Rules**: "Zero personal data in logs or events... verified by explicit test assertions" | Fully verified in `shareback-http.spec.ts:258-277`. | **Accurate** |
| **§2 Lead Encryption**: "AES-256-GCM encryption with tenant DEK... AAD binds tenantId\|leadId... blind indexing" | Fully verified in `packages/shared/src/lead-encryption.ts` and `shareback-http.spec.ts:227-251`. | **Accurate** |
| **§3 Test Execution**: "Status: Completed. 577/577 tests passing workspace-wide" | Verified independently by auditor. 74 test files, 577 tests passing. | **Accurate** |

---

## 7. Verdict and Required Fixes

**Verdict**: **Accept with fixes**

The core cryptographic and domain requirements of F13 (AES-256-GCM tenant encryption per ADR-0002, blind indexing for duplicate detection, Turnstile spam protection, rate limiting, zero PII in domain events, and accessible UI with arc animation and reduced-motion fallback) are well-designed and passing 577 tests. However, the mandatory `AGENTS.md` rule requiring write endpoints to accept and handle an idempotency key is violated, the 3-second auto-dismiss timer lacks automated test verification, and email validation is missing.

### Numbered List of Required Fixes

1. **Implement Idempotency Key Handling on `POST /public/c/{slug}/shareback`**:
   - In `services/cards/src/presentation/public-cards.controller.ts`, inject `CacheStore` and extract `Idempotency-Key` from request headers.
   - If `Idempotency-Key` is provided:
     - Return cached response if previously processed with the exact same request body.
     - Return HTTP 422 Problem Details (`https://tools.ietf.org/html/rfc7807`, Title: `Unprocessable Entity`, Detail: `Mismatching request body for provided Idempotency-Key`) if the same key is reused with different payload data.
     - Cache successful `201 Created` and `200 OK` (duplicate acknowledged) responses for 86400 seconds.
   - In `apps/web-public/app/api/shareback/route.ts`, forward `Idempotency-Key` if present in incoming headers to the cards service.
   - Add integration tests in `services/cards/tests/shareback-http.spec.ts` verifying idempotency replay on identical body and 422 error on conflicting payload.

2. **Add Email Format Validation in `SharebackService`**:
   - In `services/cards/src/application/shareback.service.ts`, if `input.email` is provided, validate that it matches standard email format (`^[^\s@]+@[^\s@]+\.[^\s@]+$`). Throw `InvalidSharebackError('Invalid email format')` if invalid.
   - Add unit test in `services/cards/tests/shareback-http.spec.ts` asserting 400 Problem Details when an invalid email string is submitted.

3. **Add Automated Test for 3-Second Auto-Dismiss in `VisitorCard`**:
   - In `packages/ui-kit/tests/visitor-card.spec.tsx`, add a test utilizing `vi.useFakeTimers()` to verify that after successful share-back submission, advancing timers by 3000ms (`vi.advanceTimersByTime(3000)`) causes the success screen to automatically dismiss and return to the default state.

4. **Align Event Version String with `events.yaml`**:
   - In `services/cards/src/application/shareback.service.ts:156,229,251`, update `version: '1.0'` to `version: '1.0.0'` to match `packages/api-contracts/events.yaml:644,671`.

5. **Correct Rate Limit Descriptions in `docs/reports/F13-report.md`**:
   - Update `docs/reports/F13-report.md` to accurately document the rate limiter window settings (5 per 15 minutes per IP, 20 per 60 minutes per card).
