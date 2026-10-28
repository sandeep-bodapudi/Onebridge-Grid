#!/usr/bin/env bash
# Returns the site to an earlier version (D-VPS-DEPLOY B7):
#   ./deploy/rollback.sh            -> the last healthy deploy (deploy/.last-good)
#   ./deploy/rollback.sh <commit>   -> that commit
# The database is not changed. After fixing the problem, run: git checkout main && ./deploy/deploy.sh
source "$(dirname "$0")/lib.sh"

load_env
TARGET="${1:-}"
if [ -z "$TARGET" ]; then
  [ -f "$ROOT/deploy/.last-good" ] || die "No deploy/.last-good yet. Give a commit: ./deploy/rollback.sh <commit>"
  TARGET="$(cat "$ROOT/deploy/.last-good")"
fi
git cat-file -e "${TARGET}^{commit}" 2>/dev/null || die "Unknown commit: $TARGET"

say "Rolling back to $(git log -1 --format='%h %s' "$TARGET")"
git checkout --detach "$TARGET"
compose build
compose up -d --remove-orphans

say "Waiting for $(health_url) (up to 180 seconds)"
if wait_healthy 180; then
  say "Rolled back. The site is healthy on $(git log -1 --format='%h' "$TARGET")."
  echo "The code is on a detached commit. When the fix is merged: git checkout main && ./deploy/deploy.sh"
  exit 0
fi
warn "Still not healthy after the rollback. Recent api logs:"
compose logs --tail 80 api || true
exit 1
