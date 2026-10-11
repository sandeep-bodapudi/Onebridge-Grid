# F27: Student plan
Priority: Should     Build step: 12     Depends on: F25, F10
Source: P1-STU-01 to -09, decision OPEN-B

## User story
As a verified student, I get a free personal professional card that I own.

## Acceptance criteria
- Student account: person-owned profile, one card, not tied to a company. ID `OB-S<6 char base32>` minted by Identity with its own registry (ADR-0001).
- Eligibility self-declared (institution, expected graduation year), then confirmed by both checks:
  - College email OTP; domain must be on the institution allowlist managed in the ops console; free-mail domains rejected.
  - College ID upload (front, back if needed), reviewed in the ops queue within 48 hours (95% of cases), approve or reject with reason, decision logged.
- Colleges with no official email domain: ID plus a second proof (bonafide letter or fee receipt), flagged for senior review.
- Controls: one active student plan per person (phone plus ID hash), rate limits, ID images in a separate encrypted bucket readable only by the ops review role and deleted 30 days after the decision, DPDP notice and consent recorded.
- Plan limits: 1 card, 2 templates, 5 catalogue or portfolio items, 7-day analytics, share-back notifications by email only, smaller keystone badge. Course and college come from verification and are locked after approval.
- Annual re-verification with a reminder 30 days before expiry. On lapse the card stays live read-only for 30 days, then shows a basic profile; one-click upgrade to Starter. Data is never deleted silently.
- The student owns the profile: export and delete (DPDP). If the student later joins a company, a separate seat is created; the personal card stays personal.
- Printed student card is not in MVP.
- Behind flag `student_plan`.

## States to design
Check pending, check failed (with reason), approved, lapsed, re-verify reminder.

## API and events
`POST /students/verify-email`, `POST /students/verify-email:confirm`, `POST /students/verify-id`, `GET|PATCH /students/me`. Event: `student.verification_decided`.

## Tests required
Allowlist, duplicate-identity detection, bucket access limited to ops review, 30-day deletion job, lapse timeline, locked fields, export and delete.

## Out of scope
Career profile (Phase 4), student printed cards.
