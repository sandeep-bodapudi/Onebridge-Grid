# Implementation handoff: new sign-in and VPS deployment

**For:** the coding agent implementing this work.
**Written:** 2026-10-27, after commit `71d5cd9` (N08).
**Runs after:** `docs/plans/features-implementation-handoff.md`. The founder completes that plan first; this one builds on its result (see section 0.6).
**Background plan:** `docs/plans/vps-deployment-and-auth-plan.md` (the why). This document is the **how**: ordered tickets with files, steps and acceptance checks. When the two disagree, this document wins; when this document is silent, stop and ask (section 0.3).

---

## 0. Read this first

### 0.1 Goal
1. Replace phone sign-in with **Continue with Google** and **email + password with a 6-digit email verification code**.
2. Make the product run for **real customers** on a dedicated VPS with **Docker Compose**, behind **Caddy** with HTTPS on **`onebridgecard.com`**, with a persistent MongoDB, backups and a runbook. The senior engineer deploys by hand: `git pull` then `./deploy/deploy.sh`.

### 0.2 Read before writing code
1. `.agent/AGENTS.md` (rules, definition of done) and `CONTRIBUTING.md`.
2. `docs/plans/vps-deployment-and-auth-plan.md`.
3. `docs/onebridge-spec-pack/docs/features/F01-auth.md` and `F14-invite-seat-claim.md`.
4. `docs/decisions.md`, the newest entries (D-F14, D-N01 to D-N08), so you follow existing patterns.
5. Code you will change: `services/identity/src/**`, `apps/web-app/app/login/page.tsx`, `apps/web-app/src/features/auth/AuthFlow.tsx`, `apps/web-app/src/api-client.ts` (auth methods near lines 130 to 260), `scripts/demo-server.mjs`, `scripts/single-server.mjs`, `scripts/single-build.mjs`.

### 0.3 Rules (non-negotiable)
- **Branch:** create `feat/vps-auth` from the reviewed features branch (`feat/features-completion`, or whatever the founder merged it into; ask if unsure). Commit there. Push **only** to `origin feat/vps-auth`. **Do not push to the `onebridge` remote or to any `main`.** The founder will ask for a review before merging.
- **Small commits**, Conventional Commits, one per ticket or smaller, each ending with the co-author line the session requires.
- **Tests first** for each acceptance check. Never disable, skip or weaken a test or lint rule to get green; report the problem instead.
- **Never commit:** `.env`, any real secret, `vitest.noswc.config.ts`, `.claude/`, `node_modules`, build output.
- **No personal data in logs or events:** no email in clear, no password, no code, no phone. Use the existing redaction in `packages/shared/src/redaction.ts` and logger.
- **Do not stop or kill anything on port 3000** (another project uses it). Use the `dev-alt-ports` launch config (web-app 3002, web-public 3003).
- **Demo data only** in seeds and tests. Never a real person's phone or email; use `example.com` / `example.in` addresses and `+9197000xxxxx` numbers.
- **Stop and ask** the founder when: a spec or decision is missing, two documents disagree, or a rule above would be broken. Write the question in your final report if you cannot ask live, and build everything else.
- **Log every decision you make yourself** in `docs/decisions.md` with date and reason.

### 0.4 Decisions already made (defaults)
The founder chose Docker Compose, the domain `onebridgecard.com`, real customers, and Google + email/password sign-in. The rest are the recommended defaults; build them unless the founder changes them (then follow the change):

| ID | Decision |
|---|---|
| D1 | Email is sent through **SMTP** (one adapter covers Zoho ZeptoMail, Amazon SES SMTP, or any SMTP provider). A `console` adapter is used in development and tests |
| D2 | Codes from `no-reply@onebridgecard.com`, reply-to `support@onebridgecard.com` (both from env) |
| D3 | Phone sign-in **off in production**, still available in development and tests (`AUTH_METHODS`) |
| D4 | Email code at sign-up, at password reset, and at login from a **new device** or after **30 days** without a code on that device. No code for Google sign-in |
| D5 | Passwords hashed with **scrypt from `node:crypto`** |
| D6 | Google and email accounts with the same email link automatically only when **both** emails are verified; otherwise an email code is required first |
| D7 | Off-server backups through **rclone** to an S3-compatible bucket (Backblaze B2 or S3) |
| D8 | Keep `render.yaml` and the Render demo working until the VPS is live; do not delete them |
| D9 | `www.onebridgecard.com` redirects to `onebridgecard.com` |
| D11 | Invite claim (F14) uses **email** in production |

### 0.5 Local environment quirks (Windows machine)
- `@swc/core` fails to load. To run a package's tests, create a **temporary** `vitest.noswc.config.ts` and delete it afterwards:
  - Node packages: `import { defineConfig } from 'vitest/config'; import path from 'node:path'; export default defineConfig({ test: { globals: true, environment: 'node', fileParallelism: false, include: ['tests/**/*.spec.ts'], setupFiles: [path.resolve(import.meta.dirname, '../../tests/setup-mongo.ts')] } });`
  - jsdom (web-app, ui-kit): `export default defineConfig({ oxc: { jsx: { runtime: 'automatic' } }, test: { globals: true, environment: 'jsdom', fileParallelism: false } } as any);`
  - Run with `TEMP` and `TMP` set to `D:\Onebridge projects\.tmp-mongo` (drive C: is full; mongodb-memory-server needs space).
- Rebuild shared after changing it: `pnpm --filter @onebridge/shared build`.
- One `connectMongo` client per test file; suites that need their own server go in their own file.
- After changing `packages/api-contracts/*.yaml`, run `pnpm contracts:gen` and **read the output**; quote YAML text that contains `{braces}` (a flow map once failed silently).
- Many files use CRLF line endings. If you script edits, preserve them.
- Git Bash rewrites values like `/svc/identity` into Windows paths when passed as env vars; set such env vars from a Node script, not the shell.
- The identity service allows only about 5 sign-in codes an hour per network in development; plan browser checks.
- Headless Playwright is unreliable on this machine; verify UI in a real browser (or the in-app browser pane) and with component tests.

### 0.6 What the features plan already built (reuse, do not redo)
- `packages/shared/src/email/` (`EmailSender`, console and SMTP adapters, `EMAIL_PROVIDER`): ticket A2 becomes "add the sign-in templates and the production refusal of `console` if missing".
- `assertNotFakeInProduction` in `packages/shared`: extend its use (A7, B1).
- `POST /auth/reauth` in identity (used by N10 account deletion): switch it from the phone code to **password or email code** (and Google re-sign-in) in A5.
- N11 call requests are signed-in only; the signed-out path (light account) can now use **email** verification instead of phone OTP: add it in A9 if the founder still wants signed-out requests.
- New services from that plan (notifications, media, moderation, calls, payments, analytics, graph, requirements, and the admin console): add **all** of them to `scripts/prod-api.mjs` (B2), the Docker build (B4), the Caddyfile (the console at `ops.onebridgecard.com` or `/ops`, ask), and the env template (B6). Media files live under `MEDIA_DIR` (mount the `media_data` volume there).
- Their fake adapters go into the B1 audit table.

### 0.7 Typecheck and test commands
- Per package: `npx tsc --noEmit -p .` in the package directory.
- Whole repo (CI equivalent): `pnpm lint`, `pnpm typecheck`, `pnpm test` (may need the swc workaround locally).

---

## Part A: New sign-in

### A1. Spec, decision and contract
**Files:** `docs/onebridge-spec-pack/docs/features/F01-auth.md`, `docs/decisions.md`, `packages/api-contracts/openapi.yaml`, `packages/api-contracts/src/index.ts`.

Steps:
1. In F01, add a dated "Change (2026-10-27, founder)" section: sign-in methods are Google and email + password with email codes; phone sign-in is development-only; rules from A3 and A5 below.
2. Append `D-AUTH-EMAIL` to `docs/decisions.md` listing D1 to D6 and D11, and that phone remains a profile and card field.
3. Add to `openapi.yaml` (tag `auth`), with problem+json errors and `code` values:
   - `POST /auth/signup` body `{ name, email, password, acceptedTermsVersion, acceptedPrivacyVersion }` → `202 { status: 'code_sent', ticket }`
   - `POST /auth/signup/verify` `{ ticket, code }` → `200 { status: 'authenticated', accessToken }` (+ refresh cookie) or `mfa_required`
   - `POST /auth/login` `{ email, password, deviceLabel? }` → `200 { status: 'authenticated' | 'code_required' | 'mfa_required', accessToken?, ticket?, mfaTicket? }`
   - `POST /auth/login/verify` `{ ticket, code }` → as signup/verify
   - `POST /auth/password/forgot` `{ email }` → `202 { status: 'code_sent', ticket }` (always)
   - `POST /auth/password/reset` `{ ticket, code, newPassword }` → `204`
   - `POST /auth/password/change` (bearer) `{ currentPassword, newPassword }` → `204`
   - `POST /auth/code/resend` `{ ticket }` → `202`
   - `GET /auth/methods` → `{ methods: ['google','email', ...], googleClientId? }` (public; the login page uses it)
   - Keep `POST /auth/oauth/{provider}`; change `link_confirmation_required` to carry `maskedEmail` and `ticket` (no phone).
   - Error codes: `invalid_credentials`, `email_not_verified`, `code_invalid`, `code_expired`, `too_many_attempts`, `weak_password`, `method_disabled`, `rate_limited` (with `retryAfterSeconds`).
4. `pnpm contracts:gen`; export new types.

**Done when:** types generate; F01 and decisions updated.

### A2. Email sender port (shared)
**Files:** `packages/shared/src/email/` (new): `email-sender.ts`, `console-email-sender.ts`, `smtp-email-sender.ts`, `templates.ts`; export from `packages/shared/src/index.ts`.

Steps:
1. Interface `EmailSender { send(msg: { to: string; subject: string; text: string; html: string; tag: string }): Promise<{ id: string }> }`.
2. `ConsoleEmailSender`: logs `tag` and the **masked** recipient; prints the full code only when `NODE_ENV=development` (so a developer can sign in), never in test or production.
3. `SmtpEmailSender`: uses `nodemailer` (add the dependency to shared with an exact version). Config from env: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_SECURE`, `EMAIL_FROM`, `EMAIL_REPLY_TO`. Timeouts 10 s; one retry on a transient error.
4. `createEmailSender(env)`: `EMAIL_PROVIDER=console|smtp`. In production, `console` **throws at start-up**.
5. Templates (English and Hindi; choose by the person's language, default English): `verification_code` (sign-up), `login_code`, `password_reset_code`, `signup_on_existing_account`, `new_device_sign_in`, `password_changed`, `google_linked`. Plain layout, the code in large monospace text, expiry stated, "If this wasn't you, ignore this email" line, **no sign-in links**. Brand name "OneBridge".
6. Tests: template rendering for both languages; production refuses `console`; SMTP adapter with a fake transport.

### A3. Identity data model
**Files:** `services/identity/src/domain/person.ts`, `mongo-person.repository.ts` (+ in-memory version), new `domain/email-code.ts`, `infrastructure/repositories/mongo-email-code.repository.ts`, `domain/known-device.ts` + repository, `packages/shared/src/mongo/collection-registry.ts`, `packages/shared/tests/collection-classification.spec.ts`.

Steps:
1. `Person`: add `emailVerifiedAt?`, `passwordHash?`, `passwordUpdatedAt?`, `googleSub?`, `language?` (`en` | `hi`); extend `authProviders` with `'password'`. Email is stored **lowercased and trimmed**. Indexes: keep unique sparse `email`, add unique sparse `googleSub`.
2. Collection `email_codes` (global; approve in the guard test with a comment citing D-AUTH-EMAIL): `{ id, ticket (random 32 bytes, base64url, unique), purpose: 'signup'|'login'|'reset'|'link', email, personId?, codeHash (HMAC-SHA256 with a server secret), attempts, sentCount, lastSentAt, expiresAt, consumedAt? }`, TTL index on `expiresAt`.
3. Collection `known_devices` (global; approve): `{ personId, deviceIdHash, label, lastCodeAt, lastSeenAt }`; unique `(personId, deviceIdHash)`.
4. Pending sign-ups: a person is created only **after** the code is verified. Until then the name and password hash live on the `email_codes` record (`pending: { name, passwordHash, consents }`), so abandoned sign-ups leave no account.

### A4. Password utility
**Files:** `services/identity/src/domain/password.ts`, `services/identity/src/domain/common-passwords.txt` (10,000 most common passwords, from SecLists `10k-most-common.txt`, MIT; note the source at the top).

Steps:
1. `hashPassword(pw)`: `crypto.scrypt` with `N=2^15, r=8, p=1, keylen=64`, random 16-byte salt, `maxmem` set high enough; return `scrypt$15$8$1$<salt b64>$<hash b64>`.
2. `verifyPassword(pw, stored)`: parse parameters from the string, `timingSafeEqual`.
3. `checkPasswordPolicy(pw, { email, name })`: 10 to 128 characters; not in the common list (case-insensitive); not equal to the email or name. Return a reason code for `weak_password`.
4. A dummy hash is verified when the email is unknown, so login timing does not reveal whether the account exists.
5. Tests: round trip, wrong password, tampered hash, policy cases, timing helper used for unknown emails.

### A5. Email + password endpoints
**Files:** `services/identity/src/application/password-auth.service.ts` (new), `presentation/nest-auth.controller.ts`, `identity.module.ts`.

Rules (each one needs a test):
1. **Sign-up:** validate email format and password policy. If the email belongs to a verified account, send `signup_on_existing_account` instead of a code and still return the same `202 { code_sent, ticket }` (no enumeration). Record consent versions on verify.
2. **Codes:** 6 digits from `crypto.randomInt`, valid 10 minutes, 5 wrong tries consume the code (`too_many_attempts`), resend after 60 seconds, at most 5 sends per email per hour and 20 per IP per hour (`rate_limited` with `retryAfterSeconds`).
3. **Login:** generic `invalid_credentials` for unknown email or wrong password. Rate limit 5 failures per account per 15 minutes (with growing delay) and 30 per IP per 15 minutes. Unverified email → send a sign-up code and return `email_not_verified` with a ticket.
4. **New device (D4):** the browser keeps a device id in an httpOnly, Secure, SameSite=Lax cookie `ob_device` (random, 1 year, path `/svc/identity/auth`). If the hashed id is not in `known_devices` for this person, or `lastCodeAt` is older than 30 days, return `code_required` and email a `login_code`. On success, upsert the device and send `new_device_sign_in`.
5. **MFA:** if the person has TOTP on, return `mfa_required` after password (and code) succeed, using the existing MFA flow.
6. **Forgot / reset:** forgot always returns `202`; reset sets the new password (policy applies), **revokes every session and refresh-token family** of that person, and sends `password_changed`.
7. **Change password:** needs the current password; revokes all other sessions; sends `password_changed`.
8. Sessions reuse `completeLogin` / `createSessionForUser` in `auth.service.ts` so refresh cookies, session listing and logout behave exactly as today.
9. Publish identity events with IDs only (`person.registered`, `auth.password_changed`), no email.

### A6. Real Google sign-in
**Files:** `services/identity/src/application/google-oauth-verifier.ts` (new), `oauth-verifier.ts`, `auth.service.ts` (`processOAuthProfile`, `confirmOAuthLink`), `config/env.ts`, `identity.module.ts`.

Steps:
1. `GoogleOAuthVerifier implements IOAuthVerifier` with `jose` (`createRemoteJWKSet('https://www.googleapis.com/oauth2/v3/certs')`, `jwtVerify` with `issuer: ['https://accounts.google.com', 'accounts.google.com']`, `audience: GOOGLE_CLIENT_ID`). Reject when `email_verified` is not true.
2. Selection: if `GOOGLE_CLIENT_ID` is set, use the real verifier; otherwise use the fake in development and test; in production a missing client ID is a start-up error.
3. Linking (D6): find by `googleSub` first; then by email. If an account with that email exists **and** its `emailVerifiedAt` is set, link (`googleSub`, add `'google'` to `authProviders`, send `google_linked`). If it exists unverified, return `link_confirmation_required` with `maskedEmail` and a ticket, and email a `link` code; `POST /auth/oauth/confirm-link { ticket, code }` completes it. No account → create one with `emailVerifiedAt` now and the Google name.
4. Remove the masked-**phone** link path (it is replaced by the email code).
5. Tests with a locally generated key pair and a fake JWKS: valid token, wrong audience, wrong issuer, expired, unverified email, linking cases, production without client ID refuses to start.

### A7. Sign-in methods flag and production guards
**Files:** `services/identity/src/config/env.ts`, `identity.module.ts`, `nest-auth.controller.ts`, `packages/shared/src/production-guard.ts` (new).

Steps:
1. Env `AUTH_METHODS` (comma list of `google`, `email`, `phone`). Defaults: production `google,email`; development and test `google,email,phone`. `POST /auth/otp` and `/auth/verify` return `403 method_disabled` when `phone` is off. `GET /auth/methods` reports the list and `GOOGLE_CLIENT_ID`.
2. `identity.module.ts` today always builds `FakeOtpSender`, `FakeEventBus` and `FakeOAuthVerifier` (the last one **throws in production**, so identity cannot start in production today). Change it to choose adapters from env, and only allow fakes outside production.
3. `assertNotFakeInProduction(name, adapter, nodeEnv)` in shared: throws with a clear message if a class named `Fake*` or `Console*` is selected in production. Call it in every module that picks an adapter (identity now; Part B extends it).
4. Tests: production config with phone on is refused; production with a fake adapter refuses to start.

### A8. Web app sign-in screens
**Files:** `apps/web-app/app/login/page.tsx`, new `apps/web-app/app/signup/page.tsx`, `apps/web-app/app/forgot-password/page.tsx`, `apps/web-app/src/features/auth/` (split into `GoogleButton.tsx`, `EmailPasswordForm.tsx`, `SignupForm.tsx`, `CodeStep.tsx`, `ResetPasswordForm.tsx`; keep `AuthFlow.tsx` as the orchestrator), `apps/web-app/src/api-client.ts`, `apps/web-app/middleware.ts` if paths need excluding, `scripts/single-server.mjs` admin path list (add `signup`, `forgot-password`).

Steps:
1. `api-client.ts`: `getAuthMethods`, `signup`, `verifySignup`, `loginWithPassword`, `verifyLoginCode`, `forgotPassword`, `resetPassword`, `changePassword`, `resendCode`, `loginWithGoogle(idToken)`, `confirmGoogleLink`. Keep the in-memory access token and refresh-cookie behaviour exactly as the phone flow does today.
2. `/login`: "Sign in to OneBridge"; **Continue with Google** first (Google Identity Services script `https://accounts.google.com/gsi/client` loaded only on auth pages; button rendered with `google.accounts.id.renderButton`; the credential is posted to `/auth/oauth/google`); a divider "or"; email and password fields with show/hide; "Forgot password?"; "Create an account". Phone sign-in shows only when `getAuthMethods()` includes `phone` (development).
3. `/signup`: name, email, password (with a plain-language hint "At least 10 characters. Avoid common passwords."), terms and privacy checkbox with links, then the code step.
4. Code step: reuse the existing 6-box code input; "We sent a code to m•••@example.com"; resend with a 60-second countdown; "Use a different email" back link; errors for wrong, expired and too many attempts.
5. Forgot password: email → code → new password → signed out everywhere message → back to sign in.
6. After sign-in, keep today's routing (dashboard if the person has a company, otherwise onboarding or profile).
7. States: loading, invalid credentials, email not verified, rate limited (show the wait time), Google popup closed or blocked, offline, Google script failed to load (email path still works).
8. Accessibility: labels on every field, errors linked with `aria-describedby`, focus moves to the first error, 44 px targets, axe clean in component tests. Orange is a fill, never text.
9. Copy: plain, verb-first buttons ("Sign in", "Create account", "Send code", "Reset password"). No blame ("That email and password don't match" rather than "You entered a wrong password").
10. CSP: if a CSP header exists, allow `https://accounts.google.com` for `script-src`, `frame-src` and `connect-src` on auth pages only.
11. Component tests: each form's happy path and errors, code step resend countdown, methods list hides phone in production mode, axe.

### A9. Invite claim and other phone-dependent flows
**Files:** `services/organization/src/application/invite*.ts`, `apps/web-app/app/invite/**`, `scripts/demo-seed.mjs`, `services/identity/src/infrastructure/seed*.ts`.

Steps:
1. Invite claim (F14): when `phone` sign-in is off, invites must carry an email; the claim page asks the person to sign in or sign up with **that email** (Google or password), then claims. Invites created with only a phone return `400 email_required` in production, with a clear message in the invite form.
2. Development seeds: give every seeded person an email (`*@example.com`) and a development-only password (`DevPassword-2026!`, written in the seed file and README, refused by the API in production because seeds never run there). `demo-seed.mjs` may keep phone sign-in in development, but add email sign-in so it also works when `AUTH_METHODS` excludes phone.
3. Search the codebase for other uses of phone sign-in (`requestOtp`, `/auth/otp`, `DEMO_PHONE`) and list each in the final report with what you did.

### A10. Security emails
Wire `new_device_sign_in`, `password_changed`, `google_linked` and `signup_on_existing_account` (A2) from the flows in A5 and A6. Sending must never block or fail the sign-in itself; on email failure, log (without the address) and continue.

### A11. Part A verification
1. All identity, shared and web-app tests green; typecheck clean.
2. In a browser on the dev stack (`dev-alt-ports`, `http://localhost:3002`), with `EMAIL_PROVIDER=console` (codes appear in the dev log): sign up → code → dashboard; sign out → sign in (known device, no code); clear cookies → sign in (code required); forgot password → reset → old session is signed out; Google with a test Google account (needs `GOOGLE_CLIENT_ID` and `http://localhost:3002` as an authorised origin); invite claim by email.
3. Take screenshots of the login, sign-up, code and reset screens at 375 px and 1280 px for the review.

---

## Part B: Production runtime and VPS deployment

### B1. Remove fakes from the production path
Audit and replace every fake selected in a production code path. Known today:

| Fake | Where | Do this |
|---|---|---|
| `FakeOtpSender` | identity | Not used in production (phone off); guard from A7 |
| `FakeOAuthVerifier` | identity | Real Google verifier (A6) |
| `FakeEventBus` | identity, organization (defaults) | Accept the shared bus from the runner (B2); the fake stays only as a test default |
| `FakeInviteNotifier` | organization | `EmailInviteNotifier` using the shared `EmailSender` (template `invite`, English and Hindi) |
| `FakeLeadNotifier` | cards | `EmailLeadNotifier`: "New lead on your card" with **no lead details** in the email body, only a link to the dashboard |
| `FakeMediaStorageService` | organization (brand kit logos) | `LocalDiskMediaStorage` writing to `MEDIA_DIR` (a Docker volume), same validation rules, files served by the api at `/svc/organization/media/<id>` with long cache headers; keep the fake for tests |
| `FakeRevalidationNotifier` | cards | `HttpRevalidationNotifier` calling web-public's revalidation route inside the Docker network (`WEB_PUBLIC_INTERNAL_URL`), signed with `REVALIDATION_SIGNING_SECRET` (see how web-public verifies it) |
| `FakeEdgeShortLinkNotifier` | cards | `NoopEdgeShortLinkNotifier` (short links are served by web-public on the VPS; no edge cache to purge) |
| Turnstile validator | cards | If `TURNSTILE_SECRET` is set, verify with Cloudflare; if not, rely on the existing honeypot and rate limits and log once at start-up. Never accept the fake "demo" token in production |

Then grep for every remaining `Fake`, `InMemory` and `demo` selection in `services/*/src/**/*.module.ts` and `app.ts`, and list each in the report with its production answer. Add `assertNotFakeInProduction` calls for every adapter choice.

### B2. Production API runner
**File:** `scripts/prod-api.mjs` (new).

1. Based on `scripts/demo-server.mjs`, but: requires `MONGODB_URI` (no in-memory database), never runs the seed, no `/demo/reset`, sets nothing to development, validates all required env vars at start and exits with a list of missing names (names only, never values).
2. Starts identity, cards, profiles, social, search, messaging, organization (same order and shared `InMemoryEventBus` as demo-server), listening on `127.0.0.1` ports 4001 to 4007, and a router on `PORT` (8080) that proxies `/<service>/...` and WebSocket upgrades (reuse `proxyUpgrade` from demo-server; move it to `scripts/lib/proxy.mjs` and import it in both).
3. `/healthz`: 200 only when every service answers and MongoDB `ping` succeeds; JSON `{ status, services: { name: ok } }` with no internal details.
4. Graceful shutdown on SIGTERM (close apps, then Mongo) within 10 seconds.

### B3. Demo features off in production
`DEMO_MODE=false` must mean: no demo passcode middleware (`apps/web-app/middleware.ts` already skips when `DEMO_ACCESS_PASSCODE` is unset; make sure production never sets it), `NEXT_PUBLIC_DEMO_LEADS_PANEL=false`, no `NEXT_PUBLIC_DEMO_PHONE`, `ENABLE_FAKE_OTP=false`, `ENABLE_FAKE_OAUTH=false`. Add a test or start-up check for each.

### B4. Docker image
**Files:** `Dockerfile`, `.dockerignore`, `deploy/build-env.mjs` (sets `NEXT_PUBLIC_*` like `single-build.mjs`).

1. Multi-stage, `node:22-bookworm-slim`, `corepack enable`, `pnpm install --frozen-lockfile`.
2. Build args: `PUBLIC_URL` (e.g. `https://onebridgecard.com`). Build shared and contracts, all services (identity, organization, cards, profiles, social, search, messaging), web-app (`NODE_ENV=production`), web-public (`NODE_ENV=production`, `ASSET_PREFIX=/_cards`), with these baked values: `NEXT_PUBLIC_<SERVICE>_API_URL=/svc/<service>` for every service, `NEXT_PUBLIC_WEB_PUBLIC_URL=$PUBLIC_URL`, demo flags off. Reuse the env list from `scripts/single-build.mjs` (move it to a shared module so both use one list).
3. Runtime stage: production dependencies and build output only, `USER node`, `tini` as PID 1, `HEALTHCHECK` per command.
4. One image, three commands (set in compose): `node scripts/prod-api.mjs`; web-app `next start -p 3100 -H 0.0.0.0`; web-public `next start -p 3200 -H 0.0.0.0` (with `ASSET_PREFIX=/_cards` at runtime too).
5. `.dockerignore`: `node_modules`, `**/node_modules`, `**/.next`, `**/dist`, `.git`, `test-results`, `.claude`, `.env*` (except `.env.production.example`), `docs`, `*.md` (except READMEs needed at runtime: none).
6. Image must build on a 4 GB machine: set `NODE_OPTIONS=--max-old-space-size=3072` for the build; document that a 2 GB swap file is needed on a 4 GB server.

### B5. Docker Compose, MongoDB and Caddy
**Files:** `docker-compose.yml`, `deploy/Caddyfile`, `deploy/mongo/init-replica.js`, `deploy/mongo/entrypoint-keyfile.sh`.

1. Services:
   - `caddy`: `caddy:2`, ports `80:80` and `443:443`, mounts `deploy/Caddyfile`, volumes `caddy_data` and `caddy_config`, `restart: unless-stopped`.
   - `mongo`: `mongo:7`, command `--replSet rs0 --bind_ip_all --keyFile /data/keyfile/mongo-keyfile`; the entrypoint wrapper copies the keyfile (from env `MONGO_KEYFILE_CONTENT` or a file in `deploy/secrets/`, git-ignored) with `chmod 400` and owner `999`; root user from `MONGO_ROOT_USER` / `MONGO_ROOT_PASSWORD`; volume `mongo_data`; health check `mongosh --eval 'db.adminCommand("ping")'`; **no `ports:`** (never published).
   - `mongo-init`: one-shot, waits for mongo, runs `rs.initiate({ _id: 'rs0', members: [{ _id: 0, host: 'mongo:27017' }] })` if not initiated, and creates user `MONGO_APP_USER` with `readWrite` on database `onebridge`. Idempotent.
   - `api`, `web-app`, `web-public`: same image (`build: .` with the `PUBLIC_URL` build arg), `env_file: .env`, `depends_on` with health conditions, health checks, `restart: unless-stopped`, memory limits (api 1536 MB, web-app 512 MB, web-public 512 MB), logging `json-file` with `max-size: 10m`, `max-file: 5`. `api` mounts volume `media_data` at `/data/media`.
   - One internal network; only caddy exposes ports.
2. `MONGODB_URI=mongodb://<app user>:<password>@mongo:27017/onebridge?replicaSet=rs0&authSource=onebridge`.
3. `deploy/Caddyfile` (domain from env `SITE_DOMAIN`, default `onebridgecard.com`):
   - `www.{$SITE_DOMAIN}` → permanent redirect to `https://{$SITE_DOMAIN}{uri}`.
   - `{$SITE_DOMAIN}`:
     - `handle_path /svc/*` → `reverse_proxy api:8080` (Caddy passes WebSocket upgrades; `/svc/messaging/realtime` must work).
     - `handle /healthz` → `reverse_proxy api:8080`.
     - `handle_path /_cards/*` → `reverse_proxy web-public:3200`.
     - Admin paths (copy the list from `ADMIN_PATHS` in `scripts/single-server.mjs`, plus `/signup` and `/forgot-password`): `/`, `/login*`, `/signup*`, `/forgot-password*`, `/dashboard*`, `/demo-access*`, `/invite*`, `/profile*`, `/network*`, `/messages*`, `/api/demo-access*`, `/_next/*`, `/fonts/*`, `/favicon.ico` → `reverse_proxy web-app:3100`.
     - everything else → `reverse_proxy web-public:3200`.
     - Headers: `Strict-Transport-Security "max-age=31536000; includeSubDomains"`, `X-Content-Type-Options nosniff`, `Referrer-Policy strict-origin-when-cross-origin`, `Permissions-Policy` (camera, microphone, geolocation off), remove `Server`.
     - `encode zstd gzip`; `request_body max_size 25MB`.
   - Caddy sets `X-Forwarded-For`, `X-Forwarded-Proto` and `X-Forwarded-Host`; the apps already build redirects from these (see `apps/web-app/middleware.ts`). Confirm the client IP the services see is the real visitor IP (search and share-back rate limits use it); configure `trusted_proxies` if needed.
4. A local variant for testing: `SITE_DOMAIN=localhost` makes Caddy use its internal certificate.

### B6. Environment template
**File:** `.env.production.example` (committed) and `.gitignore` entries for `.env`, `deploy/secrets/`.

Every variable with a one-line comment and how to create it:
```
SITE_DOMAIN=onebridgecard.com
PUBLIC_URL=https://onebridgecard.com
APP_URL=https://onebridgecard.com
WEB_PUBLIC_URL=https://onebridgecard.com
NODE_ENV=production
DEMO_MODE=false
AUTH_METHODS=google,email
GOOGLE_CLIENT_ID=                # from Google Cloud console, OAuth 2.0 Web client
EMAIL_PROVIDER=smtp
SMTP_HOST= SMTP_PORT=587 SMTP_SECURE=false SMTP_USER= SMTP_PASSWORD=
EMAIL_FROM="OneBridge <no-reply@onebridgecard.com>"
EMAIL_REPLY_TO=support@onebridgecard.com
JWT_SECRET=                      # openssl rand -hex 48
INTERNAL_SERVICE_KEY=            # openssl rand -hex 48
ENCRYPTION_KEY=                  # openssl rand -hex 32  (64 hex chars) - BACK THIS UP; losing it makes leads and messages unreadable
REVALIDATION_SIGNING_SECRET=     # openssl rand -hex 48
CODE_HMAC_SECRET=                # openssl rand -hex 32
COOKIE_SECURE=true
MONGO_ROOT_USER=root
MONGO_ROOT_PASSWORD=             # openssl rand -hex 24
MONGO_APP_USER=onebridge
MONGO_APP_PASSWORD=              # openssl rand -hex 24
MONGODB_URI=mongodb://onebridge:<MONGO_APP_PASSWORD>@mongo:27017/onebridge?replicaSet=rs0&authSource=onebridge
MEDIA_DIR=/data/media
TURNSTILE_SECRET=                # optional
BACKUP_RCLONE_REMOTE=            # e.g. b2:onebridge-backups
BACKUP_PASSPHRASE=               # openssl rand -hex 32 - store in the password manager
ALERT_EMAIL=                     # where backup summaries go
```
Cross-check every env var actually read by every service's `config/env.ts` and by both Next apps; the template must list all of them (report any you added).

### B7. Operator scripts
**Folder:** `deploy/` (all `bash`, `set -euo pipefail`, run from the repo root on the server, clear messages, no secrets printed).

| Script | Does |
|---|---|
| `deploy.sh` | Checks `.env` exists and has no empty required values; saves the current commit to `deploy/.last-good` only after a healthy deploy; `git pull --ff-only`; `docker compose build`; `docker compose up -d`; waits up to 180 s for `https://$SITE_DOMAIN/healthz`; on success prints the commit; on failure prints logs tail and the rollback command |
| `rollback.sh [commit]` | Default commit from `deploy/.last-good`; `git checkout <commit>`; rebuild and restart; health check |
| `backup.sh` | `docker compose exec -T mongo mongodump --archive --gzip` with root credentials, encrypted with `gpg --symmetric` (`BACKUP_PASSPHRASE`), uploaded with `rclone` to `BACKUP_RCLONE_REMOTE`, keeps 14 daily and 8 weekly remotely and 3 locally, also archives `media_data`; emails a one-line summary to `ALERT_EMAIL` (or prints if mail is not set up) |
| `restore.sh <archive>` | Downloads and decrypts; restores into database `onebridge_restore_check` first and prints document counts per collection; only with `--live` and a typed confirmation restores into `onebridge` |
| `status.sh` | `docker compose ps`, health endpoint, disk usage, last backup time |
| `logs.sh <service> [lines]` | `docker compose logs --tail` |
| `deploy/cron/onebridge` | Cron file: backup daily 02:30 IST; weekly image prune Sunday 04:00 |

### B8. Runbook for the senior engineer
**File:** `deploy/RUNBOOK.md`. Plain language, copy-paste commands, one command per block. Sections:
1. **Server requirements:** Ubuntu 22.04 or 24.04, 4 GB RAM minimum (8 recommended), 2 vCPU, 40 GB SSD.
2. **First-time server setup:** create user `deploy` with sudo; SSH keys only, `PasswordAuthentication no`, `PermitRootLogin no`; `ufw allow OpenSSH`, `80`, `443`, enable; `fail2ban`; `unattended-upgrades`; timezone `Asia/Kolkata`; 2 GB swap file on 4 GB servers.
3. **Install Docker Engine and the Compose plugin** from Docker's official apt repository; add `deploy` to the `docker` group.
4. **DNS:** `A` records for `onebridgecard.com` and `www` → server IP; email provider's SPF, DKIM, DMARC records (values come from the provider). Check with `dig`.
5. **Get the code:** create a read-only deploy key, add it to the GitHub repository, `git clone git@github.com:onebridge-tech/Grid.git /opt/onebridge`.
6. **Configure:** `cp .env.production.example .env`, generate each secret with the given command, `chmod 600 .env`; put a copy of `ENCRYPTION_KEY` and `BACKUP_PASSPHRASE` in the company password manager.
7. **First deploy:** `./deploy/deploy.sh`; what success looks like.
8. **Smoke test checklist** (tick each): HTTPS padlock on both domains (www redirects); sign up with a real email → code arrives (check spam) → signed in; sign out and sign in; Google sign-in; create a company; publish a card; open the card and its QR short link on a phone; send a share-back from the card and see the lead and its email; chat between two test accounts in two browsers (live delivery); `sudo reboot` and confirm everything comes back with data.
9. **Backups:** install the cron file; run `./deploy/backup.sh` once; run `./deploy/restore.sh <archive>` (check database only) to prove the backup works.
10. **Monitoring:** UptimeRobot HTTP check on `https://onebridgecard.com/healthz` every 5 minutes; disk alert at 80% (`status.sh` shows usage).
11. **Every deploy:** `cd /opt/onebridge && ./deploy/deploy.sh`. Never edit code on the server.
12. **When something breaks:** `status.sh`, `logs.sh api 200`, `rollback.sh`, `restore.sh` (with the warning about live restore).
13. **Rotating a secret:** which ones can be rotated freely (JWT signs everyone out), which need care (`ENCRYPTION_KEY` needs re-encryption: do not rotate without the team).

### B9. Local proof of the whole stack
Before handing over, run the stack on the development machine with Docker Desktop:
1. `SITE_DOMAIN=localhost`, a local `.env` from the template with `EMAIL_PROVIDER=console` **only for this local check** (production refuses it; set `NODE_ENV=production` and temporarily allow console via an explicit `ALLOW_CONSOLE_EMAIL_FOR_LOCAL_TEST=true` that the guard accepts only when `SITE_DOMAIN=localhost`; log this decision).
2. `docker compose up -d --build`; `https://localhost/healthz` is 200.
3. Run the smoke checklist (B8.8) as far as possible locally (Google needs `https://localhost` added as an authorised origin, or skip and note it).
4. `docker compose restart` and `docker compose down && docker compose up -d`: data survives.
5. `backup.sh` and `restore.sh` against the local stack (with a local rclone remote, e.g. a folder).
6. Record image size, memory use per container (`docker stats --no-stream`), build time.

If Docker Desktop is not available on this machine, say so in the report; do not claim the stack was tested.

### B10. Documentation updates
1. `README.md`: a "Production deployment" section pointing to `deploy/RUNBOOK.md`; local development unchanged.
2. `docs/plans/remaining-implementation-guide.md` section 2.4: a new service is wired in `scripts/prod-api.mjs`, the Docker build list, the shared `NEXT_PUBLIC_*` env module, and (only if it needs a new top-level path) the Caddyfile. Keep the `single-server` / `single-build` lines while Render still runs (D8).
3. `docs/decisions.md`: `D-VPS-DEPLOY` (architecture, one api container and why, Caddy routing, MongoDB replica set, backups, what was decided during implementation).
4. `docs/questions.md`: anything still open (for example Turnstile keys, email provider choice if not given).

---

## C. Order and checkpoints

| Order | Tickets | Checkpoint |
|---|---|---|
| 1 | A1, A2, A3, A4 | Contracts generated; email sender and password utility tested |
| 2 | A5, A6, A7 | Identity tests green, including production guards |
| 3 | A8, A9, A10 | Web app screens done; component tests and axe green |
| 4 | A11 | Browser walkthrough done; screenshots saved |
| 5 | B1, B2, B3 | Production runner starts against a local MongoDB with `NODE_ENV=production` and refuses fakes |
| 6 | B4, B5, B6 | Image builds; compose stack healthy locally |
| 7 | B7, B8, B9 | Scripts work against the local stack; runbook complete |
| 8 | B10 | Docs and decisions updated; branch pushed to `origin feat/vps-auth` |

Part A and Part B may proceed in parallel after step 1, but B2 depends on A7 (identity must start in production).

---

## D. Final report (write it to `docs/reviews/vps-auth-implementation-report.md`)

The founder will hand this to the reviewer. Include:
1. **Summary:** what was built, branch name, list of commits.
2. **Checklist:** every ticket A1 to B10 with done / partly done / not done, and why.
3. **Tests:** commands run and results (counts per package); anything that could not be run locally and why.
4. **Browser check:** screens tried and screenshots (paths).
5. **Docker check:** whether the local stack ran; image size; memory per container; build time.
6. **Fake-adapter audit table** (B1) with the final production answer for each.
7. **Env variables:** the full list and which service reads each.
8. **Decisions made during implementation** (also in `docs/decisions.md`).
9. **Open questions for the founder** and anything blocked on accounts (Google client ID, SMTP credentials, DNS, backup bucket, server details).
10. **Known risks or shortcuts**, each marked with where it lives in code (`// shortcut:` comment).

## E. What the reviewer will check
So you can check it yourself first:
- No path in production can sign someone in without a real Google token or a correct password plus (where required) an emailed code.
- No account enumeration through sign-up, login, forgot password or timing.
- Codes and passwords never appear in logs, events, responses or the database in clear.
- Password reset revokes all sessions.
- Every fake adapter refuses to run in production.
- MongoDB is not reachable from outside the Docker network; `.env` is not in git.
- `/svc/messaging/realtime` WebSockets work through Caddy.
- The public site's `/_cards` assets and the admin app's `/_next` assets both load.
- Rebooting the server and restoring a backup both leave the data intact.
- Tests were not weakened; no `vitest.noswc.config.ts` committed; `.claude/` not committed.
