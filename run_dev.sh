#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

npm run dev:api &
api_pid=$!
cleanup() {
  kill "$api_pid" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

export VITE_DEV_API_PROXY_TARGET="${VITE_DEV_API_PROXY_TARGET:-http://127.0.0.1:${PORT:-8787}}"
npm run dev -- --host 0.0.0.0
