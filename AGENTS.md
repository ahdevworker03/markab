# Start Here

This is the default entry point for every task.

Read this first, then load only the rule files and project sources relevant to the task.

---

## How to Use

1. Read `docs/rules/project.md` first.
2. Identify the task type.
3. Read only the rule files listed for that task.
4. Follow references only when directly relevant.
5. Load authoritative product, architecture, milestone, or testing documents when the task depends on them.
6. Before any task modifies repository files, read `docs/rules/git.md`.
7. Before committing, pushing, merging, deleting a branch, tagging, or deploying, re-read `docs/rules/git.md` and follow its approval and promotion workflow exactly.
8. If sources conflict, apply the source-of-truth and priority rules below instead of guessing.

---

## Task Routing

| Task Type                               | Files to Read (in Order)                                                                                                                                                                                                                                                                                                                                                                               |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Bug Fix**                             | `docs/rules/project.md` → `docs/rules/core-behavior.md` → `docs/rules/development-workflow.md` → `docs/rules/safety.md` → `docs/rules/coding-standards.md` → `docs/rules/typeScript-rules.md` _(if TypeScript is involved)_ → `docs/rules/testing.md`                                                                                                                                                  |
| **New Feature**                         | `docs/rules/project.md` → `docs/rules/core-behavior.md` → `docs/rules/development-workflow.md` → `docs/rules/design-decisions.md` → `docs/rules/safety.md` → `docs/rules/coding-standards.md` → `docs/rules/typeScript-rules.md` _(if TypeScript is involved)_ → `docs/rules/testing.md` → `docs/rules/documentation.md` _(if repository truth changes)_ → `docs/rules/ui-ux.md` _(if UI is involved)_ |
| **Refactoring**                         | `docs/rules/project.md` → `docs/rules/core-behavior.md` → `docs/rules/development-workflow.md` → `docs/rules/design-decisions.md` → `docs/rules/safety.md` → `docs/rules/coding-standards.md` → `docs/rules/typeScript-rules.md` _(if TypeScript is involved)_ → `docs/rules/testing.md`                                                                                                               |
| **Documentation**                       | `docs/rules/project.md` → `docs/rules/core-behavior.md` → `docs/rules/documentation.md` → `docs/rules/development-workflow.md`                                                                                                                                                                                                                                                                         |
| **Testing**                             | `docs/rules/project.md` → `docs/rules/core-behavior.md` → `docs/rules/testing.md` → `docs/rules/safety.md`                                                                                                                                                                                                                                                                                             |
| **UI / UX Work**                        | `docs/rules/project.md` → `docs/rules/core-behavior.md` → `docs/rules/development-workflow.md` → `docs/rules/ui-ux.md` → `docs/rules/design-decisions.md` → `docs/rules/safety.md` → `docs/rules/typeScript-rules.md` _(if TypeScript is involved)_ → `docs/rules/testing.md`                                                                                                                          |
| **Repository Cleanup**                  | `docs/rules/project.md` → `docs/rules/core-behavior.md` → `docs/rules/development-workflow.md` → `docs/rules/safety.md` → `docs/rules/coding-standards.md`                                                                                                                                                                                                                                             |
| **Monorepo / Package Changes**          | `docs/rules/project.md` → `docs/rules/core-behavior.md` → `docs/rules/development-workflow.md` → `docs/rules/monorepo.md` → `docs/rules/safety.md`                                                                                                                                                                                                                                                     |
| **API Contract Changes**                | `docs/rules/project.md` → `docs/rules/core-behavior.md` → `docs/rules/development-workflow.md` → `docs/rules/api-contracts.md` → `docs/rules/design-decisions.md` → `docs/rules/safety.md`                                                                                                                                                                                                             |
| **Generated Code Changes**              | `docs/rules/project.md` → `docs/rules/core-behavior.md` → `docs/rules/development-workflow.md` → `docs/rules/api-contracts.md` → `docs/rules/safety.md`                                                                                                                                                                                                                                                |
| **Backend Work**                        | `docs/rules/project.md` → `docs/rules/core-behavior.md` → `docs/rules/development-workflow.md` → `docs/rules/backend.md` → `docs/rules/design-decisions.md` → `docs/rules/safety.md` → `docs/rules/typeScript-rules.md` → `docs/rules/testing.md`                                                                                                                                                      |
| **Database / Schema Changes**           | `docs/rules/project.md` → `docs/rules/core-behavior.md` → `docs/rules/development-workflow.md` → `docs/rules/database.md` → `docs/rules/safety.md` → `docs/rules/design-decisions.md` → `docs/rules/api-contracts.md` _(if API/generated artifacts are affected)_ → `docs/rules/testing.md`                                                                                                            |
| **Authentication / Authorization Work** | `docs/rules/project.md` → `docs/rules/core-behavior.md` → `docs/rules/development-workflow.md` → `docs/rules/authentication.md` → `docs/rules/safety.md` → `docs/rules/design-decisions.md` → `docs/rules/typeScript-rules.md` → `docs/rules/testing.md`                                                                                                                                               |
| **Deployment / Infrastructure**         | `docs/rules/project.md` → `docs/rules/core-behavior.md` → `docs/rules/development-workflow.md` → `docs/rules/safety.md` → relevant architecture/deployment documentation → `docs/rules/testing.md` _(when verification is affected)_                                                                                                                                                                   |

---

## Rule Priority

When guidance conflicts, follow this order:

1. Explicit user instructions.
2. Current authoritative product, architecture, milestone, and testing documentation.
3. `docs/rules/project.md` and relevant task-specific rule files.
4. Current implementation and repository contracts.
5. Existing repository patterns and conventions.
6. AI assumptions.

Later approved decisions supersede older plans, deprecated guidance, and legacy patterns.

Never let assumptions or legacy patterns override current authoritative decisions.

---

## Repository Truth

Use the appropriate source of truth for the question being answered:

- Current implemented behavior and technical state → inspect the code, schema, migrations, API contract, and tests.
- Product behavior and business requirements → `docs/product/`.
- Architecture and deployment decisions → `docs/architecture/`.
- Current implementation scope and sequencing → active `docs/development-milestones/`.
- Testing strategy and required verification → `docs/testing/`.

If authoritative documentation and current implementation conflict:

1. Report the conflict and its impact.
2. Determine whether the implementation is outdated, the documentation is stale, or the current task intentionally changes the behavior.
3. Do not silently reconcile the conflict.
4. Follow the latest clearly applicable approved decision; if the intended direction remains ambiguous and materially affects the task, stop and ask.

---

## Loading Principle

- Do not load every rule file by default.
- Load only the rules and project sources required for the current task.
- Keep context focused by avoiding unrelated documents.
- Follow references only when directly relevant.
- Do not infer requirements from files that are outside the active task scope.
