# Architecture — Car Rental Management System

**Document:** `docs/architecture/architecture.md`
**Based on:** repository state as of July 2026
**Role:** Internal engineering documentation. Describes the actual architecture of the codebase, not a target state.

---

## 1. Repository Overview

This repository contains a **frontend-only validation prototype** for an internal car rental management system. It targets small Lebanese car rental businesses (10–50 vehicles) that currently operate using notebooks, WhatsApp, and memory. It is an Arabic-first, mobile-optimised single-page application backed by in-memory mock data.

The repository is structured as a **pnpm workspace monorepo**. Key motivations:

- The frontend app, API server, and shared libraries must evolve in lockstep. A monorepo ensures a single commit can span changes across multiple packages with consistent versioning.
- Shared TypeScript configuration, ESLint rules, and dependency catalogs are defined once at the root and inherited.
- `tsc --build` (project references) provides incremental type-checking across package boundaries without publishing intermediate artefacts.
- The `lib/api-spec` package acts as a single source of truth for the API contract; Orval code generation reads the OpenAPI spec and produces both client-side React Query hooks (`lib/api-client-react`) and server-side Zod validation schemas (`lib/api-zod`). This codegen workflow is practical only within a monorepo.

The repository is **not** a production system. It is a validation prototype used to test product-market fit. The backend exists as a stub (one health-check endpoint, empty database schema), and the frontend reads and writes directly to static in-memory TypeScript arrays.

---

## 2. Repository Structure

```
.
├── artifacts/            Deployable packages (frontend SPA and API server).
│   ├── car-rental/       React 19 single-page application (the main deliverable).
│   └── api-server/       Express 5 API server (stub — single endpoint).
├── lib/                  Shared libraries consumed by artifacts.
│   ├── api-spec/         OpenAPI 3.1 specification (source of truth for codegen).
│   ├── api-client-react/ Generated React Query hooks and fetch client (from Orval).
│   ├── api-zod/          Generated Zod validation schemas (from Orval).
│   └── db/               Database layer using Drizzle ORM (stub — empty schema).
├── docs/                 Product, architecture, and AI-rule documentation.
│   ├── architecture/     Architecture reference, screen inventory, design system.
│   ├── rules/            AI agent operating system (modular rule files).
│   └── 1-product specification/  Product overview (English + Arabic PDF).
├── pnpm-workspace.yaml   Workspace definition, version catalog, security settings, overrides.
├── package.json          Root scripts: dev, build, typecheck.
├── tsconfig.base.json    Shared TypeScript configuration inherited by all packages.
├── tsconfig.json         Root tsconfig with project references to lib/db, lib/api-client-react, lib/api-zod.
├── .npmrc                pnpm configuration (auto-install-peers=false, strict-peer-dependencies=false).
├── .gitignore            Ignores dist, node_modules, .expo, attached_assets, docs/.
└── README.md             Project overview, architecture summary, and getting-started guide.
```

**Important:** The `docs/` directory is in `.gitignore` and is not tracked in git. It exists on disk as the living documentation surface for development.

### 2.1 `artifacts/`

Contains the two deployable deliverables: the frontend SPA and the backend API server. Each has its own build process, dependency set, and TypeScript configuration. The term "artifact" signals that these packages produce deployable output (a Vite bundle or an esbuild-bundled server).

### 2.2 `lib/`

Contains internal shared libraries consumed by artifacts as workspace dependencies (`"@workspace/*": "workspace:*"`). These packages are never published to a registry. The separation between `artifacts/` and `lib/` makes dependency direction explicit: artifacts depend on libraries, never the reverse.

### 2.3 `docs/`

Three subdirectories:

- **`architecture/`** — Engineering architecture (`architecture.md`), screen blueprints (`screen inventory.md`), and design system reference (`design system.md`). These correspond to the original product doc set (specification, screen blueprints, design system, architecture) but reorganized after extracting from Replit.
- **`rules/`** — AI agent operating system. A modular rule system (12 files) that governs how AI agents interact with the repository. Entry point is `docs/rules/index.md`. These files cover project context, coding standards, design decisions, safety, git workflow, testing, documentation, and more.
- **`1-product specification/`** — Short English product overview (`english.md`) and an Arabic PDF version.

---

## 3. Workspace Packages

There are six declared workspace packages (four exist, two are undeclared but referenced). The dependency graph for existing packages:

```
                    ┌──────────────────────┐
                    │   pnpm workspace root │
                    │   (shared config,     │
                    │    dependency catalog) │
                    └──────────┬───────────┘
                               │
                    ┌──────────┴──────────┐
                    │                     │
                    ▼                     ▼
            ┌───────────────┐   ┌───────────────┐
            │ artifacts/    │   │   lib/        │
            │ (deployable)  │   │ (shared libs) │
            └───────┬───────┘   └───────┬───────┘
                    │                   │
    ┌───────────────┴───────┐   ┌───────┴────────┐
    │ car-rental            │   │  api-server    │
    │ (React SPA)           │   │  (Express 5)   │
    └───────────────────────┘   └───────┬────────┘
                                        │
                              ┌─────────┴─────────┐
                              │                   │
                        ┌─────┴──────┐    ┌──────┴─────┐
                        │ api-zod    │    │   db       │
                        │ (Zod       │    │ (Drizzle   │
                        │  schemas)  │    │  ORM)      │
                        └─────┬──────┘    └────────────┘
                              │
                        ┌─────┴──────┐
                        │ api-spec   │
                        │ (OpenAPI   │
                        │  3.1 spec) │── Orval codegen ──► api-client-react
                        └────────────┘
```

**Declared but not yet created:**
- `lib/integrations/*` — declared in `pnpm-workspace.yaml` packages pattern but no directory exists.
- `scripts` — declared as a workspace package name but no `scripts/` directory exists.

These are inert placeholders in the workspace configuration, not active packages.

### 3.1 `artifacts/car-rental` (`@workspace/car-rental`)

**Purpose:** The main frontend application — a mobile-optimised, Arabic-first, RTL car rental management dashboard.

**Responsibilities:**
- Render all 14 screens covering dashboard, vehicles, customers, rentals, maintenance, and analytics.
- Manage client-side routing via wouter.
- Provide form validation, state management, and UI feedback (toasts, loading states, empty states).
- Read and write data from an in-memory mock data layer.

**Dependencies:** React 19, wouter, TanStack React Query 5 (not yet wired), react-hook-form, Zod, Tailwind CSS 4, framer-motion, recharts, sonner, date-fns, lucide-react, next-themes, ~25 Radix UI primitive packages (shadcn/ui pattern), and utility libraries (class-variance-authority, clsx, tailwind-merge, tw-animate-css, vaul, cmdk, embla-carousel-react, react-day-picker, input-otp, react-resizable-panels).

**Current implementation status:** Complete for a validation prototype. All 14 screens render with functional forms and mock data. Two full-screen flows (new rental, add maintenance) bypass the bottom navigation bar. TanStack React Query is installed and the generated API client exists in `lib/api-client-react` but is not wired to any page component — all data flows come from in-memory arrays.

**Deployed on:** Vercel at https://car-rental-management-system-car-re.vercel.app

### 3.2 `artifacts/api-server` (`@workspace/api-server`)

**Purpose:** Express 5 HTTP API server that will eventually serve the frontend.

**Responsibilities:**
- Expose REST API endpoints under `/api`.
- Validate incoming requests using Zod schemas from `@workspace/api-zod`.
- Read and write data via the Drizzle ORM client from `@workspace/db`.
- Log structured request information using Pino.

**Dependencies:** Express 5, cors, cookie-parser, pino, pino-http, `@workspace/api-zod`, `@workspace/db`. Bundled with esbuild (via `build.mjs`).

**Current implementation status:** Stub. The server starts, applies CORS and JSON middleware, mounts a single `GET /api/healthz` route, and listens on a configurable port. All other routes are unimplemented. Not deployed.

### 3.3 `lib/api-spec` (`@workspace/api-spec`)

**Purpose:** Single source of truth for the API contract.

**Responsibilities:**
- Define the complete API surface in OpenAPI 3.1 format.
- Drive Orval code generation for both the React Query client and Zod validation schemas.

**Dependencies:** Orval (dev dependency, runs codegen).

**Current implementation status:** Defines one endpoint (`GET /api/healthz`) and one schema (`HealthStatus`). Codegen command: `pnpm --filter @workspace/api-spec codegen`, which also runs `tsc --build` to validate the generated output.

### 3.4 `lib/api-zod` (`@workspace/api-zod`)

**Purpose:** Generated Zod validation schemas derived from the OpenAPI spec.

**Responsibilities:**
- Provide runtime validation for API request and response payloads.
- Be consumed by the API server to validate incoming data.

**Dependencies:** Zod.

**Current implementation status:** Contains a single generated schema (`HealthCheckResponse`) and the corresponding TypeScript interface (`HealthStatus`).

### 3.5 `lib/api-client-react` (`@workspace/api-client-react`)

**Purpose:** Generated React Query hooks and a custom fetch client derived from the OpenAPI spec.

**Responsibilities:**
- Provide type-safe hooks (e.g., `useHealthCheck`) for each API endpoint.
- Provide a configurable fetch client with base URL, auth token injection, and error parsing.
- Be consumed by the frontend to replace the in-memory mock data layer.

**Dependencies:** `@tanstack/react-query` (catalog); peer dependency on React (>=18).

**Current implementation status:** Generated and ready. Not imported by any frontend page — all pages still read from mock data.

### 3.6 `lib/db` (`@workspace/db`)

**Purpose:** Database layer providing a configured Drizzle ORM client.

**Responsibilities:**
- Create and export a PostgreSQL connection pool and Drizzle ORM client.
- Define the database schema (tables, relations, indexes).
- Provide type-safe query builders for the API server.

**Dependencies:** drizzle-orm, drizzle-zod, pg, Zod; drizzle-kit (dev).

**Current implementation status:** Stub. Reads `DATABASE_URL` from environment, creates a `pg` pool, wraps with Drizzle. Schema file (`src/schema/index.ts`) exports an empty object `{}`. No tables defined. `drizzle-kit push` and `push-force` scripts exist but produce no tables.

---

## 4. Frontend Architecture

### 4.1 Routing

The application uses **wouter**, a hook-based lightweight router. Routes are defined in `App.tsx` using `<Switch>` and `<Route>`.

| Route | Component | Layout |
|---|---|---|
| `/` | DashboardPage | AppShell |
| `/vehicles` | VehiclesPage | AppShell |
| `/vehicles/add` | AddVehiclePage | AppShell |
| `/vehicles/:id` | VehicleDetailPage | AppShell |
| `/customers` | CustomersPage | AppShell |
| `/customers/add` | AddCustomerPage | AppShell |
| `/customers/:id` | CustomerDetailPage | AppShell |
| `/rentals` | RentalsPage | AppShell |
| `/rentals/new` | NewRentalPage | Full-screen (no AppShell) |
| `/rentals/:id` | RentalDetailPage | AppShell |
| `/maintenance` | MaintenancePage | AppShell |
| `/maintenance/add` | AddMaintenancePage | Full-screen (no AppShell) |
| `/analytics` | AnalyticsPage | AppShell |
| (catch-all) | NotFound | Full-screen |

Two routes (`/rentals/new` and `/maintenance/add`) render outside `AppShell` to hide the bottom navigation bar during focused data-entry flows.

### 4.2 Layout

`AppShell` (`components/layout/AppShell.tsx`) provides:
- Viewport constrained to `max-w-[480px]` (phone-width frame), centred.
- `h-[100dvh]` full-height with `flex flex-col`.
- Scrollable content area with `pb-20` for bottom navigation padding.
- `BottomNavigation` with five tabs: Home, Vehicles, Customers, Rentals, Maintenance.

`PageHeader` (`components/layout/PageHeader.tsx`) renders a sticky header with title, optional back button, and optional action button.

### 4.3 State Management

No global state library. Application state is entirely local:

- **Local state:** `useState` for search, filters, form inputs, UI toggles.
- **Server-state:** TanStack React Query 5 is a dependency and the generated client exists in `lib/api-client-react`, but neither is connected to any page. The app reads from in-memory mock data arrays.
- **Form state:** react-hook-form with `@hookform/resolvers` and Zod schema validation.
- **Toast state:** Custom `use-toast` hook with reducer pattern (shadcn/ui compatible).
- **Theme state:** `next-themes` for dark/light mode. Dark mode CSS variables are stubbed with placeholder `red` values and not functional.

### 4.4 Data Flow

Data flows directly between page components and in-memory TypeScript arrays:

```
User interaction
    │
    ▼
Page component (pages/*.tsx)
    │
    ├── Reads via helpers from data/index.ts
    │     └── data/vehicles.ts, customers.ts, rentals.ts, maintenance.ts
    │
    ├── Mutates data directly (Array.push, object assignment)
    │
    └── Re-renders via React state or page navigation
```

Mock data helpers in `data/index.ts` provide lookup functions (`getVehicleById`, `getRentalsForCustomer`, etc.) and calculation functions (`getTotalPaid`, `getMonthlyRevenue`). These are pure functions operating on in-memory arrays. Page components mutate mock data directly — there is no abstraction layer swappable for API calls.

The generated API client (`@workspace/api-client-react`) would intercept this flow by replacing direct array reads with React Query hooks. This integration has not been started.

### 4.5 Components

Components are organised under `src/components/`:

- **`layout/`** — `AppShell`, `BottomNavigation`, `PageHeader` (3 components).
- **`ui/`** — ~68 components following the shadcn/ui pattern: unstyled Radix UI primitives wrapped with Tailwind CSS. Includes ~25 Radix UI wrappers (accordion, dialog, dropdown-menu, select, tabs, tooltip, etc.), custom primitives (button, input, badge, card, skeleton, table, etc.), and ~15 domain-specific components (VehicleCard, CustomerCard, RentalCard, MaintenanceCard, StatCard, StatusBadge, EmptyState, SearchBar, FilterChips, SegmentedControl, FormField, InfoRow, CollapsibleSection, SectionHeader).

### 4.6 Styling

- **Tailwind CSS 4** with `@tailwindcss/vite` plugin for on-demand compilation. No `tailwind.config.js` — configuration is inline CSS via `@theme` directive.
- **Global CSS** (`src/index.css`): imports tailwindcss, tw-animate-css, `@tailwindcss/typography` plugin, dark mode variant using class-based activation.
- **Theme tokens** as CSS custom properties (HSL colour values). Light mode uses a blue-based palette. Dark mode variables are present but stubbed (all `red`).
- **Font:** Cairo typeface (Arabic), set via `--app-font-sans`.
- **RTL and mobile:** All components use `dir="rtl"`. Viewport constrained to 480px max-width.

---

## 5. Backend Status

The backend (`artifacts/api-server/`) is a stub.

**Implemented:**
- Express 5 with CORS, JSON body parsing, URL-encoded body parsing.
- Pino structured logging with pino-http middleware. pino-pretty transport in development.
- One route: `GET /api/healthz` — returns status, timestamp, uptime. Response validated against `HealthCheckResponse` schema from `@workspace/api-zod`.
- Bundled with esbuild to ESM output (`dist/index.mjs`). Uses `esbuild-plugin-pino` for pino worker threads.

**Not implemented:**
- No CRUD routes for vehicles, customers, rentals, or maintenance.
- No authentication, authorisation, or session management.
- No middleware beyond CORS and JSON parsing.
- Database schema is empty — no tables.
- No seed data, migrations, or error-handling middleware.

The backend exists to validate the architectural pattern (OpenAPI spec → codegen → Zod validation → Express routing) with a single endpoint.

---

## 6. Shared Libraries

### 6.1 `lib/api-spec`

OpenAPI 3.1 specification (`openapi.yaml`). Orval reads this and generates two downstream packages. Currently defines one endpoint and one schema. No runtime code — input to code generation only.

### 6.2 `lib/api-zod`

Generated Zod schemas used by the API server for request validation. Ensures server validation stays in sync with the API contract.

### 6.3 `lib/api-client-react`

Generated React Query hooks and custom fetch client. Supports base URL configuration, bearer auth token injection, and structured error parsing. Not yet used by the frontend.

### 6.4 `lib/db`

Centralised Drizzle ORM configuration and schema definition. Exports a configured Drizzle client and an empty schema placeholder.

---

## 7. Data Layer

### 7.1 Mock Data

All mock data resides in `artifacts/car-rental/src/data/` as TypeScript modules:

| File | Entity | Count | Details |
|---|---|---|---|
| `vehicles.ts` | Vehicle | 7 | Mix of available, rented, and maintenance |
| `customers.ts` | Customer | 6 | Arabic names, phone, locations |
| `rentals.ts` | Rental | 7 | 3 active, 4 ended; mixed payment states |
| `maintenance.ts` | MaintenanceRecord | 7 | 2 overdue, 2 upcoming, 3 completed |

Data stored as exported `const` arrays, imported via `data/index.ts` barrel file.

### 7.2 Types

TypeScript interfaces in `data/types.ts`: `Vehicle`, `Customer`, `Payment`, `Rental`, `MaintenanceRecord`.

### 7.3 Current Limitations

- No persistence between sessions. All mutations are in-memory, lost on page reload.
- No validation at the mock data level. Page components push to arrays without validation.
- `dailyPrices` on `Rental` is `Record<string, number>` but not validated for completeness.
- Relationships maintained by ID convention, not enforced by the data layer.
- Financial calculations iterate all records each call with no caching or memoisation.

---

## 8. Design System

Documented in `docs/architecture/design system.md`. Implemented through:
- CSS custom properties in `src/index.css` (colour tokens, spacing, radius, shadows, fonts).
- Tailwind CSS 4 with `@tailwindcss/vite` on-demand compilation.
- shadcn/ui components in `src/components/ui/` — Radix UI primitives + Tailwind styling.
- Domain-specific components composed from primitives.

---

## 9. Build & Development

### 9.1 pnpm Workspace

Monorepo uses pnpm workspaces with shared version catalog in `pnpm-workspace.yaml`:

- **Packages:** `artifacts/*`, `lib/*`, `lib/integrations/*` (non-existent), `scripts` (non-existent).
- **Catalog:** Shared version constraints for React 19.1.0, Vite 7, Tailwind CSS 4, TanStack React Query 5, Zod, framer-motion, lucide-react, wouter, etc. Consumed via `catalog:` protocol.
- **Security:** `minimumReleaseAge: 1440` — 1-day delay on new packages as supply-chain defence. Excludes `@replit/*`.
- **Overrides:** Strips platform-specific binaries for esbuild, lightningcss, tailwindcss-oxide, rollup, expo/ngrok-bin. Pins esbuild to 0.27.3. Replaces `@esbuild-kit/esm-loader` with `tsx`.
- **Allowed builds:** Only `@swc/core`, `esbuild`, `msw`, `unrs-resolver`.

### 9.2 Vite

Frontend uses **Vite 7** with `@vitejs/plugin-react` and `@tailwindcss/vite` plugins. Configuration:
- `base` from `BASE_PATH` env var (default `/`).
- Path alias `@/` → `src/`, `@assets/` → `attached_assets/`.
- Deduplicates `react` and `react-dom`.
- Dev server on port 5173 (configurable via `PORT`), bound to `0.0.0.0`.
- Production output to `dist/public/`.

### 9.3 TypeScript

TypeScript 5.9 with:
- **`tsconfig.base.json`** — Target ES2022, module ESNext, bundler module resolution, strict mode subset (strictNullChecks, noImplicitAny, alwaysStrict, etc.), `isolatedModules: true`, `skipLibCheck: true`, `customConditions: ["workspace"]`.
- **`tsconfig.json` (root)** — Project references to `lib/db`, `lib/api-client-react`, `lib/api-zod`. Used by `tsc --build` for incremental type-checking of shared libraries.
- **`artifacts/car-rental/tsconfig.json`** — Extends base, adds JSX preserve, DOM lib, `@/*` path alias, `noEmit: true`.
- **`artifacts/api-server/tsconfig.json`** — Extends base, sets `rootDir: src`, `outDir: dist`, Node types, project references to `lib/db` and `lib/api-zod`.

### 9.4 Build Process

Root `package.json` scripts:
- **`pnpm build`** — Runs `pnpm typecheck` first, then executes `build` in every package that defines one.
- **`pnpm typecheck:libs`** — Runs `tsc --build` at root (type-checks lib packages).
- **`pnpm typecheck`** — Runs `typecheck:libs` first, then `typecheck` individually in artifact and script packages.
- **`pnpm dev`** — Starts the frontend Vite dev server only.

Frontend build: `vite build` → `dist/public/`. API server build: `node build.mjs` (esbuild) → `dist/index.mjs` (ESM).

### 9.5 Development Workflow

Primary command is `pnpm dev`, starting the frontend Vite dev server on port 5173 with HMR. No script runs both frontend and API server concurrently — they must be started separately. API server runs with `pnpm --filter @workspace/api-server run dev`, which builds and starts with `node --enable-source-maps`.

---

## 10. Architectural Decisions

### 10.1 Monorepo with pnpm Workspaces

Supports the codegen workflow. `lib/api-spec` defines the API contract; Orval generates `api-client-react` and `api-zod`. All three in the same repo means codegen changes are immediately type-checked by `tsc --build`.

### 10.2 Mock Data Instead of an API

Explicit validation-prototype decision. Frontend uses in-memory mock data to test product-market fit without backend investment.

### 10.3 Clean Frontend/Backend Separation

- Frontend has no dependency on backend or database packages.
- API server depends on `api-zod` and `db`, but not on the frontend.
- Shared libraries are independent: `api-client-react` depends only on TanStack React Query and React; `api-zod` depends only on Zod.

### 10.4 OpenAPI-Driven Code Generation

API contract in OpenAPI 3.1 (`lib/api-spec/openapi.yaml`). Orval generates client hooks and Zod schemas from this single source. Adding an endpoint means editing one YAML file and running codegen.

### 10.5 Component Strategy (shadcn/ui pattern)

- Primitive UI components wrap unstyled Radix UI primitives with Tailwind.
- Domain-specific components compose primitives into business-logic-specific units.
- `cn()` utility merges classes, supporting caller overrides via `className`.
- Components forward refs and support `asChild` for composition.

### 10.6 Mobile-First, Arabic-First

UI designed for mobile portrait (480px max-width, one-handed usage). Arabic only — RTL layout, Cairo typeface, all UI text in Arabic.

### 10.7 AI Operating System (`docs/rules/`)

A modular rule system (12 files) governs AI agent behavior in this repository. The rule index (`docs/rules/index.md`) routes tasks to the appropriate rule files based on task type. Rules are additive to the codebase, not authoritative over it — repository facts override rule assumptions.

---

## 11. Current Limitations

1. **No data persistence.** All data is in-memory, lost on page reload.
2. **No API integration.** Generated React Query client exists but is unwired.
3. **Backend is a stub.** Single endpoint, empty database schema.
4. **Dark mode not functional.** CSS variables stubbed with placeholder values.
5. **Mock data not validated.** Direct array pushes without validation.
6. **No authentication.**
7. **No error boundaries.** A crash in any page unmounts the whole tree.
8. **No testing infrastructure.**
9. **No CI/CD pipeline.** Deployments are manual (frontend only, via Vercel).
10. **Financial calculations naive.** No caching or memoisation.
11. **Workspace packages `scripts` and `lib/integrations/*` declared but not created.**

---

## 12. Future Evolution

Based on the current repository structure and existing OpenAPI codegen pipeline:

1. **Database schema definition** — populate `lib/db/src/schema/index.ts` with table definitions.
2. **API route implementation** — expand OpenAPI spec, regenerate codegen, implement endpoints.
3. **Frontend-to-API wiring** — replace mock data reads with React Query hooks from `api-client-react`.
4. **Authentication** — middleware on API server, auth flow wired to `setAuthTokenGetter`.
5. **Reporting** — export and reporting features not yet started beyond the analytics page.

These are the only evolutions indicated by the current repository. Nothing beyond these steps has been scoped.

---

## 13. Deployment

**Frontend:** Hosted on Vercel at https://car-rental-management-system-car-re.vercel.app. Build output: `artifacts/car-rental/dist/public/`. Manual deployments.

**Backend:** Not deployed. The API server and database are outside MVP scope.
