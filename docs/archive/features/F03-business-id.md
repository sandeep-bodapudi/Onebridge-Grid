# F03: OneBridge Business ID
Priority: Must     Build step: 1     Depends on: F01, F02
Source: P1-ID-01

## User story
As a business owner, my company gets a permanent ID that identifies it everywhere.

## Acceptance criteria
- Format `OB-<6 char base32>`, for example `OB-7KQ2MX`. Unique across the platform, immutable, never reused, even after deletion.
- Generated when the organisation is created. Retries safely on collision.
- Shown in admin settings, the admin left rail footer and the public profile.
- Branch, department and seat IDs derive from it (`-B03`, `-D07`, `-E0142`). Counters never reuse a number.
- Students use `OB-S<6 char base32>`.

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
