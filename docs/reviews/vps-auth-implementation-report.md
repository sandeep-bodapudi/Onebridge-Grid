# Report: new sign-in and VPS deployment (Plan 2)

**Date:** 2026-10-28
**Branch:** `feat/vps-auth` on `origin` (from `feat/features-completion` at `ed38cca`). Not merged; nothing pushed to `main` or to the `onebridge` remote.
**Plan:** `docs/plans/vps-auth-implementation-handoff.md`

## 1. Summary

Sign-in is now **Continue with Google** and **email + password with 6-digit email codes**; phone sign-in is development-only. The product has a production runtime for one VPS: a production API runner, one Docker image, a Compose stack with Caddy and MongoDB, operator scripts and a runbook. The fake-adapter audit found and fixed several production problems (section 6).

Commits (oldest first):

| Commit | What |
|---|---|
| `f06b130` | A1 contract, F01 change, D-AUTH-EMAIL |
| `3b70111`, `60a0836` | A2 email sender (SMTP, console), templates, production guard |
| `a9939a3` | A3, A4 person fields, email codes, known devices, scrypt passwords |
| `9b12c72` | A5 sign-up, sign-in, reset, change; A7 env (AUTH_METHODS, GOOGLE_CLIENT_ID) |
| `f6eedd3` | A6 real Google verifier and email-confirmed linking; A7 controller gates |
| `9338a48` | A8 web screens: /login, /signup, /forgot-password |
| `8494fce` | A9 email invites, invite claim by sign-in, seeds |
| `c160e1a` | A11 fix: dark-mode input edges (found in the browser check) |
| `0f3e2a4` | B1 production adapters and secrets |
| `0b6fafa` | B2, B3 production API runner |
| `aefafd8`, `305b1c7` | B4, B5, B6 Dockerfile, Compose, Caddyfile, env template |
| `d802917` | B7, B8 operator scripts, runbook |
| (this commit) | B10 docs, decisions, questions, this report |

## 2. Checklist

| Ticket | Status | Notes |
|---|---|---|
| A1 Contract | Done | `openapi.yaml` + generated types; F01 change; D-AUTH-EMAIL |
| A2 Email sender | Done | Console refuses production; SMTP retries once, masks addresses in errors |
| A3 Data model | Done | `email_codes` (hashed ticket and code, TTL), `known_devices`; approved in the guard test |
| A4 Passwords | Done, changed | scrypt N=2^15. **No common-password list**: the founder declined the download (D-AUTH-EMAIL D5) |
| A5 Endpoints | Done | Growing delay on repeated failures not added: a fixed 15-minute lock after 5 failures |
| A6 Google | Done | Tested with a local key pair; **not tried with a real Google account** (no client ID yet) |
| A7 Methods and guards | Done | Code-only sign-in (`/auth/otp`, `/auth/verify`) also off without phone, since it creates accounts with no password or consent |
| A8 Screens | Done | Google button, email form, sign-up, code step, reset; axe clean |
| A9 Invites | Done | Production invites by email only; claim through sign-in/sign-up with `?next=`. Demo seed keeps phone sign-in (dev/demo only) |
| A10 Security emails | Done | new device, password changed, Google linked, sign-up on existing account; never block sign-in |
| A11 Browser check | Done | See section 4 |
| B1 Fakes | Done | Section 6 |
| B2 Runner | Done | Started locally against MongoDB in production mode |
| B3 Demo off | Done | Runner refuses the switches (tested); build sets demo NEXT_PUBLIC values off |
| B4 Image | Written, **not built** | Docker is not installed on the development machine |
| B5 Compose, Caddy | Written, **not run** | Compose file parses; only Caddy publishes ports |
| B6 Env template | Done | Every variable the services read (section 7) |
| B7 Scripts | Written, **not run against Docker** | `bash -n` clean; the `.env` reader tested (never executes the file) |
| B8 Runbook | Done | `deploy/RUNBOOK.md` |
| B9 Local proof | **Not done** | Needs Docker (see section 5) |
| B10 Docs | Done | README, guide 2.4, D-VPS-DEPLOY, Q-17 to Q-19 |

## 3. Tests

Commands (SWC cannot load on this machine, so each package ran with a temporary non-SWC vitest config, deleted afterwards; CI uses the real config):

| Package | Tests |
|---|---|
| packages/api-contracts | 2 |
| packages/shared | 131 |
| packages/ui-kit | 145 |
| edge/shortlink | 6 |
| services/cards | 139 |
| services/identity | 177 |
| services/messaging | 17 |
| services/organization | 150 |
| services/profiles | 14 |
| services/search | 12 |
| services/social | 8 |
| apps/web-app | 109 |
| apps/web-public | 25 |
| root (scripts, workspace, prod-api) | 10 |
| **Total** | **945, all passing** |

The final full run (typecheck, lint, every package, root checks) is recorded in section 11.

## 4. Browser check (dev stack, `http://localhost:3002`)

- Sign-up: field errors on blur, focus to the first problem, consent required; code step; account created; onboarding shown.
- Sign-in on the same browser: no code. A new device (API call without the device cookie): `code_required` with a masked email.
- Forgot password: code, new password, "every device was signed out"; the old session was gone (dashboard redirected to /login).
- Desktop width 1280: the card is centred, no horizontal scroll.
- Found and fixed: empty inputs and code boxes were invisible in dark mode (UI kit, all forms).
- Screenshots were viewed in the session; they are not saved as files in the repo.

## 5. Docker check

**Not run.** Docker Desktop is not installed and there is a stopped WSL Ubuntu only. Installing Docker was not done without the founder's consent. Image size, memory per container and build time are therefore unknown. What was checked instead:
- `scripts/prod-api.mjs` started against a local MongoDB with production settings: `/healthz` 200 for all seven services and Mongo; methods `google,email`; phone codes 403; an unreachable SMTP server answers 503 and logs only a masked address.
- `docker-compose.yml` parses; only `caddy` has `ports`.
- Every shell script passes `bash -n`.

Before the first real deploy, someone with Docker should run the B9 steps (`SITE_DOMAIN=localhost`, `docker compose up -d --build`, smoke test, restart, backup and restore).

## 6. Fake-adapter audit (production answer)

| Adapter | Before | Production now |
|---|---|---|
| FakeOtpSender | always | built but unused: phone and code-only sign-in are refused |
| FakeOAuthVerifier | always (threw in production) | GoogleOAuthVerifier; stand-in only outside production |
| Identity event bus | FakeEventBus (kept every event) | the runner's shared InMemoryEventBus |
| InMemoryEventBus | kept every event forever | keeps the last 1,000 |
| FakeInviteNotifier | always (invites never sent) | EmailInviteNotifier |
| FakeLeadNotifier | always | EmailLeadNotifier (no lead details in the email) |
| FakeMediaStorageService | always (stored nothing) | LocalDiskMediaStorage + `/media` route |
| FakeRevalidationNotifier | dev only | HttpRevalidationNotifier to `WEB_PUBLIC_INTERNAL_URL` |
| FakeEdgeShortLinkNotifier | always | NoopEdgeShortLinkNotifier (web-public serves `/r`) |
| BypassTurnstileValidator | always | Cloudflare with a secret, else rate limits only (Q-17) |
| Key vault | **built-in development key** in cards and organization | `ENCRYPTION_KEY`, required |
| Service secrets | test defaults accepted | `resolveSecret`: production refuses missing or development values |
| InMemoryRateLimiter | never pruned | prunes finished windows; one process, so in-memory is correct |
| Email sender | none | SMTP; console refused |

## 7. Environment variables

All listed with comments in `.env.production.example`. Read by: identity (`AUTH_METHODS`, `GOOGLE_CLIENT_ID`, `COOKIE_*`, email settings), organization (`MEDIA_DIR`, `MEDIA_PUBLIC_BASE`, email settings, `ENCRYPTION_KEY`), cards (`ENCRYPTION_KEY`, `REVALIDATION_SIGNING_SECRET`, `SHORT_LINK_BASE_URL`, `TURNSTILE_SECRET`, `WEB_PUBLIC_INTERNAL_URL`, email settings), messaging (`ENCRYPTION_KEY`, limits), social and search (limits); every service reads `JWT_SECRET`, `INTERNAL_SERVICE_KEY`, `MONGODB_URI`, `APP_URL`, `NODE_ENV`. Compose and scripts: `SITE_DOMAIN`, `PUBLIC_URL`, `MONGO_*`, `BACKUP_*`, `ALERT_EMAIL`. Added beyond the plan: `MONGO_KEYFILE_CONTENT`, `WEB_PUBLIC_INTERNAL_URL`, `MEDIA_PUBLIC_BASE`. Not needed: `CODE_HMAC_SECRET` (derived from `JWT_SECRET`).

## 8. Decisions made during implementation

In `docs/decisions.md`: D-OTP-RANDOM, D-AUTH-EMAIL (with the D11 and code-only additions), D-VPS-DEPLOY. Notable: Node 20 and pnpm 9 in the image (as CI); one api container; client IP from X-Forwarded-For everywhere.

## 9. Open questions and blocked accounts

- Q-17 Turnstile widget before launch?
- Q-18 Terms and Privacy pages (the sign-up links point to pages that do not exist). Blocks launch.
- Q-19 Google client ID, SMTP credentials and DNS records, server access, backup bucket, which GitHub repository the server pulls.

## 10. Known risks and shortcuts

- B4, B5, B7 and B9 are not proven with Docker (section 5).
- MFA setup screen shows a fixed authenticator secret instead of the server's (`apps/web-app/src/features/auth/AuthFlow.tsx`, mfa_setup step); older bug, not fixed here. Fix before any owner turns MFA on.
- No common-password list (founder's choice).
- In-memory rate limits reset on restart (single process; acceptable at launch).
- Access tokens stay valid up to 15 minutes after a password reset (refresh is revoked at once).
- `NestAuthController` and the demo seed still contain the phone flow for development.

## 11. Final verification run

2026-10-28, before the B10 commit: `pnpm typecheck` exit 0; `pnpm lint` exit 0; every package above passing (945 tests); no temporary vitest config left behind. Not run: Playwright end-to-end tests (headless browsers are unreliable on this machine) and anything needing Docker.
