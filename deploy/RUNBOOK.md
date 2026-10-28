# OneBridge Grid: server runbook

Day-to-day operations for the engineer who runs `onebridgecard.com`. **First deployment:** follow [DEPLOYMENT-GUIDE.md](DEPLOYMENT-GUIDE.md) (server setup, accounts, DNS, configuration, first deploy, smoke test, troubleshooting); this runbook assumes that is done. Every command is meant to be copied as is. Run them as the `deploy` user unless the step says `sudo`.

How it fits together: one Ubuntu server runs Docker Compose with six containers. **Caddy** takes HTTPS on ports 80 and 443 and sends requests to **api** (all backend services in one Node process), **web-app** (the admin app) or **web-public** (cards and company pages). **mongo** holds the data and is never reachable from outside. **mongo-init** runs once per deploy to set up the database.

---

## 1. Backups

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

## 2. Monitoring

- Add an HTTP check in UptimeRobot (free) for `https://onebridgecard.com/healthz`, every 5 minutes, alerting the team by email. It answers 200 only when every service and the database are working.
- Run `./deploy/status.sh` weekly; it warns when the disk is over 80% full.

## 3. Every deploy

```bash
cd /opt/onebridge && ./deploy/deploy.sh
```

Never edit code on the server. Changes come through GitHub only.

## 4. When something breaks

See what is running and whether the site is healthy:

```bash
./deploy/status.sh
```

Read the latest logs (containers: `caddy`, `mongo`, `mongo-init`, `api`, `web-app`, `web-public`). The guide's section 11 has a table of common failures and fixes.

Read the logs:

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

## 5. Rotating a secret

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
