# F14: Employee invite and seat claim
Priority: Must     Build step: 4     Depends on: F08, F13
Source: P1-EMP-03, P1-EMP-01 (invite link), PRD v1.1 section 4.3

## User story
As an admin, I invite people into their seats. As an employee, I claim my seat and my card goes live.

## Acceptance criteria
- Admin invites by SMS, WhatsApp or email (through the `Notifier`). Invite link token is single-use, random, stored hashed, expires in 7 days, and can be resent or revoked.
- Claim: the invitee verifies the phone or email the invite was sent to (OTP), then sees the **privacy notice in plain language**: the company owns leads and card history; on leaving, the person keeps only their own public card details. They must accept to continue. Acceptance is recorded with timestamp, notice version, seat and person.
- A person who already has an account is linked to the new seat. One person may hold seats in several companies.
- After claim: complete profile (photo, designation if unlocked, contacts, bio), preview card, publish. If the company has `card_admin_approval` on, the card waits in "pending approval" and the admin is notified.
- Invite link for a seat that is already claimed shows a clear message and no data.
- Over-limit seats cannot be invited (`PlanLimits`). Message tells the admin to upgrade.
- Every action writes `audit.recorded`.

## States to design
Invite sent, expired, revoked, already claimed, wrong person (OTP fails), notice declined, profile incomplete, pending approval, live.

## API and events
`POST /seats/{id}:invite`, `POST /invites/{token}:claim`, `POST /seats/{id}/invite:revoke`, `GET /invites/{token}` (minimal data). Events: `seat.assigned`, `seat.updated`.

## Data
`Invite` (hashed token, seatId, channel, expiresAt, status), `NoticeAcceptance` (personId, seatId, version, acceptedAt).

## Tests required
Token single use and expiry, claim by wrong person, notice acceptance recorded, approval flow, over-limit block, no data leak on invalid token.

## Out of scope
HRMS sync, SCIM.
