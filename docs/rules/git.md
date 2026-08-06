# Git Conventions

These conventions define how version control is used in this repository.

## Commits

- Follow the Conventional Commits specification.
- Keep each commit focused on a single logical change.
- Write commit messages in the imperative mood.
- Avoid mixing unrelated changes in the same commit.
- Do not create temporary or "WIP" commits unless explicitly requested.

## Branches

- Follow the branch naming convention defined in `project.md`.
- Create branches from the latest target branch unless instructed otherwise.
- Keep branch scope limited to a single feature, fix, or task.

## Pull Requests

- Do not open pull requests unless the user requests them.
- When preparing a pull request, include:
  - A clear summary.
  - Testing performed.
  - Breaking changes, if any.
  - Related issues or tasks, when applicable.

## History

- Keep commit history clean and easy to understand.
- Do not rewrite shared history unless explicitly approved.
- Never force-push shared branches.

## Synchronization

- Ensure the working branch is up to date before merging or pushing when appropriate.
- Resolve conflicts deliberately rather than automatically.

## Repository Safety

- Never commit secrets, credentials, API keys, or environment files.
- Verify generated files before committing them.
- Respect the repository's ignore rules.
