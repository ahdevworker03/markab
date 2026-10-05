#!/usr/bin/env bash
# Runs the Step 64 staging reconnect benchmark inside the dedicated systemd
# scope that /usr/local/sbin/markab-bench-net blocks. Values of credential
# variables are never printed.
#
#   STAGING_RECONNECT_BENCHMARK=1 STAGING_BENCH_EMAIL=... STAGING_BENCH_PASSWORD=... \
#   STAGING_RELEASE_ID=... [STAGING_RECONNECT_MODE=validation|full] \
#     apps/web/scripts/run-staging-reconnect.sh
set -euo pipefail

readonly WRAPPER=/usr/local/sbin/markab-bench-net

for name in STAGING_RECONNECT_BENCHMARK STAGING_BENCH_EMAIL STAGING_BENCH_PASSWORD STAGING_RELEASE_ID; do
  if [[ -z "${!name:-}" ]]; then
    echo "$name is required." >&2
    exit 1
  fi
done
[[ "$STAGING_RECONNECT_BENCHMARK" == "1" ]] || {
  echo "STAGING_RECONNECT_BENCHMARK=1 is required." >&2
  exit 1
}

cleanup() {
  if ! sudo -n "$WRAPPER" unblock >/dev/null; then
    echo "WARNING: unblock failed; run: sudo $WRAPPER unblock" >&2
  fi
  sudo -n "$WRAPPER" status || true
}

# Fails closed when the wrapper or its sudoers rule is missing.
sudo -n "$WRAPPER" status >/dev/null
trap cleanup EXIT INT TERM

cd "$(dirname "$0")/.."
systemd-run --user --scope --quiet --collect \
  --unit=markab-reconnect-bench \
  -- pnpm exec playwright test --config playwright.staging-reconnect.config.ts
