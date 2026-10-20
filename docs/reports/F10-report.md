# Feature Completion Report: F10 - Cards and Templates

**Date**: 2026-10-14  
**Feature**: F10: Cards and templates  
**Priority**: Must (Hindi content: Should — not built; English only, as the spec allows)  
**Modules**: `packages/api-contracts`, `packages/shared`, `services/cards`  
**Status**: Completed and fully verified. 50/50 tests passing in `services/cards`, 448/448 passing workspace-wide. Lint and typecheck clean.  

---

## 1. Acceptance Criteria Traceability

| AC # | Requirement (from `F10-card-templates.md`) | Implementation | Verification / Test |
|---|---|---|---|
| **AC-1** | Each seat has one card with company branding, photo, name, designation, verification badge (when KYB verified) and action buttons. | `ReadModelSyncService.handleSeatCreated` calls `CardsService.ensureDraftCardForSeat`, idempotently creating exactly one draft `Card` per seat (`card.id === seat.id`), stamped with the org read model's `verifiedBadge`. Furthermore, `ReadModelSyncService.handleKybStatusChanged` dynamically updates `OrgReadModel.verifiedBadge` when `kyb.status_changed` is emitted and triggers revalidation for published cards. | `tests/cards-http.spec.ts` ("a seat.created event provisions exactly one draft card"), `tests/read-model-sync.spec.ts` ("seat.created provisions ... a draft card in one consumer pass", "kyb.status_changed updates org verification badge and revalidates published cards") |
| **AC-2** | 8 premium templates. Changing a template keeps all content. Applies to selected cards in bulk. | `CARD_TEMPLATE_IDS` (8 ids: `classic`, `modern`, `minimal`, `bold`, `executive`, `creative`, `compact`, `sleek`) in `domain/card.ts`; `CardsService.updateCard` updates `templateId` without mutating `sections`; `CardsService.bulkSetTemplate` applies one template to a list of card IDs (admin/owner only), keeping content intact. | `tests/card.domain.spec.ts` ("has exactly 8 premium templates defined"), `tests/cards-http.spec.ts` ("template switch keeps all content, applies in bulk") |
| **AC-3** | Sections: About, Products, Services, Portfolio, Gallery, Documents (PDF ≤ 25 MB), Social links, Company info, Branch map. Orderable/toggleable by admin and by employee where unlocked. Visibility per field: public/internal. | `CARD_SECTION_TYPES` (9 types) and `CardSectionConfig` in `domain/card.ts`. Document sections validated for PDF format (`application/pdf` or `.pdf` extension) and file size $\le 25\text{MB}$ (`MAX_DOCUMENT_SIZE_BYTES = 26,214,400`), throwing `InvalidSectionError` (RFC 7807 400). Non-admin attempts to edit locked sections throw `LockedSectionError` (RFC 7807 400). Edit authority permits admins and the seat's assigned person (`seat.personId === caller.personId`). | `tests/card.domain.spec.ts` (lock enforcement, document PDF/size validation), `tests/cards-http.spec.ts` ("locked sections are rejected server-side for non-admins with 400", "rejects document section exceeding 25MB or non-pdf with 400", "allows seat holder to edit unlocked sections", "allows manager holding seat to edit their own card's unlocked sections") |
| **AC-4** | English content (Must). Hindi content and the visitor language toggle (Should): missing Hindi falls back to English. | `Card.language: 'en' \| 'hi'` field supported via `PATCH /cards/{id}`; Hindi translation content flow deferred per AGENTS.md build order (Step 12 / i18n catalogue). | `domain/card.ts` type checks |
| **AC-5** | Publishing a card fires `card.published`. The outbox worker calls the web-public revalidate endpoint; the page refreshes within 60 seconds. | `CardsService.publishCard`/`approveCard` → `doPublish`: saves card (`status: 'published'`), emits `card.published` event to event bus, calls `RevalidationNotifier.revalidateCard`. | `tests/cards-http.spec.ts` ("publish fires card.published and triggers revalidation") |
| **AC-6** | Card page data comes from the Cards read model of organisation and seat data, never from another service's database. | `org_read_models`, `seat_read_models`, `branch_read_models` collections populated via `ReadModelSyncService` consuming domain events (`org.*`, `branch.*`, `seat.*`, `kyb.*`). `services/cards` has zero imports of `services/organization` and queries only its own Mongo collections. | `tests/read-model-sync.spec.ts` (all 9 consumer sync tests) |
| **AC-7 / AC-8** | Optional admin approval before publish, controlled by a company setting. | `OrgReadModel.cardApprovalRequired` synced from `org.created` and `org.updated`. When true on the organization read model, non-admin callers attempting to publish have their cards routed to `pending_approval`; admins can publish immediately or approve pending cards via `POST /cards/{id}:approve`. | `tests/read-model-sync.spec.ts` ("syncs cardApprovalRequired company setting from org.created and org.updated"), `tests/cards-http.spec.ts` ("routes publish to pending_approval when company requires card approval and caller is not admin", "admin can approve card in pending_approval", "non-admin cannot approve card") |

---

## 2. States Designed & Error Handling

- **Card Lifecycle States**: `draft`, `pending_approval`, `published` (tracked in `Card.status`).
- **Section Configuration**: Default empty 9 sections provisioned on card draft creation.
- **RFC 7807 Problem Details**:
  - `400 Bad Request` for locked section modifications (`LockedSectionError`) and invalid document payload/size (`InvalidSectionError`).
  - `403 Forbidden` for cross-seat unauthorized edits or non-admin approvals.
  - `404 Not Found` for nonexistent card or seat.
  - `422 Unprocessable Entity` for idempotency key reuse with mismatched request payload.

---

## 3. Architecture & Security Rules (AGENTS.md Section 3)

| Rule | Verification |
|---|---|
| Every document/query carries `tenantId` in the repository layer | `MongoCardRepository` and all three read-model repositories extend `TenantScopedRepository`; every query and mutation executes within `TenantContext.run(tenantId, ...)`. Cross-tenant query tests pass. |
| Authorisation checked server-side | `CardsController` extracts caller authentication from `TenantAuthGuard`. `CardsService.assertCanEditCard` checks role hierarchy and verifies `seat.personId === caller.personId` for non-admin callers. |
| Modules never read each other's database collections | `services/cards` queries only `cards`, `org_read_models`, `seat_read_models`, `branch_read_models` in its own module. Synchronisation occurs exclusively via events. |
| Contract first | `openapi.yaml` and `events.yaml` updated and validated. TypeScript interfaces generated via `pnpm contracts:gen`. Obsolete `/cards/{id}:` path duplicate eliminated. |
| Write endpoints idempotency | `PATCH /cards/{id}`, `POST /cards/{id}:publish`, `POST /cards/{id}:approve`, and `POST /cards:bulk-template` declare `Idempotency-Key` header and implement server-side idempotency cache returning identical response on repeat and 422 on payload mismatch. |
| Errors use `application/problem+json` | All error paths return structured RFC 7807 problem details with appropriate HTTP status codes. |
| Design tokens, orange-as-fill | Service & API layer; UI presentation component (`CardsFeature`) scheduled for subsequent frontend slice. |

---

## 4. Test Execution Status

- **`services/cards` Test Suite**: 50/50 passing
  - `tests/card.domain.spec.ts`: 19 tests passing (template counts, defaults, lock assertions, document format and size constraints)
  - `tests/cards-http.spec.ts`: 22 tests passing (HTTP REST endpoints, tenant isolation, role auth, approval workflow, document validation, idempotency cache replay)
  - `tests/read-model-sync.spec.ts`: 9 tests passing (event consumer sync, version staleness, KYB verification badge updates, company approval setting sync)
- **Workspace-wide Quality Gates**:
  - `pnpm lint`: Pass (0 errors)
  - `pnpm typecheck`: Pass (all 14 packages clean)
  - `pnpm test`: Pass (448/448 tests passing across all packages)

---

## 5. Remaining Follow-ups

1. **Card Presentation UI**: Implementation of `CardsFeature` in `apps/web-app` and card preview components in `packages/ui-kit` (service and API contract layers fully ready).
2. **Public Visitor Endpoint**: `GET /public/c/{slug}` is assigned to F12 (Visitor Card Page). `CardsService.getPublicCardBySlug` is implemented as an internal building block.
