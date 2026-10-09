#!/bin/sh
set -eu

script="$(dirname "$0")/migrate.sh"

if [ ! -x "$script" ]; then
  printf 'missing executable migration entrypoint\n' >&2
  exit 1
fi

expect_failure() {
  description="$1"
  shift

  if "$@" >/dev/null 2>&1; then
    printf 'expected failure: %s\n' "$description" >&2
    exit 1
  fi
}

expect_failure "missing DATABASE_URL" \
  env MIGRATION_ENVIRONMENT=staging "$script" deploy
expect_failure "invalid migration environment" \
  env MIGRATION_ENVIRONMENT=development DATABASE_URL=postgresql://postgres@db:5432/staging "$script" deploy
expect_failure "unsafe localhost target" \
  env MIGRATION_ENVIRONMENT=staging DATABASE_URL=postgresql://postgres@localhost:5432/vehicle_rental "$script" deploy
expect_failure "unsafe test target" \
  env MIGRATION_ENVIRONMENT=staging DATABASE_URL=postgresql://postgres@db:5432/markab_test "$script" deploy
expect_failure "missing production release identity" \
  env MIGRATION_ENVIRONMENT=production DATABASE_URL=postgresql://postgres@db:5432/production "$script" deploy
expect_failure "unsupported command" \
  env MIGRATION_ENVIRONMENT=staging DATABASE_URL=postgresql://postgres@db:5432/staging "$script" reset
