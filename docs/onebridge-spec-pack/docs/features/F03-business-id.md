# F03: OneBridge Business ID
Priority: Must     Build step: 1     Depends on: F01, F02
Source: P1-ID-01

## User story
As a business owner, my company gets a permanent ID that identifies it everywhere.

## Acceptance criteria
- Format `OB-<6 char base32>`, for example `OB-7KQ2MX`. Unique across the platform, immutable, never reused, even after deletion.
- Minted by the Organization service during `POST /orgs`, together with the opaque `tenantId` (ADR-0001). Uses an append-only issued-ID registry. Retries safely on collision.
- Shown in admin settings, the admin left rail footer and the public profile.
- Branch, department and seat IDs derive from it (`-B03`, `-D07`, `-E0142`). Counters never reuse a number.
- Students use `OB-S<6 char base32>` (Should, built in F27). Minted by Identity with its own registry (ADR-0001).

## States to design
Business ID display with copy button.

## API and events
`POST /orgs` returns the ID. Event: `org.created`.

## Data
`Organization.businessId` with a unique index. Counter documents for branch, department and seat numbers.

## Tests required
Uniqueness under concurrent creation, no reuse after delete, format validation.

## Out of scope
Custom vanity IDs.
