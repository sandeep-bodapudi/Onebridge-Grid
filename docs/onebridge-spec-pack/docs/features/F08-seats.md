# F08: Seats and people
Priority: Must     Build step: 2     Depends on: F07
Source: P1-ID-05, PRD v1.0 section 8.2

## User story
As a company, each employee identity is a seat I own, and people are assigned to it.

## Acceptance criteria
- A seat holds title, branch, department, team, manager, status and the card, QR and chip bindings. A person is assigned to a seat.
- Reassigning a seat to another person keeps the card URL, QR, NFC binding, analytics history and leads.
- Seat statuses: invited, active, inactive, offboarded.
- Seat limit comes from the plan. Over-limit seats become read-only, never deleted.
- Seat ID format `<BusinessID>-E<nnnn>`.
- An admin can create a seat without a person (vacant) and assign later.

## States to design
Vacant seat, invited, over-limit read-only.

## API and events
`POST /orgs/{id}/seats`, `PATCH /seats/{id}`, `POST /seats/{id}:assign`. Events: `seat.created`, `seat.assigned`.

## Data
`Seat`, `Person`.

## Tests required
Reassignment preserves card and QR, over-limit behaviour, seat ID uniqueness.

## Out of scope
Invites and claim flow (F14), offboarding (F16).
