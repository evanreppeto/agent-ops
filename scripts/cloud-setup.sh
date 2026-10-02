#!/usr/bin/env bash
# Cloud environment setup script — paste this into the environment's "Setup script" box.
# It doesn't need the repo (repos may not be cloned yet when it runs): it only installs
# Chromium and its system libraries. Keep the version in step with @playwright/test in package-lock.json.
set -euo pipefail
npx -y playwright@1.63.0 install --with-deps chromium
