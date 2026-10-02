#!/usr/bin/env bash
# Runs before each cloud routine session. Installs deps + Chromium for the QA harness.
set -euo pipefail
cd "$(dirname "$0")/.."
npm ci
npx playwright install --with-deps chromium
