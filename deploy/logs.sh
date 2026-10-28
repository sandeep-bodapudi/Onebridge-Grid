#!/usr/bin/env bash
# Recent logs of one container (D-VPS-DEPLOY B7):
#   ./deploy/logs.sh api 200        (services: caddy, mongo, api, web-app, web-public)
#   ./deploy/logs.sh api 200 -f     (keep following)
source "$(dirname "$0")/lib.sh"

SERVICE="${1:-}"
LINES="${2:-100}"
[ -n "$SERVICE" ] || die "Which container? ./deploy/logs.sh <caddy|mongo|api|web-app|web-public> [lines] [-f]"
shift || true
shift || true
compose logs --tail "$LINES" "$@" "$SERVICE"
