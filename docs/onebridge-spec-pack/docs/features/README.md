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

## Track B: business identity network (D-NETWORK, D-CONTACT, added 2026-10-26)
Built in parallel with Steps 4 onward. Plan and validation: `docs/plans/business-network-plan.md`. Each file lists its open questions; those parts wait for a founder decision.

| Phase | File | Priority |
|---|---|---|
| N-1 | N01-member-profiles.md | Must |
| N-1 | N02-free-company-profiles.md | Must |
| N-1 | N03-directory-search.md | Must |
| N-1 | N04-follow.md | Must |
| N-1 | N08-realtime-chat.md | Must |
| N-1 | N11-request-a-call.md | Must |
| N-1 | N09-moderation-safety.md (basics; grows each phase) | Must |
| N-1 | N10-privacy-data-rights.md | Must |
| N-2 | N05-posts-feed.md | Must |
| N-3 | N06-relationships-endorsements.md | Must |
| N-4 | N07-requirements-matching.md | Should |

Track B changes two existing features: F12 (visitor card: Chat and Request a call instead of Call and WhatsApp; vCard without phone and email) and F13 (share-back becomes a call request or first chat message). Those changes are written in N11 and N08; F12 and F13 will be revised when N-1 starts.

Track B also needs F22 (notifications) earlier than Step 7, because chat, call requests and follows notify people. Bring F22's in-app and push channels forward into N-1.
