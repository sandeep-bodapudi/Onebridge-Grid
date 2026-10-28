#!/usr/bin/env bash
# One look at the server (D-VPS-DEPLOY B7): containers, health, disk, last backup.
source "$(dirname "$0")/lib.sh"
load_env

say "Containers"
compose ps

say "Health ($(health_url))"
insecure=()
[[ "$SITE_DOMAIN" == "localhost" || "$SITE_DOMAIN" == *.localhost ]] && insecure=(-k)
curl -sS "${insecure[@]}" --max-time 10 "$(health_url)" || echo "(no answer)"
echo

say "Disk"
df -h / | tail -n 1 | awk '{ print "Root disk: " $3 " used of " $2 " (" $5 ")" }'
used="$(df --output=pcent / | tail -n 1 | tr -dc '0-9')"
[ "${used:-0}" -lt 80 ] || warn "Disk is ${used}% full. Free space: docker image prune -af --filter until=168h"
docker system df

say "Last backup"
latest="$(ls -1t "$ROOT"/deploy/backups/onebridge-*.tar.gpg 2>/dev/null | head -n 1 || true)"
if [ -n "$latest" ]; then
  echo "$(basename "$latest") ($(du -h "$latest" | cut -f1)), made $(date -r "$latest" '+%Y-%m-%d %H:%M')"
else
  warn "No backup on this server yet. Run ./deploy/backup.sh"
fi
