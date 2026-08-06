# Design System — Validation Prototype

**Document:** `docs/architecture/design system.md`
**Purpose:** UI conventions and component patterns for the frontend prototype. Reflects current implementation — not an aspirational design spec.

---

## 1. Design Principles

- **Easier than a notebook.** The interface must reduce cognitive load, not add to it.
- **Clarity over creativity.** Never surprise the user with novel patterns.
- **Mobile-first.** Portrait phone screen, one-handed use, short interaction bursts.
- **Arabic-first.** RTL layout, Arabic terminology, Cairo typeface. English only in developer-facing UI (404 page, technical labels).
- **Speed over features.** If something adds friction, it doesn't belong.

---

## 2. Layout

### 2.1 App Shell

The app is framed in a phone-shaped viewport: `max-w-[480px] mx-auto`, `h-[100dvh]`, centred horizontally. The shell provides:
- A sticky `PageHeader` (border-bottom, z-40) with title, optional back chevron, optional action slot.
- A scrollable main area with `pb-20` padding to clear the bottom navigation.
- A fixed bottom navigation bar (5 tabs) with labels always visible.

Two full-screen flows (`/rentals/new`, `/maintenance/add`) render outside the AppShell entirely, hiding the bottom navigation bar.

### 2.2 Page Sections

Sections use `space-y-*` consistently (typically `space-y-5` or `space-y-6` at page level, `space-y-3` within card lists). Each section is wrapped in a `<section>` tag with a `SectionHeader` (bold title + optional action link).

---

## 3. Color

All colour tokens are defined as HSL custom properties in `src/index.css`. The `@theme inline` block maps them to Tailwind utility classes (`bg-primary`, `text-foreground`, `border-border`, etc.).

### 3.1 Semantic Tokens

| Token | Light value | Usage |
|---|---|---|
| `--background` | `210 20% 98%` | Page background (off-white) |
| `--foreground` | `220 15% 20%` | Primary text (dark grey) |
| `--card` | `0 0% 100%` | Card, modal, input surface |
| `--card-border` | `220 13% 91%` | Card borders, dividers |
| `--border` | `220 13% 91%` | General border colour |
| `--muted` | `220 14% 96%` | Muted background (segmented control bg, search bar bg) |
| `--muted-foreground` | `220 10% 46%` | Secondary text (dates, labels, hints) |
| `--primary` | `199 89% 38%` | Primary buttons, active tab, links |
| `--primary-foreground` | `0 0% 100%` | Text on primary backgrounds |
| `--secondary` | `199 30% 94%` | Secondary button background |
| `--secondary-foreground` | `199 89% 28%` | Text on secondary backgrounds |
| `--destructive` | `0 84% 50%` | Errors, overdue badges, alert text |
| `--destructive-foreground` | `0 0% 100%` | Text on destructive backgrounds |
| `--input` | `220 13% 91%` | Input border (same as border) |
| `--ring` | `199 89% 38%` | Focus ring (matches primary) |
| `--radius` | `0.625rem` | Base border radius |

### 3.2 Status Colours

| Token | Value | Used for |
|---|---|---|
| `--status-available` / `--status-available-bg` | green (142 76% 36% / 94%) | Available badge, paid, completed, success |
| `--status-rented` / `--status-rented-bg` | blue (199 89% 38% / 94%) | Rented badge, upcoming, active rental |
| `--status-maintenance` / `--status-maintenance-bg` | amber (38 92% 45% / 94%) | Maintenance badge, maintenance card |
| `--status-danger` / `--status-danger-bg` | red (0 84% 50% / 95%) | Overdue badge, alert strip, top debtor |

Status colours are used directly in components via `hsl(var(--status-X))` custom-property references — not through Tailwind semantic tokens.

### 3.3 Border Variants

Each semantic colour has a corresponding `--X-border` token (e.g. `--primary-border`) derived from the base HSL using `hsl(from ...)` relative colour syntax with an opacity adjustment. These are used for opaque-button variants and card borders.

### 3.4 Shadows

Six shadow tokens (`--shadow-2xs` through `--shadow-2xl`) are defined. Cards use `shadow-sm` by default. The app shell frame uses `shadow-2xl`.

### 3.5 Dark Mode

Dark mode CSS variables are declared but every colour token is stubbed to literal CSS `red`. Dark mode is not functional. Use `next-themes` for the toggle, but visually it will produce broken output.

---

## 4. Typography

- **Typeface:** Cairo (Arabic sans-serif), set via `--app-font-sans`. Serif and mono fallbacks declared but unused.
- **Scale:** Tailwind defaults (`text-xs`, `text-sm`, `text-base`, `text-lg`, `text-2xl`, `text-3xl`). No custom font sizes.
- **Weights:** `font-medium` for secondary labels, `font-semibold` for field labels, `font-bold` for headings and primary values.
- **Screen titles:** `text-lg font-bold` in `PageHeader`.
- **Section titles:** `text-base font-bold` in `SectionHeader`.
- **Body text:** `text-sm` or `text-base`.
- **Secondary info:** `text-xs` or `text-sm text-muted-foreground`.
- **Numbers / currency:** formatted via `formatCurrency()` in `src/lib/format.ts` — uses `$` prefix with Arabic numeral separators (`Intl.NumberFormat("en-US")`).

---

## 5. Iconography

- **Library:** `lucide-react` (outlined, 2-stroke default).
- **Stroke width:** `strokeWidth={1.5}` for decorative icons, `strokeWidth={2}` for interactive icons, `strokeWidth={2.5}` for active nav tabs and high-emphasis icons.
- **Icons always accompany text labels** — never stand alone as the sole indicator.

Common icons used: `Car`, `Users`, `FileText`, `Wrench`, `Home`, `Plus`, `Search`, `ChevronLeft`/`ChevronRight` (back/forward in RTL), `Check`, `X` (dismiss), `CheckCircle` (success), `AlertCircle` (alert), `Clock`, `Calendar`, `Phone`, `MapPin`, `RotateCcw` (return), `CreditCard` (payment), `Camera`, `TrendingUp`, `TrendingDown`, `AlertTriangle`.

---

## 6. Component Patterns

### 6.1 Cards

Primary container for list items (VehicleCard, CustomerCard, RentalCard, MaintenanceCard) and grouped information. Pattern:
- `bg-card rounded-2xl border border-card-border shadow-sm`
- Padding: `p-4` (16px) internally
- Tappable cards: add `cursor-pointer active:scale-[0.98] transition-transform`
- Differentiated border: active rentals use `border-[hsl(var(--status-rented-bg))]` instead of `border-card-border`
- Cards separate themselves — no visual dividers between list items beyond spacing (`space-y-3`)

### 6.2 Buttons

- **Primary:** `bg-primary text-primary-foreground rounded-2xl py-4 font-bold active:scale-[0.98]` (full-width, filled)
- **Secondary:** `bg-card border border-card-border rounded-2xl py-3.5 font-semibold active:scale-95` (outlined)
- **Add button (FAB-style):** circular `w-10 h-10 rounded-full bg-primary text-primary-foreground` with `Plus` icon, positioned in the `PageHeader` action slot
- **Quick action (dashboard):** 2-column grid buttons, `rounded-2xl p-4 min-h-[88px] flex flex-col items-center gap-2`, primary or card-bg variant
- **Disabled:** `bg-muted text-muted-foreground cursor-not-allowed` — no opacity reduction, uses muted colours
- **Interaction feedback:** `active:scale-95` or `active:scale-[0.98]` on press. No loading spinners (instant mock data).

### 6.3 Forms

- All forms use the `FormField` wrapper component with `inputClass` constant.
- **Labels:** `text-sm font-semibold text-foreground`, above the field
- **Required indicator:** Red asterisk `*` next to label using `text-destructive mr-1`
- **Input fields:** `w-full bg-card border border-border rounded-xl px-4 py-3 text-sm min-h-[48px] focus:outline-none focus:ring-2 focus:ring-primary/30`
- **Helper text:** `text-xs text-muted-foreground` below field, only when no error
- **Validation errors:** `text-xs text-destructive` below field, replaces helper text. The input border changes to `border-destructive` and ring to `ring-destructive/30`
- **Error messages:** Concise Arabic, e.g. "هذا الحقل مطلوب", "أدخل رقماً صحيحاً"
- **Save/Submit:** Full-width primary button at form bottom, disabled until required fields filled
- **No real-time validation** — errors appear on save attempt

### 6.4 Status Badge

`StatusBadge` component: `px-2.5 py-0.5 rounded-full text-xs font-semibold`, coloured by status type:

| Status | Token |
|---|---|
| متاحة / مكتملة | `--status-available` + `--status-available-bg` |
| مؤجرة / قادمة | `--status-rented` + `--status-rented-bg` |
| صيانة | `--status-maintenance` + `--status-maintenance-bg` |
| متأخرة | `--status-danger` + `--status-danger-bg` |

Used inline in cards, on vehicle photo overlay, and in history lists.

### 6.5 Filter Chips

Horizontal scrollable row of pill buttons: `px-4 py-1.5 rounded-full text-sm font-medium`. Active chip: `bg-primary text-primary-foreground`. Inactive: `bg-card border border-border text-muted-foreground`. Uses `scrollbar-hide` class.

### 6.6 Segmented Control

Two-option toggle: `bg-muted p-1 rounded-xl`, active segment: `bg-white text-foreground shadow-sm`, inactive: `text-muted-foreground`. Used for active/ended rentals.

### 6.7 Empty States

`EmptyState` component: centred column with icon in `w-16 h-16 rounded-full bg-muted/50`, bold title, optional description (`max-w-[250px]`), optional CTA button. Icon stroke width: `1.5`.

### 6.8 Section Headers

`SectionHeader`: `text-base font-bold` title on the right (RTL), optional action slot on the left. `mb-3` spacing below.

### 6.9 Info Row

`InfoRow`: label-value pair used in detail screens. Label is `text-sm text-muted-foreground` (right-aligned), value is `text-sm font-semibold text-foreground` (left-aligned). Separated by a thin bottom border within a card.

### 6.10 Success Toast

Not a reusable component — implemented inline in `RentalDetailPage` and `MaintenancePage` as a green banner: `bg-[hsl(var(--status-available-bg))] text-[hsl(var(--status-available))] rounded-xl px-4 py-3 text-sm font-semibold flex items-center gap-2`, with a `CheckCircle` icon. Auto-hides after 2.5s via `setTimeout`. Positioned below the page header.

---

## 7. Interaction Patterns

- **Tap feedback:** `active:scale-95` or `active:scale-[0.98]` on tappable elements. No ripple effects.
- **Hover states:** Not meaningful on mobile, but `hover:bg-muted/50` applied to list rows for desktop.
- **Cards:** Full-row tap target. Expandable cards (MaintenanceCard) toggle detail region via `aria-expanded`.
- **Back navigation:** `ChevronRight` icon in a `w-10 h-10` circular hit area, calls `window.history.back()` or custom handler.
- **No swipes, no long-press, no drag.** All interactions are single-tap.

---

## 8. Feedback States

| State | Treatment |
|---|---|
| Success (save) | Navigate away from form + success screen (NewRental, AddMaintenance) or inline green toast |
| Success (action) | Green toast banner, auto-dismiss 2.5s |
| Form error | Red text below field on save attempt |
| Empty list | EmptyState component with icon + message + optional CTA |
| Not found (detail) | Centered screen with alert icon, message, and "back to list" link |
| Overdue alert | Red alert strip at top of MaintenancePage: count + filter shortcut |
| Loading | Not implemented — all data is instant (in-memory mock) |
| Confirmation | Inline expandable section (return confirm, payment input) rather than modal |

No skeleton screens, no spinners, no full-page loading states exist.

---

## 9. RTL Behaviour

RTL is implicit — the app shell renders with `dir="rtl"` via the CSS custom properties. Key patterns:
- `ChevronRight` is used for "back" (points right → forward in RTL reading).
- `ChevronLeft` for "forward/next" links ("عرض الكل").
- Icons are on the right (start for RTL) in card layouts; content on the left (end).
- Single directional icons (arrows, chevrons) are mirrored compared to LTL conventions — always verify direction against Arabic reading flow.
- No CSS `left`/`right` positioning; use logical properties and flexbox ordering.

---

## 10. Utilities

- **`cn()`** from `src/lib/utils.ts` — merges Tailwind classes using `clsx` + `tailwind-merge`. Used in every component to combine conditional classes and resolve conflicts.
- **`formatCurrency(n)`** — `$1,500,000` format.
- **`formatDateAr(dateStr)`** — Arabic long date: "15 كانون الثاني 2025".
- **`formatDateShort(dateStr)`** — Without year: "15 كانون الثاني".
- **`formatInitials(name)`** — "أحمد محمد" → "أم".
- **`scrollbar-hide`** — CSS utility to hide scrollbar while preserving scroll (used on filter chips).
- **Elevation utilities** (`hover-elevate`, `active-elevate`, `toggle-elevate`) — `::after` pseudo-element overlays for press feedback. Not widely used; `active:scale-*` is the primary pattern.

---

## 11. Dark Mode

Declared but non-functional. The `.dark` class is supported by `next-themes` and the `@custom-variant dark` Tailwind directive, but all dark-mode CSS variables are stubbed to `red`. Toggling dark mode will produce broken visuals. Do not rely on dark mode until the CSS variables are properly populated.

---

## 12. Known Gaps

- No loading states / skeleton screens exist. Mock data is instant.
- No modal/dialog component is used for confirmations — inline expandable sections instead.
- No toast library (sonner) is wired — success feedback is custom inline banners.
- Date pickers are native `<input type="date">` with no styling customisation.
- Photo upload is visual-only (dashed placeholder box, no file picker integration).
- No form auto-save or draft persistence.
- All data is in-memory — no API error states exist.
