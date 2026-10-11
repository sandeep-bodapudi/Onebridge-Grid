# Feature files

One file per feature. Give the agent exactly one file per task. These files are the authoritative requirements. `docs/PLAN.md` lists only IDs, priorities and order.

## Template
```
# <ID>: <name>
Priority / Build step / Depends on / Source
## User story
## Acceptance criteria
## States to design
## API and events
## Data
## Tests required
## Out of scope
```

## Index (build order)
| Step | File | Priority |
|---|---|---|
| 1 | F00-platform.md | Must |
| 1 | F05-ui-kit-tokens.md | Must |
| 1 | F01-auth.md | Must |
| 1 | F02-tenancy-rbac.md | Must |
| 2 | F06-company-profile.md (mints Business ID per ADR-0001, includes F03) | Must |
| 2 | F03-business-id.md | Must |
| 2 | F07-org-structure.md | Must (teams, org chart: Should) |
| 2 | F08-seats.md | Must |
| 2 | F09-brand-kit.md | Must |
| 2 | F04-audit-log.md | Must |
| 3 | F10-card-templates.md | Must (Hindi: Should) |
| 3 | F11-short-links-qr.md | Must (source tags: Should) |
| 3 | F12-visitor-page.md | Must |
| 3 | F13-shareback-leads.md | Must |
| 4 | F14-invite-seat-claim.md | Must |
| 4 | F15-csv-import-bulk.md | Must |
| 4 | F16-offboarding.md | Must (handover summary: Should) |
| 5 | F17-plans-subscriptions.md | Must |
| 5 | F18-invoices-lapse.md | Must |
| 6 | F20-printed-card-artwork.md (first) | Must |
| 6 | F19-nfc-catalogue-orders.md | Must |
| 6 | F21-nfc-activation-lost.md | Must |
| 7 | F22-notifications.md | Must |
| 8 | F23-analytics.md | Must |
| 9 | F24-my-card-pwa.md | Must |
| 10 | F25-ops-console.md | Must |
| 11 | F26-public-company-profile.md | Must |
| 12 | F27-student-plan.md | Should |
| 12 | F28-hardening.md | Must |
