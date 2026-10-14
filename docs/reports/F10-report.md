# Feature Completion Report: F10 - Cards and Templates

**Date**: 2026-10-14
**Feature**: F10: Cards and templates
**Priority**: Must (Hindi content: Should — not built; English only, as the spec allows)
**Modules**: `packages/api-contracts`, `packages/shared`, new `services/cards`
**Status**: Implemented and typechecked/linted clean. Unit/integration tests written but **not executed in this session** (see §4) — this report does not claim a passing test run.

---

## 1. Acceptance Criteria Traceability

| AC # | Requirement (from `F10-card-templates.md`) | Implementation | Test (written, not run this session) |
|---|---|---|---|
| **AC-1** | Each seat has one card with company branding, photo, name, designation, verification badge (when KYB verified) and action buttons. | `ReadModelSyncService.handleSeatCreated` calls `CardsService.ensureDraftCardForSeat`, idempotently creating exactly one draft `Card` per seat (`card.id === seat.id`), stamped with the org read model's `verifiedBadge` at creation time. | `tests/cards-http.spec.ts` ("a seat.created event provisions exactly one draft card"), `tests/read-model-sync.spec.ts` ("seat.created provisions ... a draft card in one consumer pass") |
| **AC-2** | 8 premium templates. Changing a template keeps all content. Applies to selected cards in bulk. | `CARD_TEMPLATE_IDS` (8 ids) in `domain/card.ts`; `CardsService.updateCard` only touches `templateId` when that field is set, never `sections`; `CardsService.bulkSetTemplate` applies one template to a list of card ids, admin-only, leaving every other card untouched. | `tests/card.domain.spec.ts` (8-template count), `tests/cards-http.spec.ts` ("template switch keeps all content, applies in bulk") |
| **AC-3** | Sections: About, Products, Services, Portfolio, Gallery, Documents (PDF ≤ 25 MB), Social links, Company info, Branch map. Orderable/toggleable by admin and by employee where unlocked. Visibility per field: public/internal. | `CARD_SECTION_TYPES` (9 types) + `CardSectionConfig` (`enabled`, `order`, `locked`, `visibility`, `content`) in `domain/card.ts`. `assertSectionsEditable` rejects a non-admin's change to a `locked` section server-side. Edit authority further restricted (beyond a literal reading of the AC) to the seat's own assigned person for `employee`-role callers — see decisions.md. Document size/type limits are not yet enforced (no document upload endpoint exists; logged as a gap below, not silently skipped). | `tests/card.domain.spec.ts` (lock enforcement), `tests/cards-http.spec.ts` ("locked sections are rejected server-side for non-admins") |
| **AC-4** | English content (Must). Hindi content and the visitor language toggle (Should): missing Hindi falls back to English. | `Card.language: 'en' \| 'hi'` field exists and is settable via `PATCH /cards/{id}`; no Hindi *content* translation UI/flow was built (Should, explicitly deferred, consistent with AGENTS.md's Hindi i18n catalogue deferral to Step 3/12). | Not applicable (not built) |
| **AC-5** | Publishing a card fires `card.published`. The outbox worker calls the web-public revalidate endpoint; the page refreshes within 60 seconds. | `CardsService.publishCard`/`approveCard` → `doPublish`: saves the card, publishes `card.published` (added to `packages/api-contracts/events.yaml`), then calls `RevalidationNotifier.revalidateCard`. `FakeRevalidationNotifier` used in dev/tests; `HttpRevalidationNotifier` (HMAC-signed, retried) is wired for production but unused today — `apps/web-public` doesn't exist until F12. | `tests/cards-http.spec.ts` ("publish fires card.published and triggers revalidation") |
| **AC-6** | Card page data comes from the Cards read model of organisation and seat data, never from another service's database. | New `org_read_models`, `seat_read_models`, `branch_read_models` collections (registered in `collection-registry.ts`) populated solely by consuming `org.*`, `branch.*`, `seat.*` domain events via the new `ReadModelSyncService` + `InMemoryEventBus`. `services/cards` has zero import of `services/organization/src/*` and zero direct query against the `organizations`/`branches`/`seats` collections. | `tests/read-model-sync.spec.ts` |
| **AC-7** | Optional admin approval before publish, controlled by a company setting. | `Card.approvalRequired: boolean`. When set and the caller is not owner/admin, `publishCard` moves the card to `pending_approval` instead of publishing; a separate `approveCard` (admin-only) completes the publish. **Gap, logged below**: there is no admin UI/endpoint yet to *turn on* `approvalRequired` as a company-wide setting — the field exists and the state machine is implemented and tested, but nothing sets it true outside a test fixture. | `tests/cards-http.spec.ts` ("owner can always publish directly even when approval is required") |

## 2. States designed

Draft, pending_approval, published (via `Card.status`). Locked-field rejection (400 with RFC 7807 problem details). Empty/default section set on creation. *Not yet built*: the dedicated UI component for these states (`CardsFeature` in `apps/web-app`, a `CardEditor` in `packages/ui-kit`) — this report covers the service/API layer only; the presentation layer is a reasonable next slice of F10/F12 but was out of time budget for this pass. Logged, not silently dropped.

## 3. Architecture & security rules (AGENTS.md section 3)

| Rule | Verification |
|---|---|
| Every document/query carries `tenantId` in the repository layer | `MongoCardRepository` and all three read-model repositories extend `TenantScopedRepository`; every call site wraps repo access in `TenantContext.run(tenantId, ...)`. |
| Authorisation checked server-side | `CardsController` resolves role/personId from `TenantAuthGuard`-populated headers; `CardsService.assertCanEditCard` enforces owner/admin-or-own-seat server-side regardless of what the UI would show. |
| Seats belong to the company; departing person keeps only their own public card details | Not yet touched by F10 — offboarding behaviour for cards is explicitly F16 (Step 4), noted in `ReadModelSyncService.handleSeatStatusChanged`. |
| Modules never read each other's database collections | Verified by code review: `services/cards` imports only `@onebridge/shared` and `@onebridge/api-contracts`, never `services/organization`. |
| Contract first | `openapi.yaml` and `events.yaml` updated before the client regeneration (`pnpm contracts:gen`) completed this session. |
| Errors use `application/problem+json`; idempotency keys | Problem-details shape implemented via `ProblemError` → Nest exception mapping. **Gap, logged**: write endpoints (`publish`, `approve`, `bulk-template`) do not yet accept an `Idempotency-Key` header/cache, unlike the organization service's pattern — should be added before F11 depends on repeat-safe publish calls. |
| Design tokens, orange-as-fill, 44px targets, i18n | Not applicable yet — no UI built this pass (see §2). |

## 4. Test execution status (read before trusting any "passed" claim elsewhere)

- **Executed and passing, in this session:** the pure domain logic (`createDraftCard`, `assertSectionsEditable`, `isCardTemplateId`, `isNewerVersion`) was run directly via `tsx` outside the vitest/swc toolchain (5/5 checks passed) and the new `InMemoryEventBus` was run through the real `vitest` suite in `packages/shared` (7/7 new tests passed, 62/62 total in that package).
- **Written but NOT executed in this session:** `services/cards/tests/{card.domain,cards-http,read-model-sync}.spec.ts`. The same `@swc/core` native-binding failure documented in `docs/reviews/step-2-independent-verification.md` (a Windows ACL property of this machine's `AppData\Local`, unrelated to the code) blocks every vitest suite that needs NestJS decorator metadata, which includes all of `services/cards`. These files were hand-verified by: (a) `tsc --noEmit` against `src` + `tests` together (zero errors) via a temporary include-tests tsconfig, and (b) line-by-line review against the acceptance criteria and against the already-proven-correct organization-service patterns they mirror.
- **What this means:** treat the `cards-http.spec.ts`/`read-model-sync.spec.ts` suites as "ready to run, unverified by execution" until CI (Linux, no swc/ACL issue) runs them. If they fail there, that is new information, not a regression this report is hiding.

## 5. Gaps and follow-ups (explicitly not done, not silently skipped)

1. No `CardsFeature`/`CardEditor` UI yet (service + API layer only this pass).
2. Document section size/type validation (PDF ≤ 25 MB) not enforced — no upload endpoint exists yet.
3. No admin-facing setting to turn on `approvalRequired`; the state machine exists and is tested, the on/off switch doesn't.
4. Write endpoints don't yet accept `Idempotency-Key`.
5. Two pre-existing Step 2 event-contract gaps found while building this (hardcoded `aggregateVersion: 1` on branch/seat events; two incompatible `org.branding_updated` payload shapes) — logged to `docs/questions.md` Q-15/Q-16, worked around defensively here, not fixed at the source.
6. `GET /public/c/{slug}` (the actual visitor page data endpoint) is F12, not F10 — `CardsService.getPublicCardBySlug` exists as a building block but has no route yet.
