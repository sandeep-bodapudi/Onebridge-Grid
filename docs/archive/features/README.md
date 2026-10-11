# Feature files

One file per feature. Give the agent one file per task.

## File template

```
# <ID>: <name>
Priority: Must | Should | Could     Build step: N     Depends on: <ids>
Source: PRD requirement IDs

## User story
## Acceptance criteria
## States to design
## API and events
## Data
## Tests required
## Out of scope
```

## Index

| Step | File | Priority |
|---|---|---|
| 1 | F01-auth.md | Must |
| 1 | F02-tenancy-rbac.md | Must |
| 1 | F03-business-id.md | Must |
| 1 | F04-audit-log.md | Must |
| 1 | F05-ui-kit-tokens.md | Must |
| 2 | F06-company-profile.md | Must |
| 2 | F07-org-structure.md | Must |
| 2 | F08-seats.md | Must |
| 2 | F09-brand-kit.md | Must |
| 3 | F10-card-templates.md | Must |
| 3 | F11-short-links-qr.md | Must |
| 3 | F12-visitor-page.md | Must |
| 3 | F13-shareback-leads.md | Must |

## Still to write (steps 4 to 12)

F14 employee invite and seat claim, F15 CSV import and bulk actions, F16 offboarding and handover summary,
F17 plans and subscriptions, F18 GST invoices and lapse, F19 NFC catalogue and orders, F20 printed card
artwork and proofs, F21 NFC activation and lost cards, F22 notifications, F23 analytics, F24 My Card PWA,
F25 ops console (KYB, NFC fulfilment, moderation), F26 public company profile, F27 student plan,
F28 hardening (performance, accessibility, security, DPDP flows).
