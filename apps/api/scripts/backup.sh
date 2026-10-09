#!/bin/sh
set -eu

fail() {
  printf '%s\n' "$1" >&2
  exit 64
}

require() {
  eval "value=\${$1:-}"
  [ -n "$value" ] || fail "$1 is required."
}

case "${BACKUP_ENVIRONMENT:-}" in
  staging|production) ;;
  *) fail "BACKUP_ENVIRONMENT must be staging or production." ;;
esac

for variable in DATABASE_URL POSTGRES_DB BACKUP_R2_BUCKET BACKUP_R2_PREFIX BACKUP_R2_ENDPOINT BACKUP_R2_ACCESS_KEY_ID BACKUP_R2_SECRET_ACCESS_KEY; do
  require "$variable"
done

case "$DATABASE_URL" in
  *localhost*|*127.0.0.1*|*0.0.0.0*) fail "DATABASE_URL must target the private Compose database." ;;
esac

database="${DATABASE_URL##*/}"
database="${database%%\?*}"
[ "$database" = "$POSTGRES_DB" ] || fail "DATABASE_URL database must match POSTGRES_DB."
postgres_url="${DATABASE_URL%%\?*}"

expected_prefix="backups/$BACKUP_ENVIRONMENT"
[ "$BACKUP_R2_PREFIX" = "$expected_prefix" ] || fail "BACKUP_R2_PREFIX must be $expected_prefix."

case "$BACKUP_R2_ENDPOINT" in
  https://*.r2.cloudflarestorage.com) ;;
  *) fail "BACKUP_R2_ENDPOINT must be an R2 S3 endpoint." ;;
esac

release="${RELEASE_ID:-unreleased}"
case "$release" in
  *[!A-Za-z0-9._-]*) release="unreleased" ;;
esac

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
year="${timestamp%????????????}"
month="${timestamp#????}"
month="${month%??????????}"
day="${timestamp#??????}"
day="${day%????????}"
key="$BACKUP_R2_PREFIX/$year/$month/$day/$timestamp-$release.dump"
dump="$(mktemp /tmp/markab-backup.XXXXXX)"
pg_dump_bin="${PG_DUMP_BIN:-pg_dump}"
aws_bin="${AWS_BIN:-aws}"

cleanup() {
  rm -f "$dump"
}

trap cleanup EXIT INT TERM

run_aws() {
  AWS_ACCESS_KEY_ID="$BACKUP_R2_ACCESS_KEY_ID" \
  AWS_SECRET_ACCESS_KEY="$BACKUP_R2_SECRET_ACCESS_KEY" \
  AWS_EC2_METADATA_DISABLED=true \
    "$aws_bin" "$@"
}

if run_aws s3api head-object --bucket "$BACKUP_R2_BUCKET" --key "$key" \
  --endpoint-url "$BACKUP_R2_ENDPOINT" >/dev/null 2>&1; then
  fail "Backup object already exists: $key"
fi

"$pg_dump_bin" --format=custom --file "$dump" "$postgres_url"
run_aws s3 cp --no-progress "$dump" "s3://$BACKUP_R2_BUCKET/$key" \
  --endpoint-url "$BACKUP_R2_ENDPOINT" \
  --content-type application/octet-stream \
  --metadata "environment=$BACKUP_ENVIRONMENT,timestamp=$timestamp,database=$POSTGRES_DB,release=$release"
run_aws s3api head-object --bucket "$BACKUP_R2_BUCKET" --key "$key" \
  --endpoint-url "$BACKUP_R2_ENDPOINT" >/dev/null

printf 'backup uploaded: s3://%s/%s\n' "$BACKUP_R2_BUCKET" "$key"
