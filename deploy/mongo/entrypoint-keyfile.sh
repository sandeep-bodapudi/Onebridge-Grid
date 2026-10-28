#!/bin/bash
# D-VPS-DEPLOY B5: a replica set with auth needs a keyfile, readable by mongod (uid 999) only.
# It is written from MONGO_KEYFILE_CONTENT (in .env) on every start, then MongoDB's own
# entrypoint runs as usual (it creates the root user from MONGO_INITDB_ROOT_* on first start).
set -euo pipefail

if [ -z "${MONGO_KEYFILE_CONTENT:-}" ]; then
  echo "MONGO_KEYFILE_CONTENT is empty: set it in .env (openssl rand -base64 756 | tr -d '\n')" >&2
  exit 1
fi

mkdir -p /data/keyfile
printf '%s' "$MONGO_KEYFILE_CONTENT" > /data/keyfile/mongo-keyfile
chmod 400 /data/keyfile/mongo-keyfile
chown 999:999 /data/keyfile/mongo-keyfile
unset MONGO_KEYFILE_CONTENT

exec docker-entrypoint.sh "$@"
