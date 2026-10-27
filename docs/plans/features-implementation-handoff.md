# Implementation handoff: complete the remaining features

**For:** the coding agent implementing this work.
**Written:** 2026-10-27, after commit `71d5cd9` (N08 real-time chat).
**Runs before:** `docs/plans/vps-auth-implementation-handoff.md` (new sign-in and VPS). Build on the **current** sign-in (phone OTP in development) and the **current** hosting (local `pnpm dev`, the Render demo). Do not start any sign-in or Docker work from that plan here; section 0.6 lists the few places where this plan prepares for it.

Feature files in `docs/onebridge-spec-pack/docs/features/` are the source of truth for **what** to build. This document is the **how**: order, ownership, contracts, rules that are easy to get wrong, tests and done checks.

---

## 0. Read this first

### 0.1 Goal
Finish every remaining feature so the product is complete with fake or real provider adapters behind interfaces, ready for the later VPS and sign-in work:
- **Core (Track A):** F15, F16, F17, F18, F19, F20, F21, F22, F23, F24, F25, F27, and the F28 items that do not depend on the VPS.
- **Network (Track B):** N11, N09, N10, N05, N06, N07, plus follow-ups left open by N03 and N08.

### 0.2 Read before writing code
1. `.agent/AGENTS.md` (rules, definition of done) and `CONTRIBUTING.md`.
2. `docs/decisions.md`, especially D-F14, D-N01 to D-N08 (they show the patterns to copy).
3. `docs/plans/business-network-plan.md` (pricing tables in section 5, phasing in section 6).
4. `docs/plans/remaining-implementation-guide.md` (overview; this document supersedes its order where they differ).
5. For each feature: its feature file **completely**, and the feature files it depends on.
6. Reference implementations to copy from:
   - Service skeleton, events, read models, act-as-company: `services/messaging` (newest) and `services/social`.
   - Encryption at rest: `services/messaging/src/domain/crypto.ts`, `packages/shared/src/lead-encryption.ts`, `key-vault.ts`.
   - Tenant-scoped repository: `services/organization/src/application/access-request.service.ts`, `services/messaging/src/infrastructure/repositories.ts` (`MongoNoteRepository`).
   - Search read model fed by events: `services/search`.
   - Web app page with session: `apps/web-app/app/messages/page.tsx`, `src/features/messages/`.
   - Demo seed: `scripts/demo-seed.mjs` (`seedMessages`, `seedDirectory`).

### 0.3 Rules (non-negotiable)
- **Branch:** create `feat/features-completion` from `feat/step-3-cards-f10`. Commit there; push **only** to `origin feat/features-completion`. **Never push to the `onebridge` remote or to any `main`.** The founder will ask for a review.
- **One feature per commit series**, Conventional Commits (`feat(f22): ...`, `feat(n11): ...`), each commit ending with the co-author line the session requires. Small commits are better.
- **Contract first** (section 0.5), **tests first** for each acceptance criterion including failures and edge cases, **cross-tenant isolation test** for every new data access.
- **Never** disable, skip or weaken a test or lint rule. Report the problem instead.
- **Never commit** `.env`, secrets, `vitest.noswc.config.ts`, `.claude/`, build output.
- **No personal data** (phone, email, message or note text, names in analytics) in logs, events or analytics. Events carry IDs only.
- **D-CONTACT:** phone numbers and emails are never shown publicly. Contact happens through chat (N08) and call requests (N11).
- **Real providers never run in tests.** Every external service (SMS, WhatsApp, email, Razorpay, GST verifier, courier, malware scanner, storage, telephony) sits behind an interface with a fake adapter. Write the real adapter only where marked; otherwise leave a clear `// shortcut:` comment and list it in the report.
- **Do not stop anything on port 3000** (another project). Use the `dev-alt-ports` launch config (web-app 3002, web-public 3003).
- **Demo data only:** fictional names, `example.com` emails, `+9197000xxxxx` numbers.
- **Stop and ask** when a spec is silent on something that matters, documents disagree, or a rule above would be broken. If you cannot ask live, choose the safest option, log it in `docs/decisions.md`, list it in the report, and continue.
- **Log every decision** (`D-<feature>`) in `docs/decisions.md`: what you built, what you decided, what you deferred and why.

### 0.4 Local environment quirks (Windows)
- `@swc/core` fails to load. For tests create a **temporary** `vitest.noswc.config.ts` in the package and **delete it after**:
  - Node: `import { defineConfig } from 'vitest/config'; import path from 'node:path'; export default defineConfig({ test: { globals: true, environment: 'node', fileParallelism: false, include: ['tests/**/*.spec.ts'], setupFiles: [path.resolve(import.meta.dirname, '../../tests/setup-mongo.ts')] } });`
  - jsdom: `export default defineConfig({ oxc: { jsx: { runtime: 'automatic' } }, test: { globals: true, environment: 'jsdom', fileParallelism: false } } as any);`
  - Set `TEMP` and `TMP` to `D:\Onebridge projects\.tmp-mongo` (drive C: is full).
- Rebuild shared after changing it: `pnpm --filter @onebridge/shared build` (otherwise the collection registry change is not seen).
- One `connectMongo` client per test file; put suites that need their own server in their own file.
- `pnpm contracts:gen` after YAML changes; **read its output**; quote text containing `{braces}`.
- Many files are CRLF. If you script edits in Python, open with `newline=''` and keep the file's line ending, or `\r\n` turns into `\r\r\n`.
- Git Bash rewrites `/svc/...` env values into Windows paths; set such values from Node scripts.
- Identity allows about 5 sign-in codes an hour per network; the demo seed uses 4 per run and memoises tokens per phone. Plan browser sign-ins (demo owner `+919988776655`, code `123456`, development only).
- Headless Playwright is unreliable here; verify UI in a real browser and with component tests (with `jest-axe`).
- Typecheck each touched package: `npx tsc --noEmit -p .`.

### 0.5 How to add things (follow exactly)

**Contracts.** Network features: `packages/api-contracts/network.yaml`; core features: `openapi.yaml`; events: `events.yaml` (IDs only, `version: "1.0.0"`, tenantId = company or `global`). Several N-features already have drafted paths and schemas in `network.yaml` and `events.yaml` (N05, N06, N07, N09, N10, N11): **read them first and extend, do not duplicate**. Export new types from `packages/api-contracts/src/index.ts` (check for duplicate names).

**Collections.** Register in `packages/shared/src/mongo/collection-registry.ts`. Tenant data: `TenantScopedRepository` used inside `TenantContext.run(tenantId, ...)`. Cross-tenant data: `GlobalRepository`, and approve the name in `packages/shared/tests/collection-classification.spec.ts` with a comment citing your decision.

**Services never read another service's database** (ADR-0003). Use events (subscribe on the shared `InMemoryEventBus`, idempotent handlers, keep a local read model like `messaging_company_refs`) or internal HTTP endpoints protected by the `x-service-key` header (`INTERNAL_SERVICE_KEY`; copy `services/profiles` `GET /internal/members`).

**Acting as a company.** Header `X-Act-As-Company: <tenantId>`; the caller's role comes from the `RequestAuthenticator` with `x-tenant-id` set to that company (see `MessagingController.scope`). Owner and Admin manage; other roles act only where the spec allows.

**A new service** (copy `services/messaging`). Wire **all** of these:

| File | Add |
|---|---|
| `services/<name>/` | `package.json` (name `@onebridge/<name>`, same dependency versions as messaging), `tsconfig.json`, `vitest.config.ts`, `src/{app,main,index,<name>.module}.ts`, `src/config/env.ts`, `tests/` |
| `scripts/dev.mjs` | `PORTS`, build `--filter`, `importDist`, `createApp` before organization when it listens to org or seat events, the "Services ready" log line |
| `scripts/demo-server.mjs` | `TARGETS`, `importDist`, `createApp`, route regex, seed env `<NAME>_URL` in `runSeed`, `proxyUpgrade` only for WebSockets |
| `scripts/single-server.mjs` | `/svc/(...)` regex; `ADMIN_PATHS` for any new web-app top-level route |
| `scripts/single-build.mjs` | build `--filter`, `NEXT_PUBLIC_<NAME>_API_URL: '/svc/<name>'` |
| `apps/web-app/next.config.mjs` | the name in the rewrites list |
| `apps/web-app/src/api-client.ts` | `<NAME>_API_URL` constant and a `<name>Request` helper (copy `messagingRequest`) |
| `src/app.ts` | CORS `allowedHeaders` includes `X-Act-As-Company` |
| root | `pnpm install`, commit `pnpm-lock.yaml` |

**Ports:** notifications 4008, moderation 4009, payments 4010, analytics 4011, media 4012, calls 4013, graph 4014, requirements 4015. Posts and the feed go into `social` (4005). The ops console app runs on 3004 in development.

**Existing folders:** `services/notifications`, `payments`, `analytics`, `media` and `apps/admin-console` contain only a `package.json`; `services/moderation` has an in-memory draft (service, controller, module; no `package.json`, no repositories, not in git). Build on them; replace what does not fit.

### 0.6 Preparing for the later sign-in and VPS plan
Do these so the later plan does not redo work:
1. **Email sender (F22):** create `packages/shared/src/email/` with the `EmailSender` port, a `ConsoleEmailSender` (masks addresses; prints content only in development) and an `SmtpEmailSender` (`nodemailer`, env `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM`, `EMAIL_REPLY_TO`), chosen by `EMAIL_PROVIDER=console|smtp`. The auth plan (its ticket A2) will reuse it.
2. **Production guard:** add `assertNotFakeInProduction(name, adapter, nodeEnv)` in `packages/shared` and call it wherever you choose an adapter.
3. **Never depend on phone sign-in in new features.** Where a feature needs the user to re-confirm identity (N10 account deletion), call one identity endpoint `POST /auth/reauth` that today uses the phone code and later uses the email code or password. Where a feature needs a phone number (N11), the user types it; it is not taken from sign-in.
4. **Files on disk:** media storage writes under `MEDIA_DIR` (default `./.data/media`, git-ignored) so the VPS plan can mount a volume there.

### 0.7 Definition of done for every feature
- Acceptance criteria implemented and tested (happy path, failures, edge cases, cross-tenant).
- Contract updated, types generated, no breaking change to existing clients.
- Every state designed in the UI (loading, empty, error, offline, plus the feature's listed states); labels, focus, 44 px targets, `jest-axe` clean; orange used as a fill, never as text.
- Events and logs without personal data.
- Demo seed shows the feature with fictional data.
- `D-<feature>` logged; open questions written to `docs/questions.md`.
- Browser check on the dev stack; one or two screenshots saved under `docs/reviews/screenshots/<feature>/`.
- All touched packages: tests green and typecheck clean.

---

## 1. Order of work

Nine milestones. Finish one before starting the next; write the milestone section of the report (section 11) at the end of each.

| Milestone | Features | Why in this order |
|---|---|---|
| M1 Foundations | F22 Notifications; Media service; N08 follow-ups | Almost every later feature sends notifications or stores files |
| M2 Contact and safety | N11 Request a call; F25 ops console skeleton; N09 Moderation; N10 Privacy | Completes network phase N-1 (D-CONTACT) |
| M3 Employees | F15 Import and bulk actions; F16 Offboarding | Core step 4 |
| M4 Billing | F17 Plans and subscriptions; F18 Invoices and lapse | Core step 5; replaces the fake plan limits |
| M5 NFC and print | F20 Artwork and proofs; F19 Orders; F21 Activation; F25 KYB and fulfilment | Core step 6 and the rest of the ops console |
| M6 Insight and mobile | F23 Analytics; F24 My Card PWA | Core steps 8 and 9 |
| M7 Network growth | N05 Posts and feed; N06 Relationships; N07 Requirements | Network phases N-2 to N-4 |
| M8 Student plan | F27 (behind flag `student_plan`) | Should; last product feature |
| M9 Readiness | F28 items that do not need the VPS; debt list | Before the VPS plan |

---

## 2. M1 Foundations

### 2.1 F22 Notifications
**Read:** `F22-notifications.md`, `F13`, `F14`, `N08`, D-N08.
**Owner:** `services/notifications` (4008).

**Contract** (`openapi.yaml`, tag `notifications`): `GET /notifications?cursor=` (in-app list), `GET /notifications/unread-count`, `POST /notifications/{id}/read`, `POST /notifications/read-all`, `GET /notification-preferences`, `PATCH /notification-preferences`, internal `POST /internal/notify` (service key) `{ personId, event, data, tenantId? }`.

**Data:** `notifications` (global, per person: id, personId, tenantId?, event, title, body, link, readAt, createdAt; no phone, email or message text), `notification_preferences` (global: personId, per event and channel on/off, quiet hours, language), `notification_deliveries` (global: id, notificationId, channel, provider, providerId, status, attempts, nextAttemptAt, error code; **no recipient address stored**).

**Build:**
1. `Notifier` port per channel: in-app (Mongo), email (`EmailSender` from section 0.6), SMS, WhatsApp, web push (sending only; subscriptions come in F24). Fakes for SMS, WhatsApp and push in `packages/shared/src/fakes.ts` style; real adapters: **email (SMTP) only** now.
2. Recipient contact details: add identity `GET /internal/persons/{personId}/contacts` if it does not already return what you need (it exists: check `nest-internal.controller.ts`). Fetch at send time; never store.
3. Event consumers (subscribe on the shared bus; each handler idempotent by `eventId`):

| Event | Recipients | Channels (default) | Text (no personal data beyond names) |
|---|---|---|---|
| `lead.created` (F13; check the exact event name in `events.yaml`) | card owner (seat holder) | in-app, push, email | "New lead on your card" |
| `invite.created` / invite events (F14) | invitee | email (WhatsApp later) | invite template |
| `access_request.created` (N02) | Owner and Admins | in-app, email | "Someone asked to join <company>" |
| `follow.created` (N04) | followed member or company admins | in-app (digest later) | "<name> followed you" |
| `message.sent` (N08) | the other side **only if offline** (see below) | push, email after 10 minutes unread | "New message from <sender name>", **never message text** |
| `conversation.assigned` (N08) | seat holder | in-app, push | "A conversation was assigned to you" |
| `kyb.status_changed` | Owner and Admins | in-app, email | verified or rejected |
| later milestones add: call requests, moderation, billing, NFC orders, offboarding | | | |

4. Chat offline rule: messaging adds an internal endpoint `GET /internal/presence?actorType=&actorId=` (service key) returning `{ online }` from `RealtimeHub`; notifications calls it when it receives `message.sent`. For email, wait 10 minutes and send only if the message is still unread (check through a messaging internal endpoint `GET /internal/conversations/{id}/unread?personId=`). Company conversations: unassigned → Owner and Admins; assigned → seat holder (messaging exposes this in the same internal endpoint).
5. Preferences: per event and channel; quiet hours (default 22:00 to 07:00 IST) delay push, SMS and WhatsApp; security and legal notices ignore quiet hours; opt-out per channel.
6. Fallback order when push is unavailable: WhatsApp → SMS → email, limited by preferences.
7. Templates in English and Hindi, versioned (`templates/<event>.<lang>.ts` with a `version`), every English template has a Hindi one (test).
8. Delivery log with retries (exponential backoff: 1 min, 5 min, 30 min, 2 h; then failed).
9. New-lead path under 10 seconds: in-app and push are sent directly in the consumer, not batched.
10. Should: 24-hour untouched-lead reminder and daily or weekly digest (build if time allows; otherwise list in the report).

**UI (web-app):** bell with unread count in `AppShell` (dashboard) and `MemberPageShell`; `/notifications` page (list, mark read, empty state "No notifications yet"); `/settings/notifications` (table of events × channels, quiet hours, language). Poll unread count every 60 s and refresh on the messaging socket's `connected` frame.

**Tests:** preference matrix; quiet hours; fallback; idempotency (same event twice → one notification); chat notification has no message text; offline-only rule; 10-second lead path (measured in test); Hindi template coverage; cross-person isolation (one person cannot read another's notifications).

**Seed:** a few notifications for the demo owner.

### 2.2 Media service
**Read:** F00 acceptance criterion AC-15 (`F00-platform.md`), N08 (attachments), F26 (documents rules).
**Owner:** `services/media` (4012).

**Build:**
1. `POST /media` (multipart, authenticated) `{ purpose: 'chat'|'post'|'requirement'|'proof'|'brand'|'student_id'|'export', ownerType, ownerId }` → `{ id, kind, name, sizeBytes, status }`. Limits: images (JPEG, PNG, WebP) and PDF; 25 MB; check magic bytes, not only the extension.
2. Images re-encoded with `sharp` (strips EXIF and location); PDFs kept as uploaded.
3. Malware scan port `MalwareScanner` with a fake (marks EICAR test string as blocked); status `scanning → clean | blocked`. Publish `media.scanned`.
4. Storage port `MediaStore`: local disk under `MEDIA_DIR` now (S3-compatible later; leave the interface ready).
5. Access: `GET /media/{id}/url` returns a short-lived signed URL (HMAC, 5 minutes) **only if the caller's service says so**: owning services call `POST /internal/media/{id}/grant` (service key) with the viewer's personId; media checks grants. Simpler alternative allowed: owning services proxy the file. Choose one, log it.
6. Student ID images (F27) and exports (N10) use a separate folder and are deleted on schedule (see those features).

**N08 attachments:** in messaging, accept `attachmentIds` (max 10, not in message requests, each must be `clean` and owned by the sender); remove the `attachments_unavailable` refusal; message views include attachments with signed URLs for viewers who can see the conversation. Web app composer: attach button, upload progress, too large, blocked, retry, remove before sending; image thumbnails and PDF tiles in bubbles.

**Organization brand kit:** replace `FakeMediaStorageService` usage with the media service (or a disk adapter behind the same interface) so logos persist.

**Tests:** type and size limits, magic-byte check, EXIF stripped, blocked file never served, signed URL expiry, access only for allowed viewers, attachment rules in messaging.

### 2.3 N08 follow-ups
1. **Lead from the first chat message:** cards consumes `conversation.started` for kinds `member_company` and `member_card` and creates a lead with source `chat` on the routed card (card seat for `member_card`; F26 enquiry routing for `member_company`). Cards fetches the sender's public name through profiles' internal endpoint. **No phone or email** is created for chat leads (D-CONTACT); the lead links to the conversation id.
2. **Enquiry routing for new conversations:** cards exposes `GET /internal/orgs/{tenantId}/enquiry-route` (service key) using the F26 routing already in `CompanyProfileService` (branch contact, then default contact). Messaging assigns new `member_company` conversations to that seat if one is set (today they wait unassigned).
3. Link previews (server-side fetch with an allowlist of http(s), 3 s timeout, 1 MB limit, no private IP ranges: SSRF protection) for chat and later posts: build as a small module in `packages/shared` or the media service; optional in M1, required by N05.

---

## 3. M2 Contact and safety

### 3.1 N11 Request a call
**Read:** `N11-request-a-call.md`; drafted paths in `network.yaml` and events in `events.yaml`; D-CONTACT.
**Owner:** `services/calls` (4013).

**Data:** `call_requests` (global with `tenantId?` for company receivers; fields from the feature file: id, requesterPersonId, receiverType, receiverId, tenantId?, routedSeatId?, topic, slots, language, note, `encryptedPhone`, `phoneBlindIndex`, consentAt, status, scheduledAt?, proposedSlots?, declineReason?, createdAt, expiresAt).

**Build order:**
1. `POST /call-requests` (signed in only for now; the signed-out OTP path waits for the auth plan; log this). Topic, up to 3 slots (in receiver's business hours if set, else 09:00 to 19:00 IST), language (English, Hindi), note up to 500 characters, phone (typed, normalised to E.164 with `normalizePhoneToE164`), **consent checkbox naming the receiver** (store consent time and receiver name version).
2. Routing: company → F26 enquiry route (`/internal/orgs/{id}/enquiry-route`); employee via card → that seat (company Owner and Admins can see it); member → only if their N10 setting allows (until N10 exists: refuse with `not_accepting`).
3. Phone encrypted with the company's tenant key (company or employee receivers) or a per-request key (member receivers), AAD `callreq|<id>`; blind index for dedupe. **Shown only to the receiver (and the company's Owner and Admins) after accept.** Never in events, logs or list views. The receiver's number is never shown to the requester.
4. Receiver actions: accept and schedule (one of the slots or another time), propose another time (requester accepts or declines), decline with reason (not available, not relevant, wrong person), reply in chat instead (calls messaging `POST /conversations` with `context: { kind: 'call_request', id }`, which skips the request step).
5. Statuses: requested, scheduled, rescheduling, completed, missed, declined, cancelled, expired. A job every minute moves `requested` older than 48 hours to `expired` and tells the requester (offer chat). After the scheduled time the receiver marks completed or missed; a missed call can be rescheduled once.
6. Reminders 15 minutes before to both sides (F22).
7. Leads: every request to a company or employee creates a lead with source `call_request` in cards (consume `call_request.created`; cards fetches the phone through a calls internal endpoint and stores it with the existing lead encryption and dedupe, F13).
8. Limits: one open request per requester and receiver; received per month on the Free company plan (5) and sent per month for members (3) from plan section 5; new accounts lower (N09).
9. **Visitor card (F12) change behind flag `contact_via_chat`** (default off; the founder turns it on): Call and WhatsApp tiles become **Chat** and **Request a call**; "Save contact" (vCard) drops phone and email. Implement the flag in web-public and cards' public card payload.

**UI:** request form (web-app page `/call/new?to=...` and a sheet on member and company pages next to Message); requester list `/calls` with status timeline; receiver views in the company inbox area (`/calls?inbox=company`) and for members; accept, propose, decline, complete, missed.

**Tests:** number never in any response before accept, never in events or logs; only receiver (and company admins) can read after accept; expiry; one open request per pair; reschedule-once rule; cross-tenant; consent recorded; flag on and off for the visitor card.

### 3.2 F25 Ops console skeleton
**Read:** `F25-ops-console.md`, `F04-audit-log.md`, `F02-tenancy-rbac.md`.
**Owner:** `apps/admin-console` (Next.js, desktop only, dev port 3004, `basePath: '/ops'`), identity (ops accounts), every service exposing `/ops/...` endpoints guarded by ops roles.

**Build:**
1. Ops accounts: persons with a `platformRoles` field (`ops_reviewer`, `fulfilment`, `support`, `super_admin`) in identity, granted only by a CLI script `scripts/grant-ops-role.mjs` (development: the seed grants the demo owner `super_admin`; log this). Ops sign-in uses the normal sign-in **plus mandatory TOTP** (existing `MfaService`); the access token carries `platformRoles` only after MFA.
2. Shared guard `requirePlatformRole(...)` in `packages/shared`; every ops action writes `audit.recorded` (F04) with reason.
3. Console shell: sign-in, sidebar (Moderation, KYB, NFC fulfilment, Tenants, Feature flags), empty states. Wire into `single-server.mjs` (`/ops/*` → a fourth process) and `single-build.mjs`.
4. Tenant search (read-only now): name, Business ID, plan, seats, created date; through an organization ops endpoint.

### 3.3 N09 Moderation, reporting and blocking
**Read:** `N09-moderation-safety.md`; drafts in `network.yaml`; the draft in `services/moderation`.
**Owner:** `services/moderation` (4009) + enforcement in every service.

**Build:**
1. Finish the service: `package.json`, Mongo repositories, tests. Collections: `reports`, `blocks`, `moderation_actions`, `appeals` (global; approve them).
2. `POST /reports` for member, company, post, comment, message, requirement, endorsement, call request. The reporter is never revealed. Message reports include the reported message text **only for ops**: moderation asks messaging for it through an internal endpoint at review time; it is not stored in the report.
3. `POST /blocks`, `DELETE /blocks/{id}`, `GET /me/blocks`. Publish `block.created` / `block.removed`. **Enforcement where the action happens**, each service with a `<service>_block_refs` read model (like `messaging_follow_refs`):
   - social: no follows either way; existing follows removed.
   - messaging: no new messages or conversations either way; the conversation is hidden for the blocker; `canSend` false.
   - calls: no requests either way.
   - search: blocked parties do not appear to each other (search needs the viewer's block list: an internal moderation endpoint `GET /internal/blocks?actor=` cached for 60 s).
   - profiles: members-only profile hidden.
4. Ops queue (console): reports grouped by target, context (content, prior reports, account age, verification), priority scam/fraud and harassment first; actions dismiss, remove content, warn, restrict (no posting, messaging or requirements for a period), suspend, ban; each needs a reason, writes the audit log, publishes `moderation.action_taken` / `account.restricted` / `account.suspended`, and notifies the account with the rule and the appeal path.
5. Appeals: once per action; decided by a **different** reviewer.
6. New-account limits for the first 7 days (or until KYB verified): one shared config `packages/shared/src/limits/new-account.ts` read by social (follows), messaging (requests), and later posts and requirements. Identity exposes account creation date in the access token or an internal endpoint.
7. Spam signals: identical message text hash sent to more than 10 people in an hour (messaging computes a hash and reports the count, no text), many requests ignored or blocked → temporary restriction and a report for review.
8. Suspended accounts: every service rejects their writes (consume `account.suspended`).
9. Public "Community rules" page on web-public (`/community-rules`, English and Hindi), linked from every report dialog.
10. Ops metrics: reports per day, time to triage, actions by type, appeal outcomes (no personal data).

**UI:** "Report" and "Block" in the ⋯ menus of member pages, company pages, chat threads and messages; blocked list in settings; ops queue screens.

**Tests:** block both directions in every service; reporter anonymity; restricted account cannot message; appeal by a different reviewer; suspended account write rejected.

### 3.4 N10 Privacy settings, export and delete
**Read:** `N10-privacy-data-rights.md`; drafts in `network.yaml`.
**Owner:** profiles (settings, export orchestration), identity (reauth, deletion), every service (its part).

**Build:**
1. `GET|PUT /me/privacy` with the defaults in the feature file; publish `member.privacy_changed` with the changed keys. Consumers: search (visibility, member search), messaging (who can message me; read receipts; online status: the hub stops sending presence and receipts when off), calls (who can request a call), social (follower lists).
2. Company privacy: who can message the company (everyone with requests, or verified only) in the company page settings (cards) → messaging reads it through an event.
3. Export: `POST /me/exports` → job; each service implements `GET /internal/export/{personId}` (service key) returning its JSON part; the orchestrator zips it, stores it in media (purpose `export`), link valid 7 days, sign-in required, notification when ready. Company-owned conversations are metadata only.
4. Delete: `POST /me/deletion` after `POST /auth/reauth` (section 0.6); 14-day grace; `DELETE /me/deletion` cancels; then `member.deleted`. Every service erases its part; company-owned data keeps the record with the name replaced by "Former member"; seats go through F16 offboarding (M3) — until F16 exists keep deletion behind flag `account_deletion` (off) and log it.
5. Consents (version and time): terms, privacy notice, call-request number sharing (N11). Withdrawal where not needed for the service.
6. Grievance: `POST /grievances`, acknowledgement within 24 hours (notification), ops queue item; grievance officer contact on a public page (name and email from config; ask the founder).

**Tests:** each consumer honours each setting; export contains only the person's own data; deletion grace and cancel; every service has a `member.deleted` test.

---

## 4. M3 Employees

### 4.1 F15 CSV import and bulk actions
**Read:** `F15-csv-import-bulk.md`, `F08-seats.md`, `F14`.
**Owner:** organization.

**Build:**
1. Downloadable template (CSV and XLSX) with columns: name, designation, department, branch, team, manager, mobile, WhatsApp, email.
2. `POST /orgs/{id}/seats:import` (multipart, up to 5,000 rows, CSV or XLSX via `exceljs`) → **preview only**: per-row errors (bad mobile, unknown branch, duplicate), warnings, counts. Nothing saved.
3. Duplicate detection by mobile and email within the file and against existing seats (use blind indexes, not clear values, if seats store encrypted contacts; check F08).
4. `POST /imports/{id}:confirm` → background job (in-process queue with a `jobs` collection storing progress so a restart can resume or mark failed); `GET /imports/{id}` progress and the downloadable result report (created, skipped, failed with reasons).
5. Idempotent: same tenant + file hash confirmed twice does not duplicate.
6. Plan seat limit: rows beyond it are rejected with a clear message.
7. Optional "send invites" for created seats (F14).
8. `POST /seats:bulk` jobs: change template, move branch or department, deactivate, resend invites (NFC ordering added in F19).
9. Custom fields per company (text, link, select) with public or internal visibility; shown on cards when public.
10. Branch Managers only within their branch. One audit entry per job with counts.

**Performance test:** 1,000 rows imported in 60 s or less against `mongodb-memory-server`.
**UI:** People section → Import (upload, preview table with errors, confirm, progress, result report); selection checkboxes with a bulk actions bar; custom fields in company settings.

### 4.2 F16 Offboarding and handover
**Read:** `F16-offboarding.md`, D-N08 (seat-based conversation ownership).
**Owner:** organization (seat state, orchestration), identity (session revocation), cards (card, short link, leads), messaging (already follows seat events).

**Build:**
1. `POST /seats/{id}:offboard` with the visitor option: deactivated card with "contact X", redirect to successor's card, or redirect to department or company page; confirmation dialog naming the person ("This cannot be undone. The seat can be given to someone else later.").
2. Access revoked within 1 minute: identity revokes the person's sessions and refresh tokens for that company membership (new internal endpoint); F24 later adds the device wipe push.
3. Short link re-pointed within 60 s (cards; update edge cache or revalidate web-public).
4. Leads, share-back submissions, saved contacts, card history and analytics stay with the company and move to the successor or manager. Messaging already keeps conversations on the seat and unassigns them when the seat is inactive: add an end-to-end test that proves it.
5. Personal export: only the person's own public card details.
6. `GET /seats/{id}/handover-summary` (admin, within 5 s): counts that stay, who takes over, the visitor message, access removed confirmation.
7. Notifications to admin and the departing person (what they keep).
8. Event `seat.offboarded`; seat becomes `offboarded` and can be reassigned later with the same URL and QR.
9. After F16: switch on N10 account deletion (`account_deletion` flag) using this flow for the person's seats.

**Tests:** access revoked (old refresh token rejected), short link destination, data ownership, summary counts, reassign keeps URL.

---

## 5. M4 Billing

### 5.1 F17 Plans and subscriptions
**Read:** `F17-plans-subscriptions.md`, plan section 5.1 and 5.2, D-N02.
**Owner:** `services/payments` (4010).

**Decision to make first (ask the founder; default if no answer):** the spec defaults payments to PostgreSQL + Prisma (OPEN-PAYDB). **Default for this plan: MongoDB** (one database to run on the VPS; use multi-document transactions on the replica set for money changes). Log it as `D-F17-DB`. If the founder chooses PostgreSQL, keep the repository interfaces so the adapter can be swapped.

**Build:**
1. `GET /plans`, `POST /subscriptions`, `PATCH /subscriptions/{id}` (seats, plan, monthly or annual), `POST /webhooks/razorpay` (signature verified with the webhook secret, idempotent by event id, safe out of order: apply only if newer than the stored state).
2. `PaymentGateway` port: fake (tests, demo) and **real Razorpay adapter** (subscriptions, UPI AutoPay mandates, cards, netbanking) using the official HTTP API; keys from env; never called in tests.
3. Proration on seat add and remove; upgrade and downgrade; downgrade never deletes; over-limit seats become read-only.
4. Dunning D+1, D+3, D+7 (F22), 7-day grace.
5. **Real `PlanLimits`:** one config table in `packages/shared/src/limits/plans.ts` for free, starter, business, enterprise (seats, branches, templates, catalogue items, posts per month, requests per month, call requests, relationships, requirement responses), with a test per plan. Replace the scattered numbers: `services/organization/src/domain/plan-limits.ts`, messaging `companyRequestsPerMonth`, N02 free limits, cards catalogue limit. Publish `plan_limits.changed`; consumers apply within 60 s.
6. Flag `payment_after_first_card` controls where payment sits in onboarding.
7. Enterprise by invoice (manual activation from the ops console).

**UI:** Billing section in the dashboard: current plan, seats used, change plan, payment method, history; checkout with Razorpay Checkout (test mode keys in development).
**Tests:** webhook signature, idempotency, out-of-order events, proration maths, limits per plan, read-only over-limit seats.

### 5.2 F18 GST invoices and plan lapse
**Read:** `F18-invoices-lapse.md`.
**Owner:** payments.

**Build:**
1. GST invoice: company GSTIN, HSN/SAC, CGST + SGST for the same state or IGST otherwise, gap-free numbering per financial year (a counter document updated in a transaction), credit notes. Legal entity name and address from config (**ask the founder: question Q5**; use a clearly marked placeholder until then).
2. PDF generated server-side (e.g. `pdfkit`), emailed (F22), downloadable `GET /invoices/{id}.pdf`. Subscription and NFC order charges can share an invoice.
3. Lapse: days 0 to 30 after expiry cards stay live and admins see a renewal banner; after 30 days cards show the company's basic profile; the Business ID is never released; nothing deleted; renewal restores everything immediately. Publish `subscription.status_changed`; cards, web-public, messaging (company inbox read-only?) react — check the feature file and log what you chose.

**Tests:** tax split by state, numbering without gaps under concurrency, credit note, lapse timeline with a fake clock.

---

## 6. M5 NFC and print

### 6.1 F20 Printed card artwork and proofs
**Read:** `F20-printed-card-artwork.md`, F09 (contrast), F11 (short links).
**Owner:** cards (print module).

Build the three families (small business, medium employee, owner and leadership) with the print rules (90 × 54 mm, 3 mm bleed, artwork 96 × 60 mm, safe area 4 mm, QR ≥ 20 mm on a light plate); default family by plan and role with admin override; brand kit recolouring of the medium family with the 4.5:1 contrast check; server PDF with bleed and crop marks; front and back proof preview; approved proof stored with a SHA-256 hash and the print file must match it; wood and metal engraving variants (metal QR-only); sample data labelled as sample.
**Tests:** dimensions in the PDF, QR size and quiet zone, hash check, contrast refusal.

### 6.2 F19 NFC catalogue and orders
**Read:** `F19-nfc-catalogue-orders.md`.
**Owner:** payments (orders, payment, invoice) + cards (proofs, seat data).

Catalogue prices (excl. GST) and volume discounts from the feature file; order flow: seats, material, family, quantity, shipping (one address or per branch), **proof approval before payment**, Razorpay payment, GST invoice; status timeline (placed, proof approved, printing, encoding, QC, dispatched with tracking, delivered) with `nfc.order_status_changed` and notifications; metal notice (QR-only, NFC not guaranteed); bulk ordering from the People list (extends F15); orders blocked for vacant or offboarded seats.

### 6.3 F21 NFC activation and lost cards
**Read:** `F21-nfc-activation-lost.md`.
**Owner:** cards.

Chip states unactivated, active, disabled; activation by tapping on the seat holder's own signed-in phone (or scanning the card QR), one chip per seat; unactivated chip page "This card is not active yet" (no personal data); lost or stolen → disabled, neutral "This card is inactive" page, within 60 s; admin can reassign or reorder (replacement price); all actions audited; events `nfc.chip_activated`, `nfc.chip_disabled`; offboarding re-points via the short link, never re-encoding.

### 6.4 F25 Ops console: KYB, NFC fulfilment, tenants, impersonation, flags
**Owner:** admin-console + organization (KYB) + payments (orders).

1. KYB queue: GSTIN checked through a `GstVerifier` port (fake), legal-name match, mismatches to manual review with a document viewer (media), SLA timer, reviewer assignment, decision with reason, `kyb.status_changed` (search, social, messaging already consume it).
2. NFC fulfilment: order queue, vendor assignment, encoding batch (NDEF URL to the short link, write-lock), QC checklist (includes the CMYK physical proof check from F20), dispatch with courier and tracking.
3. Tenant management: search, plan, usage, health.
4. Impersonation: reason required, time-boxed (30 min), logged, visible to the customer admin, needs customer consent (the customer admin approves a request in their dashboard).
5. Should: feature flags and plan configuration without deploy, per-tenant overrides (a `feature_flags` collection read by services with a 60 s cache).
6. Moderation (from M2) and the student queue (M8) live here too.

---

## 7. M6 Insight and mobile

### 7.1 F23 Analytics
**Read:** `F23-analytics.md`; current analytics code in cards (`MongoAnalyticsEventRepository`, `dashboard.service.ts`) — read it before deciding how to move ingestion.
**Owner:** `services/analytics` (4011).

1. `POST /analytics/events` (batch up to 100) replaces the stub; events from the feature file; no cookies for visitors, a random daily session id, no personal data in names or properties.
2. Store behind an `AnalyticsStore` port: MongoDB (time-series collection or daily rollups) now; ClickHouse later (leave a `// shortcut:` comment and log it).
3. Queue and replay: card pages and redirects never fail because analytics is down (the client and the edge buffer; the service accepts late events).
4. Dashboards: employee (views, saves, leads, top sources, 7/30/90-day trends, mobile friendly) and admin (totals, by branch, department and employee, leaderboard, top products), scoped by role (Branch Manager sees only their branch). Endpoints `GET /analytics/summary`, `/timeseries`, `/leaderboard`.
5. Retention by plan (Starter 90 days, Business 1 year, Enterprise 2 years).
6. Network metrics needed for the phase exit gates: follows, enquiries, chat first-response time, call request outcomes, later posts and requirement responses (consume the existing events; counts only).
7. Should: QR source split, approximate city (IP-derived only), CSV export, weekly email report.

**Tests:** counts within 1% of source, role scoping, retention cut-off, no personal data accepted (reject properties that look like phones or emails).

### 7.2 F24 My Card PWA
**Read:** `F24-my-card-pwa.md` completely (budgets, security, caching).
**Owner:** web-app under its own scope `/my-card` (own manifest and service worker; never controls admin pages).

Manifest (name "OneBridge", standalone, theme Bridge Orange, background Warm Paper, `start_url /my-card?source=pwa`, scope `/my-card`); install prompt after the first successful share (Android, desktop Chromium), iPhone guide, dismissal respected 14 days; offline card and on-device QR (SVG cached); last 50 leads cached with phone and email encrypted in IndexedDB using a non-extractable WebCrypto key; write queue with idempotency keys and `POST /leads:sync`; controlled updates ("Update available" banner); Web Push with VAPID (`POST /push-subscriptions`, `DELETE /push-subscriptions/{id}`; sending through F22); cache wipe on logout, session revocation, seat unassignment, offboarding, plan lapse, 14 days without sync; budgets (150 KB JS gzipped, QR within 300 ms offline). Web NFC is **not** built (hint only, hidden on iPhone).

**Tests:** service worker scope, offline QR, queue flush and idempotency, encryption of cached leads, wipe triggers; a budget check script in CI (`scripts/check-public-budgets.mjs` exists: extend it).

---

## 8. M7 Network growth

### 8.1 N05 Posts and feed
**Read:** `N05-posts-feed.md`; drafts in `network.yaml`.
**Owner:** `services/social` (posts, comments, reactions, feed).

1. Authors: member, or company (Owner and Admin by default; company setting allows other roles).
2. Content: text up to 3,000; up to 10 images or one PDF (media service); one YouTube or Vimeo link (loaded on tap); or one link preview (section 2.3.3); hashtags; @mentions of companies and members.
3. Types with structured fields: update, product (links a catalogue item), project, hiring (role, city, apply by chat), event or expo (date, venue, stall), certificate.
4. **Contact detection (D-CONTACT):** one detector in `packages/shared/src/contact-detector.ts` (Indian mobile formats with spaces, dashes and +91; emails, including "name at domain dot com" variants). Publishing is refused with "Use chat or request a call instead". Reused by N07.
5. Drafts from activity (catalogue item added, portfolio project added, seat claimed with the person's consent, event QR created, KYB verified): offered, never auto-published (`GET /me/post-drafts`).
6. Visibility public or followers only; Free plan posts per month (2) from plan limits.
7. Reactions (like, insightful, celebrate; one per member per post), one-level comments up to 1,250 characters (author can turn off or delete), reshare with comment, edit within 24 hours ("Edited"), delete removes from feeds and search within 60 s.
8. Feed: followed authors newest first, small boosts for verified authors and engagement, at most 2 in a row from one author, "Suggested" (city or industry) and "Promoted" labels. Cursor pagination; precompute nothing at first (query by followed author ids, indexed by `authorId, createdAt`); measure and log.
9. N09: report posts and comments; posts from accounts under review and new accounts' link posts are **held** (status `held`).
10. Notifications: mentions, comments on your post; reactions batched into a digest.
11. Search: index posts? Only if the feature file requires it; otherwise company and member search stays as is.

**UI:** `/feed` (home for members), composer with type picker, post cards, comments, reactions, company and member post tabs, drafts tray.

### 8.2 N06 Relationships and endorsements
**Read:** `N06-relationships-endorsements.md`.
**Owner:** `services/graph` (4014).

Propose (types supplier of, client of, distributor of, partner, contractor for; optional since, products, city), confirm (or confirm with edits that the proposer must accept), decline, end (history kept privately 12 months then deleted); reverse type shown automatically; badges "Verified relationship" (both KYB-verified) or "Confirmed relationship"; never public before confirmation; private relationships counted without names; plan limits (Free views only); endorsements only from confirmed partners, 500 characters, written by Owner or Admin, shown after the receiver approves, hideable, withdrawable, no star ratings; anti-gaming (one relationship per type per pair; companies with the same Owner cannot confirm each other and show as "Related company" — needs an identity internal endpoint for company owners); feed search ranking and the "has verified clients" filter in search (consume `relationship.confirmed`); all actions audited. Each side reads only its own relationships plus public confirmed ones, enforced in the repository layer.

### 8.3 N07 Requirements and matching
**Read:** `N07-requirements-matching.md`.
**Owner:** `services/requirements` (4015).

Post (product or service, taxonomy from search, quantity and unit, delivery city, needed by, optional hidden budget, description up to 2,000, up to 5 attachments) with contact detection; visibility "matched suppliers only" (default) or public board; buyer shown or hidden ("A verified buyer in <city>") until they reply; matching on taxonomy, city or service area, catalogue keywords (through search's API, not its database) and verification, verified first, at posting and when new suppliers join the category; matched suppliers notified once (no budget unless allowed); supplier responds with a short quote (price, availability, lead time, note) which opens a chat (`context: { kind: 'requirement', id }`, skips the request step) and uses one response from the plan allowance (add-on credits later); buyer view side by side (name, verified badge, confirmed relationships count from graph, quote), shortlist, reply, decline politely, close; lifecycle open → closed, auto-close 30 days after needed-by (or after posting), reminder 3 days before; leads with source `requirement` in cards; limits per plan and for new accounts; identical requirements blocked; public board pages on web-public `/board/<city>/<industry>` (SEO like the directory pages, noindex when empty); analytics: match count, response rate, time to first response.

---

## 9. M8 Student plan (F27, behind flag `student_plan`)
**Read:** `F27-student-plan.md` completely.
**Owner:** identity (`OB-S` IDs, own registry per ADR-0001), a `students` module in organization or a small `students` service (choose and log), media (ID images), admin-console (verification queue).

Self-declared eligibility, then both checks: college email code (domain allowlist managed in the console; free-mail domains rejected) and college ID upload reviewed within 48 hours; colleges without an email domain need a second proof and senior review; one active student plan per person (phone + ID hash); ID images in a separate encrypted folder readable only by the ops review role, deleted 30 days after the decision; plan limits (1 card, 2 templates, 5 catalogue or portfolio items, 7-day analytics, email-only share-back notifications, smaller keystone badge); annual re-verification with a reminder 30 days before; lapse behaviour; export and delete (N10); joining a company later creates a separate seat.

---

## 10. M9 Readiness (without the VPS)

Do these after M1 to M8. Each is a checklist item in the report.

1. **End-to-end suite** (Playwright specs in `tests/e2e/`, runnable in CI even if headless is unreliable locally): onboarding to first card in under 10 minutes; share-back to notification; chat and call request; offboarding; offline QR; NFC order to activation (with fakes).
2. **Accessibility audit** of every dashboard and public page (WCAG 2.1 AA): keyboard, screen reader labels, contrast, 44 px targets, reduced motion. Fix failures.
3. **Performance budgets:** visitor page LCP ≤ 1.5 s on 4G in a lab run, ≤ 300 KB before media; dashboard API p95 400 ms read / 800 ms write in a local load test; extend `scripts/check-public-budgets.mjs`.
4. **Security checks:** dependency audit clean of high issues; RBAC review of every new endpoint (who can call it); cross-tenant tests exist for every collection; no personal data in logs (add a test that scans log output of the e2e run for phone and email patterns).
5. **Outbox:** a transactional outbox in `packages/shared` (write the event in the same transaction as the data; a relay publishes it) used by payments first, then any service that changes money, leads or seats. (Needed before running more than one process.)
6. **Search debt:** a one-off reindex job (`scripts/reindex-search.mjs`) that rebuilds `search_documents` from each service's public endpoints; Meilisearch adapter behind `SearchIndex` (optional now; log).
7. **Hindi copy:** every user-facing template has Hindi; list strings that need a native speaker's review in the report.
8. **Docs:** update `README.md` feature list, `docs/plans/remaining-implementation-guide.md` status, and the report.

---

## 11. Final report

Write `docs/reviews/features-implementation-report.md`, with one section per milestone, updated as each milestone finishes:

1. **Summary:** features done, branch, commits (hash and subject).
2. **Checklist per feature:** every acceptance criterion from the feature file marked done / partly / not done, with the test that proves it.
3. **Tests:** commands and results per package; anything not run and why.
4. **Browser checks:** what was tried; screenshot paths.
5. **Contracts:** new and changed endpoints and events.
6. **New services and collections:** ports, collections (global or tenant-scoped, and why).
7. **Adapters:** every provider interface, its fake, whether a real adapter exists, and what account or key it needs.
8. **Decisions made** (also in `docs/decisions.md`).
9. **Open questions for the founder** (also in `docs/questions.md`): at least Q5 legal entity, payments database, grievance officer, WhatsApp and SMS providers, Razorpay keys, storage for production, ops account holders.
10. **Shortcuts and known risks:** each with its `// shortcut:` location.

## 12. What the reviewer will check
- Acceptance criteria covered by tests, not just implemented.
- No phone, email, message or note text in events, logs, analytics or list responses; call-request phones only after accept and only to the receiver.
- Cross-tenant tests for every new collection; services do not read each other's databases.
- Blocks, suspensions and privacy settings are enforced in **every** service they affect.
- Money: webhook signature and idempotency, gap-free invoice numbers, proration maths.
- Every external provider behind an interface with a fake; no real provider in tests; production guard used.
- UI states and accessibility; orange never used as text.
- Contracts match the implementation; types regenerated.
- No weakened tests; no committed temporary config, `.env` or `.claude/`.
