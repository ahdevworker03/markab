# Frontend Architecture

## Purpose

This document describes the architecture of the frontend application in `artifacts/car-rental` (`@workspace/car-rental`).

It explains the application structure, routing, layout, state management, data flow, component organization, styling approach, and testing setup.

The document describes the repository as it currently exists. It is a **validation prototype**: the frontend is the main deliverable and reads and writes directly to in-memory mock data.

---

# Application Overview

The frontend is a mobile-optimised, Arabic-first, RTL single-page application for small Lebanese car rental businesses. It is built with:

- **React 19** + TypeScript (strict)
- **Vite 7** with `@vitejs/plugin-react` and `@tailwindcss/vite`
- **Tailwind CSS 4** with `@theme inline` design tokens (no `tailwind.config.js`)
- **wouter** for client-side routing
- **shadcn/ui** pattern: unstyled Radix UI primitives wrapped with Tailwind
- **react-hook-form** + **Zod** (`@hookform/resolvers`) for forms
- **Vitest** + React Testing Library for unit/component tests
- **TanStack React Query 5** (installed, **not yet wired**)

The application renders 14 screens covering dashboard, vehicles, customers, rentals, maintenance, and analytics. All data is served from in-memory TypeScript arrays under `src/data/`.

---

# Source Layout

```text
src/
├── main.tsx                 Entry point — renders <App />
├── App.tsx                  Router composition (nested switches, provider mounting)
├── index.css                Tailwind import, @theme tokens, CSS variables, utilities
├── pages/                   Route-level page components (14 pages + not-found)
├── features/                Per-domain feature modules
│   ├── vehicles/            hooks.ts, selectors.ts (+ tests)
│   ├── customers/           hooks.ts
│   ├── rentals/             hooks.ts, selectors.ts (+ tests)
│   └── maintenance/         hooks.ts, selectors.ts (+ tests)
├── components/
│   ├── layout/              AppShell, BottomNavigation, PageHeader
│   └── ui/                  shadcn/ui primitives + domain components
├── hooks/                   use-toast, use-mobile, useTimeout
├── lib/                     format, labels, mock-date, utils (+ tests)
├── data/                    In-memory mock data + barrel accessors + types
└── test/                    test setup (Vitest environment)
```

---

# Routing

Routing uses **wouter**. Two levels of routing are composed in `App.tsx`:

1. **Outer switch** — handles the two full-screen data-entry flows that must render *outside* `AppShell` (no bottom navigation):
   - `/rentals/new` → `NewRentalPage`
   - `/maintenance/add` → `AddMaintenancePage`
   - Everything else falls through to the inner router wrapped in `AppShell`.
2. **Inner switch (`Router`)** — all AppShell screens plus the catch-all `NotFound` page.

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

Details:

- Router base is derived from `import.meta.env.BASE_URL` (Vite `base`), so routing works under a sub-path.
- The full-screen flows reuse the same viewport wrapper as `AppShell` (480px max-width, `h-[100dvh]`, `overflow-hidden`, `shadow-2xl`) but skip the `AppShell` chrome.
- `TooltipProvider` and the sonner `Toaster` are mounted once at the root, above the router.

---

# Layout

`components/layout/AppShell.tsx` provides:

- Viewport constrained to `max-w-[480px]`, centred, `h-[100dvh]` flex column.
- Scrollable `<main>` with `flex-1`, `overflow-y-auto`, `pb-20` (bottom-nav padding), `no-scrollbar`.
- `BottomNavigation` pinned at the bottom with five tabs: Home, Vehicles, Customers, Rentals, Maintenance.
  - Home is exact-match only (`/`); all other tabs match their route prefix.
  - Active state driven by wouter's `useLocation`.

`components/layout/PageHeader.tsx` renders a sticky header with title, optional back button, and optional action button.

---

# State Management

There is **no global state library**. State is deliberately local:

- **Local state** — `useState` for search, filters, form inputs, UI toggles.
- **Form state** — react-hook-form with Zod resolvers (`@hookform/resolvers`), shared field components.
- **Toast state** — `hooks/use-toast.ts`, a shadcn-compatible reducer pattern (dispatch-based, `toast()` imperative helper + `useToast()` hook).
- **Server state** — TanStack React Query 5 is a dependency and the generated client exists in `lib/api-client-react`, but neither is connected to any page. All data comes from in-memory mock arrays.
- **Theme** — light mode only. `next-themes` remains a dependency (used by `sonner.tsx`), but `index.css` defines no dark variant.

---

# Data Flow

Pages never touch the mock arrays directly. They go through the **feature layer**:

```text
User interaction
        │
        ▼
Page component (pages/*.tsx)
        │
        ├── reads via feature hooks (features/*/hooks.ts)
        │     └── useRentals(), useVehicle(id), useActiveRentals(), ...
        │
        ├── hooks call pure selectors (features/*/selectors.ts)
        │     └── getTotalRemaining(), getMonthlyRevenue(), ...
        │
        ├── selectors read from data barrel (data/index.ts)
        │     └── data/vehicles.ts, customers.ts, rentals.ts, maintenance.ts
        │
        └── mutations go directly to the arrays (Array.push, assignment)
```

- **`src/data/`** — mock data as exported `const` arrays, re-exported through the `data/index.ts` barrel which also exposes lookup helpers (`getVehicleById`, `getRentalsForCustomer`, ...). Types live in `data/types.ts`.
- **`src/features/*/selectors.ts`** — pure, unit-tested functions for filtering and calculation.
- **`src/features/*/hooks.ts`** — thin hooks that wrap selectors over the mock data (`useRental(id)` → `rentals.find(...)`), giving pages a stable API to swap for React Query hooks later.

Mock data volumes: 7 vehicles, 6 customers, 7 rentals, 7 maintenance records.

The generated API client (`@workspace/api-client-react`) is the intended replacement for the feature hooks when the API integration starts — the hook-per-entity shape was designed for a near drop-in swap. This has **not** been started.

---

# Components

## Layout components (`components/layout/`)

`AppShell`, `BottomNavigation`, `PageHeader` — 3 components.

## UI components (`components/ui/`)

~69 components, split into:

- **shadcn/ui primitives** — Radix UI wrappers styled with Tailwind: accordion, alert, alert-dialog, aspect-ratio, avatar, badge, breadcrumb, button, button-group, calendar, card, carousel, chart, checkbox, collapsible, command, context-menu, dialog, drawer, dropdown-menu, field, form, hover-card, input, input-group, input-otp, kbd, label, menubar, navigation-menu, pagination, popover, progress, radio-group, resizable, scroll-area, select, separator, sheet, sidebar, skeleton, slider, sonner, spinner, switch, table, tabs, textarea, toast, toaster, toggle, toggle-group, tooltip, and more.
- **Domain-specific components** composed from primitives: VehicleCard, CustomerCard, RentalCard, MaintenanceCard, StatCard, StatusBadge, EmptyState, SearchBar, FilterChips, SegmentedControl, FormField, InfoRow, CollapsibleSection, SectionHeader.

## Hooks (`hooks/`)

`use-toast.ts` (reducer-based toast store), `use-mobile.tsx` (responsive breakpoint hook), `useTimeout.ts`.

## Utilities (`lib/`)

`format.ts` (number/currency/date formatting), `labels.ts` (Arabic display labels and status maps), `mock-date.ts` (deterministic "today" for consistent demo rendering), `utils.ts` (`cn()` class merger).

---

# Styling

- **Tailwind CSS 4** via `@tailwindcss/vite` — on-demand compilation, no config file; tokens defined inline in `src/index.css` with `@theme inline`.
- **Design tokens** as HSL CSS custom properties (background, foreground, primary, secondary, muted, accent, destructive, card, popover, sidebar, status colors, shadows, radius, fonts).
- **Status colors** — dedicated tokens for available / rented / maintenance / danger states with tinted backgrounds (`--status-*`, `--status-*-bg`).
- **Elevation utilities** — custom `.hover-elevate`, `.active-elevate`, `.toggle-elevate` utility classes implementing the elevation language via `::before`/`::after` pseudo-elements.
- **Font** — Cairo typeface for Arabic (`--app-font-sans`).
- **RTL** — set at document level in `index.html` (`<html lang="ar" dir="rtl">`); no per-component direction overrides needed.
- **Light mode only** — dark mode variables were removed from `index.css`.

---

# Forms

All forms use **react-hook-form** with **Zod** schemas via `@hookform/resolvers`. The `FormField` component standardizes label + error display across add/edit screens (vehicle, customer, rental, maintenance). Validation is client-side only; mock mutations are not validated.

---

# Testing

Vitest-based test infrastructure:

- **Vitest 4** with **jsdom** environment; setup in `src/test/setup.ts` (Testing Library matchers via `@testing-library/jest-dom`).
- Script: `pnpm --filter @workspace/car-rental test` (`vitest run`).
- Existing suites:
  - `features/*/selectors.test.ts` — pure selector unit tests (maintenance, rentals, vehicles).
  - `lib/format.test.ts`, `lib/mock-date.test.ts` — formatting and mock-date behavior.
  - `components/ui/SegmentedControl.test.tsx`, `StatusBadge.test.tsx` — component tests with Testing Library.

---

# Build & Development

- **Vite 7** — `base` from `BASE_PATH` (default `/`); aliases `@/` → `src/`, `@assets/` → `attached_assets/`; dedupe `react`/`react-dom`; dev server on port `PORT` (default 5173, `strictPort`, `host 0.0.0.0`, `allowedHosts`); build output to `dist/public/`.
- Scripts: `dev` (Vite dev server), `build` (vite build), `typecheck` (`tsc --noEmit`), `test` (vitest run).
- Deployed on Vercel (manual deployments).

---

# Current Limitations

1. **No data persistence** — all data in-memory, lost on reload.
2. **No API integration** — React Query and the generated client are installed but unwired.
3. **No error boundaries** — a crash in any page unmounts the whole tree.
4. **Light mode only** — no dark theme.
5. **Mock mutations unvalidated** — direct array pushes without schema checks.
6. **Financial calculations naive** — iterates all records without caching/memoisation.
7. **Test coverage is thin** — selectors, lib utilities, and two components only; no page-level tests.

---

# Future Evolution

1. **Wire React Query** — replace feature hooks with generated hooks from `@workspace/api-client-react` (the hook-per-entity shape is ready for a drop-in swap).
2. **Add error boundaries** — per-route boundaries with retry and graceful fallback.
3. **Server-driven data** — move `data/` arrays into the backend once the API is implemented.
4. **Expand testing** — page-level integration tests with Testing Library and mocked API hooks.
