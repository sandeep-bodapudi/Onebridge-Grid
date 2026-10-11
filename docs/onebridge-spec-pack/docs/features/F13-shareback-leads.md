# F13: Share-back and leads
Priority: Must     Build step: 3     Depends on: F12
Source: P1-CARD-03, PRD v1.1 section 6.7

## User story
As a visitor, I share my details with the card owner. As the owner, I get a lead.

## Acceptance criteria
- Form fields: name and phone required; email, company, note optional; consent checkbox required with a link to the privacy notice.
- Submitting creates a `Lead` owned by the seat's company. The lead keeps its source (QR tag, NFC or link).
- Consent is recorded with timestamp, notice version and card.
- Owner is notified in under 10 seconds (notification delivery built in step 7; use the event and a fake notifier until then).
- Lead personal data is encrypted per ADR-0002 (one encrypted payload, per-tenant key, blind index for duplicates).
- Spam protection: Cloudflare Turnstile or equivalent, rate limits per IP and per card, duplicate detection by phone within 24 hours.
- On success the page shows an arc animation and a clear confirmation. Reduced motion shows a fade.
- Leads stay with the company when the seat is offboarded or reassigned.

## States to design
Validation errors, sending, success, rate-limited, offline (visitor): message that it will not send.

## API and events
`POST /public/c/{slug}/shareback`. Events: `shareback.submitted`, `lead.created`.

## Data
`Lead` (leadId, tenantId, cardId, ownerSeatId, source [shareback | manual | company_enquiry], encrypted payload and phoneBlindIndex per ADR-0002, consent, createdAt).

## Tests required
Consent required, encryption at rest, duplicate handling, rate limiting, lead survives reassignment, cross-tenant isolation.

## Out of scope
CRM pipeline, relationship graph, follow-up tasks (Phase 2).
