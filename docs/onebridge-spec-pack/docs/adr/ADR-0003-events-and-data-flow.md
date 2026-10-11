# ADR-0003: Domain events, analytics ingestion and read models
Date: 2026-10-09   Status: Accepted

## Decision
1. **Two separate paths.**
   - *Domain events* (SNS/SQS through the transactional outbox): state changes such as `org.*`, `seat.*`, `card.published`, `shareback.submitted`, `plan_limits.changed`.
   - *Analytics ingestion* (`POST /analytics/events`, batched, queue and replay): high-volume behaviour events (`card_viewed`, `qr_scanned`, `nfc_tapped`, `contact_saved`, `cta_clicked`, `doc_downloaded`). Never on the domain bus. Edge workers use this path.
2. **Event envelope:** `eventId`, `type`, `version`, `tenantId`, `occurredAt`, `correlationId`, `payload`, and `aggregateVersion` (monotonic per aggregate).
3. **Consumers are idempotent** (dedupe by `eventId`) and **ignore stale events** (apply only if `aggregateVersion` is greater than the stored one). If a gap is detected, the consumer re-fetches the aggregate through the owner's API.
4. **Read models.** The Cards service keeps denormalised copies of organization, branch and seat data needed to render cards and visitor pages. It never reads another service's database. Source events: `org.created`, `org.updated`, `org.branding_updated`, `branch.created|updated|archived`, `seat.created|updated|assigned|offboarded`, `kyb.status_changed`.
5. **Non-subscriber targets.** The Next.js app (`apps/web-public`) and the Cloudflare edge cannot subscribe to SNS. An outbox worker calls them over HTTPS: signed requests (HMAC with timestamp, 5 minute tolerance), retried with exponential backoff, idempotent by `eventId`. Targets: `POST /api/revalidate` on `web-public`, Cloudflare KV API for short-link records.
6. **Edge consistency.** Cloudflare KV is eventually consistent. Accepted maximum propagation for short-link status changes (repoint, disable, offboard) is **60 seconds**. The edge worker caches for at most 60 seconds. The neutral inactive page must never show personal data even if the cache is stale (it only shows a generic message when the status is not `active`).
7. **Audit.** Services emit `audit.recorded`. Sensitive fields (passwords, tokens, OTPs, personal data of visitors) are redacted *before* emission, because events sit in queues. Organization persists the entries.
8. Compatibility: add fields, never rename. Deprecation window is two releases.

## Event catalogue (Phase 1)
| Event | Publisher | Consumers |
|---|---|---|
| `user.registered` | identity | analytics |
| `org.created` | organization | identity, cards (read model), analytics |
| `org.updated` | organization | cards (read model) |
| `org.branding_updated` | organization | cards (read model, then revalidate) |
| `branch.created`, `branch.updated`, `branch.archived` | organization | cards (read model) |
| `seat.created`, `seat.updated` | organization | cards (read model), analytics |
| `seat.assigned` | organization | cards, identity, notifications |
| `seat.offboarded` | organization | identity (revoke access, wipe signal), cards (redirect, deactivate), notifications, analytics |
| `audit.recorded` | all services | organization |
| `kyb.status_changed` | identity | organization, cards (badge), notifications |
| `card.published` | cards | analytics; outbox calls web-public revalidate |
| `shortlink.created`, `shortlink.repointed`, `shortlink.status_changed` | cards | analytics; outbox calls Cloudflare KV |
| `shareback.submitted`, `lead.created` | cards | notifications, analytics |
| `plan_limits.changed` | payments | organization, cards, identity (MFA rule) |
| `subscription.status_changed` | payments | organization, cards (lapse), notifications |
| `invoice.issued` | payments | notifications |
| `nfc.order_status_changed` | payments | notifications |
| `nfc.chip_activated`, `nfc.chip_disabled` | cards | organization (audit), notifications, analytics |
| `student.verification_decided` | identity | cards, notifications |

## Consequences
Analytics outages never block cards or redirects. Stale read models are bounded by event lag and repaired by version checks.
