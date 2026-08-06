# TypeScript Rules

These rules define how TypeScript is used in this repository. Language best practices belong in the TypeScript skill.

## Repository Rules

- TypeScript strict mode is required.
- Avoid `any` unless explicitly justified.
- Use `import type` and `export type` where appropriate.
- Follow the repository's existing naming and module conventions.
- Keep types close to the code that owns them.
- Shared types should have a single source of truth.
- Do not duplicate API or database types manually.
- Generated types must not be edited directly.
- Prefer consistency with existing repository patterns over introducing new typing styles.
