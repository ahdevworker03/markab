#!/usr/bin/env bash
set -euo pipefail

release_sha=${1:?release SHA required}
image=${2:?image digest required}
compose_hash=${3:?Compose hash required}
[[ $release_sha =~ ^[0-9a-f]{40}$ ]]
[[ $image =~ ^ghcr\.io/ahdevworker03/markab-api@sha256:[0-9a-f]{64}$ ]]
[[ $compose_hash =~ ^[0-9a-f]{64}$ ]]

cd /opt/markab/production
compose_file=apps/api/docker-compose.production.yml
[[ $(sha256sum "$compose_file" | cut -d ' ' -f 1) == "$compose_hash" ]] || {
  echo 'Production Compose file differs from the approved release; stop before deployment.' >&2
  exit 1
}
[[ -f .env ]] || { echo 'Protected production .env is missing.' >&2; exit 1; }
exec 9>/tmp/markab-production-deploy.lock
flock -n 9 || { echo 'Another production deployment holds the VPS lock.' >&2; exit 1; }

export API_IMAGE=$image RELEASE_ID=$release_sha
compose=(docker compose --env-file .env -f "$compose_file")
"${compose[@]}" config --quiet
[[ $(head -n 1 "$compose_file") == 'name: vehicle-rental-production' ]]
db_id=$("${compose[@]}" ps -q db)
old_id=$("${compose[@]}" ps -q api)
[[ -n $db_id && -n $old_id ]]
[[ $(docker inspect -f '{{.State.Health.Status}}' "$db_id") == healthy ]]
[[ $(docker inspect -f '{{.State.Status}}' "$old_id") == running ]]
old_image=$(docker inspect -f '{{.Config.Image}}' "$old_id")
old_release=$(docker inspect -f '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$old_id")
[[ $old_image =~ ^ghcr\.io/ahdevworker03/markab-api@sha256:[0-9a-f]{64}$ ]]
[[ $old_release =~ ^[0-9a-f]{40}$ ]]

"${compose[@]}" pull api migrate backup >/dev/null
[[ $(docker image inspect -f '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$image") == "$release_sha" ]]
echo "event=preflight.succeeded release=$release_sha image=$image previous_release=$old_release"

stopped=0
migration_started=0
on_exit() {
  status=$?
  if (( status != 0 )); then
    if (( stopped == 1 && migration_started == 0 )); then
      if [[ $(docker inspect -f '{{.State.Status}}' "$old_id") == exited ]]; then
        if docker start "$old_id" >/dev/null; then
          for attempt in {1..10}; do
            if [[ $(docker inspect -f '{{.State.Health.Status}}' "$old_id") == healthy ]]; then
              echo "event=previous_api.restarted release=$old_release"
              break
            fi
            sleep 2
          done
          if [[ $(docker inspect -f '{{.State.Health.Status}}' "$old_id") != healthy ]]; then
            echo 'Previous API restarted but is not healthy; operator intervention required.' >&2
          fi
        else
          echo 'Previous API restart failed; operator intervention required.' >&2
        fi
      fi
    fi
    if (( migration_started == 1 )); then
      echo 'Migration may have changed the schema. Keep the old API stopped; follow the Step 65 migration/recovery runbook. Fix forward unless an operator explicitly approves backup restore and possible write loss.' >&2
    fi
    echo "event=deployment.failed release=$release_sha status=$status" >&2
  fi
}
trap on_exit EXIT

stopped=1
"${compose[@]}" stop -t 30 api >/dev/null
[[ $(docker inspect -f '{{.State.Status}}' "$old_id") == exited ]]
echo "event=old_api.stopped release=$old_release"

backup_output=$("${compose[@]}" --profile backup run --rm --no-deps backup)
backup_line=$(printf '%s\n' "$backup_output" | grep -E "^event=backup\.succeeded environment=production release=$release_sha key=backups/production/.*\.dump$")
[[ -n $backup_line ]]
echo "$backup_line"

migration_started=1
"${compose[@]}" run --rm --no-deps migrate deploy
echo "event=migration.deploy.succeeded release=$release_sha"
"${compose[@]}" run --rm --no-deps migrate status
echo "event=migration.status.clean release=$release_sha"

"${compose[@]}" up -d --no-deps --force-recreate api >/dev/null
api_id=$("${compose[@]}" ps -q api)
[[ -n $api_id && $api_id != "$old_id" ]]
[[ $(docker inspect -f '{{.Config.Image}}' "$api_id") == "$image" ]]
[[ $(docker inspect -f '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$api_id") == "$release_sha" ]]
for attempt in {1..30}; do
  if [[ $(docker inspect -f '{{.State.Health.Status}}' "$api_id") == healthy ]] &&
    curl --fail --silent --show-error --max-time 5 https://api.markab-lb.com/api/readyz >/dev/null; then
    echo "event=api.ready release=$release_sha image=$image"
    exit 0
  fi
  sleep 2
done
echo 'New API readiness failed; frontend deployment remains blocked.' >&2
exit 1
