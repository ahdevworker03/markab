#!/bin/sh
set -eu

mode="${1:-}"

case "$mode" in
  empty|representative) ;;
  *)
    printf 'Usage: rehearse-migrations.sh empty|representative\n' >&2
    exit 64
    ;;
esac

root="$(CDPATH= cd -- "$(dirname "$0")/../../.." && pwd)"
image="markab-migration-rehearsal:${mode}"
network="markab-migration-rehearsal-${mode}-$$"
database="markab_migration_rehearsal"
container="${network}-db"
temp_dir=""

cleanup() {
  docker rm --force "$container" >/dev/null 2>&1 || true
  docker network rm "$network" >/dev/null 2>&1 || true
  if [ -n "$temp_dir" ]; then
    rm -rf "$temp_dir"
  fi
}

trap cleanup EXIT INT TERM

docker build --target runner --tag "$image" --file "$root/apps/api/Dockerfile" "$root"
docker network create "$network" >/dev/null
docker run --detach --name "$container" --network "$network" --network-alias db \
  --env POSTGRES_USER=rehearsal \
  --env POSTGRES_PASSWORD=rehearsal \
  --env POSTGRES_DB="$database" \
  postgres:16-alpine >/dev/null

until docker exec "$container" pg_isready -U rehearsal -d "$database" >/dev/null 2>&1; do
  sleep 1
done

database_url="postgresql://rehearsal:rehearsal@db:5432/${database}?schema=public"
run_migration() {
  docker run --rm --network "$network" \
    --env DATABASE_URL="$database_url" \
    --env MIGRATION_ENVIRONMENT=staging \
    "$image" ./scripts/migrate.sh "$1"
}

if [ "$mode" = representative ]; then
  temp_dir="$(mktemp -d)"
  mkdir -p "$temp_dir/prisma/migrations"
  chmod 755 "$temp_dir" "$temp_dir/prisma" "$temp_dir/prisma/migrations"
  cp "$root/lib/db/prisma.config.ts" "$temp_dir/prisma.config.ts"
  cp "$root/lib/db/prisma/schema.prisma" "$temp_dir/prisma/schema.prisma"
  cp "$root/lib/db/prisma/migrations/migration_lock.toml" "$temp_dir/prisma/migrations/"

  for migration in "$root"/lib/db/prisma/migrations/[0-9]*; do
    name="$(basename "$migration")"
    [ "$name" \< "20260901120000_replace_task_fixed_recurrence" ] || continue
    cp -R "$migration" "$temp_dir/prisma/migrations/$name"
  done

  docker run --rm --network "$network" \
    --volume "$temp_dir:/rehearsal:ro" \
    --workdir /rehearsal \
    --env DATABASE_URL="$database_url" \
    "$image" /app/lib/db/node_modules/.bin/prisma migrate deploy
  docker exec --interactive "$container" psql -v ON_ERROR_STOP=1 -U rehearsal -d "$database" \
    < "$root/apps/api/scripts/fixtures/task-recurrence-pre-release.sql"
fi

run_migration deploy
run_migration status

docker run --rm --network "$network" \
  --workdir /app/lib/db \
  --env DATABASE_URL="$database_url" \
  "$image" ./node_modules/.bin/prisma migrate diff \
  --from-config-datasource \
  --to-schema=prisma/schema.prisma \
  --exit-code

if [ "$mode" = representative ]; then
  docker exec --interactive "$container" psql -v ON_ERROR_STOP=1 -U rehearsal -d "$database" \
    < "$root/apps/api/scripts/fixtures/task-recurrence-verify.sql"
fi

printf '%s migration rehearsal passed.\n' "$mode"
