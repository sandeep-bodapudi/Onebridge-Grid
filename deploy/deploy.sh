#!/usr/bin/env bash
# Deploys the latest code on this server (D-VPS-DEPLOY B7):
#   cd /opt/onebridge && ./deploy/deploy.sh
# Pulls, rebuilds, restarts, then waits for https://<SITE_DOMAIN>/healthz. The commit is saved as
# "last good" only after a healthy deploy, so ./deploy/rollback.sh can return to it.
source "$(dirname "$0")/lib.sh"

load_env
require_env "${REQUIRED_SETTINGS[@]}"
[ "${NODE_ENV:-}" = "production" ] || die "NODE_ENV must be production in .env"
[[ "${MONGODB_URI}" != *CHANGE_ME* ]] || die "MONGODB_URI still says CHANGE_ME: put MONGO_APP_PASSWORD in it"
if [[ ",${AUTH_METHODS:-google,email}," == *",google,"* ]]; then require_env GOOGLE_CLIENT_ID; fi
command -v docker >/dev/null || die "Docker is not installed (see deploy/DEPLOYMENT-GUIDE.md, section 4)"

PREVIOUS="$(git rev-parse HEAD)"

say "Fetching the latest code"
git pull --ff-only || die "git pull failed. Never edit code on the server; see deploy/RUNBOOK.md."
CURRENT="$(git rev-parse HEAD)"
say "Deploying $(git log -1 --format='%h %s' "$CURRENT")"

say "Building the image (this takes a few minutes)"
compose build

say "Starting the stack"
compose up -d --remove-orphans

say "Waiting for $(health_url) (up to 180 seconds)"
if wait_healthy 180; then
  echo "$CURRENT" > "$ROOT/deploy/.last-good"
  say "Deployed $(git log -1 --format='%h' "$CURRENT"). The site is healthy."
  exit 0
fi

warn "The site did not become healthy. Recent api logs:"
compose logs --tail 80 api || true
compose ps || true
echo
echo "To go back to the version that was running before this deploy:"
echo "  ./deploy/rollback.sh $PREVIOUS"
exit 1
