#!/bin/sh
set -eu

environment="unknown"
release="unreleased"
dump=""

cleanup() {
  status=$?
  [ -z "$dump" ] || rm -f "$dump"
  if [ "$status" -ne 0 ]; then
    printf 'event=restore.failed environment=%s release=%s status=%s\n' "$environment" "$release" "$status" >&2
  fi
}

trap cleanup EXIT INT TERM

fail() {
  printf '%s\n' "$1" >&2
  exit 64
}

require() {
  eval "value=\${$1:-}"
  [ -n "$value" ] || fail "$1 is required."
}

case "${RESTORE_ENVIRONMENT:-}" in
  staging|production) environment="$RESTORE_ENVIRONMENT" ;;
  *) fail "RESTORE_ENVIRONMENT must be staging or production." ;;
esac

for variable in POSTGRES_DB RESTORE_DATABASE RESTORE_DATABASE_URL RESTORE_ADMIN_DATABASE_URL; do
  require "$variable"
done

case "$RESTORE_DATABASE" in
  markab_restore_[A-Za-z0-9_]*) ;;
  *) fail "RESTORE_DATABASE must use the markab_restore_ prefix." ;;
esac

[ "$RESTORE_DATABASE" != "$POSTGRES_DB" ] || fail "RESTORE_DATABASE must not be the live database."

restore_database="${RESTORE_DATABASE_URL##*/}"
restore_database="${restore_database%%\?*}"
[ "$restore_database" = "$RESTORE_DATABASE" ] || fail "RESTORE_DATABASE_URL must target RESTORE_DATABASE."
postgres_restore_url="${RESTORE_DATABASE_URL%%\?*}"
postgres_admin_url="${RESTORE_ADMIN_DATABASE_URL%%\?*}"

case "$RESTORE_DATABASE_URL" in
  *localhost*|*127.0.0.1*|*0.0.0.0*) fail "RESTORE_DATABASE_URL must target the private Compose database." ;;
esac

source_file="${RESTORE_SOURCE_FILE:-}"
backup_key="${1:-}"

if [ -z "$source_file" ]; then
  for variable in BACKUP_R2_BUCKET BACKUP_R2_PREFIX BACKUP_R2_ENDPOINT BACKUP_R2_ACCESS_KEY_ID BACKUP_R2_SECRET_ACCESS_KEY; do
    require "$variable"
  done

  expected_prefix="backups/$RESTORE_ENVIRONMENT"
  [ "$BACKUP_R2_PREFIX" = "$expected_prefix" ] || fail "BACKUP_R2_PREFIX must be $expected_prefix."
  case "$backup_key" in
    "$BACKUP_R2_PREFIX"/*.dump) ;;
    *) fail "Backup object must be inside $BACKUP_R2_PREFIX." ;;
  esac
else
  [ -f "$source_file" ] || fail "RESTORE_SOURCE_FILE does not exist."
fi

psql_bin="${PSQL_BIN:-psql}"
pg_restore_bin="${PG_RESTORE_BIN:-pg_restore}"
aws_bin="${AWS_BIN:-aws}"
release="${RELEASE_ID:-unreleased}"
case "$release" in
  *[!A-Za-z0-9._-]*) release="unreleased" ;;
esac
dump="$(mktemp /tmp/markab-restore.XXXXXX)"

if [ -z "$source_file" ]; then
  run_aws() {
    AWS_ACCESS_KEY_ID="$BACKUP_R2_ACCESS_KEY_ID" \
    AWS_SECRET_ACCESS_KEY="$BACKUP_R2_SECRET_ACCESS_KEY" \
    AWS_EC2_METADATA_DISABLED=true \
      "$aws_bin" "$@"
  }
  run_aws s3 cp --no-progress "s3://$BACKUP_R2_BUCKET/$backup_key" "$dump" \
    --endpoint-url "$BACKUP_R2_ENDPOINT"
else
  cp "$source_file" "$dump"
fi

existing_database="$("$psql_bin" "$postgres_admin_url" -tAc "SELECT 1 FROM pg_database WHERE datname = '$RESTORE_DATABASE'")"
[ -z "$existing_database" ] || fail "RESTORE_DATABASE already exists. Refusing to overwrite it."

"$psql_bin" "$postgres_admin_url" -v ON_ERROR_STOP=1 \
  -c "CREATE DATABASE \"$RESTORE_DATABASE\""
"$pg_restore_bin" --exit-on-error --no-owner --no-privileges \
  --dbname="$postgres_restore_url" "$dump"

root="$(CDPATH= cd -- "$(dirname "$0")/../../.." && pwd)"
prisma="$root/lib/db/node_modules/.bin/prisma"
[ -x "$prisma" ] || fail "Prisma migration runtime is unavailable in this image."

cd "$root/lib/db"
DATABASE_URL="$RESTORE_DATABASE_URL" "$prisma" migrate status --schema prisma/schema.prisma
DATABASE_URL="$RESTORE_DATABASE_URL" "$prisma" migrate diff \
  --from-config-datasource \
  --to-schema=prisma/schema.prisma \
  --exit-code

printf 'event=restore.succeeded environment=%s release=%s database=%s\n' "$environment" "$release" "$RESTORE_DATABASE"
