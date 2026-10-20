#!/bin/sh
set -eu

root="$(CDPATH= cd -- "$(dirname "$0")/../../.." && pwd)"
workflow="$root/.github/workflows/deploy-staging-pages.yml"

test -f "$workflow"
grep -Fq "github.ref == 'refs/heads/staging'" "$workflow"
grep -Fq 'environment: staging' "$workflow"
grep -Fq 'git merge-base --is-ancestor "$RELEASE_SHA" origin/staging' "$workflow"
grep -Fq 'ref: ${{ inputs.release_sha }}' "$workflow"
grep -Fq 'CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}' "$workflow"
grep -Fq 'CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}' "$workflow"
grep -Fq 'markab-staging' "$workflow"
grep -Fq 'production_branch == "staging"' "$workflow"
grep -Fq 'production_deployments_enabled == false' "$workflow"
grep -Fq 'preview_deployment_setting == "none"' "$workflow"
grep -Fq 'VITE_API_URL: ${{ env.STAGING_API_URL }}' "$workflow"
grep -Fq "'https://api.markab-lb.com'" "$workflow"
grep -Fq 'printf '\''{"release_id":"%s"}\n'\'' "$RELEASE_SHA"' "$workflow"
grep -Fq 'wrangler@4.150.0 pages deploy' "$workflow"
grep -Fq -- '--project-name="$STAGING_PAGES_PROJECT" --branch=staging' "$workflow"
grep -Fq -- '--commit-hash="$RELEASE_SHA"' "$workflow"
! grep -Eq 'markab-production|PROD_SSH|ssh |docker compose|deploy-staging\.sh' "$workflow"

printf 'staging Pages workflow static checks passed.\n'
