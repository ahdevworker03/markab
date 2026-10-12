# Project

Markab (مَركب) is an Arabic-first, multi-tenant SaaS platform for vehicle-rental businesses. The repository contains the web application, backend API, shared contract and database packages, tests, and project documentation.

The product serves day-to-day rental operations, including fleet, customer, rental, payment, maintenance, task, analytics, and reporting workflows. See `docs/product/01-product-vision.md` for product direction and `README.md` for the current technology stack and basic development commands.

## Product Vision

Build a reliable, production-ready SaaS platform for vehicle-rental businesses, with workflows designed for mobile use, Arabic-first content and right-to-left layouts, multiple isolated tenants, and support for essential offline work.

Keep product decisions focused on rental-business needs. See the product documentation for target customers, product principles, and longer-term direction.

## Current Stage

This repository contains an implemented web application and API, shared workspace packages, automated tests, and operational documentation. Development continues incrementally; verify the current implementation before treating planning documents as evidence that a feature is complete or deployed.

Deployment state is environment-specific and cannot be inferred from the repository contents alone.

## Repository Architecture

The repository is a pnpm monorepo with two applications and shared libraries:

- `apps/web` — React and TypeScript web application.
- `apps/api` — Node.js and Express API.
- `lib/api-spec` — OpenAPI contract source and client generation configuration.
- `lib/api-client-react` and `lib/api-zod` — generated API client and validation schemas.
- `lib/db` — Prisma schema, migrations, and database utilities.

The workspace is defined by `pnpm-workspace.yaml`. Follow `monorepo.md` for package boundaries and ownership, and `api-contracts.md` for API and generated-code workflows.

## Repository Structure

```text
apps/
  api/
  web/

lib/
  api-spec/
  api-client-react/
  api-zod/
  db/

docs/
  architecture/
  development-milestones/
  operations/
  planning/
  product/
  rules/
  superpowers/
  testing/

assets/
.agents/skills/
.codex/config.toml
```

Root package and TypeScript configuration files define shared workspace tooling. Build output and installed dependencies are not source directories.

## Source of Truth

Use each source for the responsibility it owns:

| Area | Source of truth |
| --- | --- |
| Current application behavior | Implemented application and API code |
| Product direction and requirements | `docs/product/` |
| Architecture and repository workflow | `docs/architecture/` and `docs/rules/` |
| API contract | `lib/api-spec/openapi.yaml` |
| Database schema and migrations | `lib/db/prisma/` |
| Generated API client and validation schemas | Generated from the API contract |
| Shared business logic | The package that owns the relevant domain responsibility |
| Technology-specific agent guidance | `.agents/skills/` |

When documentation conflicts with implemented behavior, treat the implementation as current repository truth, report the inconsistency, and update documentation only when the task calls for it. Do not make generated artifacts a source of truth.

## Development Principles

Development in this repository follows these principles:

- Documentation-first planning with implementation-grounded decisions.
- API-first contract ownership.
- Small incremental changes.
- Clear package ownership and a single source of truth for shared concepts.
- Simplicity, consistency, and long-term maintainability.

## Generated Artifacts

The API client and validation schemas are generated from the OpenAPI contract in `lib/api-spec`. Do not edit generated output manually; update its source and use the documented generation workflow.

Follow `api-contracts.md` before changing API contracts or generated packages.

## Repository Rules

Repository-specific workflows and constraints are defined in `docs/rules/`. They cover architecture, API contracts, generated code, backend and database work, safety, documentation, testing, coding standards, UI/UX, and Git.

Technology-specific implementation guidance belongs in `.agents/skills/`.

## Long-Term Goal

Maintain a predictable, modular, well-documented platform that rental businesses can rely on and that contributors can extend safely.
