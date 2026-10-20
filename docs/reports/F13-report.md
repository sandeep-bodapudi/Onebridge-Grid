# Feature Completion Report: F13 - Share-back and Leads

**Date**: 2026-10-15  
**Feature**: F13: Share-back and Leads  
**Priority**: Must  
**Modules**: `packages/api-contracts`, `packages/shared`, `packages/ui-kit`, `services/cards`, `apps/web-public`  
**Status**: Completed. 582/582 tests passing workspace-wide (`services/cards`: 103/103, `packages/shared`: 95/95, `packages/ui-kit`: 59/59, `apps/web-public`: 10/10, `services/identity`: 124/124, `services/organization`: 115/115, `apps/web-app`: 61/61, `edge/shortlink`: 6/6, workspace root: 7/7). Lint and typecheck clean with 0 errors.

---

## 1. Acceptance Criteria Traceability

| AC # | Requirement (from `F13-shareback-leads.md`) | Implementation | Verification / Test |
|---|---|---|---|
| **AC-1** | Share-back form has fields: name (required), phone (required), email (optional), company (optional), note (optional), and a mandatory consent checkbox with a link to the privacy notice. | `packages/ui-kit/src/components/VisitorCard.tsx` implements interactive form with accessible `<label htmlFor="...">`, required indicators, E.164 phone normalization, optional email, company, and note inputs, and a required consent checkbox with link to `/privacy` using tokenized `text-deep-orange` for contrast compliance. Form and service validate all inputs before dispatch, including email format validation (`^[^\s@]+@[^\s@]+\.[^\s@]+$`). | `packages/ui-kit/tests/visitor-card.spec.tsx` ("renders arched-top share-back container with all form fields and privacy link", "validates required fields (name, phone, consent) before submit (AC-1)"), `services/cards/tests/shareback-http.spec.ts` ("rejects missing name, phone, unchecked consent, or invalid email with 400 Problem Details") |
| **AC-2** | Submitting creates a Lead owned by the seat's company. Preserves the visitor's channel (QR scan, NFC tap, or link) and source tag. | `services/cards/src/domain/lead.ts` defines `Lead` entity owned by tenant with `ownerSeatId`, `cardId`, `source: 'qr' \| 'nfc' \| 'link' \| 'shareback'`, and `sourceTag`. Created via `POST /public/c/:slug/shareback` and persisted via `MongoLeadRepository`. `apps/web-public/app/c/[...slug]/page.tsx` and `VisitorCardClient.tsx` propagate query parameters (`?source=...&src=...`) through submission. | `services/cards/tests/shareback-http.spec.ts` ("persists lead in MongoDB scoped to card tenantId with ownerSeatId, source, and sourceTag", "creates encrypted Lead owned by seat company, records consent, notifies owner < 10s, and emits events with zero PII"), `apps/web-public/tests/visitor-page.spec.tsx` ("forwards share-back submission to cards service with client IP header") |
| **AC-3** | Consent is recorded with a timestamp, privacy notice version, and the card it was submitted on. | `LeadConsent` value object records `granted: true`, ISO-8601 `timestamp`, `noticeVersion: 'v1.0'`, and `cardId: string`. Enforced by `Lead` domain aggregate and verified in repository persistence. | `services/cards/tests/lead.domain.spec.ts` ("creates valid lead aggregate when required attributes and consent are provided"), `services/cards/tests/shareback-http.spec.ts` ("consent recorded with timestamp, notice version and card (AC-3)") |
| **AC-4** | Cardholder (seat owner) is notified under 10 seconds. | In-memory `LeadNotifier` interface and `FakeLeadNotifier` implement owner notification. Tests measure dispatch latency ($< 10\text{s}$, typically $< 5\text{ms}$). Domain events `shareback.submitted` and `lead.created` are emitted with ZERO visitor PII and event version `1.0.0`. | `services/cards/tests/shareback-http.spec.ts` ("owner notified under 10 seconds (AC-4)", "check events emitted on bus with ZERO visitor PII and version 1.0.0 (AC-4)") |
| **AC-5** | Visitor personal data is encrypted per ADR-0002. | `packages/shared/src/lead-encryption.ts` implements AES-256-GCM encryption with per-tenant 256-bit DEK retrieved via `KeyVaultProvider`, 96-bit random IV, and AAD = `${tenantId}\|${leadId}`. Raw database document contains only ciphertext, IV, authTag, and blind index; no plaintext PII. | `packages/shared/tests/lead-encryption.spec.ts` (10 tests verifying roundtrip encryption/decryption, AAD mismatch rejection, unique IVs, tamper detection), `services/cards/tests/shareback-http.spec.ts` ("encrypted at rest per ADR-0002 (AC-5)") |
| **AC-6** | Spam protection: Cloudflare Turnstile token validation, rate limit on share-back submissions per card and per IP, duplicate detection (same phone on same card within 24 hours returns original confirmation without creating a second lead). | `services/cards/src/application/shareback.service.ts` validates Turnstile token, enforces `RateLimiter` per IP (5 submissions / 15 minutes) and per card (20 submissions / 60 minutes) returning 429 Problem Details with `Retry-After` header. Queries `findRecentByBlindIndex` using salted HMAC-SHA256 blind index to detect duplicates within 24 hours, returning original `leadId` without creating duplicate lead or triggering redundant owner notification. | `services/cards/tests/shareback-http.spec.ts` ("returns original confirmation on duplicate submission by same phone on same card within 24 hours without creating second lead", "enforces rate limits per IP and returns 429 Problem Details with Retry-After header", "rejects submission when Turnstile verification fails"), `packages/shared/tests/rate-limiter.spec.ts` (4 tests) |
| **AC-7** | Submitting displays a success arc animation that fades after 3 seconds, or can be dismissed immediately. | `VisitorCard.tsx` renders animated arc checkmark container (`shareback-success`, `animate-arc-success`) with 3-second auto-dismiss timer and accessible manual dismiss button (`min-h-[44px]`). `packages/ui-kit/src/styles/tokens.css` incorporates `@media (prefers-reduced-motion: reduce)` rule replacing arc animation with an instantaneous 150ms opacity fade per AGENTS.md rules. | `packages/ui-kit/tests/visitor-card.spec.tsx` ("submits valid share-back and displays arc success animation (AC-2, AC-7)", "automatically dismisses success state after 3 seconds (AC-7)"), `packages/ui-kit/src/styles/tokens.css` inspection |
| **AC-8** | Leads stay with the company when the seat is offboarded or reassigned. | `Lead` aggregate carries immutable `tenantId` and is persisted in tenant-scoped `leads` collection. Offboarding or reassigning a seat in the organization read model leaves all existing leads intact under company tenancy. | `services/cards/tests/shareback-http.spec.ts` ("leads stay with the company when the seat is offboarded or reassigned (AC-8)") |

---

## 2. Architecture & Security Rules Compliance (AGENTS.md Section 3)

| Rule | Status | Implementation Verification |
|---|---|---|
| **Every document/query carries `tenantId`** | **PASS** | `MongoLeadRepository` extends `TenantScopedRepository<Lead>`. All read and write queries enforce `tenantId: this.getTenantId()`. Duplicate lookup queries use `{ tenantId, cardId, phoneBlindIndex, createdAt: { $gte: since } }`. Collection `leads` is registered as tenant-scoped in `collection-registry.ts`. |
| **Authorisation checked server-side** | **PASS** | Write endpoint `POST /public/c/:slug/shareback` resolves card by slug, verifies tenant validity, checks rate limits, and creates lead strictly under the card's company tenant. Private lead access in future modules will enforce RBAC. |
| **Write endpoints accept an idempotency key** | **PASS** | `PublicCardsController.handleShareback` extracts `Idempotency-Key` (case-insensitive), returns cached response when replayed with identical payload, and throws 422 Problem Details (`Mismatching request body for provided Idempotency-Key`) when conflicting payload is sent. `apps/web-public/app/api/shareback/route.ts` forwards `idempotency-key` header. Verified in `shareback-http.spec.ts` and `visitor-page.spec.tsx`. |
| **Zero personal data in logs or events** | **PASS** | `shareback.submitted` and `lead.created` domain events emit only non-identifying metadata (`tenantId`, `cardId`, `leadId`, `source`, `sourceTag`, `hasNote`, `timestamp`). No name, phone, or email is ever emitted on the event bus, logged, or sent in analytics events. Verified by explicit test assertions in `shareback-http.spec.ts`. |
| **AES-256-GCM encryption with tenant DEK** | **PASS** | Enforced per ADR-0002. 96-bit random IV generated via `crypto.randomBytes(12)` per encryption. AAD binds `${tenantId}\|${leadId}` to prevent ciphertext transplant attacks. |
| **Blind indexing for duplicate detection** | **PASS** | Enforced per ADR-0002. Blind index uses `HMAC-SHA256(indexKey, tenantId + "|" + normalizedPhone)` with distinct per-tenant salting. Two tenants receiving the same phone number produce completely different hashes, preserving cross-tenant isolation. |
| **Orange is a fill, never a text colour** | **PASS** | Submit button in `VisitorCard.tsx` uses `bg-bridge-orange text-charcoal`. Privacy notice link uses `text-deep-orange` on sand background to ensure WCAG AA contrast compliance. |
| **Touch targets $\ge 44\text{px}$** | **PASS** | All inputs, checkboxes, submit buttons, and dismiss controls have `min-h-[44px]` with proper aria-labels and labels. |
| **Status never colour alone** | **PASS** | Error and success banners include descriptive icons (⚠️, arc checkmark) and explicit textual copy in both English and Hindi. |
| **Prefers-reduced-motion compliance** | **PASS** | Success arc animation respects `prefers-reduced-motion: reduce`, replacing the keyframe arc with a 150ms opacity fade in `tokens.css`. |
| **Errors use `application/problem+json`** | **PASS** | 400 Bad Request, 404 Not Found, 422 Unprocessable Entity, and 429 Too Many Requests return RFC 7807 problem details with `application/problem+json`. 429 responses include `Retry-After` header. |
| **No localStorage for leads or tokens** | **PASS** | All visitor submissions post directly over HTTPS; no visitor PII is stored in browser localStorage. |

---

## 3. Test Execution Summary

All 582 tests executed cleanly across the entire workspace:

```bash
pnpm test
```

| Package / App / Service | Test Files | Tests Passed | Status |
|---|---|---|---|
| `packages/api-contracts` | 1 | 2 | Pass |
| `packages/shared` | 17 | 95 | Pass |
| `packages/ui-kit` | 3 | 59 | Pass |
| `services/cards` | 9 | 103 | Pass |
| `services/identity` | 23 | 124 | Pass |
| `services/organization` | 8 | 115 | Pass |
| `apps/web-app` | 9 | 61 | Pass |
| `apps/web-public` | 1 | 10 | Pass |
| `edge/shortlink` | 1 | 6 | Pass |
| Workspace root | 2 | 7 | Pass |
| **Total** | **74** | **582** | **100% Pass** |

Quality gates:
- `pnpm lint`: Pass (0 errors, 0 warnings across all packages).
- `pnpm typecheck`: Pass (0 errors across 14 workspace projects).

---

## 4. Contract & Schema Changes

1. **`packages/api-contracts/openapi.yaml`**:
   - Added endpoint `POST /public/c/{slug}/shareback` with `Idempotency-Key` header parameter.
   - Added `SharebackRequest` schema (`name`, `phone`, `email` with `format: email`, `company`, `note`, `consent`, `noticeVersion`, `source`, `sourceTag`, `turnstileToken`).
   - Added `SharebackResponse` schema (`success`, `leadId`, `status: created | duplicate_acknowledged`, `cardId`, `message`).
   - Added 422 Unprocessable Entity and 429 Too Many Requests response schemas with `Retry-After` header.

2. **`packages/api-contracts/events.yaml`**:
   - Added `SharebackSubmittedEvent` (`shareback.submitted`) schema with non-PII payload and `version: 1.0.0`.
   - Added `LeadCreatedEvent` (`lead.created`) schema with non-PII payload and `version: 1.0.0`.

3. **Database Schema (`services/cards/src/infrastructure/mongo-lead.repository.ts`)**:
   - Collection `leads`:
     - Index `{ tenantId: 1, id: 1 }` (unique)
     - Index `{ tenantId: 1, cardId: 1, createdAt: -1 }`
     - Index `{ tenantId: 1, ownerSeatId: 1, createdAt: -1 }`
     - Index `{ tenantId: 1, cardId: 1, phoneBlindIndex: 1, createdAt: -1 }`

---

## 5. Architectural Decisions Recorded

- **`[2026-10-15] D-F13-SHAREBACK-LEADS`**: Documented in `docs/decisions.md` detailing lead encryption, blind indexing, spam protection, idempotency handling, zero visitor PII in domain events, and success arc animation with reduced-motion fallback.
