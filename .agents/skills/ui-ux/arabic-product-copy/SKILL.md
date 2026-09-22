---
name: arabic-product-copy
description: Canonical skill for Markab's user-facing Arabic UI terminology and wording. Use for any tenant-facing Arabic label, button, form field, status text, error, empty state, confirmation, or dashboard copy — including reviewing existing strings for awkward, machine-translated, bureaucratic, or inconsistent Arabic. Does not authorize renaming backend/API/domain identifiers or changing business meaning.
---

# Arabic Product Copy Skill

## Purpose

This is the canonical source for Markab's **user-facing Arabic UI terminology and wording**. Use it for any tenant-facing Arabic string: navigation, page titles, buttons, form labels, placeholders, status/financial wording, empty states, errors, confirmations, and helper text.

It exists to catch and improve:

- awkward Arabic and literal machine-translated phrasing
- overly formal or bureaucratic wording
- inconsistent terminology (e.g. مركبة vs سيارة, or the same status worded differently across screens)
- inconsistent action labels
- unnecessarily long UI copy
- wording that doesn't match how Lebanese/Arabic rental-business staff actually speak

It does not cover: layout/responsive rules (`markab-mobile-ux`, `responsive-system`), visual/token consistency (`design-system-guardian`), or business/domain rules for the vehicle-rental product (`vehicle-rental-saas-ui`). Use this skill together with those, not instead of them.

## UI Terminology vs Technical Identifiers

**This skill governs user-facing Arabic text only.** It never governs code, API, schema, enum, or type identifiers.

A UI label may read `السيارة` while the underlying code remains unchanged:

- TypeScript types/interfaces: `Vehicle`, `VehicleResponseStatus`
- API fields: `vehicle_id`, `status`
- Enum values: `AVAILABLE`, `RESERVED`, `RENTED`, `MAINTENANCE`, `OUT_OF_SERVICE`, `ARCHIVED`
- Route paths, file names, feature directory names (`features/vehicles/`)
- Domain-model terms in `docs/product/04-domain-model.md` ("Vehicle" as the ubiquitous-language term)

**Never instruct or perform a rename of a backend/domain/API/TypeScript identifier because the Arabic UI wording changed.** A copy change to `السيارات المتاحة` does not touch `VehicleResponseStatus.AVAILABLE`, `features/vehicles/`, or the OpenAPI contract in `lib/api-spec`. If a terminology decision seems to imply a domain-model change, that is out of scope for this skill — flag it instead of acting on it.

## Language Direction and Tone

Markab is Arabic-first, targeting rental businesses primarily in Lebanon. Users are business owners, rental office employees, and operational staff who need to work quickly.

Use:

- clear Modern Standard Arabic suitable for software
- familiar rental-business vocabulary
- short, operational wording
- natural phrasing understandable immediately, without explanation
- a professional, direct, calm, practical tone

Avoid:

- unnecessarily literary or classical Arabic
- bureaucratic/government-style phrasing
- literal English translation
- generic enterprise jargon
- marketing exaggeration, motivational language, exclamation marks
- words that are technically correct but sound unnatural in everyday rental-business use

Do not make the UI dialect-heavy or slang-heavy — the tone stays professional even when wording is simplified.

## Terminology Precedence

This skill and the shared label files (`vehicle-labels.ts`, `rental-labels.ts`, `labels.ts`, etc.) can appear to disagree. Resolve that with two different questions, not one rule:

- **"What string does this currently implemented UI use?"** → The shared label source wins. Read the actual current value and treat it as ground truth; this skill's example tables describe typical/preferred shape, not a guaranteed literal match.
- **"Is the current wording actually good?"** → This skill defines the UX language standard and may justify changing the label source. A mismatch between this skill and a label file is a flag to evaluate, not evidence that either one is wrong by default.

This is not circular: implementation status and copy quality are different questions. Do not use "the skill is canonical" to override a label file's current value in place, and do not use "the label file is source of truth" to avoid ever improving wording this skill flags as weak. Any change to a label file's value is still a copy-quality decision subject to [Consistency Rules](#consistency-rules) and [Do Not Change Business Meaning](#do-not-change-business-meaning) — it is not automatic just because this skill prefers different wording.

## Terminology Model

### 1. Preferred terms

Approved user-facing terms and their typical context. Values marked "current code" match the live label sources (`apps/web/src/lib/vehicle-labels.ts`, `rental-labels.ts`, `labels.ts`) at last review — verify against the current file before relying on an exact string, since these are label sources of truth, not this skill.

| Concept | Preferred Arabic | Context |
|---|---|---|
| Vehicle (tenant UI, default) | السيارة / السيارات | Titles, nav, forms, filters, buttons, lists, details, empty states — see [Context-dependent terms](#2-context-dependent-terms) for when `مركبة` still applies |
| Customer | العميل / العملاء | Nav, lists, forms |
| Rental | الإيجار | Nav, workflow |
| Rental agreement | عقد الإيجار | Contract context |
| Pickup | الاستلام | Rental workflow |
| Return | الإرجاع | Rental workflow |
| Deposit | مبلغ الضمان | Financial |
| Payment(s) | الدفعة / الدفعات | Financial, where plural is contextually correct |
| Outstanding balance | الرصيد المتبقي | Financial |
| Expenses | المصاريف | Nav, financial |
| Maintenance | الصيانة | Nav, workflow |
| Repair (maintenance type) | إصلاح | Canonical Modern Standard Arabic term; `تصليح` is current code (`MAINTENANCE_TYPES.REPAIR`) but is colloquial — see note below |
| Tasks | المهام | Nav, workflow |
| Due date | تاريخ الاستحقاق | Tasks, maintenance |
| Analytics | التحليلات | Nav |
| Reports | التقارير | Nav |
| Available (status) | متاحة | Matches current `VEHICLE_STATUS_LABELS.AVAILABLE` |
| Reserved (status) | محجوزة | Matches current `VEHICLE_STATUS_LABELS.RESERVED` / rental `محجوز` |
| Rented / active rental (status) | مؤجرة (vehicle) / نشط (rental) | Matches current code — vehicle and rental statuses use different wording by design; do not force them to match |
| Under maintenance (status) | في الصيانة | Matches current `VEHICLE_STATUS_LABELS.MAINTENANCE` |
| Out of service (status) | خارج الخدمة | Matches current code |
| Archived (status) | مؤرشفة | Matches current code |
| Add | إضافة | Buttons |
| Edit | تعديل | Buttons |
| Save | حفظ | Buttons |
| Cancel | إلغاء | Buttons |
| Delete | حذف | Buttons |
| Search | بحث | Buttons/inputs |
| Filter | تصفية | Buttons/controls |
| Print | طباعة | Buttons |
| Export | تصدير | Buttons |

Do not invent terminology where current product sources (label files, `docs/product/`, `docs/architecture/12-ui-design-system.md`) already establish something specific — confirm the current label file value before overriding it. See [Terminology Precedence](#terminology-precedence) for how to resolve a conflict between this table and a shared label file.

**Note on `إصلاح` vs `تصليح`:** the language-direction rule above calls for clear Modern Standard Arabic, not dialect. `إصلاح` is the canonical UI term for repair; `تصليح` is Lebanese colloquial and matches what the current code happens to use. Treat `تصليح` as an existing, acceptable value under [Terminology Precedence](#terminology-precedence) (don't rename it reactively), but do not introduce `تصليح` as the preferred choice in new copy — use `إصلاح` unless there is a deliberate reason to keep the colloquial term.

**Grammatical gender:** status adjectives above (`متاحة`, `محجوزة`, `مؤجرة`, `مؤرشفة`) are feminine because they agree with السيارة. They are not universal genderless labels. A status badge that appears without its noun, or that describes a different entity (e.g. a rental, a task, a document), must agree with whatever it actually refers to — check the relevant label file (`vehicle-labels.ts` for vehicle statuses, `rental-labels.ts` for rental statuses) rather than reusing a vehicle-status adjective by default. Label sources remain authoritative for the exact current value; this table shows typical shape, not a guarantee that it fits every referent.

### 2. Context-dependent terms

The most important context-dependent term is **مركبة vs سيارة**.

**Prefer `سيارة` / `السيارات`** in normal tenant-facing UI when referring to the rental company's cars:

- page titles, dashboard labels, forms, filters, buttons, list/card labels, detail screens, empty states, operational messages, confirmations.

**`مركبة` may remain appropriate** where:

- formal/legal wording requires it (contract text)
- the current code/API/domain layer refers generically to the `Vehicle` entity (this is a technical-identifier concern, not UI wording — see above)
- the wording must genuinely cover vehicle types broader than ordinary cars, if the product ever supports that
- an existing approved product source specifically requires `مركبة` in that exact spot and no verified usability problem justifies changing it

**Forbid blind global search-and-replace of `مركبة` → `سيارة`.** Each occurrence is a UI-copy decision made in context, following the [Consistency Rules](#consistency-rules) below — not a mechanical find/replace across the codebase.

### 3. Avoid / blocked wording

Flag these in normal tenant-facing UI as context-sensitive warnings, not automatic replacements:

- `الأسطول` when the UI simply means the company's cars (e.g. `حالة الأسطول`, `إدارة الأسطول`) — prefer `حالة السيارات`, `إدارة السيارات`.
- Unnecessary `إجمالي` when the surrounding UI (a KPI card, a labeled count) already communicates that the value is a total or count.
- Long administrative phrases where a short operational label works (e.g. `القيام بإضافة مركبة جديدة` → `إضافة سيارة`).
- Literal translations such as `تنفيذ عملية...`.
- Generic phrases such as `إدارة الكيانات`.
- Unexplained English business jargon when a clear Arabic equivalent exists.

## Phrase-Level Rewriting

Work above the individual-word level — optimize the whole phrase, not just the noun.

Examples:

- `إجمالي عدد المركبات المتاحة` → `السيارات المتاحة` (when the surrounding KPI card already communicates this is a count).
- `إدارة عمليات الصيانة للمركبات` → `صيانة السيارات`.
- `القيام بإضافة مركبة جديدة` → `إضافة سيارة`.

A correct rewrite removes redundant words (`إجمالي عدد`, `القيام بـ`) and keeps only what changes the meaning, rather than substituting `مركبة` for `سيارة` inside an otherwise unchanged verbose phrase.

## UI Copy Principles

- Short labels; action-first button text (`إضافة سيارة`, not `القيام بإضافة مركبة جديدة`).
- Consistent nouns and verbs for the same concept across the product.
- No duplicated meaning between a heading and its helper text.
- No unnecessary punctuation.
- Do not explain obvious controls.
- Avoid verbose empty states — state what's missing, then the next action.
- Errors explain the problem and, where useful, the recovery step.
- Confirmations state the target and consequence clearly.
- Placeholders give useful input guidance; they do not repeat the label.
- Helper text exists only when it materially reduces ambiguity.

Prefer `حفظ` over `حفظ التغييرات التي تم إجراؤها` unless a specific field genuinely needs the extra clarity.

### Success messages

Calm, specific: `تم حفظ التغييرات.`, `تم إضافة السيارة.`, `تم تسجيل الدفعة.`

Avoid: `تم بنجاح!`, `رائع! تم الحفظ`, exclamation-heavy phrasing.

### Error messages

Explain what happened and, where useful, what to do: `تعذر حفظ التغييرات. حاول مرة أخرى.`, `هذه السيارة غير متاحة في الفترة المحددة.`, `تاريخ الإرجاع يجب أن يكون بعد تاريخ الاستلام.`

Avoid: `عذراً حدث خطأ ما`, `خطأ غير معروف`, `فشلت العملية!`

### Empty states

Structure: state what's missing → explain the next action → offer the action if appropriate.

```md
لا توجد سيارات بعد.
أضف أول سيارة لبدء العمل.
```

Avoid: `لا توجد بيانات`, `لا شيء هنا`, `ابدأ رحلتك الآن`, and avoid re-introducing `الأسطول` in a rewritten empty state.

### Confirmations

Direct, states the consequence:

```md
هل تريد إلغاء هذا الإيجار؟
سيتم تحرير السيارة من هذا الحجز.
```

Avoid dramatic warnings unless the action is genuinely destructive.

## Consistency Rules

When changing one string, inspect nearby related strings in the same feature before finishing. For example, if changing `المركبات` to `السيارات` on a page, check:

- page title
- search placeholder
- filter labels
- empty state
- add button
- detail link
- count/KPI label
- confirmation dialog
- validation/error copy

Do not silently rewrite unrelated features while fixing one string.

**If the bad wording comes from one shared label/helper** (e.g. every screen showing a vehicle status pulls from `VEHICLE_STATUS_LABELS` in `vehicle-labels.ts`), fix it at that shared source, not by patching each screen that consumes it. Patching call sites individually while the shared constant stays wrong reintroduces the inconsistency the next time that constant is used.

**If the same awkward phrase is duplicated as separate literals** across several features with no shared source, report the repeated pattern and identify the smallest shared label source that should eventually own it, rather than fixing every literal occurrence ad hoc in one pass.

### Search auditing

For a terminology cleanup (not a single-string fix), search for known problem terms and their variants within the relevant UI scope — the affected feature directory and shared label sources, not the whole backend or docs:

```
rg "الأسطول|مركبة|المركبات" apps/web/src/features/<feature> apps/web/src/lib/*labels*.ts
```

Wording inconsistency is often distributed across several files that never cross-reference each other, so a single-file read can miss it. Keep the search scoped to `apps/web/src` UI sources — do not extend it into the API spec, backend, or documentation, which use "Vehicle"/"مركبة" as legitimate technical or domain-model terms outside this skill's scope.

### Navigation terminology stability

Navigation labels are the most visible and most repeated terminology in the product, so they must be especially stable. If `السيارات` is the approved nav term for a section, its page title, breadcrumbs, empty states, and related action labels must all agree — they should not alternate between `السيارات`, `المركبات`, and `الأسطول` within the same section. A nav-adjacent inconsistency is a stronger signal to fix the shared source (see above) than an isolated string elsewhere.

### Nouns vs. actions

Keep the noun form and the action form distinct and both natural:

- Noun (section/list identity): `الإيجارات`, `السيارات`, `المهام`.
- Action (what the user does): `إنشاء إيجار` or `إضافة إيجار`, `إضافة سيارة`, `إضافة مهمة`.

Avoid a generic `إدارة الإيجارات`-style title for a page that is really just a list — reserve "إدارة" phrasing for a screen that genuinely represents management (multiple sub-workflows, settings, configuration), not a simple list/detail page.

## Repository Inspection Rules

Do not read the whole project. For a terminology change, inspect only:

1. The affected page/component.
2. Existing label constants/helpers for that domain — check `apps/web/src/lib/labels.ts`, and feature-specific sources such as `apps/web/src/lib/vehicle-labels.ts`, `rental-labels.ts`, `media-labels.ts` before writing a new literal string.
3. Related strings in the same feature (`apps/web/src/features/<feature>/`).
4. The closest equivalent feature's terminology for the same kind of concept (status label, action button, empty state).
5. Approved product/UI docs when wording remains unclear: `docs/architecture/12-ui-design-system.md`, `docs/product/02-business-requirements.md`, `docs/product/04-domain-model.md`.
6. Formatting helpers (`apps/web/src/lib/format.ts`) when numbers, dates, or currency are involved.

Use the actual current paths and label names found in the repository — do not assume a filename or exported constant listed above still exists or is spelled the same; confirm before relying on it.

## Do Not Change Business Meaning

A copy improvement must never alter:

- persisted status meaning
- lifecycle behavior
- permissions
- calculations
- business rules
- API contracts
- validation requirements

If two backend states have different meanings (e.g. a vehicle's `RESERVED` vs a rental's `RESERVED`, or `RETURNED` vs `CANCELLED`), the Arabic UI must preserve that distinction even if the cleaner-sounding wording would collapse them into one label. Do not merge two distinct statuses into the same Arabic word merely because it reads better.

## Arabic + Numbers + LTR Content

Keep Markab's existing rules unchanged:

- Western digits, `dd/mm/yyyy` dates, currency formatting, phone numbers, IDs, and plate numbers keep their existing LTR treatment inside RTL content (`apps/web/src/lib/format.ts`).
- A wording change must not introduce new ad hoc number/date/currency formatting — reuse the existing formatting helpers.

## Mobile Copy

Coordinate with `markab-mobile-ux` for layout-affecting decisions. On narrow screens:

- Prefer shorter equivalent labels where meaning is fully preserved.
- Do not abbreviate so aggressively that meaning becomes unclear.
- Test long Arabic strings at 375px (see `markab-mobile-ux`'s review matrix).
- Avoid headings wrapping to excessive lines because of unnecessarily verbose wording.
- Never solve a layout problem by deleting meaning that the user needs — shorten the phrase, don't drop the content it conveys.

## When Uncertain

If no approved wording exists for a given string:

1. Inspect comparable terminology already used elsewhere in Markab.
2. Prefer the shortest natural, professional Arabic that preserves meaning.
3. Avoid inventing new domain terminology not present in `docs/product/04-domain-model.md` or the business requirements.
4. Flag genuinely consequential terminology decisions (ones likely to recur across many screens, or that touch a status/financial term) instead of silently establishing new product vocabulary.

For minor stylistic choices with no real ambiguity, make the smallest reasonable choice and keep it consistent within the feature.

## Required Terminology Examples

These illustrate the rule; they are not a universal mechanical replacement list — apply the same reasoning to other strings rather than only matching these exact phrases.

- `حالة الأسطول` → `حالة السيارات` (this exact phrase currently exists in `DashboardPage.tsx`; a future dashboard copy pass should apply this rule there).
- `إدارة الأسطول` → `إدارة السيارات`.
- `أضف أول مركبة لبدء إدارة الأسطول` → `أضف أول سيارة لبدء العمل` (removes both the `مركبة`→`سيارة` swap and the unnecessary `إدارة الأسطول` tail).
- `إجمالي المركبات المتاحة` → `السيارات المتاحة`.
- `القيام بإضافة مركبة جديدة` → `إضافة سيارة`.
- `حفظ التغييرات التي تم إجراؤها` → `حفظ` (unless the field genuinely needs the extra clarity).
- Overly formal maintenance phrasing (`إدارة عمليات الصيانة للمركبات`) → direct operational wording (`صيانة السيارات`).
- Verbose empty state (`لا توجد بيانات متعلقة بالمركبات في الوقت الحالي`) → concise, helpful wording (`لا توجد سيارات بعد. أضف أول سيارة لبدء العمل.`).

## Verification

When Arabic wording changes, verify:

- Meaning remains correct and unambiguous.
- Nearby terminology in the same feature is consistent with the change.
- The wording reads naturally as an actual product UI, not a translated document.
- RTL layout still works with the new string.
- Mobile wrapping remains acceptable at 375px.
- Mixed Arabic/LTR content (numbers, dates, plates, phone numbers) remains readable.
- No backend/API/domain identifier was renamed as a side effect.

For pure copy changes, automated tests are only needed when an existing test asserts the affected visible text or interaction. Update those focused tests as needed; do not create new tests solely because wording changed.

## What Not to Do

- Do not globally replace every `مركبة` with `سيارة`.
- Do not translate or rename internal identifiers (types, enums, API fields, routes, file/feature names).
- Do not rewrite contract/legal text unless that exact text is explicitly in scope.
- Do not change business rules, statuses, or calculations under the guise of a copy improvement.
- Do not introduce dialect/slang as the normal product voice.
- Do not make text longer merely to sound more formal.
- Do not rewrite unrelated screens while fixing one terminology issue.
- Do not create a second, competing terminology dictionary — this skill is canonical for Arabic UI wording; if a shared label source (e.g. `vehicle-labels.ts`) already owns a value, defer to it rather than restating a conflicting one here.
