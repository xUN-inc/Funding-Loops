#!/usr/bin/env bash
# Deploy + restart Follow The Money on a VM.
#
# Idempotent: safe to run by hand, by CI, or on a cron / reboot. Pulls the
# latest code, installs deps, builds the React client into public/, then
# restarts the Express app under PM2 (which also serves the built client).
#
# Usage:
#   ./script.sh              # deploy from current branch
#   BRANCH=main ./script.sh  # deploy from a specific branch
#   SKIP_PULL=1 ./script.sh  # skip git pull (deploy local changes)
#
# Required (one-time on the VM):
#   - Node.js >= 20, npm
#   - pm2 installed globally:  npm install -g pm2
#   - this repo cloned at $APP_DIR (default: ~/follow-the-money/app)
#   - .env populated at $APP_DIR/.env (see .env.example)

set -euo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "$0")" && pwd)}"
BRANCH="${BRANCH:-main}"
PM2_APP_NAME="${PM2_APP_NAME:-follow-the-money}"

cd "$APP_DIR"

echo "==> [1/5] Sanity check"
command -v node >/dev/null || { echo "node not found — install Node 20+"; exit 1; }
command -v npm  >/dev/null || { echo "npm not found";  exit 1; }
command -v pm2  >/dev/null || { echo "pm2 not found — run: npm install -g pm2"; exit 1; }
[ -f .env ] || { echo ".env missing in $APP_DIR — copy .env.example and fill it in"; exit 1; }

NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]')
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "Node $NODE_MAJOR detected — this app needs Node 20+"; exit 1
fi

echo "==> [2/5] Pull latest from origin/$BRANCH"
if [ "${SKIP_PULL:-0}" = "1" ]; then
  echo "  SKIP_PULL=1 — using current working tree"
else
  git fetch origin "$BRANCH"
  git checkout "$BRANCH"
  git reset --hard "origin/$BRANCH"
fi
echo "  HEAD = $(git rev-parse --short HEAD)  ($(git log -1 --pretty=%s))"

echo "==> [3/5] Install dependencies (root + client via postinstall)"
# `npm ci` is faster + reproducible from package-lock.json.
# postinstall script installs client deps automatically.
npm ci

echo "==> [4/5] Build React client → public/"
( cd client && npm run build )

echo "==> [5/5] (Re)start under PM2 as '$PM2_APP_NAME'"
# `pm2 startOrReload` does the right thing whether the app is already running
# (zero-downtime reload) or not (cold start). ecosystem.config.cjs holds the
# canonical process definition.
pm2 startOrReload ecosystem.config.cjs --only "$PM2_APP_NAME" --update-env
pm2 save

echo ""
echo "==> Deploy complete. Status:"
pm2 status "$PM2_APP_NAME"
echo ""
echo "==> Tail logs with:  pm2 logs $PM2_APP_NAME"
