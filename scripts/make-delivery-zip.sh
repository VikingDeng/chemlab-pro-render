#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
npm ci
npm run build
zip -qr ../chemlab_workspace_delivery.zip . \
  -x 'node_modules/*' \
  -x 'release/*' \
  -x '.playwright-cli/*' \
  -x 'output/*' \
  -x '.test-dist/*' \
  -x '.DS_Store'
echo "Wrote ../chemlab_workspace_delivery.zip"
