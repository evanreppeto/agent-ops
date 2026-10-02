#!/usr/bin/env bash
# Make Chromium trust the cloud sandbox's HTTPS proxy, so pages load without disabling TLS checks.
# Chromium on Linux reads trust from the NSS database in ~/.pki/nssdb (not NODE_EXTRA_CA_CERTS),
# so every certificate in the sandbox's CA bundle is imported there. Safe to re-run; no-op off-sandbox.
set -euo pipefail
bundle="${1:-${NODE_EXTRA_CA_CERTS:-/root/.ccr/ca-bundle.crt}}"
if [ ! -f "$bundle" ]; then
  echo "No CA bundle at $bundle — nothing to trust."
  exit 0
fi
if ! command -v certutil >/dev/null; then
  if [ "$(id -u)" = 0 ]; then
    apt-get install -y --no-install-recommends libnss3-tools >/dev/null 2>&1 \
      || (apt-get update >/dev/null 2>&1 && apt-get install -y --no-install-recommends libnss3-tools >/dev/null)
  else
    echo "certutil is missing and this isn't root — install libnss3-tools." >&2
    exit 1
  fi
fi
db="$HOME/.pki/nssdb"
mkdir -p "$db"
[ -f "$db/cert9.db" ] || certutil -d "sql:$db" -N --empty-password
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
awk -v dir="$tmp" '/-----BEGIN CERTIFICATE-----/ { n++; f = dir "/c" n ".pem" } f { print > f } /-----END CERTIFICATE-----/ { close(f); f = "" }' "$bundle"
count=0
for pem in "$tmp"/c*.pem; do
  [ -e "$pem" ] || continue
  count=$((count + 1))
  certutil -d "sql:$db" -A -t "C,," -n "sandbox-ca-$count" -i "$pem"
done
echo "Chromium now trusts $count certificate(s) from $bundle."
