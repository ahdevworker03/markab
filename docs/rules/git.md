This document is the single source of truth for repository-specific Git behavior. General Git commands and tooling belong in the `git` skill.

## Branch Model

Persistent branches:

- `main` — production-approved source.
- `staging` — next release candidate deployed to staging.

Temporary branches:

- `feat/<name>` — new functionality.
- `fix/<name>` — bug fixes.
- `perf/<name>` — performance work.
- `chore/<name>` — infrastructure, deployment, tooling, or maintenance.
- `docs/<name>` — documentation-only work.

Do not create permanent `develop`, `production`, `release`, or other environment branches unless this policy is explicitly changed.

`main` is not a fallback development branch. Production rollback uses a previously verified production commit or release tag.

## Working Branches

Normal planned work branches from the latest `staging`.

Production hotfixes branch from the latest `main`.

Before implementation:

1. Inspect Git status and current branch.
2. Confirm the correct base branch.
3. Create a dedicated working branch.
4. Keep the branch limited to one coherent task or milestone step.

Do not mix unrelated work in one branch.

## Promotion Flow

Normal flow:

```text
working branch
→ staging
→ staging deployment
→ staging verification
→ main
→ production deployment
→ production smoke verification
→ optional release tag
```

Add this under `## Promotion Flow`:

### Agent Promotion Workflow

Normal work:

```text
latest staging
→ working branch
→ push working branch
→ merge into staging
→ delete working branch
→ verify staging
→ merge staging into main
→ production only after explicit user approval
```

Required sequence:

1. Create the working branch from the latest `staging`.
2. Complete the task and verification on that branch.
3. Before push, inspect:
   - `git status`
   - `git diff`
   - `git diff --staged`
4. With explicit user approval, commit and push the working branch to GitHub.
5. Before staging promotion, inspect the exact branch delta against `origin/staging`:
   - commits unique to the working branch;
   - changed files;
   - whether `staging` has moved independently.
6. With explicit user approval, merge or replay the working branch onto current `staging`.
7. Push `staging` only with explicit user approval.
8. Confirm the working branch has no unique work remaining in it, then delete the local and remote working branch only with explicit user approval.
9. Before promoting `staging` to `main`, inspect the complete `origin/main...origin/staging` commit and file delta and resolve any branch divergence deliberately.
10. With explicit user approval, merge `staging` into `main` and push `main`.
11. Confirm `main` contains the exact approved staging state. After promotion, `main` and `staging` should normally converge before new release work begins.
12. A merge to `main` does not authorize production deployment. If the change is intended for production, stop and request explicit user approval before deployment.
13. After approved production deployment, perform production smoke verification. Release tags may be created only afterward and only with explicit user approval.

When a working branch is significantly behind `staging`, do not blindly merge stale history. Reconcile it deliberately; for a small isolated change, replaying/cherry-picking the intended commit onto current `staging` may be preferable.

The agent must stop for explicit user approval before each protected action already listed in `Agent Permissions`: commit, push, merge, branch deletion, staging deployment, production deployment, or release tagging.

---

Rules:

- A completed working branch does not merge into `staging` automatically.
- The agent must stop and report when the branch is ready for staging.
- Merge to `staging` requires explicit user approval.
- Staging must be verified against the real affected frontend, API, database, migrations, and supporting services before production promotion.
- Merge `staging` into `main` only after explicit user approval.
- Production must receive the same approved code and migrations verified in staging.
- Production deployment requires explicit user approval.
- After a successful release, `main` and `staging` should normally converge before new release work begins.

## Hotfixes

Production hotfixes start from `main`.

Normal flow:

```text
main
→ fix/<name>
→ verification
→ staging verification where practical
→ main
→ production
→ sync fix back into staging
```

Skipping staging requires explicit user approval.

## Release Tags

Production release tags use:

```text
vMAJOR.MINOR.PATCH
```

- `PATCH` — backward-compatible fixes, security patches, small corrections, or performance fixes.
- `MINOR` — backward-compatible product functionality or meaningful new capabilities.
- `MAJOR` — intentionally incompatible or breaking product/API changes.

Tags are created only:

- from the production-approved commit on `main`,
- after production deployment succeeds,
- after production smoke verification succeeds,
- with explicit user approval.

Do not tag staging builds, working branches, milestone steps, failed releases, or rolled-back releases.

Release tags are immutable.

## Commits

- Follow Conventional Commits.
- Keep commits focused.
- Do not mix unrelated work.
- Do not create `WIP` commits unless explicitly requested.
- A milestone step should normally produce one commit.
- The agent may suggest the commit title and body but must not commit without explicit user approval.

Before every commit, review:

```text
git status
git diff
git diff --staged
```

Verify that only intended files are included and no secrets or unrelated changes are present.

## Agent Permissions

Allowed without additional approval:

- Inspect Git state and history.
- Create an appropriate working branch.
- Modify files on the working branch.
- Run tests, builds, lint, typecheck, and verification.
- Review diffs.
- Recommend commit messages, staging promotion, and release versions.

Requires explicit user approval:

- Stage files for commit.
- Commit.
- Push.
- Merge into `staging`.
- Merge into `main`.
- Delete local or remote branches.
- Create, move, delete, or push release tags.
- Deploy staging.
- Deploy production.

Forbidden unless explicitly approved for an exceptional case:

- Force-push shared branches.
- Rewrite shared history.

When work is complete, the agent must report the branch name, base branch, changes made, verification performed, remaining risks, and whether it is ready for staging promotion.

## Repository Safety

- Never commit secrets, credentials, tokens, private keys, or sensitive environment files.
- Never discard unrelated user changes.
- Never reset, overwrite, or delete uncommitted work without explicit approval.
- Never use destructive Git commands only to make the working tree appear clean.
- Resolve conflicts deliberately.
- Do not move existing production release tags.
- Confirm the current branch before repository-level changes.
