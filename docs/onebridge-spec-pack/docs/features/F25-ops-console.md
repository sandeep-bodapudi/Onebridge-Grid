# F25: Ops console
Priority: Must (feature-flag console: Should)     Build step: 10     Depends on: F19, F21
Source: P1-ADM-01 to -05, P1-ID-03, P1-NFC-07, ID-04

## User story
As OneBridge ops staff, I verify businesses, fulfil NFC orders and keep the platform safe.

## Acceptance criteria
- Desktop only, separate app (`apps/admin-console`), separate login with mandatory MFA, ops roles: Ops Reviewer, Fulfilment, Support, Super Admin. Every action is audited.
- **KYB queue:** GSTIN validated through the GST verifier (fake locally); legal-name match; mismatches go to manual review with a document viewer, SLA timer, reviewer assignment, decision with reason, decision log. Status Pending, Verified or Rejected. Badge only when Verified; revoked automatically if verification lapses. Event `kyb.status_changed`.
- **NFC fulfilment:** order queue, vendor assignment, encoding batch (NDEF URL to short link, write-lock), QC checklist (includes the CMYK and physical proof check from F20), dispatch with courier and tracking, customer status timeline, SLA breach alerts.
- **Tenant management:** search organisations; view plan, usage and health. Must.
- **Impersonation (Must, P1-ADM-01):** requires a reason, is time-boxed, logged, visible to the customer admin, and needs customer consent.
- **Moderation:** report-abuse intake from card pages, takedown workflow, review within 24 hours.
- Should: feature flags and plan configuration without deploy, per-tenant overrides.
- Student verification queue is built in F27 inside this console.

## States to design
Queue empty, SLA warning, document viewer failure, decision confirmation.

## API and events
Internal admin APIs with ops RBAC. Events: `kyb.status_changed`, `nfc.order_status_changed`.

## Tests required
Ops role scopes, impersonation limits and visibility, badge revocation, SLA timers, customers can never reach ops endpoints.

## Out of scope
Customer-facing support chat.
