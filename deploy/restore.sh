#!/usr/bin/env bash
# Restores a backup made by deploy/backup.sh (D-VPS-DEPLOY B7).
#   ./deploy/restore.sh onebridge-2026-11-01_0230.tar.gpg          -> CHECK ONLY (safe)
#   ./deploy/restore.sh onebridge-2026-11-01_0230.tar.gpg --live   -> replaces live data
# The file is taken from deploy/backups/ or, if missing there, downloaded from the remote.
# Check only: restores into database "onebridge_restore_check" and prints document counts per
# collection; the live site is untouched. --live asks you to type a confirmation, stops the
# apps, replaces the "onebridge" database and the uploaded files, then starts the apps again.
source "$(dirname "$0")/lib.sh"

load_env
require_env BACKUP_PASSPHRASE
ARCHIVE="${1:-}"
MODE="${2:-check}"
[ -n "$ARCHIVE" ] || die "Give the backup file name: ./deploy/restore.sh onebridge-<date>.tar.gpg [--live]"
[[ "$MODE" == "check" || "$MODE" == "--live" ]] || die "Unknown option: $MODE"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
LOCAL="$ROOT/deploy/backups/$(basename "$ARCHIVE")"
[ -f "$ARCHIVE" ] && LOCAL="$ARCHIVE"
if [ ! -f "$LOCAL" ]; then
  require_env BACKUP_RCLONE_REMOTE
  say "Downloading $(basename "$ARCHIVE")"
  rclone copy "${BACKUP_RCLONE_REMOTE}/daily/$(basename "$ARCHIVE")" "$WORK/" 2>/dev/null \
    || rclone copy "${BACKUP_RCLONE_REMOTE}/weekly/$(basename "$ARCHIVE")" "$WORK/" \
    || die "Not found locally or on ${BACKUP_RCLONE_REMOTE}"
  LOCAL="$WORK/$(basename "$ARCHIVE")"
fi

say "Decrypting"
gpg --batch --quiet --decrypt --pinentry-mode loopback --passphrase-fd 3 "$LOCAL" 3< <(printf '%s' "$BACKUP_PASSPHRASE") \
  | tar -xf - -C "$WORK" || die "Could not decrypt: wrong BACKUP_PASSPHRASE or a damaged file"
[ -s "$WORK/mongo.archive.gz" ] || die "The backup has no database dump"

mongo_restore() {
  # The archive arrives on stdin; the mongo container already holds the root credentials.
  compose exec -T mongo \
    sh -c 'mongorestore --quiet --archive --gzip -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin "$@"' sh "$@" \
    < "$WORK/mongo.archive.gz"
}

count_collections() {
  compose exec -T mongo \
    sh -c 'mongosh --quiet -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --eval "
      const d = db.getSiblingDB(\"$1\");
      d.getCollectionNames().sort().forEach((c) => print(c.padEnd(32) + d.getCollection(c).countDocuments()));
    "' sh "$1"
}

if [ "$MODE" = "check" ]; then
  say "Restoring into onebridge_restore_check (the live database is not touched)"
  mongo_restore --drop --nsInclude 'onebridge.*' --nsFrom 'onebridge.*' --nsTo 'onebridge_restore_check.*'
  say "Documents per collection in the backup:"
  count_collections onebridge_restore_check
  echo
  echo "Uploaded files in the backup: $(tar -tzf "$WORK/media.tar.gz" 2>/dev/null | grep -vc '/$' || echo 0)"
  echo "When you are done checking, remove the copy:"
  echo "  docker compose exec mongo mongosh -u $MONGO_ROOT_USER -p --authenticationDatabase admin --eval 'db.getSiblingDB(\"onebridge_restore_check\").dropDatabase()'"
  exit 0
fi

warn "This REPLACES the live database and uploaded files with the backup $(basename "$LOCAL")."
warn "Everything written since that backup is lost."
read -r -p "Type RESTORE LIVE to continue: " ANSWER
[ "$ANSWER" = "RESTORE LIVE" ] || die "Cancelled. Nothing was changed."

say "Stopping the apps"
compose stop web-app web-public api
say "Restoring the database"
mongo_restore --drop --nsInclude 'onebridge.*'
say "Restoring uploaded files"
compose run --rm --no-deps -T --entrypoint sh api -c 'rm -rf /data/media/* && tar -xzf - -C /data/media' < "$WORK/media.tar.gz"
say "Starting the apps"
compose up -d api web-app web-public
if wait_healthy 180; then say "Restore finished. The site is healthy."; else die "The site did not become healthy; check ./deploy/logs.sh api 200"; fi
