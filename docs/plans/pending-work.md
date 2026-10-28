# Pending work: what is left and how to finish it

**Written:** 2026-10-28, at commit `e57a679` on `feat/vps-auth`.
**For:** the founder (what is left, in what order) and the coding agent that builds it (how).
**Status in one line:** the product works for companies, cards, leads, member profiles, follow, search and chat, with production sign-in and a VPS setup ready. Before real customers, **section 2** must be finished. After that, the remaining features (section 4) are built one milestone at a time.

---

## 1. What is done

| Area | Done |
|---|---|
| Core | F00 platform, F01 sign-in, F02 roles, F03 Business ID, F04 audit log, F05 UI kit, F06 company profile, F07 structure, F08 seats, F09 brand kit, F10 card templates, F11 short links and QR, F12 visitor card page, F13 share-back and leads, F14 invites, F26 public company page |
| Network | N01 member profiles, N02 free company profiles, N03 directory and search, N04 follow, N08 real-time chat |
| Sign-in (Plan 2, Part A) | Google; email + password with emailed codes; new-device check; forgot and change password; phone sign-in off in production |
| Production (Plan 2, Part B) | production API runner, Docker image, Compose with Caddy and MongoDB, env template, deploy / rollback / backup / restore scripts, runbook, production adapters (real email, files on disk, encryption with the real key) |

Report of the last work: `docs/reviews/vps-auth-implementation-report.md`.

---

## 2. Must finish before real customers (launch blockers)

Do these in this order. P1 to P3 are code; P4 to P7 need the founder or the senior engineer.

### P1. Fix the MFA setup hole (security, code)

**Problem.** `POST /auth/mfa/setup` (`services/identity/src/presentation/nest-auth.controller.ts`, `setupMfa`) accepts an `mfaTicket` without checking it: it splits the text on `:` and uses the last part as the user ID. Anyone who knows a person's user ID can call it, which **turns that person's MFA off** (`setupMfaForUser` writes `mfa: { enabled: false, secret }`) and returns the new secret. MFA can be bypassed this way. Also, the web app's MFA setup screen shows a fixed secret (`JBSWY3DPEHPK3PXP` in `apps/web-app/src/features/auth/AuthFlow.tsx`) instead of the server's, so setup never worked.

**Fix:**
1. In `setupMfa`, replace the ticket parsing with `userId = this.authService.tokenService.verifyMfaTicket(body.mfaTicket)` inside `try`; on failure answer `401` with code `invalid_ticket`. Do the same check anywhere else a ticket is parsed by hand (search `split(':')` in `services/identity/src`).
2. `setupMfaForUser` must not overwrite an **enabled** MFA: if `person.mfa.enabled` is true, answer `409` `mfa_already_enabled` (turning MFA off is a separate, re-authenticated action, not part of this fix).
3. Web app: in the `mfa_setup` step, call `POST /auth/mfa/setup` with the `mfaTicket`, show the returned secret and its `otpauth://` link as a QR code (the `qrcode` library is already a dependency of cards; add it to web-app or render the code server-side), then `POST /auth/mfa/verify` with the ticket and the code. Remove the hard-coded secret.
4. Tests (identity HTTP test): a forged ticket (`"x:usr_123"`, a random string, an access token) is refused; a real ticket works; setup on an enabled MFA is refused. Web app component test: the screen shows the secret it received, not a constant.
5. Log `D-MFA-SETUP-FIX` in `docs/decisions.md`.

### P2. Docker trial run (proves Plan 2 Part B)

The image, the Compose stack and the scripts have **never run** (Docker was not installed on the development machine). Run them once before the real server, either on a developer machine with Docker or on the VPS itself before DNS points to it:
1. Install Docker (Docker Desktop, or Docker Engine in WSL 2 Ubuntu).
2. `cp .env.production.example .env`; fill it with generated secrets; set `SITE_DOMAIN=localhost`, `PUBLIC_URL=https://localhost`, `APP_URL=https://localhost`, `WEB_PUBLIC_URL=https://localhost`.
3. Email for the local trial only: production refuses the console sender. Either use a real SMTP test account (Mailtrap, Ethereal), or add a guard-accepted override: `ALLOW_CONSOLE_EMAIL_FOR_LOCAL_TEST=true` honoured by `createEmailSender` **only** when `SITE_DOMAIN=localhost` (test it, log it). Recommended: Ethereal, no code change.
4. `docker compose up -d --build`, then `curl -k https://localhost/healthz` must answer 200 with every service `ok`.
5. Smoke test (as in `deploy/DEPLOYMENT-GUIDE.md` section 9) as far as possible locally (Google needs `https://localhost` added as an authorised origin, or skip it).
6. `docker compose restart`, and `docker compose down && docker compose up -d`: the data must survive.
7. `./deploy/backup.sh` with a local rclone remote (`rclone config` → type `local`) and `./deploy/restore.sh <file>`: counts must match.
8. Record image size (`docker images`), memory per container (`docker stats --no-stream`), build time. Fix whatever fails; commit fixes; update the report's section 5.

Known risk points to watch: `pnpm prune --prod` keeping everything `next start` needs; the Mongo keyfile entrypoint; `mongo-init` waiting for the primary; web-public's `/_cards` assets through Caddy; `/svc/messaging/realtime` WebSockets through Caddy.

### P3. Terms of Service and Privacy Policy pages (code, after P5)

Sign-up links to `/terms` and `/privacy` on the public site, which do not exist. When the founder provides the text (P5):
1. Add `apps/web-public/app/terms/page.tsx` and `app/privacy/page.tsx` (static, readable, dated, with the version string).
2. The version strings must equal `TERMS_VERSION` and `PRIVACY_VERSION` in `apps/web-app/src/features/auth/auth-errors.ts`; bump both whenever the text changes.
3. No routing change is needed: Caddy already sends every non-admin path to web-public.
4. Link them in the public site footer and the admin app footer.

### P4. Accounts and settings (founder)

The stack refuses to start without these (Q-19):
- **Google:** OAuth 2.0 Web client ID (see the deployment guide, section 3.2).
- **Email:** an SMTP provider with SPF, DKIM and DMARC on `onebridgecard.com` (guide section 3.3).
- **Server:** Ubuntu 22.04 or 24.04, 4 GB RAM or more, SSH access for the senior engineer.
- **Backups:** an S3-compatible bucket (Backblaze B2 recommended) and a key limited to it.
- **Repository:** which GitHub repository and branch the server pulls (after merging `feat/vps-auth`).

### P5. Legal content (founder)

Terms of Service and Privacy Policy text, the legal entity name and address, and the grievance officer's contact (DPDP / IT Rules). Must come from the founder or a lawyer (Q-18).

### P6. Merge and deploy (founder, senior engineer)

1. Review and merge `feat/features-completion` and `feat/vps-auth` into the branch the server will pull (open a pull request; check CI is green).
2. The senior engineer follows `deploy/DEPLOYMENT-GUIDE.md` end to end, including the smoke test.

### P7. Decide on spam protection for card share-backs (founder)

The card page sends no Turnstile token, so share-backs are limited only by rate limits (Q-17). Either accept that for launch and watch for spam, or build it first:
1. Cloudflare dashboard → Turnstile → add site `onebridgecard.com` → site key and secret key.
2. `packages/ui-kit` `VisitorCard`: render the Turnstile widget (script `https://challenges.cloudflare.com/turnstile/v0/api.js`, loaded only on card pages) in the share-back form, put its token in `turnstileToken`.
3. `NEXT_PUBLIC_TURNSTILE_SITE_KEY` in `scripts/lib/next-public-env.mjs` and the env template; `TURNSTILE_SECRET` in `.env` (cards already verifies with Cloudflare when it is set).
4. Privacy notice line under the form; component test; Content-Security-Policy if one is added.

---

## 3. Small follow-ups (soon after launch)

| Item | Where | What to do |
|---|---|---|
| Growing delay after failed sign-ins | `PasswordAuthService.login` | Today: 5 failures lock 15 minutes. Add 1 s, 2 s, 4 s delays after failures 2 to 4 (plan A5) |
| Common-password list | `services/identity/src/domain/password.ts` | Declined by the founder for now; if wanted later, add SecLists `10k-most-common.txt` (MIT) and check it in `checkPasswordPolicy` |
| Access tokens after reset | `TokenService` | Access tokens live 15 minutes after a password reset. If that matters, add a per-person "tokens before this time are invalid" check in `verifyAccessToken` |
| Demo seed without phone | `scripts/demo-seed.mjs` | Optional: sign in by email when `AUTH_METHODS` has no phone (dev and demo keep phone today) |
| Render demo retirement | `render.yaml`, `scripts/single-*.mjs` | After the VPS is live and stable (D8), delete them and their docs lines |
| Old in-memory OTP repos | identity | `InMemory*` repositories are test-only; keep them out of any production path (they are today) |

---

## 4. Remaining product features

Full, step-by-step instructions for every feature are in **`docs/plans/features-implementation-handoff.md`** (sections 2 to 10). That plan was written before the new sign-in and the VPS work; **section 5 below lists what changed**, and wins where they differ.

| Milestone | Features | Plan section | Status |
|---|---|---|---|
| M1 Foundations | F22 notifications, media service, N08 follow-ups (attachments, chat leads, enquiry routing) | 2 | Not started. Partly prepared: email sender, invite and lead emails, logo storage on disk |
| M2 Contact and safety | N11 request a call, F25 ops console skeleton, N09 moderation and blocking, N10 privacy, export, delete | 3 | Not started |
| M3 Employees | F15 CSV import and bulk actions, F16 offboarding | 4 | Not started |
| M4 Billing | F17 plans and subscriptions (Razorpay), F18 GST invoices and plan lapse | 5 | Not started |
| M5 NFC and print | F20 artwork and proofs, F19 NFC orders, F21 activation and lost cards, F25 KYB and fulfilment | 6 | Not started |
| M6 Insight and mobile | F23 analytics, F24 My Card PWA | 7 | Not started |
| M7 Network growth | N05 posts and feed, N06 relationships, N07 requirements | 8 | Not started |
| M8 Student plan | F27 (behind a flag) | 9 | Not started |
| M9 Readiness | F28 hardening items, end-to-end tests, accessibility and performance audits | 10 | Partly: production secrets, memory and rate-limit fixes done in Plan 2 |

Founder decisions needed along the way (each is also in the plan): payments database (MongoDB recommended), the legal entity on GST invoices, Razorpay account, SMS / WhatsApp provider (for F22 later channels and N11), who gets ops console accounts, and when to switch the visitor card's Call / WhatsApp buttons to Chat / Request a call.

---

## 5. Changes to the features plan (read before building)

These override `features-implementation-handoff.md`.

**5.1 Branch.** Create `feat/features-m1` (one branch per milestone: `feat/features-m2`, ...) from the merged result of `feat/vps-auth`, not from `feat/step-3-cards-f10`. Push only to `origin`. Never to `main` or to the `onebridge` remote.

**5.2 Already built (reuse, do not rebuild):**
- Email: `packages/shared/src/email/` (`EmailSender`, `ConsoleEmailSender`, `SmtpEmailSender`, `createEmailSender`, `renderEmail` with English and Hindi templates). F22's email channel uses it; add new templates to `templates.ts`.
- Production guards: `assertNotFakeInProduction` and `resolveSecret` / `resolveEncryptionKey` / `resolveInternalServiceKey` in `packages/shared`. Every new adapter choice and every new secret goes through them.
- Invite emails (`EmailInviteNotifier`) and new-lead emails (`EmailLeadNotifier`): F22 takes these over as event consumers (in-app + push + email per preferences), then the two notifiers are removed in the same change.
- Logo files: `LocalDiskMediaStorage` in organization writes to `MEDIA_DIR`. The media service (plan 2.2) uses the same `MEDIA_DIR` volume; moving the brand kit onto the media service is optional.
- Client IP: read the first `X-Forwarded-For` entry (see `getClientIp` in identity); never `req.ip` alone (behind the router it is always 127.0.0.1).

**5.3 Sign-in has changed.** Phone sign-in exists only in development. New features must not depend on it:
- Re-confirming identity (N10 account deletion, sensitive settings): add `POST /auth/reauth` in identity that accepts **the current password** (email accounts) or **a fresh emailed code** (any account: add `'reauth'` to `EmailCodePurpose` and a template, then reuse `PasswordAuthService.issueCode` / `consumeCode`) or a **fresh Google token**; it returns a 5-minute `reauthTicket` the calling service verifies through `GET /internal/reauth/{ticket}` (service key).
- Phone numbers (N11 call requests, cards) are typed by the user; never taken from sign-in.
- Demo sign-in in the browser on the dev stack: email `aarav.owner@acme.example.com` (or any seeded person) with `DevPassword-2026!`, code `123456` (development only).

**5.4 Wiring a new service.** In addition to the table in the plan's section 0.5:

| File | Add |
|---|---|
| `scripts/prod-api.mjs` | `TARGETS` port, the name in the loader list, `start(...)` before organization if it listens to org or seat events, the route regex, the upgrade regex if it uses WebSockets |
| `scripts/lib/next-public-env.mjs` | the name in `SERVICES` (builds and `NEXT_PUBLIC_<NAME>_API_URL` for both Render and VPS) |
| `src/config/env.ts` | secrets through the shared `resolve*` helpers |
| `.env.production.example` | every new variable, with a comment and how to create it |
| `deploy/Caddyfile` | only for a new top-level page path in the admin app (add it to `@admin`); the ops console gets its own site block or `/ops` (decide, log it) |
| `deploy/DEPLOYMENT-GUIDE.md` and `deploy/RUNBOOK.md` | anything the operator must set up (a new secret or account: the guide; a new volume, cron job or routine task: the runbook) |

`scripts/single-build.mjs` no longer needs editing (it reads `SERVICES`).

**5.5 Running tests on the Windows machine.** The temporary config in the plan's section 0.4 fails on files with decorators. Use this instead (it is what was used for every test run so far), and delete it after:
- Node packages:
  ```ts
  import { defineConfig } from 'vitest/config';
  import path from 'node:path';
  export default defineConfig({
    oxc: { decorator: { legacy: true, emitDecoratorMetadata: true } } as never,
    test: { globals: true, environment: 'node', fileParallelism: false, include: ['tests/**/*.spec.ts'], setupFiles: [path.resolve(import.meta.dirname, '../../tests/setup-mongo.ts')] },
  });
  ```
- jsdom (web apps): `oxc: { jsx: { runtime: 'automatic' } }` and `environment: 'jsdom'`.
- Set `TEMP` and `TMP` to `D:\Onebridge projects\.tmp-mongo`.

**5.6 Commit discipline.** Chain checks to the commit with `&&` only (`npx eslint <paths> && pnpm typecheck && git commit ...`). Never `;` or a pipe after lint: twice a commit went in with lint errors that way.

**5.7 Production check per milestone.** Besides tests: build the services, start `node scripts/prod-api.mjs` against a local MongoDB with production settings (as in the report's section 5) and check `/healthz` is 200 and the new service refuses stand-in adapters.

---

## 6. Definition of done (every item above)

- Acceptance criteria implemented with tests (happy path, failures, edge cases, cross-tenant).
- Contract first; types generated; no breaking change for existing clients.
- Every UI state designed (loading, empty, error, offline); labels, focus, 44 px targets, axe clean; orange only as a fill.
- No personal data in logs, events or analytics.
- `pnpm typecheck` and `pnpm lint` clean, all tests green; numbers pasted in the milestone report.
- Decision logged in `docs/decisions.md`; open questions in `docs/questions.md`.
- Browser check on the dev stack; production check (5.7).
- Report written to `docs/reviews/<milestone>-report.md` and the founder asks for a review before the next milestone.
