#!/bin/sh
set -eu

root="$(CDPATH= cd -- "$(dirname "$0")/../../.." && pwd)"
script="$root/apps/api/scripts/deploy-production.sh"
workflow="$root/.github/workflows/deploy-production.yml"
release_sha=0123456789abcdef0123456789abcdef01234567
image="ghcr.io/ahdevworker03/markab-api@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT HUP INT TERM

mkdir -p "$tmp/bin" "$tmp/production/apps/api"
printf 'name: vehicle-rental-production\n' > "$tmp/production/apps/api/docker-compose.production.yml"
: > "$tmp/production/.env"
compose_hash=$(sha256sum "$tmp/production/apps/api/docker-compose.production.yml" | cut -d ' ' -f1)

cat > "$tmp/bin/docker" <<'EOF'
#!/bin/sh
set -eu

state=${FAKE_DOCKER_STATE:?}
command=${1:?}
shift

case "$command $*" in
  "compose "*" config --quiet") exit 0 ;;
  "compose "*" ps -q db") printf 'db-id\n' ;;
  "compose "*" ps -q api")
    if [ -f "$state/new-api" ]; then printf 'new-api-id\n'; else printf 'old-api-id\n'; fi
    ;;
  "compose "*" pull api migrate backup") exit 0 ;;
  "compose "*" stop -t 30 api") : > "$state/old-stopped" ;;
  "compose "*" --profile backup run --rm --no-deps backup")
    [ "${SCENARIO:?}" != backup-failure ] || exit 1
    [ "$SCENARIO" != backup-evidence-missing ] || { printf 'backup completed\n'; exit 0; }
    printf 'event=backup.succeeded environment=production release=%s key=backups/production/test.dump\n' "$RELEASE_ID"
    ;;
  "compose "*" run --rm --no-deps migrate deploy") [ "$SCENARIO" != migration-failure ] || exit 1 ;;
  "compose "*" run --rm --no-deps migrate status") exit 0 ;;
  "compose "*" up -d --no-deps --force-recreate api") : > "$state/new-api" ;;
  "image inspect "*) printf '%s\n' "$RELEASE_ID" ;;
  "inspect -f "*)
    format=$2
    id=$3
    case "$format:$id" in
      *State.Health.Status*:*) printf 'healthy\n' ;;
      *State.Status*:old-api-id)
        if [ -f "$state/old-stopped" ]; then printf 'exited\n'; else printf 'running\n'; fi
        ;;
      *State.Status*:new-api-id) printf 'running\n' ;;
      *Config.Image*:old-api-id) printf 'ghcr.io/ahdevworker03/markab-api@sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc\n' ;;
      *Config.Image*:new-api-id) printf '%s\n' "$API_IMAGE" ;;
      *org.opencontainers.image.revision*:old-api-id) printf 'fedcba9876543210fedcba9876543210fedcba98\n' ;;
      *org.opencontainers.image.revision*:new-api-id) printf '%s\n' "$RELEASE_ID" ;;
    esac
    ;;
  "start old-api-id") rm -f "$state/old-stopped" ;;
  *) printf 'unexpected docker command: %s %s\n' "$command" "$*" >&2; exit 2 ;;
esac
EOF
cat > "$tmp/bin/curl" <<'EOF'
#!/bin/sh
[ "${SCENARIO:?}" != readiness-failure ]
EOF
cat > "$tmp/bin/flock" <<'EOF'
#!/bin/sh
exit 0
EOF
cat > "$tmp/bin/sleep" <<'EOF'
#!/bin/sh
exit 0
EOF
chmod +x "$tmp/bin/docker" "$tmp/bin/curl" "$tmp/bin/flock" "$tmp/bin/sleep"

run_case() {
  scenario=$1
  expected_status=$2
  output="$tmp/$scenario.output"
  state="$tmp/$scenario.state"
  mkdir "$state"
  cp "$script" "$tmp/$scenario.sh"
  sed -i "s|cd /opt/markab/production|cd $tmp/production|" "$tmp/$scenario.sh"

  set +e
  PATH="$tmp/bin:$PATH" FAKE_DOCKER_STATE="$state" SCENARIO="$scenario" \
    bash "$tmp/$scenario.sh" "$release_sha" "$image" "$compose_hash" >"$output" 2>&1
  status=$?
  set -e
  [ "$status" -eq "$expected_status" ] || { cat "$output" >&2; exit 1; }
}

run_case backup-failure 1
grep -F 'event=previous_api.restarted' "$tmp/backup-failure.output" >/dev/null

run_case backup-evidence-missing 1
grep -F 'event=previous_api.restarted' "$tmp/backup-evidence-missing.output" >/dev/null

run_case migration-failure 1
grep -F 'Migration may have changed the schema.' "$tmp/migration-failure.output" >/dev/null
! grep -F 'event=previous_api.restarted' "$tmp/migration-failure.output" >/dev/null

run_case readiness-failure 1
grep -F 'New API readiness failed; frontend deployment remains blocked.' "$tmp/readiness-failure.output" >/dev/null
grep -F 'Migration may have changed the schema.' "$tmp/readiness-failure.output" >/dev/null

run_case success 0
grep -F "event=api.ready release=$release_sha image=$image" "$tmp/success.output" >/dev/null

api_deploy_line=$(grep -n -m 1 'id: api_deploy' "$workflow" | cut -d: -f1)
pages_deploy_line=$(grep -n -m 1 'name: Deploy matching frontend to production Pages' "$workflow" | cut -d: -f1)
[ -n "$api_deploy_line" ] && [ -n "$pages_deploy_line" ]
[ "$api_deploy_line" -lt "$pages_deploy_line" ]
in_pages_step=0
pages_has_if=0
while IFS= read -r line; do
  case "$line" in
    '      - name: Deploy matching frontend to production Pages') in_pages_step=1 ;;
    '      - '*) [ "$in_pages_step" -eq 0 ] || break ;;
    '        if:'*) [ "$in_pages_step" -eq 0 ] || pages_has_if=1 ;;
  esac
done < "$workflow"
[ "$pages_has_if" -eq 0 ]

printf 'production deployment regression harness passed.\n'
