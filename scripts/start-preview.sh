#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${PORT:-8787}"
HOST_URL="http://127.0.0.1:${PORT}"
LOG_DIR="${TMPDIR:-/tmp}/chemlab-pro-preview"
SERVER_LOG="${LOG_DIR}/server.log"
TUNNEL_LOG="${LOG_DIR}/tunnel.log"
URL_FILE="${LOG_DIR}/url.txt"

mkdir -p "$LOG_DIR"
cd "$ROOT"

say_line() {
  printf '%s\n' "$*"
}

ensure_build() {
  if [ ! -d node_modules ]; then
    say_line "Installing dependencies..."
    npm ci
  fi

  if [ ! -f dist/index.html ]; then
    say_line "Building app..."
    npm run build
  fi
}

start_server() {
  if curl -fsS --max-time 2 "${HOST_URL}/api/lavoisier" >/dev/null 2>&1; then
    say_line "Local service is already running: ${HOST_URL}"
    return
  fi

  local pids
  pids="$(lsof -tiTCP:"${PORT}" -sTCP:LISTEN 2>/dev/null || true)"
  if [ -n "$pids" ]; then
    say_line "Stopping old process on port ${PORT}..."
    # shellcheck disable=SC2086
    kill $pids 2>/dev/null || true
    sleep 1
  fi

  say_line "Starting ChemLab service..."
  : > "$SERVER_LOG"
  nohup node server/index.mjs > "$SERVER_LOG" 2>&1 &

  for _ in $(seq 1 30); do
    if curl -fsS --max-time 2 "${HOST_URL}/api/lavoisier" >/dev/null 2>&1; then
      say_line "Local service started: ${HOST_URL}"
      return
    fi
    sleep 1
  done

  say_line "Server failed to start. Log:"
  tail -80 "$SERVER_LOG" || true
  exit 1
}

start_tunnel() {
  say_line "Starting public preview tunnel..."
  pkill -f "ssh .*localhost.run.*localhost:${PORT}" 2>/dev/null || true
  sleep 1

  : > "$TUNNEL_LOG"
  : > "$URL_FILE"
  nohup ssh \
    -o StrictHostKeyChecking=no \
    -o ServerAliveInterval=60 \
    -o ExitOnForwardFailure=yes \
    -R "80:localhost:${PORT}" \
    nokey@localhost.run > "$TUNNEL_LOG" 2>&1 &

  local url=""
  for _ in $(seq 1 45); do
    url="$(tr -d '\r' < "$TUNNEL_LOG" | grep -Eo 'https://[^[:space:]]+\.lhr\.life' | tail -1 || true)"
    if [ -n "$url" ]; then
      break
    fi
    sleep 1
  done

  if [ -z "$url" ]; then
    say_line "Tunnel did not return a URL. Log:"
    tail -120 "$TUNNEL_LOG" || true
    exit 1
  fi

  if ! curl -fsS --max-time 15 "${url}/api/lavoisier" >/dev/null; then
    say_line "Tunnel URL appeared, but health check failed: ${url}"
    tail -120 "$TUNNEL_LOG" || true
    exit 1
  fi

  printf '%s\n' "$url" > "$URL_FILE"
  say_line ""
  say_line "ChemLab Pro is ready:"
  say_line "$url"
  say_line ""
  say_line "If it later says 'no tunnel here', run this script again."

  if command -v open >/dev/null 2>&1 && [ "${CHEMLAB_NO_OPEN:-0}" != "1" ]; then
    open "$url" >/dev/null 2>&1 || true
  fi
}

ensure_build
start_server
start_tunnel
