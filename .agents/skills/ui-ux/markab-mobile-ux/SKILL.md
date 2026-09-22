---
name: markab-mobile-ux
description: Markab-specific mobile UX rules for the tenant-facing app in apps/web. Use for any mobile-affecting screen, list, form, or navigation change in the Arabic-first RTL vehicle-rental SaaS. Treats mobile as its own information architecture, not a shrunk desktop layout.
---

# Markab Mobile UX Skill

## What this skill is for

`responsive-system`, `antislop-layoutmobile`, and `antislop-human` give generic mobile/responsive/accessibility rules that apply to any product. `design-system-guardian` and `visual-qa-review` give generic consistency and QA checklists. None of them know Markab's actual screens, components, or business priorities.

This skill fills that gap: it states what "mobile" means specifically for Markab's operational, Arabic-first, vehicle-rental workflows, and tells the agent exactly which repository files to look at instead of reading the whole project.

Use this skill together with the skills above, not instead of them:

- `responsive-system` / `antislop-layoutmobile` — generic reflow, breakpoint, and touch-target mechanics.
- `antislop-human` — generic contrast, focus, and keyboard rules.
- `design-system-guardian` — generic token/component consistency rules.
- `markab-mobile-ux` (this skill) — how to derive Markab-specific mobile information hierarchy from the affected workflow, existing screen, and closest established patterns, plus Markab's specific RTL/density/verification requirements.
- `visual-qa-review` — verifies the finished result against product fit.

Repository inspection (below) establishes what actually exists before any of these rules are applied.

## Preserve Product Meaning

Responsive adaptation may change layout, grouping, ordering, visibility of secondary information, or presentation format.

It must not change:

- business meaning
- persisted status meaning
- permissions
- authoritative calculations
- lifecycle rules
- required form data
- API behavior

If simplifying a mobile screen would require omitting information necessary to complete or understand the workflow, keep that information accessible (e.g. in the detail view or an expandable section) rather than removing it. Mobile simplification must never become product simplification.

## Core Principle

**Mobile is not compressed desktop.**

A mobile screen is a different information architecture for the same workflow, not the desktop screen scaled down. For every affected screen, decide:

- What information is essential at a glance on mobile.
- What is secondary and can move to the detail view.
- Which actions must stay immediately reachable with one hand.
- Whether a desktop table still makes sense, or should become cards/prioritized fields.
- Whether filters or secondary controls belong in a sheet/drawer instead of an inline row.
- Whether an action group should stack, wrap, or simplify to a single primary action plus overflow.

The goal is to preserve the underlying workflow (per `docs/architecture/12-ui-design-system.md` §2, §8) while adapting how it's presented at each width. Do not change business rules, statuses, calculations, or API behavior to accomplish this (`vehicle-rental-saas-ui` rules apply unchanged).

## Repository Inspection Rules

Do not read the whole project. For a normal mobile UI issue, follow this sequence and stop once you have what you need:

1. **Inspect the affected page** under `apps/web/src/features/<feature>/pages/`.
2. **Trace the components it directly renders** under `apps/web/src/features/<feature>/components/`.
3. **Inspect the shared layout/UI primitives it uses.** The stable architectural locations and ownership boundaries are `apps/web/src/components/layout/` (shared shell, navigation, page primitives) and `apps/web/src/components/ui/` (shadcn-style and application-neutral components), per `docs/architecture/03-frontend-architecture.md` §8–9. Confirm the current contents and exact filenames by listing these directories when present rather than assuming a fixed component list — individual filenames may change over time.
   - As of the last review, `layout/` includes primitives such as `AppShell.tsx`, `AppSidebar.tsx`, `TabletNavigationRail.tsx`, `BottomNavigation.tsx`, `NavigationDrawer.tsx`, `navigation.ts`, `PageContainer.tsx`, `PageHeader.tsx`, and `PageActionArea.tsx`.
   - `ui/` includes primitives such as `SectionCard.tsx`, `StatusBadge.tsx`, `EmptyState.tsx`, `FeedbackState.tsx`, `FilterChips.tsx`, `SearchBar.tsx`, `FormField.tsx`, `FormSection.tsx`, plus shadcn-style primitives (`dialog.tsx`, `drawer.tsx`, `card.tsx`, `button.tsx`, table components, etc.).
   - Treat both lists as "when present/current" — verify against the actual directory contents before relying on a specific name.
4. **Inspect the closest existing equivalent pattern** in a sibling feature (e.g. if fixing `rentals` list mobile behavior, check how `vehicles` or `customers` lists already solved it) before inventing a new pattern.
5. **Inspect design tokens and formatting helpers only when relevant**: `apps/web/src/index.css` (semantic tokens, spacing scale, radii), `apps/web/src/lib/format.ts` (currency/date/number formatting), `apps/web/src/lib/labels.ts` / `rental-labels.ts` / `vehicle-labels.ts` / `media-labels.ts` (domain label sources).
6. **Change the smallest appropriate code path.** Do not touch unrelated features, and do not modify `AppShell`, navigation composition, or shared primitives unless the mobile problem is actually in the shared shell rather than the feature screen.

Every specific filename referenced elsewhere in this skill (`FormSection.tsx`, `DataListShell.tsx`, `InfoRow.tsx`, `StatusBadge.tsx`, etc.) is an example of a currently established pattern, not a guarantee. Confirm it still exists and still fits before relying on it; if it doesn't, use the current equivalent or the closest sibling-feature pattern instead.

## Required Responsive Review Matrix

Use Markab's locked review widths (matches `docs/architecture/12-ui-design-system.md` §6 and `responsive-system`):

`375 → 768 → 1024 → 1440 → 1920`

Always review in that order, starting from 375px. Do not design at 1440px and shrink afterward — that produces exactly the "compressed desktop" failure this skill exists to prevent.

### At 375px specifically, verify:

- No accidental horizontal overflow.
- Realistic Arabic content is readable, not just placeholder Latin text.
- The primary action must be immediately discoverable and appropriately positioned for the workflow; users should not need to search through secondary content to find it.
- Controls and touch targets are usable (see antislop-layoutmobile for the 44×44px mechanics).
- `BottomNavigation` behaves correctly and nothing scrolls underneath it uncovered.
- Information hierarchy matches what the screen's workflow needs first (status → next action → summary → secondary detail, per the design-system's page archetypes).
- Vertical density is compact but not cramped — see Density below.
- A realistic short viewport height (in addition to the 375px width) is tested, including how the layout and primary action behave once the on-screen keyboard is open for any in-view form field.

### At 768px and 1024px:

- Verify the transition from `BottomNavigation`/`NavigationDrawer` to `TabletNavigationRail` to `AppSidebar` is clean, not a hybrid state.
- Controls that were single-column on mobile do not become awkwardly stretched before the desktop two-column pattern is justified.

### At 1440px and 1920px:

- Confirm the mobile-focused fix did not regress desktop density or introduce excessive stretching (`ContentGrid` / container max-widths should already bound this).

## Mobile Forms

- Default to one-column forms on mobile (`FormSection.tsx` groups already support this); do not force the desktop two-column layout onto a narrow viewport.
- Group related fields using existing `FormSection`/`FormField` primitives rather than ad hoc wrappers.
- Keep labels, hints, and validation messages associated with their control via the existing pattern (`aria-invalid`, error/help relationships per §11 of the design system doc) — do not introduce a new association pattern for mobile.
- Ensure the on-screen keyboard never covers the primary submit action; the focused field must scroll into view above it.
- Do not put large multi-section forms in a cramped `dialog.tsx`. Prefer a full route or `drawer.tsx`/sheet where the existing app pattern already uses one (task/maintenance "full-screen create" routes in `App.tsx` are the existing precedent — reuse that pattern, don't invent a new modal-vs-route rule).
- Preserve the semantic relationship and established action hierarchy between submit and cancel. Adapt stacking or placement on mobile only when necessary for usability, while reusing the existing action pattern.
- No horizontal scrolling on forms, ever.

## Lists and Tables

- Never shrink a full desktop table's columns until it fits mobile — that is the exact anti-pattern this skill exists to prevent.
- Check `DataListShell.tsx` and the feature's existing card component (e.g. vehicle/customer/rental cards under `features/<feature>/components/`) before building a new mobile list pattern. Markab already has mobile-card equivalents for most entity lists — reuse them.
- Choose intentionally, per screen, between: existing mobile cards, simplified prioritized-field rows, or justified horizontal scroll (only when the data is genuinely comparative, e.g. a report table).
- Prioritize per `docs/architecture/12-ui-design-system.md` §8.2–8.3: entity identity, current status (`StatusBadge`), the most relevant date/amount, and the next valid action. Push secondary metadata to the detail page.
- Do not invent a new card pattern when an existing Markab mobile list/card pattern for a comparable entity already covers the same shape of data.

### Mobile Filters and Search

- Search should normally remain directly accessible when it is a primary list workflow. Secondary filters may move into a sheet/drawer. Do not hide both search and filtering behind the same secondary menu when search is frequently used.
- Opening and closing a filter sheet, detail page, or mobile drawer must not unnecessarily lose the user's search/filter/page context.
- Returning from a detail screen should preserve the user's meaningful list context (search term, filters, scroll position) where the existing routing/state model already supports it. Do not introduce new state infrastructure solely for this.

## Actions and Touch

- Primary actions must not depend on hover; every action Markab exposes (pick up, return, extend, cancel, record payment, generate contract, complete maintenance, etc.) must be reachable and discoverable by tap.
- Do not shrink important workflow actions into unlabeled icon-only controls — icon-only controls need an accessible label regardless (see `antislop-human`).
- Avoid tightly packed action clusters in row actions; group primary/secondary/destructive per the existing `PageActionArea`/row-action pattern rather than compressing everything into an overflow menu just to save space.
- Destructive actions (delete, cancel rental, or other currently implemented destructive actions) stay visually and spatially distinct from routine actions, matching desktop. Only reference destructive actions that exist in the current product; do not normalize a workflow that isn't implemented.
- Evaluate one-handed reachability for frequent actions. Do not introduce sticky or floating controls unless the existing Markab pattern or a demonstrated usability problem justifies them.

## Navigation

Respect the existing responsive shell contract in `docs/architecture/12-ui-design-system.md` §7. Reuse, do not replace:

- `AppShell.tsx`, `AppSidebar.tsx`, `TabletNavigationRail.tsx`, `BottomNavigation.tsx`, `NavigationDrawer.tsx`, `navigation.ts`.

Rules:

- Mobile keeps the frequent destinations (dashboard, rentals, vehicles, customers) immediately available via `BottomNavigation`; everything else stays behind the existing labeled "More" entry (`NavigationDrawer`) — do not invent a second navigation surface.
- Never hide a routine business workflow behind an unlabeled icon or require desktop navigation to reach it.
- Preserve mobile safe-area handling already implemented in `AppShell`; do not add a new fixed element that isn't accounted for in its scroll/safe-area logic.
- Full-screen create flows (`/rentals/new`, `/maintenance/add`, `/tasks/add`) intentionally render outside `AppShell` per `App.tsx` — this is expected, not a navigation bug; preserve their back/cancel route.

## Arabic and RTL Mobile Rules

Every meaningful mobile review must use realistic Arabic content, not Latin placeholders. Test combinations such as:

- Long Arabic customer names and page titles.
- Arabic descriptions and long validation/action-label text.
- Mixed Arabic + English strings, and LTR numeric islands (plate numbers, phone numbers, national IDs, currency, `dd/mm/yyyy` dates) inside RTL flow — these must render via the existing LTR numeric treatment (`lib/format.ts`), not a new one.

Verify at 375px specifically:

- RTL alignment and logical `start`/`end` spacing (never physical `left`/`right` — matches `docs/architecture/03-frontend-architecture.md` styling rule and `responsive-system`).
- Wrapping and truncation behavior with long Arabic strings — no unexpected overflow.
- Directional icons/chevrons point the correct reading direction; non-directional icons are never mirrored.
- Dates render as `dd/mm/yyyy` in Beirut-local business time, never a fixed UTC offset (per `03-frontend-architecture.md`).

Do not solve an RTL issue with ad hoc physical `left`/`right` styles when a logical utility or an existing pattern already handles it elsewhere in the codebase.

## Density

Markab is operational SaaS, not a marketing site (`docs/architecture/12-ui-design-system.md` §2, §4). Mobile screens should be compact and scannable.

Avoid:

- Nesting `SectionCard`/`card.tsx` inside another card for a single small info group.
- Oversized headings or excessive `gap`/`padding` carried unchanged from desktop.
- Large empty surfaces or desktop-scale whitespace on a 375px screen.

Use the existing spacing scale, `InfoRow`, and `SectionHeader` primitives to build hierarchy through structure, not through added whitespace.

## Verification Requirements

For any visible mobile change, manual verification is required in addition to automated checks — passing tests alone is not evidence of mobile UX correctness.

At minimum, verify:

**375px** — realistic Arabic data, a long-content case, no overflow, primary action visible, `BottomNavigation` correct, controls usable by touch.

**768px** — the mobile→tablet navigation transition is clean, controls aren't awkwardly stretched.

**1024px** — the tablet→desktop shell transition (rail → sidebar) works cleanly.

**1440px / 1920px** — confirm the mobile fix did not degrade desktop and content isn't excessively stretched.

Where the change affects them, also verify: loading, empty, error, validation, disabled, long-content, sheet/dialog, and keyboard-interaction states (per §9.7 of the design system doc).

## Testing Guidance

Follow the project's authoritative risk-based testing strategy in `docs/testing/testing-strategy.md`, which explicitly distinguishes presentation-only work from behavioral changes:

- For presentation-only responsive/layout fixes: manual visual verification at the matrix above is mandatory; run `pnpm --filter @workspace/web typecheck`, `pnpm lint`, and the existing test suite. Do not add tests solely because CSS/layout changed.
- For changes to interaction or component behavior: add or update focused frontend tests colocated with the feature/component per existing convention, and still manually verify the original mobile scenario afterward.

## What Not to Do

- Do not introduce new product features, business rules, API behavior, or architectural changes to fix a mobile UX issue.
- Do not add new layout/UI libraries or new navigation surfaces.
- Do not create a new mobile card/list pattern when an existing Markab one already fits.
- Do not modify `AppShell`, navigation composition, or shared design tokens for a single-screen mobile fix — fix the screen, or escalate if the shared shell itself is the problem.
- Do not treat 1440px as the default design and shrink it — always design/review starting from 375px.
- Do not scan or modify unrelated features while fixing one screen's mobile behavior.
