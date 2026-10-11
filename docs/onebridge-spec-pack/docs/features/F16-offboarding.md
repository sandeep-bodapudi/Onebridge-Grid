# F16: Offboarding and handover
Priority: Must (handover summary: Should, founder may promote)     Build step: 4     Depends on: F14
Source: F3 in PRD v1.1 section 4.3, P1-EMP-05, P1-HAND-01, decision D3

## User story
As an admin, when someone leaves, their access ends at once, the company keeps every relationship, and visitors are guided to the right person.

## Acceptance criteria
- Admin chooses **Offboard** on a seat and picks what visitors see: (a) deactivated card with "no longer with the company, contact X"; (b) redirect to the successor's card; (c) redirect to the department or company page. If (b), a successor is required.
- **Access to company data is revoked within 1 minute**: sessions killed, refresh tokens revoked, push subscriptions revoked, and a wipe signal is sent to the person's installed My Card app.
- The seat, leads, share-back submissions, saved-contact history, card history and analytics **stay with the company** and move to the successor or manager.
- The NFC and QR short link is re-pointed to the chosen destination within 60 seconds; no re-encoding. Hardware reissue is optional.
- The departing person keeps **only** their own public card details (name, designation, contact details shown on their public card) as a personal export. No leads, no collected contacts, no notes, no analytics.
- Handover summary (admin only, within 5 seconds): counts of leads, saved contacts, share-back submissions and card views that stay; who takes over; the message visitors will see; confirmation that access was removed. Also emailed to the admin and recorded in the audit log. The person being offboarded cannot see it.
- Notifications: confirmation to admin and to the departing person (what they keep).
- Seat becomes `offboarded`; it can be assigned to a new person later without changing card URL or QR.
- Offboarding is confirmed with a summary dialog before executing. It cannot be undone, but the seat can be reassigned.

## States to design
Drawer (choice and successor), confirmation, in progress, summary with arc, failure of one step (shows which step retries), visitor pages for (a), (b), (c).

## API and events
`POST /seats/{id}:offboard`, `GET /seats/{id}/handover-summary`. Event: `seat.offboarded`.

## Tests required
Access dead within 60 s (with fake clock), leads unchanged and reassigned, visitor behaviour for all three options, export contains only public fields, summary hidden from the departing person, idempotent retry of each step.

## Out of scope
Admin override to let the person keep collected contacts (removed in v1.1).
