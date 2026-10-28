# OneBridge Grid: server runbook

For the engineer who runs `onebridgecard.com`. Every command is meant to be copied as is. Run them as the `deploy` user unless the step says `sudo`.

How it fits together: one Ubuntu server runs Docker Compose with six containers. **Caddy** takes HTTPS on ports 80 and 443 and sends requests to **api** (all backend services in one Node process), **web-app** (the admin app) or **web-public** (cards and company pages). **mongo** holds the data and is never reachable from outside. **mongo-init** runs once per deploy to set up the database.

---

## 1. Server requirements

- Ubuntu 22.04 or 24.04 LTS, 64-bit.
- 4 GB RAM minimum, 8 GB recommended. 2 vCPU. 40 GB SSD.
- A public IPv4 address.

## 2. First-time server setup

Log in as root once, create the `deploy` user and give it your SSH key:

```bash
adduser --disabled-password --gecos "" deploy
```

```bash
usermod -aG sudo deploy
```

```bash
mkdir -p /home/deploy/.ssh && cp ~/.ssh/authorized_keys /home/deploy/.ssh/ && chown -R deploy:deploy /home/deploy/.ssh && chmod 700 /home/deploy/.ssh
```

Set a password for `sudo` (it is only used for `sudo`, never for SSH):

```bash
passwd deploy
```

Open a **second** terminal and check you can log in as `deploy` with your key before going on. Then turn off password and root logins:

```bash
sudo sed -i 's/^#\?PasswordAuthentication .*/PasswordAuthentication no/; s/^#\?PermitRootLogin .*/PermitRootLogin no/' /etc/ssh/sshd_config && sudo systemctl restart ssh
```

Firewall: allow SSH, HTTP and HTTPS only:

```bash
sudo ufw allow OpenSSH && sudo ufw allow 80/tcp && sudo ufw allow 443/tcp && sudo ufw allow 443/udp && sudo ufw --force enable
```

Block repeated SSH login attempts, and install security updates automatically:

```bash
sudo apt update && sudo apt install -y fail2ban unattended-upgrades gnupg curl git
```

```bash
sudo dpkg-reconfigure -f noninteractive unattended-upgrades
```

Timezone (backups run at 02:30 India time):

```bash
sudo timedatectl set-timezone Asia/Kolkata
```

On a 4 GB server, add 2 GB of swap (the image build needs about 3 GB of memory):

```bash
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile && echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

## 3. Install Docker

From Docker's official repository (not the Ubuntu `docker.io` package):

```bash
sudo install -m 0755 -d /etc/apt/keyrings && sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc && sudo chmod a+r /etc/apt/keyrings/docker.asc
```

```bash
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
```

```bash
sudo apt update && sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

Let `deploy` use Docker, then log out and back in:

```bash
sudo usermod -aG docker deploy
```

Check:

```bash
docker compose version
```

## 4. DNS

At the domain registrar, add:

| Type | Name | Value |
|---|---|---|
| A | `@` (onebridgecard.com) | the server's IP |
| A | `www` | the server's IP |

For email, add the SPF, DKIM and DMARC records your email provider (ZeptoMail, SES, ...) gives you, exactly as they give them. Without these, sign-in codes land in spam.

Check DNS from the server (both must print the server's IP):

```bash
dig +short onebridgecard.com
```

```bash
dig +short www.onebridgecard.com
```

## 5. Get the code

Create a read-only deploy key on the server:

```bash
ssh-keygen -t ed25519 -N "" -f ~/.ssh/onebridge_deploy -C "onebridge-server"
```

```bash
cat ~/.ssh/onebridge_deploy.pub
```

In GitHub: the repository > Settings > Deploy keys > Add deploy key. Paste the key, leave "Allow write access" **off**.

Tell SSH to use it for GitHub:

```bash
printf 'Host github.com\n  IdentityFile ~/.ssh/onebridge_deploy\n  IdentitiesOnly yes\n' >> ~/.ssh/config && chmod 600 ~/.ssh/config
```

Clone into `/opt/onebridge` (use the repository the founder names):

```bash
sudo mkdir -p /opt/onebridge && sudo chown deploy:deploy /opt/onebridge && git clone git@github.com:onebridge-tech/Grid.git /opt/onebridge
```

## 6. Configure

```bash
cd /opt/onebridge && cp .env.production.example .env && chmod 600 .env
```

Open `.env` (`nano .env`) and fill every empty value. Each secret has the command that makes it next to it, for example:

```bash
openssl rand -hex 48
```

Put the app database password into `MONGODB_URI` in place of `CHANGE_ME`.

**Before going on**, copy `ENCRYPTION_KEY` and `BACKUP_PASSPHRASE` into the company password manager. If `ENCRYPTION_KEY` is lost, leads, invite contacts and messages can never be read again. If `BACKUP_PASSPHRASE` is lost, no backup can be restored.

## 7. First deploy

```bash
cd /opt/onebridge && ./deploy/deploy.sh
```

The first build takes 5 to 15 minutes. Success ends with:

```
==> Deployed <commit>. The site is healthy.
```

Check everything is up:

```bash
./deploy/status.sh
```

All six containers should be "running" or "healthy" (`mongo-init` shows "exited (0)", which is correct), and the health line shows `"status":"ok"`.

## 8. Smoke test (tick each one)

- [ ] `https://onebridgecard.com` shows a padlock; `https://www.onebridgecard.com` redirects to it.
- [ ] Sign up with a real email: the code arrives (check spam), you are signed in.
- [ ] Sign out, sign in again with the password (same browser: no code).
- [ ] Continue with Google works.
- [ ] Forgot password: code arrives, new password works, other devices are signed out.
- [ ] Create a company, upload a logo, publish a card.
- [ ] Open the card and scan its QR code on a phone (the short link `/r/...` opens the card).
- [ ] Share your details from the card: the lead appears in the dashboard and the owner gets a "new lead" email.
- [ ] Two test accounts in two browsers: messages arrive live (no refresh).
- [ ] Reboot and check everything comes back with the data: `sudo reboot`, wait two minutes, then `./deploy/status.sh` and sign in.

## 9. Backups

Install rclone and connect it to the backup bucket (Backblaze B2 or any S3-compatible storage):

```bash
sudo apt install -y rclone
```

```bash
rclone config
```

Name the remote (for example `b2`), then set `BACKUP_RCLONE_REMOTE=b2:onebridge-backups` and `BACKUP_PASSPHRASE` in `.env`.

Run one backup by hand:

```bash
./deploy/backup.sh
```

Prove it can be restored. This only fills a separate check database; the live site is untouched:

```bash
./deploy/restore.sh onebridge-<date>.tar.gpg
```

It prints the number of documents in each collection. Then install the daily schedule (02:30, plus a weekly clean-up of old images):

```bash
sudo cp deploy/cron/onebridge /etc/cron.d/onebridge && sudo chmod 644 /etc/cron.d/onebridge
```

Backups are kept 14 days (daily) and 8 weeks (weekly) in the bucket, and the 3 newest on the server in `deploy/backups/`.

## 10. Monitoring

- Add an HTTP check in UptimeRobot (free) for `https://onebridgecard.com/healthz`, every 5 minutes, alerting the team by email. It answers 200 only when every service and the database are working.
- Run `./deploy/status.sh` weekly; it warns when the disk is over 80% full.

## 11. Every deploy

```bash
cd /opt/onebridge && ./deploy/deploy.sh
```

Never edit code on the server. Changes come through GitHub only.

## 12. When something breaks

See what is running and whether the site is healthy:

```bash
./deploy/status.sh
```

Read the latest logs (containers: `caddy`, `mongo`, `api`, `web-app`, `web-public`):

```bash
./deploy/logs.sh api 200
```

Go back to the last version that deployed cleanly (the database is not changed):

```bash
./deploy/rollback.sh
```

Restart one container:

```bash
docker compose restart api
```

Restore data from a backup. **This replaces live data and loses everything since the backup**; check first without `--live`, and agree with the founder before using it:

```bash
./deploy/restore.sh onebridge-<date>.tar.gpg --live
```

## 13. Rotating a secret

| Secret | Can it be changed freely? |
|---|---|
| `JWT_SECRET` | Yes. Everyone is signed out. |
| `INTERNAL_SERVICE_KEY`, `REVALIDATION_SIGNING_SECRET` | Yes. |
| `SMTP_PASSWORD`, `GOOGLE_CLIENT_ID` | Yes, after changing them at the provider. |
| `MONGO_APP_PASSWORD` | Yes: change it in both `MONGO_APP_PASSWORD` and `MONGODB_URI`; the next deploy updates the database user. |
| `MONGO_ROOT_PASSWORD` | Only with care: it is set when the database is first created. Change it inside MongoDB first, then in `.env`. |
| `ENCRYPTION_KEY` | **No.** Data encrypted with it would become unreadable. Rotation needs a planned re-encryption with the team. |
| `BACKUP_PASSPHRASE` | Yes for new backups, but keep the old one: older backups still need it. |

After changing `.env`, apply it with:

```bash
./deploy/deploy.sh
```
