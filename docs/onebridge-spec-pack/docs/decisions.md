# Decisions log

The coding agent treats this file as final. If something here is wrong, change it here first.
Append new decisions at the bottom, with date, decision and reason.

## Resolved decisions

| ID | Topic | Decision | Source |
|---|---|---|---|
| D1 | Repo model | One workspace with strict module boundaries. Folders mirror the planned repos so we can split later. Replaces the 15-repo plan. | Founder, 9 Oct 2026 (reverses PRD v1.1 D1) |
| D2 | Free plan | None. Starter and Business are paid. Enterprise is contact-sales. Verified students are the only free users. | PRD v1.1 D2 |
| D3 | Offboarding | Departing person keeps only their own public card details. Leads, saved-contact history, analytics and card history stay with the company. | PRD v1.1 D3 |
| D4 | Dashboard | One app with feature modules and no cross-module imports. | PRD v1.1 D4 |
| D5 | PWA | My Card only. Visitor page is not a PWA. Admin dashboard is online-only. | PRD v1.1 s7 |
| OPEN-A | 14-day trial | Not built. Payment step must be movable behind flag `payment_after_first_card`. | Default |
| OPEN-B | Student verification | College email OTP and college ID both required. No-email-domain colleges go to senior review with a second proof. | Default |
| OPEN-C | Scope cuts | Deferred: custom template builder, wallet passes, auto-translate, native NFC, SSO/SAML. | Default |
| OPEN-D | PWA manifest | One OneBridge manifest for all customers. | Default |
| M1 | MFA | Optional for users. Mandatory for Owner and Admin on Business plan and above. | PRD v1.0 P1-ID-02, section 16.3 |
| L1 | Phase 1 leads | Lightweight `Lead` owned by Cards. No Relationship graph, no Contact entity (Phase 2). | PRD v1.1 s3 |
| S1 | Share-back fields | Required: name, phone, consent. Optional: email, company, note. | Default |
| C1 | Printed card families in MVP | Small business, medium employee, owner. Large-employee and student printed cards are later. | Default |
| C2 | Metal cards | QR-only design. NFC not guaranteed on metal. | Default |
| P1 | Student card cost | Student printed card is not in MVP, so no decision needed yet. | Default |
| T1 | Business and tenant IDs | Organization mints `tenantId` and `businessId`; Identity mints student IDs `OB-S...`. See ADR-0001. | ADR-0001 |
| T2 | Lead encryption | AES-256-GCM single encrypted payload, per-tenant key, per-tenant HMAC blind index. See ADR-0002. | ADR-0002 |
| T3 | Event model | Domain events via outbox; analytics on a separate ingestion path; read models in Cards; signed outbox calls to web-public and the edge. See ADR-0003. | ADR-0003 |
| T4 | Edge consistency | Short-link status changes reach the edge within 60 seconds (accepted). | ADR-0003 |
| T5 | Refresh cookie | `SameSite=Lax`. | F01 |
| T6 | SSO scope | Out of scope: enterprise SSO (SAML, org-level OIDC, SCIM). In scope: Google and Microsoft personal sign-in. | AGENTS.md |
| T7 | Hindi, QR source tags | Should (English and one QR per card are Must). | PRD v1.0 |
| T8 | Handover summary | Should, per PRD. Founder may promote to Must. | PRD v1.1 |
| T9 | Impersonation | Must (PRD P1-ADM-01), with consent, reason, time limit, visible to customer admin. | PRD v1.0 |
| T10 | Quality gates | Tenant isolation, contrast, Lighthouse and accessibility budgets run in CI from the step that introduces the code. | F00 |
| T11 | Student ID minting | Identity, own registry, built in F27. | ADR-0001 |

## Still open (agent must ask, not guess)

| ID | Question | Owner |
|---|---|---|
| Q5 | Domains `grid.onebridge.in` and `obg.in` available? Legal entity name for invoices? | Founders |
| Q10 | Team size, budget, GA date | Management |
| OPEN-GATEWAY | API gateway: Kong or AWS API Gateway | Engineering |
| OPEN-PAYDB | Payments database: PostgreSQL or MySQL (default PostgreSQL with Prisma) | Engineering |
| V1 | Closed beta target: 20-50 orgs or 50+ paying | Founders |
| V2 | Verify page for large-employee card: what it reveals (deferred, card not in MVP) | Product, Legal |

## Decisions made by the agent

(Agent appends here: date, decision, reason.)
