#!/bin/sh
set -eu

command="${1:-}"

case "$command" in
  deploy|status) ;;
  *)
    printf 'Usage: migrate.sh deploy|status\n' >&2
    exit 64
    ;;
esac

case "${MIGRATION_ENVIRONMENT:-}" in
  staging|production) ;;
  *)
    printf 'MIGRATION_ENVIRONMENT must be staging or production.\n' >&2
    exit 64
    ;;
esac

if [ -z "${DATABASE_URL:-}" ]; then
  printf 'DATABASE_URL is required.\n' >&2
  exit 64
fi

case "$DATABASE_URL" in
  *localhost*|*127.0.0.1*|*0.0.0.0*|*test*)
    printf 'DATABASE_URL must not target a local or test database.\n' >&2
    exit 64
    ;;
esac

if [ "$MIGRATION_ENVIRONMENT" = production ] && [ -z "${RELEASE_ID:-}" ]; then
  printf 'RELEASE_ID is required for production migrations.\n' >&2
  exit 64
fi

root="$(CDPATH= cd -- "$(dirname "$0")/../../.." && pwd)"
prisma="$root/lib/db/node_modules/.bin/prisma"

if [ ! -x "$prisma" ]; then
  printf 'Prisma migration runtime is unavailable in this image.\n' >&2
  exit 70
fi

cd "$root/lib/db"
exec "$prisma" migrate "$command" --schema prisma/schema.prisma
