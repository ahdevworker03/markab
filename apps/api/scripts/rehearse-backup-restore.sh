#!/bin/sh
set -eu

root="$(CDPATH= cd -- "$(dirname "$0")/../../.." && pwd)"
image="markab-backup-restore-rehearsal"
network="markab-backup-restore-$$"
container="$network-db"
temp_dir="$(mktemp -d)"
source_database="markab_backup_source"
restore_database="markab_restore_drill"
database_url="postgresql://rehearsal:rehearsal@db:5432/$source_database?schema=public"
admin_url="postgresql://rehearsal:rehearsal@db:5432/postgres?schema=public"

cleanup() {
  docker rm --force "$container" >/dev/null 2>&1 || true
  docker network rm "$network" >/dev/null 2>&1 || true
  rm -rf "$temp_dir"
}

trap cleanup EXIT INT TERM

docker build --target runner --tag "$image" --file "$root/apps/api/Dockerfile" "$root"
docker network create "$network" >/dev/null
docker run --detach --name "$container" --network "$network" --network-alias db \
  --env POSTGRES_USER=rehearsal \
  --env POSTGRES_PASSWORD=rehearsal \
  --env POSTGRES_DB="$source_database" \
  postgres:16-alpine >/dev/null

until docker exec "$container" pg_isready -U rehearsal -d "$source_database" >/dev/null 2>&1; do
  sleep 1
done

docker run --rm --network "$network" \
  --env DATABASE_URL="$database_url" \
  --env MIGRATION_ENVIRONMENT=staging \
  "$image" ./scripts/migrate.sh deploy
docker exec --interactive "$container" psql -v ON_ERROR_STOP=1 -U rehearsal -d "$source_database" \
  < "$root/apps/api/scripts/fixtures/backup-restore-source.sql"

cat > "$temp_dir/aws" <<'EOF'
#!/bin/sh
set -eu

case "$1" in
  s3api)
    [ -s "$MOCK_BACKUP_FILE" ] && exit 0
    exit 1
    ;;
  s3)
    shift
    [ "$1" = cp ] || exit 2
    source=""
    target=""
    for argument in "$@"; do
      case "$argument" in
        s3://*) target="$argument" ;;
        /tmp/*) source="$argument" ;;
      esac
    done
    if [ -f "$source" ]; then
      cp "$source" "$MOCK_BACKUP_FILE"
    else
      cp "$MOCK_BACKUP_FILE" "$source"
    fi
    ;;
  *) exit 2 ;;
esac
EOF
chmod 755 "$temp_dir/aws"
chmod 777 "$temp_dir"

docker run --rm --network "$network" --volume "$temp_dir:/mock" \
  --env DATABASE_URL="$database_url" \
  --env POSTGRES_DB="$source_database" \
  --env BACKUP_ENVIRONMENT=staging \
  --env BACKUP_R2_BUCKET=markab-backups-staging \
  --env BACKUP_R2_PREFIX=backups/staging \
  --env BACKUP_R2_ENDPOINT=https://account.r2.cloudflarestorage.com \
  --env BACKUP_R2_ACCESS_KEY_ID=key \
  --env BACKUP_R2_SECRET_ACCESS_KEY=secret \
  --env AWS_BIN=/mock/aws \
  --env MOCK_BACKUP_FILE=/mock/backup.dump \
  "$image" ./scripts/backup.sh

[ -s "$temp_dir/backup.dump" ]
docker exec "$container" psql -v ON_ERROR_STOP=1 -U rehearsal -d postgres \
  -c "DROP DATABASE \"$source_database\""

restore_url="postgresql://rehearsal:rehearsal@db:5432/$restore_database?schema=public"
docker run --rm --network "$network" --volume "$temp_dir:/mock:ro" \
  --env POSTGRES_DB="$source_database" \
  --env RESTORE_ENVIRONMENT=staging \
  --env RESTORE_DATABASE="$restore_database" \
  --env RESTORE_DATABASE_URL="$restore_url" \
  --env RESTORE_ADMIN_DATABASE_URL="$admin_url" \
  --env RESTORE_SOURCE_FILE=/mock/backup.dump \
  "$image" ./scripts/restore.sh
docker exec --interactive "$container" psql -v ON_ERROR_STOP=1 -U rehearsal -d "$restore_database" \
  < "$root/apps/api/scripts/fixtures/backup-restore-verify.sql"

: > "$temp_dir/corrupt.dump"
if docker run --rm --network "$network" --volume "$temp_dir:/mock:ro" \
  --env POSTGRES_DB="$source_database" \
  --env RESTORE_ENVIRONMENT=staging \
  --env RESTORE_DATABASE=markab_restore_corrupt \
  --env RESTORE_DATABASE_URL=postgresql://rehearsal:rehearsal@db:5432/markab_restore_corrupt?schema=public \
  --env RESTORE_ADMIN_DATABASE_URL="$admin_url" \
  --env RESTORE_SOURCE_FILE=/mock/corrupt.dump \
  "$image" ./scripts/restore.sh; then
  printf 'corrupt backup unexpectedly restored\n' >&2
  exit 1
fi

printf 'backup/restore rehearsal passed.\n'
