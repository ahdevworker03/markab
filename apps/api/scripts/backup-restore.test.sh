#!/bin/sh
set -eu

root="$(CDPATH= cd -- "$(dirname "$0")/../../.." && pwd)"
backup="$root/apps/api/scripts/backup.sh"
restore="$root/apps/api/scripts/restore.sh"

if [ ! -x "$backup" ] || [ ! -x "$restore" ]; then
  printf 'missing executable backup/restore entrypoints\n' >&2
  exit 1
fi

expect_failure() {
  description="$1"
  event="$2"
  shift 2

  if output="$("$@" 2>&1)"; then
    printf 'expected failure: %s\n' "$description" >&2
    exit 1
  fi

  case "$output" in
    *"event=$event"*) ;;
    *)
      printf 'missing backup failure event: %s\n' "$description" >&2
      exit 1
      ;;
  esac
}

expect_failure "missing backup database URL" "backup.failed" \
  env BACKUP_ENVIRONMENT=staging "$backup"
expect_failure "invalid backup environment" "backup.failed" \
  env BACKUP_ENVIRONMENT=development DATABASE_URL=postgresql://postgres@db:5432/staging \
    BACKUP_R2_BUCKET=markab-backups BACKUP_R2_PREFIX=backups/development \
    BACKUP_R2_ENDPOINT=https://account.r2.cloudflarestorage.com \
    BACKUP_R2_ACCESS_KEY_ID=key BACKUP_R2_SECRET_ACCESS_KEY=secret "$backup"
expect_failure "live restore target" "restore.failed" \
  env RESTORE_ENVIRONMENT=production RESTORE_DATABASE=markab_production \
    POSTGRES_DB=markab_production RESTORE_DATABASE_URL=postgresql://postgres@db:5432/markab_production \
    RESTORE_ADMIN_DATABASE_URL=postgresql://postgres@db:5432/postgres \
    BACKUP_R2_BUCKET=markab-production-backups BACKUP_R2_PREFIX=backups/production \
    BACKUP_R2_ENDPOINT=https://account.r2.cloudflarestorage.com \
    BACKUP_R2_ACCESS_KEY_ID=key BACKUP_R2_SECRET_ACCESS_KEY=secret "$restore" backups/production/2026/01/01/example.dump
