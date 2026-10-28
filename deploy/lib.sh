#!/usr/bin/env bash
# Shared helpers for the deploy/*.sh scripts (D-VPS-DEPLOY B7). Sourced, not run.
# Nothing here prints a secret value.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

say()  { printf '\033[1m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[33mWARNING: %s\033[0m\n' "$*" >&2; }
die()  { printf '\033[31mERROR: %s\033[0m\n' "$*" >&2; exit 1; }

# Reads KEY=value lines from .env into the environment WITHOUT running the file as shell code.
# Surrounding single or double quotes are removed. Lines starting with # are comments.
load_env() {
  [ -f "$ROOT/.env" ] || die ".env is missing. Copy .env.production.example to .env and fill it in (see deploy/DEPLOYMENT-GUIDE.md, section 7)."
  local line key value
  while IFS= read -r line || [ -n "$line" ]; do
    line="${line%$'\r'}"
    [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
    [[ "$line" =~ ^([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]] || continue
    key="${BASH_REMATCH[1]}"
    value="${BASH_REMATCH[2]}"
    if [[ "$value" =~ ^\"(.*)\"$ || "$value" =~ ^\'(.*)\'$ ]]; then value="${BASH_REMATCH[1]}"; fi
    export "$key=$value"
  done < "$ROOT/.env"
}

# Fails with the names (never values) of required settings that are empty.
require_env() {
  local missing=()
  for name in "$@"; do
    [ -n "${!name:-}" ] || missing+=("$name")
  done
  [ ${#missing[@]} -eq 0 ] || die "These settings in .env are empty: ${missing[*]}"
}

REQUIRED_SETTINGS=(
  SITE_DOMAIN PUBLIC_URL APP_URL WEB_PUBLIC_URL
  JWT_SECRET INTERNAL_SERVICE_KEY ENCRYPTION_KEY REVALIDATION_SIGNING_SECRET
  SMTP_HOST EMAIL_FROM
  MONGO_ROOT_USER MONGO_ROOT_PASSWORD MONGO_APP_USER MONGO_APP_PASSWORD MONGO_KEYFILE_CONTENT MONGODB_URI
  MEDIA_DIR
)

compose() { docker compose "$@"; }

health_url() {
  echo "https://${SITE_DOMAIN}/healthz"
}

# Waits up to $1 seconds for /healthz to answer 200. Local test domains use Caddy's own certificate.
wait_healthy() {
  local timeout="$1" waited=0 insecure=()
  [[ "$SITE_DOMAIN" == "localhost" || "$SITE_DOMAIN" == *.localhost ]] && insecure=(-k)
  while [ "$waited" -lt "$timeout" ]; do
    if curl -fsS "${insecure[@]}" --max-time 5 "$(health_url)" >/dev/null 2>&1; then return 0; fi
    sleep 5
    waited=$((waited + 5))
    printf '.'
  done
  echo
  return 1
}
