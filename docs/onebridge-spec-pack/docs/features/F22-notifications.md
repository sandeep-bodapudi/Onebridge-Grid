# F22: Notifications
Priority: Must (digests, 24-hour reminder: Should)     Build step: 7     Depends on: F13, F17
Source: P1-NOT-01, -02, -03, P1-HAND-02, PRD v1.1 section 7.5

## User story
As a user, I am told about the things that matter, through the channel I prefer.

## Acceptance criteria
- Channels: in-app, email, SMS (DLT-registered templates), WhatsApp Business. Web push **sending** is built here; **subscription and permission** are built in F24.
- Events: new lead, invite, approval request, card saved milestone, NFC order status, billing and invoice, security alert, KYB decision, offboarding confirmation.
- Per-user preferences by event and channel, quiet hours, opt-out. Security alerts and legal notices ignore quiet hours.
- **New-lead notification reaches the owner in under 10 seconds.**
- Fallback routing: push unavailable or denied (including iPhone not installed) falls back to WhatsApp, SMS or email per preference.
- Push payloads contain only a title and a deep link, never phone or email.
- Templates in English and Hindi with versioning and a delivery log (status, provider id, retries with backoff).
- The `Notifier` fake is replaced by real adapters behind the same interface; real providers never run in tests.
- Should: reminder when a lead is untouched for 24 hours (opt-out), daily or weekly digest.
- No marketing messages in Phase 1; DND respected.

## States to design
Notification centre, preferences page, delivery failure notice (admin).

## API and events
`GET|PATCH /notification-preferences`, `GET /notifications`, internal `POST /internal/notify`. Consumes events from ADR-0003 catalogue.

## Tests required
Latency under 10 s with fake provider timing, fallback order, quiet hours, payload contains no PII, retry and idempotency.

## Out of scope
Marketing campaigns, in-app chat.
