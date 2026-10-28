# OneBridge Grid: deploying to the VPS

For the senior engineer doing the **first deployment** of `onebridgecard.com`. Follow it top to bottom. Day-to-day work after that (deploys, backups, restores, rollbacks, secrets) is in [RUNBOOK.md](RUNBOOK.md).

Every command is meant to be copied as is. Run commands as the `deploy` user unless the step says `sudo`.

> **Read first.** The Docker setup (image, Compose stack, scripts) is written and reviewed, but it has **not yet been run end to end**. Expect the first build to need a small fix or two. Section 11 lists what to collect and send to the developers if something fails. Do not put real customer data on the server until the smoke test (section 9) passes.

---

## 1. How it fits together

```
Internet ──443/80──▶ caddy ──/svc/*──────────▶ api (port 8080: identity, organization, cards,
 (HTTPS, automatic       │                         profiles, social, search, messaging)
  certificates)          ├──admin pages─────────▶ web-app (port 3100)
                         └──everything else─────▶ web-public (port 3200)
                                                     │
                         mongo (replica set rs0) ◀──┘  never reachable from outside
                         mongo-init (runs once per deploy: replica set + app user)
```

- One Ubuntu server, Docker Compose, six containers. Only Caddy opens ports (80, 443).
- Code comes from GitHub. The server never has code edited on it: `git pull` then `./deploy/deploy.sh`.
- Data lives in Docker volumes: `mongo_data` (database), `media_data` (uploaded logos), `caddy_data` (certificates).
- Settings and secrets are in `/opt/onebridge/.env` (never in git).

---

## 2. Before you start: collect these

Tick each one. The stack refuses to start while any is missing.

| What | From | Used for |
|---|---|---|
| A server: Ubuntu 22.04 or 24.04, 4 GB RAM (8 GB better), 2 vCPU, 40 GB SSD, public IPv4 | Hosting provider | Everything |
| Access to DNS for `onebridgecard.com` | Domain registrar | Pointing the domain at the server, email records |
| Google OAuth Web client ID | Google Cloud (section 3.2) | "Continue with Google" |
| SMTP host, port, user, password; sender `no-reply@onebridgecard.com` | Email provider (section 3.3) | Sign-in codes, invites, lead emails |
| An S3-compatible bucket and a key limited to it | Backblaze B2 or similar (section 3.4) | Encrypted off-server backups |
| The GitHub repository and branch to deploy | Founder | The code |
| A company password manager entry for this server | Founder | Storing `ENCRYPTION_KEY` and `BACKUP_PASSPHRASE` |

---

## 3. Accounts (do these first; some take time to verify)

### 3.1 DNS

At the registrar, add:

| Type | Name | Value |
|---|---|---|
| A | `@` | the server's IPv4 |
| A | `www` | the server's IPv4 |

Do this early: records can take up to an hour to spread. Check later with `dig` (section 5).

### 3.2 Google sign-in

1. Go to `https://console.cloud.google.com/` and create a project, for example "OneBridge".
2. **APIs & Services → OAuth consent screen:** User type **External**. App name "OneBridge", support email, logo (optional), app home page `https://onebridgecard.com`, privacy policy and terms links (`https://onebridgecard.com/privacy`, `/terms`), authorised domain `onebridgecard.com`. Scopes: `openid`, `email`, `profile` only. Then **Publish app** (otherwise only test users can sign in).
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**, type **Web application**.
4. **Authorised JavaScript origins:** `https://onebridgecard.com`. No redirect URIs are needed (the button uses Google's popup).
5. Copy the **Client ID** (it ends in `.apps.googleusercontent.com`). No client secret is used.

### 3.3 Email (SMTP)

Any SMTP provider works; Zoho ZeptoMail and Amazon SES are good choices for India.
1. Add and verify the domain `onebridgecard.com` in the provider.
2. Add the **SPF**, **DKIM** and **DMARC** DNS records exactly as the provider shows them. Without them, sign-in codes go to spam. A simple DMARC record to start with: TXT `_dmarc` → `v=DMARC1; p=none; rua=mailto:support@onebridgecard.com`.
3. Create SMTP credentials. Note host, port and whether it is 587 (STARTTLS, `SMTP_SECURE=false`) or 465 (`SMTP_SECURE=true`).
4. Some hosting providers block outgoing mail ports on new servers. If sending fails (section 11), ask the host to open port 587, or use 465.

### 3.4 Backup bucket

With Backblaze B2 (others are similar):
1. Create a **private** bucket, for example `onebridge-backups`.
2. Create an **application key** limited to that bucket, with read and write. Note the key ID and key.
3. You will connect it with `rclone config` in section 10.

---

## 4. Prepare the server

Log in as root once. Create the `deploy` user and give it your SSH key:

```bash
adduser --disabled-password --gecos "" deploy
```

```bash
usermod -aG sudo deploy
```

```bash
mkdir -p /home/deploy/.ssh && cp ~/.ssh/authorized_keys /home/deploy/.ssh/ && chown -R deploy:deploy /home/deploy/.ssh && chmod 700 /home/deploy/.ssh
```

Give `deploy` a password, used only for `sudo`:

```bash
passwd deploy
```

**Open a second terminal and check you can log in as `deploy` with your key.** Only then turn off password and root logins:

```bash
sudo sed -i 's/^#\?PasswordAuthentication .*/PasswordAuthentication no/; s/^#\?PermitRootLogin .*/PermitRootLogin no/' /etc/ssh/sshd_config && sudo systemctl restart ssh
```

From now on, work as `deploy`.

Firewall (SSH, HTTP, HTTPS only):

```bash
sudo ufw allow OpenSSH && sudo ufw allow 80/tcp && sudo ufw allow 443/tcp && sudo ufw allow 443/udp && sudo ufw --force enable
```

Security updates, SSH brute-force protection and tools:

```bash
sudo apt update && sudo apt install -y fail2ban unattended-upgrades gnupg curl git dnsutils
```

```bash
sudo dpkg-reconfigure -f noninteractive unattended-upgrades
```

India time (backups run at 02:30 IST):

```bash
sudo timedatectl set-timezone Asia/Kolkata
```

On a 4 GB server, add 2 GB of swap, because building the image needs about 3 GB of memory:

```bash
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile && echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### Install Docker

From Docker's own repository (not Ubuntu's `docker.io`):

```bash
sudo install -m 0755 -d /etc/apt/keyrings && sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc && sudo chmod a+r /etc/apt/keyrings/docker.asc
```

```bash
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
```

```bash
sudo apt update && sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

```bash
sudo usermod -aG docker deploy
```

Log out and back in, then check (it should print a version, without `sudo`):

```bash
docker compose version
```

---

## 5. Check DNS

Both must print the server's IP before you deploy (Caddy needs them to get HTTPS certificates):

```bash
dig +short onebridgecard.com
```

```bash
dig +short www.onebridgecard.com
```

---

## 6. Get the code

Make a read-only deploy key on the server:

```bash
ssh-keygen -t ed25519 -N "" -f ~/.ssh/onebridge_deploy -C "onebridge-server"
```

```bash
cat ~/.ssh/onebridge_deploy.pub
```

In GitHub: the repository → **Settings → Deploy keys → Add deploy key**. Paste the key. Leave **Allow write access** off.

Tell SSH to use that key for GitHub:

```bash
printf 'Host github.com\n  IdentityFile ~/.ssh/onebridge_deploy\n  IdentitiesOnly yes\n' >> ~/.ssh/config && chmod 600 ~/.ssh/config
```

Clone (replace the repository and branch with the ones the founder gave you):

```bash
sudo mkdir -p /opt/onebridge && sudo chown deploy:deploy /opt/onebridge && git clone --branch main git@github.com:onebridge-tech/Grid.git /opt/onebridge
```

---

## 7. Configure

```bash
cd /opt/onebridge && cp .env.production.example .env && chmod 600 .env
```

Open it:

```bash
nano .env
```

Fill **every** empty value. The comment above each one says what it is and how to make it. To generate the secrets, run each command and paste its output:

| Setting | Command |
|---|---|
| `JWT_SECRET`, `INTERNAL_SERVICE_KEY`, `REVALIDATION_SIGNING_SECRET` | `openssl rand -hex 48` (a new one for each) |
| `ENCRYPTION_KEY`, `BACKUP_PASSPHRASE` | `openssl rand -hex 32` (a new one for each) |
| `MONGO_ROOT_PASSWORD`, `MONGO_APP_PASSWORD` | `openssl rand -hex 24` (a new one for each) |
| `MONGO_KEYFILE_CONTENT` | `openssl rand -base64 756 \| tr -d '\n'` |

Then:
- Put `MONGO_APP_PASSWORD` into `MONGODB_URI` in place of `CHANGE_ME`.
- Fill `GOOGLE_CLIENT_ID`, the `SMTP_*` settings and `EMAIL_FROM` from section 3.
- Leave `TURNSTILE_SECRET` empty.
- Do not put a `$` sign in any value.

**Before going further**, save `ENCRYPTION_KEY` and `BACKUP_PASSPHRASE` in the company password manager:
- Losing `ENCRYPTION_KEY` makes every lead, invite contact and message unreadable, forever.
- Losing `BACKUP_PASSPHRASE` makes every backup useless.

---

## 8. First deploy

```bash
cd /opt/onebridge && ./deploy/deploy.sh
```

What happens:
1. It checks `.env` (it names any empty setting; it never prints values).
2. It builds the image (5 to 15 minutes the first time).
3. It starts MongoDB, sets up the replica set and the app user, then starts the apps and Caddy.
4. Caddy gets HTTPS certificates from Let's Encrypt (needs DNS from section 5 and ports 80/443 open).
5. It waits up to 3 minutes for `https://onebridgecard.com/healthz`.

Success ends with:

```
==> Deployed <commit>. The site is healthy.
```

Then look at everything:

```bash
./deploy/status.sh
```

Expected: `caddy`, `mongo`, `api`, `web-app`, `web-public` are running (the last four "healthy"); `mongo-init` shows "Exited (0)" (that is correct: it runs once); the health line shows `"status":"ok"` with every service `ok`.

If it fails, see section 11.

---

## 9. Smoke test

Do every check. Use a real email address you can read, and a phone for the QR test.

- [ ] `https://onebridgecard.com` shows the padlock. `https://www.onebridgecard.com` redirects to it.
- [ ] **Create account** with a real email: the 6-digit code arrives (check spam), you land on company setup.
- [ ] **Sign out**, then **sign in** with the password in the same browser: no code is asked.
- [ ] Sign in from another browser or a private window: a code **is** asked and arrives.
- [ ] **Continue with Google** works.
- [ ] **Forgot password:** the code arrives, the new password works, and the other browser is signed out.
- [ ] Create a company, **upload a logo** (it shows after a page reload), publish a card.
- [ ] Open the card's page; scan its **QR code** with a phone: it opens the card.
- [ ] On the card, **share your details**: the lead appears in the dashboard, and the card owner receives a "new lead" email (with no personal details in it).
- [ ] **Invite** a person to a seat by email: the invite email arrives; opening it, signing up with that email and accepting claims the seat.
- [ ] **Chat:** two accounts in two browsers; messages arrive without refreshing.
- [ ] **Reboot test:** `sudo reboot`, wait two minutes, `./deploy/status.sh` is healthy, sign in, the data is still there.

Then delete the test company and accounts or keep them clearly named as tests.

---

## 10. Backups and monitoring

Install rclone and connect the bucket from section 3.4:

```bash
sudo apt install -y rclone
```

```bash
rclone config
```

Choose `n` (new remote), name it `b2`, storage type `b2`, paste the key ID and key, accept the defaults. Test it:

```bash
rclone lsd b2:
```

In `.env`, set `BACKUP_RCLONE_REMOTE=b2:onebridge-backups` (your bucket name). Optionally set `ALERT_EMAIL` and install `mailutils` to receive a daily summary.

Run a first backup:

```bash
./deploy/backup.sh
```

Prove it restores. This fills a separate check database only; the live site is not touched:

```bash
ls deploy/backups/
```

```bash
./deploy/restore.sh <file name from the list above>
```

It prints the number of documents in each collection. Then schedule the daily backup and the weekly clean-up:

```bash
sudo cp deploy/cron/onebridge /etc/cron.d/onebridge && sudo chmod 644 /etc/cron.d/onebridge
```

Monitoring:
- Create a free UptimeRobot (or similar) HTTP check for `https://onebridgecard.com/healthz` every 5 minutes, alerting the team. It answers 200 only when every service and the database work.
- Run `./deploy/status.sh` once a week; it warns when the disk is over 80% full.

---

## 11. If something goes wrong

Start here:

```bash
./deploy/status.sh
```

```bash
./deploy/logs.sh api 200
```

(Other containers: `caddy`, `mongo`, `mongo-init`, `web-app`, `web-public`.)

| What you see | Likely cause | Fix |
|---|---|---|
| Build stops with "Killed" or exit code 137 | Out of memory while building | Add the swap file (section 4), run `./deploy/deploy.sh` again |
| `ERROR: These settings in .env are empty: ...` | `.env` not filled | Fill the named settings |
| api log: `Missing environment variables: ...` or `... is required in production` | A setting missing or still a development value | Fill or regenerate the named setting |
| api log: `must not be the development default` | A secret was copied from an example | Generate a new one (section 7) |
| `mongo` restarting, log mentions the keyfile | `MONGO_KEYFILE_CONTENT` empty or broken | Regenerate it with the command in section 7 (one line, no spaces) |
| `mongo-init` exited with an error, api never starts | Wrong root password, or MongoDB not ready | `./deploy/logs.sh mongo-init 100`; check `MONGO_ROOT_*`; run `./deploy/deploy.sh` again |
| api log: `Authentication failed` | `MONGODB_URI` password differs from `MONGO_APP_PASSWORD` | Make them the same, deploy again |
| Browser: certificate warning, or Caddy log `challenge failed` | DNS not pointing here yet, or port 80 blocked | Check section 5 and the firewall; wait for DNS; `docker compose restart caddy` |
| Caddy log: `too many certificates` | Let's Encrypt rate limit after many failed tries | Wait an hour; fix DNS first |
| Sign-up says "We couldn't send the email" | SMTP settings, or the host blocks the port | `./deploy/logs.sh api 200` shows `Code email failed`; check `SMTP_*`; try port 465 with `SMTP_SECURE=true`; ask the host to open outgoing mail |
| Codes arrive in spam | SPF / DKIM / DMARC missing | Add the provider's DNS records (section 3.3) |
| "Continue with Google" missing or failing | `GOOGLE_CLIENT_ID` wrong, or the origin not authorised | Check section 3.2 step 4 (exact `https://onebridgecard.com`, no trailing slash) |
| Signed out after every page reload | Cookie path or address mismatch | `COOKIE_PATH=/svc/identity/auth`, `APP_URL` and `PUBLIC_URL` = `https://onebridgecard.com`; changing `PUBLIC_URL` needs `./deploy/deploy.sh` (rebuild) |
| Chat only updates after refresh | WebSocket blocked | `./deploy/logs.sh caddy 200` and `api 200` around `/svc/messaging/realtime`; send to the developers |
| Card pages without styles | `/_cards` assets not served | Send `./deploy/logs.sh web-public 200` to the developers |

**Go back to the previous working version** (the database is not changed):

```bash
./deploy/rollback.sh
```

**What to send the developers** when you need help: the output of `./deploy/status.sh`, the last 200 lines of the failing container's logs (`./deploy/logs.sh <name> 200`), the commit (`git log -1 --oneline`), and what you did. **Never send `.env`** or any secret; the scripts and logs do not print them.

---

## 12. After the first deploy

- Every later deploy: `cd /opt/onebridge && ./deploy/deploy.sh` (see [RUNBOOK.md](RUNBOOK.md)).
- Never edit code on the server; changes arrive through GitHub.
- Keep the server updated: `unattended-upgrades` installs security updates; reboot monthly in a quiet hour and check `./deploy/status.sh`.
- Rotating secrets, restoring backups and other tasks: [RUNBOOK.md](RUNBOOK.md).
