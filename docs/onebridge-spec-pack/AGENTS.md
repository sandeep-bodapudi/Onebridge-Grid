# OneBridge Grid: Project Instructions for the Coding Agent

Read this file at the start of every session. If anything here conflicts with another document, this file wins. If something is not covered here or in the spec, **ask. Do not invent requirements.**

## 1. What we are building

OneBridge Grid is a digital business identity platform for Indian businesses. The company owns the identity, the cards and the relationships. Employees are custodians. We are building **Phase 1 only**: company onboarding, organisation and seats, digital cards with QR and NFC, a public visitor card page, the My Card PWA, an admin dashboard, an ops console, billing, notifications and basic analytics.

Core promise: a scan or tap becomes a saved contact and a company-owned lead, with no app or login for the visitor.

### Source of truth, in order
1. This file
2. `docs/decisions.md` (resolved questions)
3. `docs/adr/*.md` (accepted architecture decisions)
4. `docs/features/*.md` (one file per feature, with acceptance criteria). These are the authoritative requirements.
5. `docs/PLAN.md` (order, dependencies and exit gates only; it holds no requirements)
6. PRD v1.1, then PRD v1.0 (only for sections v1.1 does not replace), in `docs/spec/`
7. UI/UX Specification and Printed Card Designs (visual rules and states), in `docs/spec/`

Earlier plans and month schedules are **superseded**. Follow the build order in section 8 and `docs/PLAN.md`.

## 2. Resolved decisions (change here if the founders decide otherwise)

| Topic | Decision |
|---|---|
| Repo model | **One workspace** with strict module boundaries. Folder names match the planned repos so we can split later. This replaces the 15-repo plan. |
| Free plan | None. Paid plans only (Starter, Business; Enterprise is contact-sales). Verified students are the only free users. |
| 14-day trial (OPEN-A) | Not built. Make the payment step movable behind a feature flag (`payment_after_first_card`). |
| Student verification (OPEN-B) | Both college email OTP and college ID required. Fallback for colleges with no email domain goes to senior review. |
| Scope cuts (OPEN-C) | Deferred: custom template builder, wallet passes, auto-translate, native NFC, SSO/SAML. |
| PWA manifest (OPEN-D) | One OneBridge manifest for all customers. |
| MFA | Optional for users. **Mandatory** for Owner and Admin roles on Business plan and above. |
| Phase 1 leads | A lightweight `Lead` owned by the Cards module (created from share-back and enquiries). **No Relationship graph, no Contact entity.** Those are Phase 2. |
| Share-back fields | name, phone (required); email, company, note (optional); consent checkbox (required). |
| Printed cards in MVP | Small business, medium employee and owner families. Large-employee and student printed cards are not in MVP. |
| Metal cards | QR-only design. NFC is not guaranteed on metal. |

## 3. Non-negotiable rules

**Data and security**
- Every database document and query carries `tenantId`. It is enforced in the repository layer, never only in controllers.
- Authorisation is checked **server-side** by tenant and role scope. The UI only hides what the server already denies.
- Seats belong to the company. Offboarding never deletes leads, saved-contact history, analytics or card history. The departing person keeps only their own public card details.
- No personal data in logs, push payloads or analytics event names.
- Phone and email of visitors are encrypted at rest. Offline lead data on the device is encrypted with a non-extractable WebCrypto key.
- Access token in memory only. Refresh token in an httpOnly, Secure, `SameSite=Lax` cookie. Never put tokens or lead data in localStorage.
- Student ID images go to a separate encrypted bucket, readable by the ops review role only, deleted 30 days after the decision.
- Record consent (share-back, seat-claim notice) with a timestamp and notice version.
- Short links are **immutable**. Only the destination can be re-pointed.
- Disabled and unactivated chips resolve to a neutral page that shows no personal data.

**API and architecture**
- Contract first: change the OpenAPI spec or event schema in `packages/api-contracts` before changing code. Generate clients from it.
- Write endpoints accept an idempotency key. Events are at-least-once, so consumers must be idempotent.
- Modules never read each other's database collections. They call the module's public API or consume its events.
- Errors use `application/problem+json`. Lists are paginated. Every request carries a correlation ID.
- Additive changes only. Never rename or remove a field in the same change that adds its replacement.
- Anything user-visible and unfinished goes behind a feature flag.

**Design**
- Use tokens from `packages/ui-kit`. Never hard-code a colour, radius or spacing value.
- **Orange is a fill, never a text colour.** Orange buttons carry charcoal text. Orange text or icons on light backgrounds use Deep Orange `#A04E08`. White text on orange fails contrast.
- Brand-kit colours chosen by customers must pass a contrast check. If not, warn and auto-pick a readable text colour.
- Touch targets are 44 px or more. Status is never colour alone (always icon or word).
- Respect `prefers-reduced-motion`: arcs become a 150 ms fade.
- Copy: sentence case, plain words, active verbs. Errors say what happened and how to fix it.
- English and Hindi in Phase 1. No hard-coded strings; use the i18n layer. Indian number formatting (12,48,000).

## 4. Stack

- TypeScript strict mode everywhere. pnpm workspaces.
- Backend: Node.js, NestJS, REST with OpenAPI 3.1.
- Data: MongoDB (identity, organisation, cards, notifications), PostgreSQL with Prisma (payments only), Redis and BullMQ (cache, jobs), ClickHouse (analytics; use a simple events table locally).
- Messaging: an internal event bus interface with an SNS/SQS adapter for production and an in-memory adapter for local and tests.
- Frontend: Next.js (App Router, ISR) and React, Tailwind with ui-kit tokens, Serwist for the service worker.
- Edge: Cloudflare Worker for short-link redirect.
- Auth: OTP (MSG91), Google and Microsoft OAuth. Short-lived JWT plus rotating refresh token.
- Payments: Razorpay (UPI, cards, netbanking). GST invoices.
- Tests: Vitest or Jest (unit), Playwright (end to end), Pact or schema-based contract tests.
- External providers (MSG91, WhatsApp, Razorpay, GST API, Shiprocket) sit behind interfaces with a fake adapter for local and tests. **Never call a real provider in tests.**

## 5. Workspace layout

```
apps/
  web-public/        visitor card pages and public company profile
  web-app/           admin dashboard + My Card PWA (feature modules)
  admin-console/     internal ops
services/
  identity/  organization/  cards/  payments/  notifications/  analytics/
edge/
  shortlink/         Cloudflare Worker
packages/
  ui-kit/            tokens, components, Storybook
  api-contracts/     OpenAPI, event schemas, generated clients
  shared/            small utilities only
docs/
  decisions.md  features/  adr/
```

- `apps/web-app/src/features/*` modules may not import each other. They import only from `shared/` or another module's public `index.ts`. Enforce with an ESLint boundaries rule.
- A service may import only `packages/*`, never another service's source.

## 6. Commands

The agent fills this in after scaffolding and keeps it current. It must always be possible to run these from the repo root:

```
pnpm install
pnpm dev            # start everything locally with fake providers
pnpm lint
pnpm typecheck
pnpm test           # unit and integration
pnpm test:e2e       # Playwright
pnpm contracts:gen  # regenerate clients from OpenAPI
```

## 7. Working protocol (every task)

1. **Plan first.** Write a short plan listing files to change, contracts affected and tests to add. Wait for approval on anything that touches a contract, a data model or a rule in section 3.
2. **One feature file per task.** Work only on the feature named. Do not touch other modules except through their public API.
3. **Tests first** for the acceptance criteria, then the code. Include the failure and edge cases, not only the happy path.
4. **Design every state**, not only the happy path: loading, empty, error, offline, plus any states listed in the feature file.
5. **Small diffs.** Prefer many small commits (Conventional Commits) over one large change.
6. **Stop and ask** if the spec is silent, two documents disagree, or a rule in section 3 would be broken.
7. **Log decisions.** Append anything you decided on your own to `docs/decisions.md` with a date and reason.
8. **Never** disable a test, skip a lint rule or weaken a check to get green. Report the problem instead.

### Definition of done
- Acceptance criteria met and covered by tests; `pnpm lint`, `typecheck` and `test` green.
- Contract updated, clients regenerated, no breaking change.
- Cross-tenant isolation test added for any new data access.
- States designed; accessibility checked for UI changes.
- Telemetry added (structured logs, trace, product event) without personal data.
- Behind a feature flag if not ready for users.
- Docs and `docs/decisions.md` updated.

## 8. Build order (by dependency, not by calendar)

Finish and review each step before starting the next.

1. **Foundation:** workspace, tokens and `ui-kit`, auth (OTP, OAuth), tenant model, RBAC, audit log, Business ID, fake provider adapters, CI.
2. **Organisation and seats:** company, branches, departments, teams, seats, brand kit with contrast validation.
3. **Cards and short links:** card CRUD, 8 templates, sections, QR (branded, source-tagged), edge redirect, visitor page with all states, vCard, share-back and Lead, spam protection on share-back.
4. **Employees:** invite and seat claim (with recorded privacy notice), CSV import, bulk actions, offboarding, handover summary, personal export of public card details.
5. **Billing:** Razorpay subscriptions, plan limits, GST invoices, proration, dunning, over-limit read-only, plan-lapse behaviour.
6. **NFC and printed cards:** artwork and proofs first (F20), then catalogue and orders (F19), then activation and lost chips (F21).
7. **Notifications:** email, SMS (DLT templates), WhatsApp, in-app, web push, preferences, quiet hours, fallback channels.
8. **Analytics:** batched ingestion, aggregates, dashboards scoped by role, retention by plan.
9. **My Card PWA:** manifest, offline QR, lead sync queue, push, install flow, controlled update, cache wipe.
10. **Ops console:** KYB queue, NFC fulfilment, moderation, consented impersonation.
11. **Public company profile:** catalogue with enquiry, portfolio, gallery, documents, SEO and structured data.
12. **Student plan (Should), then hardening:** performance, accessibility, security review, DPDP export, delete and grievance flows.

## 9. Event and data flow

Follow `docs/adr/ADR-0003-events-and-data-flow.md` exactly. Analytics events never use the domain bus. Cards keeps read models of organisation and seat data. Outbox calls to web-public and the edge are signed and retried.

## 10. Out of scope for Phase 1

Custom template builder, Apple and Google Wallet passes, auto-translate, native mobile apps and in-app NFC read or write, CRM pipeline, connections and directory, messaging, communities, reviews, AI features, marketplace, career profiles, HRMS native connectors, enterprise SSO (SAML, org-level OIDC, SCIM), free plan (except verified students), trial. Google and Microsoft personal sign-in are in scope.

## 11. Gap policy: what to do when something is not specified

**Silence in the spec is not permission.** Classify every unknown before acting.

| Class | What it is | What you do |
|---|---|---|
| **A. Specified** | The answer is in a source of truth file | Follow it. Cite the file and requirement ID in the plan and, where non-obvious, in code comments. |
| **B. Free detail** | Invisible to users and to other modules: private function and variable names, internal file layout inside one module, formatting, choosing between equivalent helpers already in the stack | You may decide. Keep it consistent with surrounding code. |
| **C. Needs a decision** | Anything affecting user-visible behaviour, wording, numbers (limits, timeouts, prices, retries), permissions, data fields or schemas, API or event shapes, security or privacy, a new dependency or provider, scope, or a state that is not listed | **Do not decide.** Stop work on that part, write the question in `docs/questions.md`, and continue only with parts that are not blocked. |

Rules:
- If a feature file states a default, use it. If it does not, ask.
- Never invent field names, endpoints, error codes, copy, limits, colours or acceptance criteria. If the criteria need a contract detail the feature file does not give, **propose it in the contract change inside your plan** and wait for approval.
- Never mark an item done if part of it was skipped. List skipped parts explicitly.
- If two sources disagree, follow the higher one in section 1 and record the conflict in `docs/questions.md`.
- If a requirement seems wrong or unsafe, say so in the plan. Do not silently change it.

`docs/questions.md` format (one block per question):
```
Q-<n> | <feature id> | <date>
Question:
Why it matters:
Options (with your recommendation):
Blocked work:
```

## 12. Spec pack index

`docs/decisions.md`, `docs/adr/` (ADR-0001 to 0003), `docs/features/` (F00 to F28), `docs/PLAN.md`, `docs/agent-prompts.md`, `docs/spec/` (PRDs, UI/UX specification, printed card designs, reference PNGs).
