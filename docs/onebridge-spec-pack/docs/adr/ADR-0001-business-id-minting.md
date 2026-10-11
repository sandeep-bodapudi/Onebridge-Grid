# ADR-0001: Minting the Business ID and tenant ID
Date: 2026-10-09   Status: Accepted

## Context
Every company gets a permanent Business ID (`OB-<6 char base32>`). Identity and Organization are separate services. We must decide who mints it, who mints the internal tenant ID, and how the first login works.

## Decision
1. **Organization service mints both** the opaque `tenantId` (ULID) and the public `businessId`, during `POST /orgs`.
2. **Issued-ID registry:** an append-only collection `issued_business_ids` with a unique index. An ID is inserted here before the organization is saved. IDs are never removed. Organizations are soft-deleted only. This guarantees "never reused".
3. Generate the base32 string with a cryptographically secure random source. On collision, retry up to 5 times, then fail with a 503 and an alert.
4. `org.created` (versioned) carries `tenantId`, `businessId`, `creatorPersonId`.
5. **First-login consistency:** Organization calls Identity's internal API `POST /internal/memberships` synchronously, in the same request, to create the Owner membership (idempotent by `orgId + personId`). Identity also consumes `org.created` as a safety net. The client then calls `POST /auth/refresh` to receive a token containing the new membership. If the synchronous call fails, `POST /orgs` returns 503 and nothing is saved (the outbox event and the registry entry are rolled back together, or the entry is marked `void` and never reused).
6. **Student IDs** (`OB-S<6 char base32>`) are minted by Identity with its own registry `issued_student_ids`. Students are not organizations. A small `generateBase32Id()` helper lives in `packages/shared`, but uniqueness is enforced by the minting service.
7. Branch, department and seat numbers come from per-organization counters that only increase.

## Consequences
- Only Organization writes organization data; Identity owns memberships.
- A synchronous call from Organization to Identity is the one allowed exception to "events only" and is limited to this internal endpoint.
- Tests: concurrent creation, collision retry, no reuse after soft delete, Owner membership exists before the response returns.
