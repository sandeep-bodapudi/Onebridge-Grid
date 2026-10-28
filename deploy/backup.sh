#!/usr/bin/env bash
# Encrypted off-server backup of the database and uploaded files (D-VPS-DEPLOY B7, D7).
#   ./deploy/backup.sh          (cron runs it daily at 02:30, see deploy/cron/onebridge)
# 1. mongodump of every database (gzip archive) and a tar of the media volume.
# 2. Both packed in one file, encrypted with gpg (AES-256, BACKUP_PASSPHRASE).
# 3. Uploaded with rclone to BACKUP_RCLONE_REMOTE/daily (and /weekly on Sundays).
# Kept: 14 daily and 8 weekly copies remotely, the 3 newest on this server.
source "$(dirname "$0")/lib.sh"

load_env
require_env BACKUP_PASSPHRASE BACKUP_RCLONE_REMOTE
command -v gpg >/dev/null || die "gpg is not installed: sudo apt install -y gnupg"
command -v rclone >/dev/null || die "rclone is not installed (see deploy/DEPLOYMENT-GUIDE.md, section 10)"

STAMP="$(date +%Y-%m-%d_%H%M)"
LOCAL_DIR="$ROOT/deploy/backups"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
mkdir -p "$LOCAL_DIR"
chmod 700 "$LOCAL_DIR"
NAME="onebridge-${STAMP}.tar.gpg"
OUT="$LOCAL_DIR/$NAME"

notify() {
  local subject="$1" body="$2"
  if [ -n "${ALERT_EMAIL:-}" ] && command -v mail >/dev/null; then
    printf '%s\n' "$body" | mail -s "$subject" "$ALERT_EMAIL" || warn "Could not email the summary"
  fi
  echo "$subject: $body"
}

fail() {
  notify "OneBridge backup FAILED" "$1 ($(hostname), $STAMP)"
  exit 1
}

say "Dumping MongoDB"
# The mongo container already holds the root credentials in its environment, so no password
# appears on this server's command line.
compose exec -T mongo \
  sh -c 'mongodump --quiet --archive --gzip -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin' \
  > "$WORK/mongo.archive.gz" || fail "mongodump failed"

say "Packing uploaded files"
compose exec -T api tar -czf - -C /data/media . > "$WORK/media.tar.gz" || fail "media archive failed"

say "Encrypting"
tar -cf - -C "$WORK" mongo.archive.gz media.tar.gz \
  | gpg --batch --yes --quiet --symmetric --cipher-algo AES256 --pinentry-mode loopback \
        --passphrase-fd 3 -o "$OUT" 3< <(printf '%s' "$BACKUP_PASSPHRASE") \
  || fail "encryption failed"
SIZE="$(du -h "$OUT" | cut -f1)"

say "Uploading to ${BACKUP_RCLONE_REMOTE}"
rclone copy "$OUT" "${BACKUP_RCLONE_REMOTE}/daily/" || fail "upload failed"
if [ "$(date +%u)" = "7" ]; then
  rclone copy "$OUT" "${BACKUP_RCLONE_REMOTE}/weekly/" || fail "weekly upload failed"
fi

say "Removing old copies"
rclone delete --min-age 15d "${BACKUP_RCLONE_REMOTE}/daily/" || warn "Could not prune old daily backups"
rclone delete --min-age 57d "${BACKUP_RCLONE_REMOTE}/weekly/" || warn "Could not prune old weekly backups"
ls -1t "$LOCAL_DIR"/onebridge-*.tar.gpg 2>/dev/null | tail -n +4 | xargs -r rm -f

notify "OneBridge backup OK" "$NAME ($SIZE) uploaded to ${BACKUP_RCLONE_REMOTE} from $(hostname)"
