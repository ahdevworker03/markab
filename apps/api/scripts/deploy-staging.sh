#!/usr/bin/env bash
set -euo pipefail

release_sha=${1:?release SHA required}
image=${2:?candidate image digest required}
operator=${DEPLOY_OPERATOR:?DEPLOY_OPERATOR is required}

[[ $release_sha =~ ^[0-9a-f]{40}$ ]]
[[ $image =~ ^ghcr\.io/ahdevworker03/markab-api-candidate@sha256:[0-9a-f]{64}$ ]]
[[ $operator =~ ^[A-Za-z0-9._@-]+$ ]]

root=/opt/markab/staging
compose_file=apps/api/docker-compose.staging.yml
config_file=.env.staging
backup_file=secrets/backup.env
release_file=secrets/release.env
staging_origin=https://staging-api.markab-lb.com

cd "$root"
[[ $(pwd -P) == "$root" ]]
[[ $(git rev-parse HEAD) == "$release_sha" ]]
git diff --quiet
git diff --cached --quiet
[[ -f $compose_file && -f $config_file && -f $backup_file && -f $release_file ]]
[[ $(head -n 1 "$compose_file") == 'name: vehicle-rental-staging' ]]
! grep -Eq 'https://api\.markab-lb\.com|backups/production|/opt/markab/production' \
  "$config_file" "$backup_file" "$release_file"
grep -Eq 'https://staging\.markab-lb\.com' "$config_file" "$release_file"
command -v curl >/dev/null

export API_IMAGE=$image RELEASE_ID=$release_sha
compose=(docker compose --env-file "$config_file" --env-file "$backup_file" --env-file "$release_file" -f "$compose_file")
"${compose[@]}" config --quiet

exec 9>/tmp/markab-staging-deploy.lock
flock -n 9 || { echo 'Another staging deployment holds the VPS lock.' >&2; exit 1; }

db_id=$("${compose[@]}" ps -q db)
[[ -n $db_id ]]
[[ $(docker inspect -f '{{index .Config.Labels "com.docker.compose.project"}}' "$db_id") == vehicle-rental-staging ]]
[[ $(docker inspect -f '{{.State.Health.Status}}' "$db_id") == healthy ]]

old_id=$("${compose[@]}" ps -q api)
if [[ -n $old_id ]]; then
  [[ $(docker inspect -f '{{index .Config.Labels "com.docker.compose.project"}}' "$old_id") == vehicle-rental-staging ]]
  [[ $(docker inspect -f '{{.State.Status}}' "$old_id") == running ]]
  old_release=$(docker inspect -f '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$old_id")
  [[ $old_release =~ ^[0-9a-f]{40}$ ]]
else
  old_release=none
fi

echo "event=preflight.succeeded environment=staging operator=$operator release=$release_sha image=$image previous_release=$old_release"

stopped=0
migration_started=0
new_api_started=0
on_exit() {
  status=$?
  trap - EXIT
  if (( status != 0 )); then
    if (( migration_started == 0 && stopped == 1 && ${#old_id} > 0 )); then
      if [[ $(docker inspect -f '{{.State.Status}}' "$old_id") == exited ]]; then
        if docker start "$old_id" >/dev/null; then
          for attempt in {1..10}; do
            [[ $(docker inspect -f '{{.State.Health.Status}}' "$old_id") == healthy ]] && break
            sleep 2
          done
          echo "event=previous_api.restarted environment=staging release=$old_release"
        else
          echo 'Previous staging API restart failed; operator intervention required.' >&2
        fi
      fi
    fi
    if (( migration_started == 1 )); then
      if (( new_api_started == 1 )); then
        "${compose[@]}" stop -t 30 api >/dev/null 2>&1 || true
      fi
      echo 'Migration may have changed the schema. Keep the old API stopped; fix forward or follow the approved isolated restore procedure.' >&2
    fi
    echo "event=deployment.failed environment=staging operator=$operator release=$release_sha status=$status" >&2
  fi
  exit "$status"
}
trap on_exit EXIT

if [[ -n $old_id ]]; then
  stopped=1
  "${compose[@]}" stop -t 30 api >/dev/null
  [[ $(docker inspect -f '{{.State.Status}}' "$old_id") == exited ]]
  echo "event=old_api.stopped environment=staging release=$old_release"
else
  echo 'event=old_api.absent environment=staging'
fi

docker pull "$image" >/dev/null
[[ $(docker image inspect -f '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$image") == "$release_sha" ]]
echo "event=image.verified environment=staging release=$release_sha image=$image"

backup_output=$("${compose[@]}" --profile backup run --rm --no-deps backup)
backup_line=$(printf '%s\n' "$backup_output" | grep -E "^event=backup\.succeeded environment=staging release=$release_sha key=backups/staging/.*\.dump$")
[[ -n $backup_line ]]
echo "$backup_line"

migration_started=1
"${compose[@]}" --profile migration run --rm --no-deps migrate deploy
echo "event=migration.deploy.succeeded environment=staging release=$release_sha"
"${compose[@]}" --profile migration run --rm --no-deps migrate status
echo "event=migration.status.clean environment=staging release=$release_sha"

"${compose[@]}" up -d --no-deps --force-recreate api >/dev/null
new_api_started=1
api_id=$("${compose[@]}" ps -q api)
[[ -n $api_id ]]
[[ $(docker inspect -f '{{.Config.Image}}' "$api_id") == "$image" ]]
[[ $(docker inspect -f '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$api_id") == "$release_sha" ]]
for attempt in {1..30}; do
  if [[ $(docker inspect -f '{{.State.Health.Status}}' "$api_id") == healthy ]] &&
    curl --fail --silent --show-error --max-time 5 "$staging_origin/api/healthz" >/dev/null &&
    curl --fail --silent --show-error --max-time 5 "$staging_origin/api/readyz" >/dev/null; then
    echo "event=api.ready environment=staging release=$release_sha image=$image"
    echo "event=smoke.succeeded environment=staging operator=$operator release=$release_sha"
    exit 0
  fi
  sleep 2
done

echo 'New staging API readiness or smoke check failed.' >&2
exit 1
