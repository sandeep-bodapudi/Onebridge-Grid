# F04: Audit log
Priority: Must     Build step: 1     Depends on: F02
Source: P1-ORG-08

## User story
As an admin, I can see who did what and when, and prove it.

## Acceptance criteria
- Every admin action writes an entry: actor, action, entity, before, after, timestamp, IP.
- Entries are append-only. No update or delete path exists, in code or in database permissions.
- Filter by actor, action, entity and date. Export to CSV, respecting role scope.
- Retention by plan: Starter 90 days, Business 1 year, Enterprise 2 years or more.
- Passwords, tokens and OTPs never appear in before/after.

## States to design
Empty log, filtered with no results, export in progress.

## API and events
`GET /orgs/{id}/audit`, `GET /orgs/{id}/audit:export`. Services emit `audit.recorded` events through the outbox (ADR-0003) after redacting sensitive fields; Organization persists them.

## Data
`AuditLog` (immutable).

## Tests required
No update or delete possible, sensitive fields redacted, scope respected on export, retention job.

## Out of scope
Audit log streaming to a customer SIEM.
