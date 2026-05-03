#!/bin/sh
# Keeps /app/node_modules (anonymous Docker volume) in sync with package-lock.json.
# After adding a dependency on the host, the next container start reinstalls deps.
set -e
cd /app

LOCK_HASH=""
if [ -f package-lock.json ]; then
  LOCK_HASH=$(sha256sum package-lock.json | awk '{print $1}')
fi

STORED=""
if [ -f node_modules/.npm-lock-check ]; then
  STORED=$(cat node_modules/.npm-lock-check)
fi

MISSING_PKG=""
if [ ! -f node_modules/recharts/package.json ]; then
  MISSING_PKG=1
fi

if [ "$LOCK_HASH" != "$STORED" ] || [ -n "$MISSING_PKG" ] || [ ! -d node_modules ]; then
  echo "frontend: syncing node_modules (lock changed, deps missing, or fresh volume)..."
  npm ci --prefer-offline || npm install --prefer-offline
  if [ -n "$LOCK_HASH" ]; then
    echo "$LOCK_HASH" > node_modules/.npm-lock-check
  fi
fi

exec "$@"
