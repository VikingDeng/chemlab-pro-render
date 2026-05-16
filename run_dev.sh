#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

npm run dev:api &
api_pid=$!
cleanup() {
  kill "$api_pid" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

npm run dev -- --host 0.0.0.0
