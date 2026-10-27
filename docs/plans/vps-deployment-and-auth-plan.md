# OneBridge Grid: VPS deployment and new sign-in plan

Date: 2026-10-27. Status: **plan, waiting for approval and server details.**

## 1. What changes and why

| Topic | Before | After |
|---|---|---|
| Hosting | One Render web service, demo only (`render.yaml`, `scripts/single-server.mjs`) | A dedicated VPS running **Docker Compose**, deployed by hand by the senior engineer (`git pull` then `./deploy.sh`) |
| Domain | `onebridge-grid.onrender.com` | **`onebridgecard.com`** with HTTPS |
| Data | In-memory MongoDB, wiped and re-seeded on every start | Persistent MongoDB on the VPS, daily backups off the server |
| Users | Demo only | **Real customers** |
| Sign-in | Phone number + SMS code (fake code `123456`) | **Continue with Google**, or **email + password** with a 6-digit email verification code |

Real customers means three non-negotiables before launch: no fake sign-in, data that survives restarts with backups, and real secrets.

---

## 2. Target architecture

```
                    Internet (HTTPS 443, HTTP 80 -> redirect)
                                   |
                          +------------------+
                          |   caddy          |  automatic Let's Encrypt certificates,
                          |   (reverse proxy)|  security headers, WebSocket pass-through
                          +------------------+
              /svc/*  |            | admin paths          | everything else
                      v            v                      v
              +-------------+  +-----------+       +--------------+
              |  api        |  |  web-app  |       |  web-public  |
              |  (all Nest  |  |  Next.js  |       |  Next.js     |
              |  services)  |  |  :3100    |       |  :3200       |
              |  :8080      |  +-----------+       +--------------+
              +-------------+
                      |
              +-------------+
              |  mongo      |  MongoDB 7, single-node replica set, auth on,
              |  (private)  |  data on a Docker volume, never exposed to the internet
              +-------------+
```

**One domain, path routing**, the same routing that `scripts/single-server.mjs` does today, moved into Caddy:

| Path | Goes to |
|---|---|
| `/svc/<service>/...` | `api`, with `/svc` stripped (identity, organization, cards, profiles, social, search, messaging, and later services) |
| `/svc/messaging/realtime` | `api` WebSocket (Caddy passes upgrades through) |
| `/`, `/login`, `/signup`, `/dashboard`, `/invite`, `/profile`, `/network`, `/messages`, `/_next`, `/fonts` | `web-app` |
| everything else (`/<company>`, `/c/...`, `/r/...`, `/in/...`, `/search`, `/directory/...`) | `web-public` |

One domain keeps the refresh cookie first-party and avoids CORS between the apps.

**Why the `api` container runs all services in one process (for now).** The services talk through an in-process event bus (`InMemoryEventBus`), as in `scripts/demo-server.mjs`. Splitting them into separate containers needs a real message broker and a transactional outbox first. Launch with one `api` container; split later (Phase 5). This is the same code path we test every day, just with a real database and production settings.

**Server size:** at least 4 GB RAM (8 GB recommended), 2 vCPU, 40 GB SSD, Ubuntu 22.04 or 24.04 LTS.

---

## 3. Decisions (my recommendation in bold; confirm or change)

| # | Decision | Options | Recommendation |
|---|---|---|---|
| D1 | Email provider for verification codes | Amazon SES (Mumbai), Resend, Postmark, Zoho ZeptoMail | **Zoho ZeptoMail or Amazon SES**: cheap, India region, good delivery. Needs SPF, DKIM and DMARC DNS records on `onebridgecard.com` |
| D2 | Sending address | `no-reply@`, `hello@` | **`no-reply@onebridgecard.com`** for codes, `support@onebridgecard.com` as reply-to |
| D3 | Phone sign-in | Remove, keep for dev only | **Off in production, kept for local development and tests** behind `AUTH_METHODS` (production: `google,email`). Phone stays a profile and card field |
| D4 | When is the email code asked | At sign-up only; at sign-up and on every login; at sign-up and on login from a new device | **At sign-up, for password reset, and on login from a new device or after 30 days**. Google sign-in needs no code (Google verified the email) |
| D5 | Password hashing | argon2id (native package), scrypt (built into Node) | **scrypt from `node:crypto`**: no native build in Docker, OWASP-accepted parameters |
| D6 | Google and email accounts with the same email | Separate accounts, automatic link | **Link automatically only when Google says the email is verified and the existing account's email is verified**; otherwise ask for the email code first |
| D7 | Off-server backup target | Backblaze B2, AWS S3, Google Drive (rclone), a second VPS | **Backblaze B2 or S3 via rclone**, 14 daily + 8 weekly copies, encrypted |
| D8 | Render demo | Keep, retire | **Keep until the VPS is live, then retire** (delete `render.yaml`), so there is one source of truth |
| D9 | `www.onebridgecard.com` | Separate site, redirect | **Redirect to `onebridgecard.com`** |
| D10 | Ops console address (F25, later) | `onebridgecard.com/ops`, `ops.onebridgecard.com` | **`ops.onebridgecard.com`**, IP-restricted, added when F25 is built |
| D11 | Invite claim (F14) | Phone or email, email only | **Email only in production**; invites by phone wait for the SMS provider |
| D12 | Uptime monitoring | UptimeRobot, Better Stack | **UptimeRobot free** on `/healthz`, alerts to the senior's email and phone |

**Accounts and access needed before go-live:**
1. VPS: IP address, SSH access for the senior, Ubuntu version, RAM and disk (you will share these).
2. DNS access for `onebridgecard.com` (to add A records and the email records).
3. Google Cloud project with an **OAuth 2.0 Web client ID** (authorised JavaScript origin `https://onebridgecard.com`; also `http://localhost:3002` for development). OAuth consent screen with app name, logo, privacy policy and terms URLs.
4. Email provider account and API key (D1), domain verified.
5. Backup storage bucket and key (D7).
6. A read-only GitHub **deploy key** on the VPS for `onebridge-tech/Grid`.

---

## 4. Implementation plan

Five phases. Phases 1 and 2 are code changes in the repo and can be done in parallel; phase 3 needs the server details.

### Phase 1. New sign-in: Google and email + password

**1.1 Spec and decision first**
- Update `docs/onebridge-spec-pack/docs/features/F01-auth.md` acceptance criteria to the new methods and log `D-AUTH-EMAIL` in `docs/decisions.md` (founder decision, date, D3 to D6, D11).
- Contract changes in `packages/api-contracts/openapi.yaml`, then `pnpm contracts:gen`.

**1.2 Identity: data model**
- `Person`: email becomes the primary sign-in identifier (already unique and sparse); add `emailVerifiedAt`, `passwordHash` (scrypt, with salt and parameters stored in the hash string), `passwordUpdatedAt`, `googleSub` (unique, sparse), `authMethods`.
- New collection `email_codes` (global): purpose (`signup`, `login`, `reset`, `link`), email, code **hash**, attempts, expiry (10 minutes, TTL index). Register it in the collection registry.
- `known_devices` per person (hashed device id from a long-lived httpOnly cookie) for D4.

**1.3 Identity: endpoints**

| Endpoint | Does |
|---|---|
| `POST /auth/signup` `{ name, email, password }` | Validates the password, creates an unverified person, sends a 6-digit code. Same response whether or not the email exists (no account enumeration); an existing verified email gets a "someone tried to sign up" email instead |
| `POST /auth/signup/verify` `{ email, code }` | Marks the email verified, starts a session (refresh cookie + access token) |
| `POST /auth/login` `{ email, password }` | Wrong email or password gives one generic error. New device or more than 30 days → `{ status: 'code_required', ticket }` and a code by email; otherwise a session. MFA (existing TOTP) still applies after this |
| `POST /auth/login/verify` `{ ticket, code }` | Completes a login that needed a code |
| `POST /auth/password/forgot` `{ email }` | Always "if an account exists, we sent a code" |
| `POST /auth/password/reset` `{ email, code, newPassword }` | Sets the password and **revokes every session** |
| `POST /auth/password/change` (signed in) | Needs the current password; revokes other sessions |
| `POST /auth/code/resend` | 60-second cooldown, at most 5 codes an hour per email |
| `POST /auth/oauth/google` `{ idToken }` | Existing endpoint, now with a **real Google verifier** |

**1.4 Identity: Google verifier**
- Replace `FakeOAuthVerifier` in production with `GoogleOAuthVerifier`: verifies the ID token signature against Google's public keys (cached), `aud` = our client ID, `iss` = `accounts.google.com`, not expired, `email_verified` true. Use the `jose` library (small, no native code) or `google-auth-library`.
- Account linking follows D6. The current link confirmation (`link_confirmation_required` with a masked **phone**) changes to an **email code**.
- The fake verifier stays for tests and local development only (it already refuses to start in production).

**1.5 Identity: rules**
- Passwords: at least 10 characters, at most 128, refuse the 10,000 most common passwords (a list in the repo), no other composition rules (NIST 800-63B).
- Codes: 6 digits from a secure random source, stored hashed, 10-minute expiry, 5 wrong attempts burn the code.
- Rate limits: login 5 failures per account per 15 minutes with backoff, and per IP; sign-up and forgot-password per IP and per email.
- Sessions: the existing refresh-token families, httpOnly Secure SameSite=Lax cookie scoped to `/svc/identity/auth`.
- Security emails: new sign-in from a new device, password changed, Google linked.
- Logs never contain the email in clear (existing redaction), the password, or the code.

**1.6 Email sender**
- An `EmailSender` port in `packages/shared` with a fake (tests and dev, writes to the console with the code masked except in development) and a real adapter for the chosen provider (D1). This becomes the email channel of F22 later.
- Templates (English and Hindi): verification code, password reset, new sign-in, signup-attempt-on-existing-account. Plain, branded, the code large, no links that sign you in.

**1.7 Phone sign-in**
- `AUTH_METHODS` env: production `google,email`; development `google,email,phone`. Identity refuses `/auth/otp` when phone is off. The fake OTP sender can never be selected when `NODE_ENV=production` (already true; add a test).

**1.8 Web app**
- New `/login` page: **Continue with Google** (Google Identity Services button, loaded only on the sign-in pages), then "or" an email and password form, links "Create an account" and "Forgot password?".
- `/signup`: name, email, password (show and hide toggle, strength hint), consent to terms and privacy notice (recorded with version).
- Code screen: reuse the existing 6-digit input; resend with countdown; "wrong email?" back link.
- Forgot and reset password screens.
- Every state designed: loading, wrong password, too many attempts, code expired, email not verified, Google popup blocked or closed, offline.
- Content Security Policy allows `accounts.google.com` scripts and frames on the sign-in pages only.
- The invite claim (F14) uses email sign-in (D11).

**1.9 Seeds and tests**
- Development seed accounts get emails and a development-only password (in the seed file, never used in production). The production stack never runs a seed.
- Tests: every endpoint's happy and failure paths, no enumeration (identical responses and similar timing), code expiry and attempt limits, session revocation on reset, Google token checks (wrong audience, unverified email, expired), account linking rules, fake adapters refused in production.
- Browser check in the in-app pane: sign up, verify, log out, log in, new-device code, forgot password, Google (with a test Google account on `localhost`).

### Phase 2. Production runtime in the repo

**2.1 Production API runner** `scripts/prod-api.mjs`
- Like `scripts/demo-server.mjs`, but: no in-memory MongoDB (requires `MONGODB_URI`), no seed, no `/demo/reset`, `NODE_ENV=production`, all secrets required at start (fail fast with a clear message), `/healthz` checks every service and the database.

**2.2 Fake-adapter audit.** Production must not start with a fake where a real one is needed. Found today:

| Fake in production code path | Where | Production answer |
|---|---|---|
| `FakeOtpSender` | identity | Phone sign-in off (D3); fine until SMS exists |
| `FakeOAuthVerifier` | identity | Real Google verifier (1.4) |
| `FakeInviteNotifier` | organization | Real email sender (1.6) |
| `FakeLeadNotifier` | cards | Email to the card owner through the email sender, until F22 |
| `FakeMediaStorageService` | organization | Store uploads on a Docker volume (`/data/media`) served by `api`, until the media service (guide step 2) |
| `FakeRevalidationNotifier`, `FakeEdgeShortLinkNotifier` | cards | Real HTTP calls to web-public's revalidation endpoint inside the Docker network; short links are served by web-public, so the edge notifier becomes a no-op with a log line |
| Bot check on enquiries (Turnstile) | cards / web-public | Cloudflare Turnstile keys, or the existing honeypot and rate limits only (decide) |

Each service gets a start-up check: in production, any remaining fake throws and the container refuses to start.

**2.3 Demo features off in production.** `DEMO_MODE=false`: no demo passcode page, no demo leads panel, no fake codes, no seed.

**2.4 Docker**
- `Dockerfile` (multi-stage, `node:22-bookworm-slim`): install with `pnpm install --frozen-lockfile`, build shared, contracts, all services and both Next apps (with `NEXT_PUBLIC_*` values passed as build arguments, since Next bakes them in), then a small runtime stage. One image, three commands: `api`, `web-app`, `web-public`. Runs as a non-root user.
- `.dockerignore` (node_modules, .next, dist, .git, test-results, `.claude`).
- `docker-compose.yml`:
  - `caddy` (ports 80 and 443, `Caddyfile`, volumes for certificates)
  - `mongo` (mongo:7, `--replSet rs0`, auth with a root user and an app user, keyfile, volume `mongo_data`, health check, **no published port**)
  - `mongo-init` (one-shot: initiates the replica set and creates the app user)
  - `api`, `web-app`, `web-public` (same image, `restart: unless-stopped`, health checks, memory limits, log rotation `max-size 10m, max-file 5`)
- `Caddyfile`: `onebridgecard.com` with the routing table in section 2, `www` redirect, HSTS, security headers, compression, request size limit (25 MB for future uploads).

**2.5 Configuration**
- `.env.production.example` with every variable, a one-line explanation, and how to generate secrets (`openssl rand -hex 32`): `PUBLIC_URL=https://onebridgecard.com`, `MONGODB_URI`, `MONGO_ROOT_PASSWORD`, `JWT_SECRET`, `INTERNAL_SERVICE_KEY`, `ENCRYPTION_KEY` (64 hex), `REVALIDATION_SIGNING_SECRET`, `COOKIE_SECURE=true`, `AUTH_METHODS=google,email`, `GOOGLE_CLIENT_ID`, email provider key and sender, backup bucket keys.
- **`ENCRYPTION_KEY` warning:** leads, messages and notes are encrypted with it. If it is lost, that data cannot be read; if it leaks, rotate. Keep a copy in the company password manager, never in git.

**2.6 Scripts for the senior** (in `deploy/`)
- `deploy.sh`: checks `.env` exists, records the current commit as the rollback point, `git pull --ff-only`, `docker compose build`, `docker compose up -d`, waits for `/healthz`, prints the result; on failure prints the rollback command.
- `rollback.sh <commit>`: checks out the previous commit and redeploys.
- `backup.sh`: `mongodump --archive --gzip` from the mongo container, encrypted, uploaded with rclone (D7); keeps 14 daily and 8 weekly; run nightly by cron.
- `restore.sh <archive>`: restores into a scratch database first, then into the live one only with explicit confirmation.
- `logs.sh <service>` and `status.sh`: shortcuts.

**2.7 Local proof.** Run the whole compose stack on a laptop with Docker Desktop and `localhost` certificates before touching the server; run the end-to-end sign-in and card flows against it.

### Phase 3. Server setup and first deploy (needs the server details)

A step-by-step runbook `deploy/RUNBOOK.md` for the senior, covering:
1. **Harden the server:** create a `deploy` user, SSH keys only, root login off, `ufw` allow 22, 80, 443 only, `fail2ban`, `unattended-upgrades`, time zone `Asia/Kolkata`, swap file if RAM is 4 GB.
2. **Install Docker Engine and the Compose plugin** (official repository).
3. **DNS:** A records for `onebridgecard.com` and `www` to the VPS IP; email provider's SPF, DKIM and DMARC records.
4. **Get the code:** read-only deploy key, `git clone` to `/opt/onebridge`.
5. **Configure:** copy `.env.production.example` to `.env`, fill in, `chmod 600 .env`.
6. **First start:** `./deploy/deploy.sh`; Caddy fetches certificates automatically.
7. **Smoke test checklist:** HTTPS padlock; sign up with email, receive the code, verify; sign in with Google; create a company; publish a card; open the visitor card and the QR short link on a phone; share-back lead arrives; chat between two test accounts; restart the server (`sudo reboot`) and confirm everything comes back with the data.
8. **Backups:** install the cron entry, run one backup, **restore it into a scratch database** to prove it works.
9. **Monitoring:** UptimeRobot on `https://onebridgecard.com/healthz`; disk usage alert at 80%.

### Phase 4. Operations (first week live)
- Daily: check the backup ran (the script emails a summary).
- Weekly: `docker system df`, prune old images, review logs for errors.
- Monthly: restore drill; OS updates with a planned reboot.
- Deploys: after `git pull`, always `./deploy/deploy.sh`; never edit code on the server.
- Incident basics: `status.sh`, `logs.sh api`, rollback, restore.

### Phase 5. Before scaling past one server (later)
- Transactional outbox in each service and a real event bus (Redis Streams or NATS), then split `api` into one container per service.
- Redis for rate limits, idempotency, WebSocket tickets and chat fan-out (debt from N03 and N08).
- Meilisearch container for search (N03).
- Media service with S3-compatible storage (guide step 2).
- SMS provider for phone verification and call requests (N11), with DLT templates.
- Optional: CI that builds the image and the senior pulls a tagged image instead of building on the server.

---

## 5. Effect on the rest of the plan

- `docs/plans/remaining-implementation-guide.md` section 2.4 (wiring a new service) changes: instead of `single-server.mjs`, `single-build.mjs` and Render, a new service is added to `scripts/prod-api.mjs`, the `Caddyfile` routes (if it needs a new path) and the Docker build. Update the guide when Phase 2 lands.
- F01 (auth) changes as in Phase 1; F14 invite claim becomes email only in production.
- F22 (notifications) starts from the email sender built in Phase 1.6.
- N11 (request a call) and phone verification need the SMS provider (Phase 5) or must use email verification for signed-out requesters; decide when N11 starts.
- F28 (hardening) items done early here: real secrets, backups and restore drill, HTTPS, security headers.

## 6. Risks

| Risk | Mitigation |
|---|---|
| Lost `ENCRYPTION_KEY` makes leads and messages unreadable | Stored in the password manager; restore drill uses it |
| One server is a single point of failure | Daily off-site backups, documented restore; RTO a few hours is acceptable at launch |
| Events lost if the `api` process crashes mid-request (no outbox yet) | Rare; acceptable for launch; outbox in Phase 5 |
| Verification emails land in spam | SPF, DKIM, DMARC set before launch; test with Gmail and Outlook |
| Building on a small VPS runs out of memory | Swap file; or build the image on a laptop or CI and copy it |
| Google sign-in blocked until the consent screen is verified | Start Google verification early; the email path works meanwhile |

## 7. Order of work and what I need from you

1. **You:** confirm the decisions in section 3 (or change them), and start the accounts in section 3 (Google client ID, email provider, DNS access, backup bucket). Share the server details.
2. **Me:** Phase 1 (sign-in) and Phase 2 (Docker, Caddy, scripts, runbook), tested locally, pushed to GitHub.
3. **Senior:** Phase 3 on the server following the runbook, with me adjusting anything that differs on the real machine.
4. **Then** we go back to the feature guide, starting with F22 notifications.
