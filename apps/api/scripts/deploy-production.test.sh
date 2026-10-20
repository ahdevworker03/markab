#!/bin/sh
set -eu

root="$(CDPATH= cd -- "$(dirname "$0")/../../.." && pwd)"
script="$root/apps/api/scripts/deploy-production.sh"

bash -n "$script"

line_of() {
  grep -n -m 1 -F "$1" "$script" | cut -d: -f1
}

trap_line=$(line_of 'trap on_exit EXIT')
disable_trap=$(line_of 'trap - EXIT')
preserve_status=$(line_of 'exit "$status"')
backup=$(line_of 'backup_output=')
migrate=$(line_of 'migrate deploy')
ready=$(line_of 'event=api.ready')

test -n "$disable_trap"
test -n "$preserve_status"
[ "$trap_line" -lt "$disable_trap" ]
[ "$disable_trap" -lt "$backup" ]
[ "$backup" -lt "$migrate" ]
[ "$migrate" -lt "$ready" ]
[ "$preserve_status" -lt "$backup" ]

printf 'production deployment script checks passed.\n'
