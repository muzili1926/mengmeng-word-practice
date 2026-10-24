#!/bin/bash
set -e
cd "$(dirname "$0")"
node server.mjs &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null || true' EXIT
for i in {1..40}; do
  if curl -fsS http://127.0.0.1:38917/api/state >/dev/null; then break; fi
  sleep 0.25
done
if [ -d "/Applications/Google Chrome.app" ]; then
  open -na "Google Chrome" --args --app=http://127.0.0.1:38917
else
  open http://127.0.0.1:38917
fi
wait "$SERVER_PID"
