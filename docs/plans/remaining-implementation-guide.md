# OneBridge Grid: implementation guide for the remaining work

Date: 2026-10-27. Written after N08 (commit `71d5cd9`).

This guide is the order and the method for building everything that is left. Each feature file in `docs/onebridge-spec-pack/docs/features/` stays the source of truth for **what** to build; this guide says **how and in which order**, and lists the traps already found while building F14, N01 to N04 and N08.

---

## 1. Where we are

**Done and pushed (both remotes, `onebridge/main` = `feat/step-3-cards-f10`):**

| Area | Features |
|---|---|
| Foundation and core | F00 to F13 (auth, tenancy, RBAC, Business ID, audit, UI kit, company, structure, seats, brand kit, cards, short links and QR, visitor page, share-back leads) |
| Employees | F14 invite and seat claim |
| Public company page | F26 |
| Network, phase N-1 | N01 member profiles, N02 free company profiles and access requests, N03 directory and search, N04 follow, N08 real-time chat |
| Hosting | One Render web service (`scripts/single-build.mjs`, `scripts/single-server.mjs`), demo data seeded on every start |

**Left to build:**

- **Track A (sellable core):** F15, F16, F17, F18, F19, F20, F21, F22, F23, F24, F25, F27 (Should), F28.
- **Track B (network):** N11, N09, N10 (finish phase N-1), then N05 (N-2), N06 (N-3), N07 (N-4).
- **Debt carried from earlier steps** (section 6).

**Existing empty or draft folders:** `services/analytics`, `services/media`, `services/notifications`, `services/payments` and `apps/admin-console` contain only a `package.json`. `services/moderation` has an in-memory draft (service, controller, module, no `package.json`, no repositories, not in git history). Treat all of them as starting points, not finished work.

---

## 2. The recipe for every feature

Follow this for each step below. It is `.agent/AGENTS.md` section 7 plus what we learned.

### 2.1 Before code
1. Read the feature file end to end, plus every feature it depends on.
2. List the open questions in the feature file. Answer them from `docs/decisions.md` or the plan; if they are still open, **ask the founder** before building that part (AGENTS.md: "stop and ask").
3. Decide which service owns the data (one owner per collection; services never read another service's database, ADR-0003). Prefer an existing service when the data clearly belongs there.

### 2.2 Contract first
1. Add or change endpoints in `packages/api-contracts/network.yaml` (network features) or `openapi.yaml` (core), and events in `events.yaml`.
2. Run `pnpm contracts:gen` and **read its output**. A YAML flow map that contains `{braces}` in a text value silently produced nothing once; quote such text.
3. Export new types from `packages/api-contracts/src/index.ts` (check for duplicates).

### 2.3 Data
1. Register every new collection in `packages/shared/src/mongo/collection-registry.ts`.
2. Tenant data uses `TenantScopedRepository` inside `TenantContext.run(tenantId, ...)`. Cross-tenant data (members, follows, conversations) uses `GlobalRepository` and must be **approved by name** in `packages/shared/tests/collection-classification.spec.ts` with a comment that cites the decision.
3. Rebuild shared (`pnpm --filter @onebridge/shared build`) before service tests, or the registry change is not seen.
4. Personal data that is not public (phones, emails, message text) is encrypted at rest with the key vault (`LocalKeyVaultProvider` now, ADR-0002), with an AAD that binds the ciphertext to its record. Events carry IDs only.

### 2.4 A new service (copy `services/messaging` or `services/social`)
A new service is wired in **all** of these places, or it works locally and breaks on Render:

| File | What to add |
|---|---|
| `services/<name>/` | `package.json`, `tsconfig.json`, `vitest.config.ts`, `src/{app,main,index,<name>.module}.ts`, `config/env.ts` |
| `scripts/dev.mjs` | port in `PORTS`, `--filter` in the build line, `importDist`, `createApp` **before organization** if it listens to org events |
| `scripts/demo-server.mjs` | `TARGETS`, `importDist`, `createApp`, the route regex, seed env (`<NAME>_URL`), and `proxyUpgrade` if it uses WebSockets |
| `scripts/single-server.mjs` | the `/svc/(...)` regex; admin path list if the app gets a new top-level route |
| `scripts/single-build.mjs` | `--filter` in the build line and `NEXT_PUBLIC_<NAME>_API_URL: '/svc/<name>'` |
| `apps/web-app/next.config.mjs` | the service name in the rewrites list |
| `apps/web-app/src/api-client.ts` | `<NAME>_API_URL` constant and a `<name>Request` helper |
| `app.ts` CORS | `X-Act-As-Company` and any new custom header in `allowedHeaders` |
| `pnpm-lock.yaml` | run `pnpm install` and commit the lockfile |

Next free ports: notifications 4008, moderation 4009, payments 4010, analytics 4011, media 4012, calls 4013, graph 4014, posts 4015.

### 2.5 Tests
- Tests first for each acceptance criterion, including failure and edge cases, cross-tenant isolation for any new data access, and "no personal data in events or logs".
- Locally `@swc/core` fails to load. Run tests with a **temporary** config and delete it after:
  - Node services: `vitest.noswc.config.ts` = plain config + `setupFiles: ['../../tests/setup-mongo.ts']`, run with `TEMP`/`TMP` set to `D:\Onebridge projects\.tmp-mongo` (C: is full).
  - jsdom (apps, ui-kit): `oxc: { jsx: { runtime: 'automatic' } }`.
  - **Never commit `vitest.noswc.config.ts`** (it happened once).
- One `connectMongo` client per test file: a second `describe` that closes and reopens it breaks; put such suites in their own file.
- Typecheck every touched package: `npx tsc --noEmit -p .`.

### 2.6 UI
- Design every state: loading, empty, error, offline, plus the states listed in the feature file.
- Orange is a fill, never text. Touch targets 44 px. Labels on every input. `axe` check in the component test.
- Verify in the in-app browser pane (headless Playwright is broken on this machine). Use the seeded demo phone `+919988776655`, code `123456`, on localhost only.
- Identity allows about 5 OTP codes an hour per network: the seed uses 4 per run, so plan browser sign-ins.

### 2.7 Finish
1. Append the decision (`D-<feature>`) to `docs/decisions.md`: what was built, what was decided without the spec, what is deferred and why.
2. Add or extend `scripts/demo-seed.mjs` so the demo shows the feature (fictional data only, never a real number). Sign in each phone once per run (the seed memoises tokens).
3. Restart dev (`dev-alt-ports` launch config, ports 3002 and 3003; never touch port 3000) and run the seed.
4. Commit with a Conventional Commit message ending in the co-author line; do not stage `.claude/`.
5. Push: `git push onebridge feat/step-3-cards-f10:main feat/step-3-cards-f10` and `git push origin feat/step-3-cards-f10`. Render redeploys.

---

## 3. Build order

Both tracks continue in parallel (D-NETWORK), but they share foundations. The order below puts shared foundations first so nothing is built twice.

| # | Step | Track | Why here |
|---|---|---|---|
| 1 | F22 Notifications (core) | Shared | Chat, call requests, invites, leads, billing and moderation all need it |
| 2 | Media service (F00 AC-15) | Shared | Chat attachments, posts, requirements, print proofs and student IDs need it |
| 3 | N11 Request a call | B | Completes D-CONTACT ("no public numbers") |
| 4 | F25 Ops console, skeleton + N09 Moderation | Shared | Moderation needs the ops queue; KYB and NFC fulfilment reuse the console |
| 5 | N10 Privacy, export and delete | B | Closes phase N-1; needs N08, N11, N09 |
| 6 | F15 CSV import and bulk actions | A | Step 4 of the core |
| 7 | F16 Offboarding and handover | A | Step 4; N10 deletion relies on it |
| 8 | F17 Plans and subscriptions | A | Step 5; replaces the fake plan limits |
| 9 | F18 GST invoices and lapse | A | Step 5 |
| 10 | F20 Printed artwork and proofs | A | Orders need proofs |
| 11 | F19 NFC catalogue and orders | A | Step 6 |
| 12 | F21 NFC activation and lost cards | A | Step 6 |
| 13 | F25 Ops console, KYB and NFC fulfilment | A | Completes F25 |
| 14 | F23 Analytics | A | Step 8 |
| 15 | F24 My Card PWA | A | Step 9; needs F22 and F23 |
| 16 | N05 Posts and feed | B | Phase N-2 |
| 17 | N06 Relationships and endorsements | B | Phase N-3; needs KYB |
| 18 | N07 Requirements and matching | B | Phase N-4 |
| 19 | F27 Student plan (Should, flagged) | A | Step 12 |
| 20 | F28 Hardening and launch, plus section 6 debt | Both | Last; some debt items earlier if a customer goes live |

**Founder gate:** Track A phase 0 exit metric is 10 paying companies and 200 active seats. After step 9 (billing), confirm with the founder whether to keep both tracks going or to focus on sales.

---

## 4. Step-by-step instructions

Each step lists: owner, contract, data, rules that are easy to get wrong, UI, tests, demo seed, and what it unlocks.

### Step 1. F22 Notifications (core)

**Owner:** new `services/notifications` (4008).

**Build:**
1. Contract: `GET|PATCH /notification-preferences`, `GET /notifications` (in-app list, unread count), `POST /notifications/{id}/read`, internal `POST /internal/notify` (service key).
2. A `Notifier` port with adapters: in-app (Mongo), email, SMS, WhatsApp, web push (sending only; subscriptions arrive in F24). Real providers sit behind the existing fakes in `packages/shared/src/fakes.ts`; **real providers never run in tests**.
3. Event consumers (subscribe on the shared bus, like messaging does): `lead.created` (F13), `invite.*` (F14), `message.sent` (N08), `access_request.*` (N02), `follow.created` (N04), `kyb.status_changed`, later billing, NFC and moderation events.
4. Routing: per-user preferences by event and channel, quiet hours, opt-out. Security and legal notices ignore quiet hours. Fallback: push unavailable → WhatsApp → SMS → email, by preference.
5. Templates in English and Hindi, versioned, with a delivery log (status, provider id, retries with exponential backoff).
6. The recipient's contact details come from identity through a service-key endpoint (add `GET /internal/persons/{id}/contact` to identity). Never copy phones into the notifications database beyond the delivery log entry, and redact them in logs.

**Rules that are easy to get wrong:**
- Push and WhatsApp payloads carry a title and a deep link only. For chat: "New message from Sahyadri Steel Works", **never message text** (N08).
- New-lead notification must reach the owner in under 10 seconds: send in-app and push directly from the consumer, not a batch job.
- Chat: notify only when the recipient is offline. Ask messaging (add `GET /internal/presence?actor=`) or have messaging publish `message.sent` with an `recipientOnline` flag. Pick one and log it.
- Company inbox recipients: unassigned conversation → Owner and Admins; assigned → the seat holder.

**UI:** bell with unread count in the dashboard `AppShell` and `MemberPageShell`; notifications page; preferences page (per event and channel, quiet hours).

**Tests:** preference matrix, quiet hours, fallback order, no content in chat payloads, 10-second lead path, idempotency (same event twice → one notification), Hindi template present for every English one.

**Unlocks:** N08 offline notifications, N11 reminders, invites by WhatsApp, billing dunning.

**Ask the founder:** DLT-registered SMS templates and WhatsApp Business provider (the fakes stay until accounts exist); sender email domain.

### Step 2. Media service

**Owner:** new `services/media` (4012).

**Build:** `POST /media` (multipart) → stored file with type and size limits (images, PDF; 25 MB), image re-encode with `sharp` (strips EXIF and location), malware scan port with a fake adapter, status `scanning | clean | blocked`, short-lived signed URLs. Storage port: local disk now, S3-compatible later.

**Then wire N08 attachments:** messaging accepts `attachmentIds` once media reports `clean` (remove the `attachments_unavailable` refusal), up to 10 per message, not in message requests. Show uploading, too large, blocked and clean states in the composer.

**Rules:** media for a company conversation belongs to the company; signed URLs are checked against the caller's access to the conversation (messaging issues them through media, not the browser directly).

**Ask the founder:** storage provider for production (Render disk is not durable; S3, R2 or similar).

### Step 3. N11 Request a call

**Owner:** new `services/calls` (4013), or inside `messaging` if you want one inbox service. Recommendation: a separate service; it shares the company-routing logic through a small shared module.

**Contract:** already drafted in `network.yaml` (N11 section): `POST /call-requests`, `GET /me/call-requests?role=`, `GET /orgs/{id}/call-requests`, actions accept, propose, respond-proposal, decline, cancel, complete, missed. Events in `events.yaml`.

**Build order inside the step:**
1. Create and list requests; routing to company inbox (Owner and Admins), employee seat (via card), or member (only if their N10 setting allows; until N10 exists, default to **nobody**, so members cannot be asked).
2. Number privacy: the requester's phone is encrypted (ADR-0002, reuse `encryptLeadPayload`-style helpers with the tenant key for companies), and decrypted **only** for the receiver after accept. The receiver's number is never returned.
3. Statuses and the 48-hour expiry: a scheduled job (in-process interval now) moves `requested` to `expired` and publishes `call_request.expired`.
4. "Reply in chat instead": calls messaging `POST /conversations` with `context: { kind: 'call_request', id }` (this skips the request step, as N08 already supports).
5. Leads: every request to a company or employee creates a lead with source `call_request`. Cards owns leads: add an internal endpoint on cards (`POST /internal/leads`) or have cards consume `call_request.created` and fetch details through a service-key endpoint. Do the same for the N08 first-message lead (`conversation.started`), which was deferred.
6. Signed-out requesters: OTP-verify the phone, create a light account (identity), then submit.
7. Limits: one open request per requester and receiver; monthly limits from the plan tables.
8. Reminders 15 minutes before the slot through F22.

**Visitor card change (F12):** the Call and WhatsApp tiles become **Chat** and **Request a call**; "Save contact" (vCard) drops phone and email. This changes a live public page: put it behind a flag `contact_via_chat` and switch it on with the founder.

**UI:** request form (topic, up to 3 slots, language, note, phone prefilled and editable, consent checkbox naming the receiver); receiver list with accept/propose/decline; requester status timeline.

**Tests:** number never in responses before accept, never in events or logs; expiry; one open request per pair; cross-tenant (another company cannot see the request); signed-out OTP path.

### Step 4. F25 Ops console skeleton + N09 Moderation

**Owner:** `apps/admin-console` (Next app, desktop only) and `services/moderation` (4009). Finish the draft in `services/moderation`: add `package.json`, repositories (Mongo), module wiring, tests.

**F25 skeleton first:** separate login with mandatory MFA (TOTP), ops roles (Ops Reviewer, Fulfilment, Support, Super Admin), every action audited (F04). Serve it on its own path or subdomain; it must not be reachable from the customer app's navigation. On Render's single service, add it as a fourth process behind `/ops` in `single-server.mjs`.

**N09 build:**
1. `POST /reports` for every target type; the reporter is never revealed.
2. `POST /blocks`, `DELETE /blocks/{id}`, `GET /me/blocks`. Blocks are **enforced where the action happens**: social (no follows), messaging (no messages both ways, conversation hidden for the blocker), calls (no requests), search (blocked parties hidden from each other), profiles (members-only profile hidden). Each service keeps a `*_block_refs` read model from `block.created/removed` events, like `messaging_follow_refs`.
3. Ops queue grouped by target, priority scam/fraud and harassment first; actions dismiss, remove, warn, restrict, suspend, ban, each with a reason, an audit entry and a notification with the appeal path.
4. Appeals decided by a different reviewer.
5. New-account limits (first 7 days or until verified): lower caps on follows, message requests, posts with links, requirements. Make social and messaging read the caps from one config with a `newAccount` variant.
6. Spam signals: identical messages to many people, many requests ignored or blocked → temporary restriction and review.
7. Public "Community rules" page (English and Hindi) on web-public.

**Tests:** block both directions in every service; reporter anonymity; restricted account cannot post or message; appeal needs a different reviewer.

### Step 5. N10 Privacy, export and delete

**Owner:** profiles (settings, export orchestration), identity (deletion OTP), every service (export parts, erasure).

1. `GET|PUT /me/privacy` with the defaults in the feature file; publish `member.privacy_changed`. Consumers: search (visibility, member search), messaging (who can message me, read receipts, online status), calls (who can request a call), social (follower lists).
2. Company privacy: who can message the company (everyone with requests, or verified only).
3. Export: `POST /me/exports` → a job that asks each service for its part through a service-key endpoint (`GET /internal/export/{personId}`), zips it, stores it in media, link valid 7 days and needs sign-in. Company-owned conversations are metadata only.
4. Delete: OTP confirm, 14-day grace (cancellable), then `member.deleted`. Every service erases its part; company-owned data keeps the record with the name replaced by "Former member"; seats go through F16 offboarding (so build step 7 before switching on deletion, or keep deletion behind a flag until then).
5. Consents with version and time; grievance form and published grievance officer contact.

**Tests:** every service handles `member.deleted` (add one test per service); export contains no other person's private data; grace-period cancel.

**Ask the founder:** grievance officer name and contact; export and grace-period numbers (72 hours, 14 days are proposals).

### Step 6. F15 CSV import and bulk actions

**Owner:** organization.

1. `POST /orgs/{id}/seats:import` parses CSV or XLSX (up to 5,000 rows) and returns a **preview** only: row errors, warnings, duplicates (by mobile and email, in the file and against existing seats), counts.
2. `POST /imports/{id}:confirm` runs a background job (in-process queue now) with progress; `GET /imports/{id}` returns progress and the downloadable result report.
3. Idempotent on the same confirmed file (hash the file + tenant). Rows over the plan seat limit are rejected with a clear message, never silently dropped.
4. Optional invites for created seats (reuses F14).
5. `POST /seats:bulk`: change template, move branch or department, deactivate, resend invites, as jobs.
6. Custom fields per company (text, link, select) with public or internal visibility.
7. Branch Managers act only within their branch. One audit entry per job with counts.

**Performance target:** 1,000 rows in 60 seconds. Write a test that imports 1,000 rows against `mongodb-memory-server` and asserts the time.

**Demo seed:** a template download link and a small sample import.

### Step 7. F16 Offboarding and handover

**Owner:** organization (seat state), identity (session revocation), cards (card and short link), cards/leads (ownership stays with company), messaging (already follows seat events).

1. `POST /seats/{id}:offboard` with the visitor option: deactivated card with a contact, redirect to the successor's card, or redirect to department or company page.
2. Revoke access within 1 minute: identity revokes sessions and refresh tokens for that membership; F24 later adds the push wipe signal.
3. Re-point the short link within 60 seconds (edge cache invalidation, ADR-0003).
4. Leads, saved contacts, card history and analytics stay with the company and move to the successor or manager. Messaging already keeps conversations on the seat and unassigns them when the seat is no longer active (D-N08): verify with an end-to-end test.
5. Personal export of the person's own public card details only.
6. `GET /seats/{id}/handover-summary` within 5 seconds; confirmation dialog that names the person and says it cannot be undone.
7. Event `seat.offboarded`; seat can be reassigned later with the same URL and QR.

### Step 8. F17 Plans and subscriptions

**Owner:** `services/payments` (4010).

1. **Decide the database first:** the spec says PostgreSQL with Prisma (OPEN-PAYDB). Render offers managed PostgreSQL; the demo can keep an in-memory fake. Ask the founder before adding a second database.
2. `GET /plans`, `POST /subscriptions`, `PATCH /subscriptions/{id}` (seats, plan), `POST /webhooks/razorpay` (signature verified, idempotent, out-of-order safe).
3. Razorpay adapter behind a `PaymentGateway` port; the fake stays in tests and the demo.
4. Proration on seat changes, upgrade and downgrade (downgrade never deletes; over-limit seats become read-only).
5. Dunning D+1, D+3, D+7 through F22, 7-day grace.
6. Replace the fake `PlanLimits` with the real one backed by subscription state; publish `plan_limits.changed`; organization, cards, social and messaging apply it within 60 seconds. Move the scattered limit numbers (`services/organization/src/domain/plan-limits.ts`, messaging request caps, N02 free limits) into one config table with tests per plan.
7. Flag `payment_after_first_card` controls where payment sits in onboarding.

**Ask the founder:** Razorpay account and keys (test mode first), the final prices (sample prices are in the plan), GST registration details.

### Step 9. F18 GST invoices and lapse

**Owner:** payments.

1. GST invoice: GSTIN, HSN/SAC, CGST+SGST same state or IGST otherwise, gap-free numbering per financial year, credit notes. PDF generated server-side and emailed.
2. Lapse: 30 days cards stay live with a renewal banner for admins only; after 30 days cards show the company's basic profile; the Business ID is never released; nothing is deleted silently; renewal restores everything at once. Publish `subscription.status_changed` and make cards, the visitor page and messaging react.

**Ask the founder:** legal entity name and address for invoices (open question Q5).

### Step 10. F20 Printed card artwork and proofs

**Owner:** cards (artwork from seat data) or a new `print` module inside cards.

1. Three families (small business, medium employee, owner and leadership) with the print rules in the feature file (90 x 54 mm, 3 mm bleed, QR at least 20 mm on a light plate).
2. Server-generated print PDF with bleed and crop marks; same short link and QR on reprint.
3. Proof preview front and back; the approved proof is stored with a hash and the print file must match it.
4. Engraving variants for wood and metal; metal is QR-only.
5. Brand kit recolours the medium family; contrast check from F09 (4.5:1).

### Step 11. F19 NFC catalogue and orders

**Owner:** payments (order and payment) + cards (proofs).

Catalogue, order flow (seats, material, family, quantity, shipping), **proof approval before payment**, Razorpay payment, GST invoice (F18), status timeline with `nfc.order_status_changed`, bulk ordering from the employees list (extends F15), block orders for vacant or offboarded seats, metal notice (QR-only).

### Step 12. F21 NFC activation and lost cards

**Owner:** cards (chips bind to seats and short links).

Chip states unactivated, active, disabled. Activation by tapping on the owner's own signed-in phone; one chip, one seat. Lost or stolen disables within 60 seconds at the edge; neutral pages carry no personal data. Offboarding re-points through the short link, never by re-encoding. Events `nfc.chip_activated`, `nfc.chip_disabled`.

### Step 13. F25 Ops console: KYB and NFC fulfilment

**Owner:** admin-console + organization (KYB) + payments (orders).

1. KYB queue: GSTIN verified through the GST verifier port (fake now), legal-name match, manual review with document viewer (media), SLA timer, decision with reason, `kyb.status_changed` (search, social and messaging already consume it).
2. NFC fulfilment: order queue, vendor assignment, encoding batch (NDEF URL to short link, write-lock), QC checklist, dispatch with tracking.
3. Tenant management (search, plan, usage, health).
4. Impersonation: reason, time-boxed, logged, visible to the customer admin, needs customer consent.
5. Should: feature flags and plan configuration without deploy.

### Step 14. F23 Analytics

**Owner:** `services/analytics` (4011).

1. `POST /analytics/events` batch (up to 100) replaces the stub; queue and replay if the pipeline is down; card pages and redirects never fail because of analytics.
2. Store: ClickHouse in production, a plain events collection locally (keep the store behind a port).
3. Dashboards: employee (views, saves, leads, sources, 7/30/90-day trends) and admin (totals, by branch, department, employee, leaderboard), scoped by role.
4. Retention by plan. No cookies for visitors; a random daily session ID; no personal data in events.
5. Network metrics for the exit gates: follows, enquiries, chat response time (N08), call request outcomes (N11), later posts and requirement responses.

### Step 15. F24 My Card PWA

**Owner:** web-app under its own scope (`/my-card`) so the service worker never touches admin screens.

Manifest, install prompts (after the first share, never in the first session), offline card and QR, last 50 leads cached with phone and email encrypted in IndexedDB (non-extractable WebCrypto key), write queue with idempotency keys and `POST /leads:sync`, controlled updates, Web Push with VAPID (subscriptions here; sending is F22), cache wipe on logout, revocation, offboarding, lapse and 14 days without sync. Budgets: 150 KB JS, QR in 300 ms offline. Test on the device-lab matrix in the feature file.

### Step 16. N05 Posts and feed

**Owner:** new `services/posts` (4015), or extend `social` (it already owns follows, and the plan put the feed there). Recommendation: extend `social`, because the feed is a join of follows and posts.

1. Authors: member or company (Owner and Admin by default).
2. Post types with structured fields; media through the media service; one link preview (fetch server-side with an allowlist and timeouts: SSRF risk).
3. **Contact detection (D-CONTACT):** refuse publishing when the text has a phone number or email; reuse one detector in `packages/shared` for posts, requirements and (optionally) chat.
4. Drafts from activity (catalogue item added, project added, seat claimed with consent, KYB verified): offer, never auto-publish.
5. Reactions, one-level comments, reshares, edit within 24 hours, delete within 60 seconds from feeds and search.
6. Feed ranking: followed authors newest first, small boosts for verified and engagement, at most 2 in a row from one author, "Suggested" and "Promoted" labels.
7. Free plan posts per month (2) enforced through plan limits.
8. N09: report, hold posts from accounts under review and new accounts' link posts.

**Note:** N05 lists N09 and F22 as dependencies; do not start it before steps 1 and 4.

### Step 17. N06 Relationships and endorsements

**Owner:** new `services/graph` (4014).

Propose, confirm (with edits that the proposer accepts), decline, end; reverse types shown automatically; badges "Verified relationship" (both KYB-verified) or "Confirmed relationship"; private relationships count without naming; endorsements only from confirmed partners, approved by the receiver, no star ratings. Anti-gaming: one relationship per type per pair; companies with the same Owner cannot confirm each other. Feed search ranking and the "has verified clients" filter (N03 needs an event consumer). Plan limits (Free can view only).

### Step 18. N07 Requirements and matching

**Owner:** new `services/requirements`, or inside `graph`. Recommendation: its own service; matching reads the search index through search's API.

Post a requirement (contact detection applies), visibility (matched suppliers only or public board), hidden buyer identity until reply, matching on taxonomy, city, catalogue keywords and verification, notify matched suppliers once, responses open an N08 chat (`context: { kind: 'requirement' }`, which skips the request step), response allowance per plan and add-on credits, lifecycle with auto-close and reminder, leads with source `requirement`, public board pages on web-public `/board/<city>/<industry>`.

### Step 19. F27 Student plan (Should, behind `student_plan`)

Identity mints `OB-S` IDs; college email OTP with an allowlist; ID upload reviewed in the ops console within 48 hours; ID images in a separate encrypted bucket, deleted 30 days after decision; annual re-verification; one active student plan per person.

### Step 20. F28 Hardening and launch

Performance budgets, WCAG 2.1 AA audit, OWASP ASVS Level 2, cross-tenant penetration test, DPDP flows end to end, backups (RPO 15 min, RTO 4 h) with a restore drill, SLO dashboards and runbooks, Hindi copy review, the full end-to-end suite, and a signed launch checklist. Include every item in section 6.

---

## 5. Decisions to get from the founder (collected)

| When | Decision |
|---|---|
| Step 1 | WhatsApp Business provider, SMS DLT templates, sender email domain |
| Step 2 | Production file storage provider |
| Step 3 | Switch the visitor card to Chat and Request a call (flag `contact_via_chat`) |
| Step 4 | Ops console URL and who gets ops accounts |
| Step 5 | Grievance officer, export time (72 h) and deletion grace (14 days) |
| Step 8 | PostgreSQL for payments (OPEN-PAYDB), Razorpay account, final prices |
| Step 9 | Legal entity name and address on invoices (Q5) |
| After step 9 | Keep both tracks or focus on sales (phase 0 exit metric) |
| Step 16 | Who besides Owner and Admin may post for a company |

---

## 6. Debt carried from earlier steps (fix by F28, earlier if a real customer goes live)

| Item | From | What to do |
|---|---|---|
| Identity always issues OTP `123456` in demo mode | F01, demo hosting | Real SMS OTP through F22 adapters before any real customer; keep the fake only behind `DEMO_MODE` |
| Rate limiters, idempotency cache and tickets are in memory | F00, N03, N08 | Redis adapters before running more than one instance |
| Chat fan-out is in-process | N08 | Redis pub/sub before a second messaging node |
| No transactional outbox | F00 AC-7 | Outbox per service so events survive crashes (needed before payments) |
| Search uses a MongoDB adapter | N03 | Meilisearch behind the `SearchIndex` interface; add typo tolerance |
| No search backfill | N03 | A one-off reindex job for data created before search existed |
| Branch routing of enquiries | N08, N11 | F26 routing: branch contact, then default contact |
| Lead from first chat message | N08 | Cards consumes `conversation.started` (do it in step 3 with call-request leads) |
| Link previews, voice notes, message text search | N08 | After media (step 2); text search needs a client-side or searchable-encryption design |
| Demo data resets on every Render start | Hosting | Set `MONGODB_URI` (and the secrets single-server asks for) before real use |
| `.claude/launch.json` is local only | Tooling | Never commit it |

---

## 7. How to ask for each step

When you are ready for a step, say "go ahead with <step>", for example "go ahead with F22". Each step ends with tests green, the decision logged, the demo seeded, and a push to both remotes, as in section 2.7.
