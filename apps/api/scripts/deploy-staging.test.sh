#!/bin/sh
set -eu

root="$(CDPATH= cd -- "$(dirname "$0")/../../.." && pwd)"
script="$root/apps/api/scripts/deploy-staging.sh"
runbook="$root/docs/operations/step-65-staging-deployment-runbook.md"

bash -n "$script"

grep -Fq 'root=/opt/markab/staging' "$script"
grep -Fq 'docker-compose.staging.yml' "$script"
grep -Fq 'vehicle-rental-staging' "$script"
grep -Fq 'https://staging-api.markab-lb.com' "$script"
grep -Fq 'markab-api-candidate@sha256' "$script"
! grep -Eq '/opt/markab/production|docker-compose\.production\.yml|https://api\.markab-lb\.com|markab-api@sha256' "$script"
! grep -Eq 'migrate (dev|reset)|db push|migrate resolve|docker compose .*down|docker system prune' "$script"

line_of() {
  grep -n -m 1 -F "$1" "$script" | cut -d: -f1
}

preflight=$(line_of 'event=preflight.succeeded')
stopped=$(line_of 'stopped=1')
stop=$(line_of 'old_api.stopped')
image=$(line_of 'docker pull "$image"')
backup=$(line_of 'backup_output=')
deploy=$(line_of 'migrate deploy')
status=$(line_of 'migrate status')
start=$(line_of 'up -d --no-deps --force-recreate api')
smoke=$(line_of 'event=smoke.succeeded')
restart=$(line_of 'event=previous_api.restarted')
migration_started=$(line_of 'migration_started=1')
[ "$preflight" -lt "$backup" ]
[ "$preflight" -lt "$stopped" ]
[ "$stopped" -lt "$stop" ]
[ "$stop" -lt "$image" ]
[ "$image" -lt "$backup" ]
[ "$backup" -lt "$deploy" ]
[ "$deploy" -lt "$status" ]
[ "$status" -lt "$start" ]
[ "$start" -lt "$smoke" ]
[ "$restart" -lt "$migration_started" ]
grep -Fq 'migration_started == 0' "$script"

grep -Fq 'vehicle-rental-staging' "$runbook"
grep -Fq 'VITE_API_URL=https://staging-api.markab-lb.com' "$runbook"
grep -Fq -- '--project-name=vehicle-rental-staging' "$runbook"
grep -Fq -- '--commit-hash="$release_sha"' "$runbook"
grep -Fq 'pnpm dlx wrangler@4.150.0 pages deploy' "$runbook"
! grep -Fq 'wrangler@4 pages deploy' "$runbook"
grep -Fq 'stays Git-integrated' "$runbook"
grep -Fq 'Do not delete, recreate,' "$runbook"
grep -Fq 'or convert the Pages project.' "$runbook"
grep -Fq 'event=api.ready' "$runbook"
grep -Fq 'https://staging.markab-lb.com/platform' "$runbook"
grep -Fq 'https://staging-api.markab-lb.com' "$runbook"
! grep -Fq 'vehicle-rental-production' "$runbook"
runbook_api_ready=$(grep -n -m 1 -F 'event=api.ready' "$runbook" | cut -d: -f1)
frontend_upload=$(grep -n -m 1 -F 'pnpm dlx wrangler@4.150.0 pages deploy' "$runbook" | cut -d: -f1)
[ "$runbook_api_ready" -lt "$frontend_upload" ]

if "$script" not-a-sha ghcr.io/ahdevworker03/markab-api-candidate@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa >/dev/null 2>&1; then
  echo 'invalid release SHA unexpectedly passed' >&2
  exit 1
fi
if DEPLOY_OPERATOR='' "$script" aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa ghcr.io/ahdevworker03/markab-api-candidate@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa >/dev/null 2>&1; then
  echo 'missing operator unexpectedly passed' >&2
  exit 1
fi

printf 'staging deployment script static checks passed.\n'
