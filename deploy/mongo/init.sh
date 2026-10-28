#!/bin/bash
# D-VPS-DEPLOY B5: one-shot setup, safe to run on every deploy.
#  1. Starts the single-node replica set rs0 if it is not running yet (transactions and change
#     streams need a replica set).
#  2. Creates the application user with readWrite on the "onebridge" database if it is missing.
# The app password reaches mongosh through the environment; the root password is passed to mongosh
# only inside this short-lived container, which nothing else runs in.
set -euo pipefail

: "${MONGO_ROOT_USER:?}" "${MONGO_ROOT_PASSWORD:?}" "${MONGO_APP_USER:?}" "${MONGO_APP_PASSWORD:?}"

for i in $(seq 1 30); do
  if mongosh --quiet --host mongo -u "$MONGO_ROOT_USER" -p "$MONGO_ROOT_PASSWORD" --authenticationDatabase admin --eval 'db.adminCommand("ping").ok' >/dev/null 2>&1; then
    break
  fi
  echo "Waiting for MongoDB ($i)..."
  sleep 2
done

mongosh --quiet --host mongo -u "$MONGO_ROOT_USER" -p "$MONGO_ROOT_PASSWORD" --authenticationDatabase admin /deploy/mongo/init-replica.js
echo "MongoDB is ready."
