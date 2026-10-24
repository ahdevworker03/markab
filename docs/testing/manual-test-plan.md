# Markab — مَركب Manual QA Test Plan

## 1. Purpose

This plan defines human manual QA for **Markab — مَركب**, the Arabic-first multi-tenant vehicle rental SaaS.

Manual QA complements automated and browser E2E testing. It focuses on areas that require human judgment or real deployment boundaries:

- complete business workflows;
- Arabic RTL presentation;
- responsive behavior;
- accessibility and keyboard use;
- browser differences;
- real email delivery;
- private file storage;
- print/PDF/CSV output;
- cross-module reconciliation;
- staging/production smoke;
- final pilot acceptance.

Do not duplicate exhaustive automated validation or E2E scenarios unless manual inspection adds meaningful evidence.

For formal Step 66 verification, record:

- tester;
- date;
- environment;
- release commit;
- browser/version;
- viewport;
- account/role;
- result: `PASS`, `FAIL`, `BLOCKED`, or `N/A`;
- useful evidence where relevant.

---

## 2. Current release context

Step 66 automated release verification is complete.

Manual QA therefore focuses on the remaining human/browser/release checks.

Step 64 remains `PAUSED / OPEN`.

The following are **not production-qualified**:

- reconnect/reconciliation P95 `<= 10,000 ms`;
- offline customer/vehicle-search qualification;
- full offline-first operation.

The current release path is a **controlled online-first pilot**.

Do not describe offline functionality as unimplemented.

Do not describe it as fully production-qualified either.

---

## 3. Common UI expectations

Markab should consistently use:

- Arabic-first RTL layout;
- IBM Plex Sans Arabic where defined;
- Western digits;
- dates as `DD/MM/YYYY`;
- Asia/Beirut date-time behavior;
- established USD formatting;
- readable LTR vehicle plates, IDs, phone numbers, and technical values inside RTL layouts.

Status must never rely on color alone.

Loading, empty, unavailable, zero, error, submitting, permission-denied, and success states must remain visually distinct and truthful.

Unavailable or failed values must not appear as zero.

Destructive actions must use the established confirmation pattern.

---

# 4. Test environment

## Required setup

| Item                | Requirement                                               |
| ------------------- | --------------------------------------------------------- |
| Environment         | Staging or designated disposable release-test environment |
| Services            | Web, API, PostgreSQL, R2 storage, email delivery          |
| Readiness           | `/api/healthz` and `/api/readyz` healthy                  |
| Primary browser     | Chromium/Chrome                                           |
| Additional browsers | Firefox and Safari where available                        |
| Viewports           | 375, 768, 1024, 1440, 1920                                |
| Files               | Valid PDF/JPEG/PNG/WebP, invalid type, oversized file     |
| Data                | Realistic non-sensitive QA data only                      |
| Evidence            | Screenshots/downloads/network evidence where useful       |

## Test accounts

| Account          | Organization | Role             |
| ---------------- | ------------ | ---------------- |
| `platform-owner` | Platform     | `PLATFORM_OWNER` |
| `owner-a`        | QA Rental A  | `OWNER`          |
| `employee-a`     | QA Rental A  | `EMPLOYEE`       |
| `owner-b`        | QA Rental B  | `OWNER`          |

`PLATFORM_OWNER` must never be created through normal tenant registration, invitation, or tenant user creation.

## Minimum controlled data

Organization A should contain:

- customer with rental history;
- Available vehicle;
- Reserved vehicle;
- Rented vehicle;
- Maintenance vehicle;
- Out-of-Service vehicle;
- Reserved rental;
- Active rental;
- Returned rental;
- Cancelled rental;
- partial-payment rental;
- conflicting future rental;
- Scheduled/In-Progress/Completed maintenance;
- vehicle and organization expenses;
- pending/overdue/completed tasks;
- payments and expenses across multiple reporting periods.

Organization B should contain representative records for tenant-isolation testing.

---

# 5. Sequential smoke checks

| ID     | Check                                    | Expected                         |
| ------ | ---------------------------------------- | -------------------------------- |
| SMK-01 | Open health/readiness and Markab web app | Services healthy; app loads      |
| SMK-02 | Login as `owner-a`                       | Tenant Dashboard loads           |
| SMK-03 | Open all primary tenant modules          | Every supported route works      |
| SMK-04 | Open representative detail pages         | Correct records load             |
| SMK-05 | Login as `platform-owner`                | Routed to `/platform`            |
| SMK-06 | Open Platform organization list/detail   | Platform shell works             |
| SMK-07 | Trigger safe request failure             | Truthful error/retry state shown |

---

# 6. Authentication and tenant boundaries

| ID      | Check                                      | Expected                      |
| ------- | ------------------------------------------ | ----------------------------- |
| AUTH-01 | Valid owner login                          | Dashboard opens               |
| AUTH-02 | Invalid credentials                        | Login rejected safely         |
| AUTH-03 | Session refresh/new tab                    | Session remains valid         |
| AUTH-04 | Protected route while signed out           | Redirected to Login           |
| AUTH-05 | Logout then Back/direct URL                | Protected content unavailable |
| AUTH-06 | Owner representative mutation              | Allowed                       |
| AUTH-07 | Employee owner-only mutation               | Hidden/disabled or rejected   |
| AUTH-08 | Owner A opens Organization B record URL    | Forbidden/not-found           |
| AUTH-09 | Compare A/B lists, reports, files          | No cross-tenant data          |
| AUTH-10 | Owner/employee opens `/platform`           | Denied                        |
| AUTH-11 | Platform owner opens tenant business route | Denied                        |

Any cross-tenant exposure is a release blocker.

---

# 7. Platform administration

| ID     | Check                                 | Expected                              |
| ------ | ------------------------------------- | ------------------------------------- |
| PLT-01 | Platform owner login                  | Dedicated platform shell              |
| PLT-02 | Search/filter organizations           | Correct tenants shown                 |
| PLT-03 | Open organization detail              | Only approved basic organization data |
| PLT-04 | Suspend QA Rental A                   | Status changes successfully           |
| PLT-05 | Login/use QA Rental A while suspended | Business access blocked               |
| PLT-06 | Reactivate QA Rental A                | Status restored                       |
| PLT-07 | Retry tenant access                   | Tenant works again                    |
| PLT-08 | Platform detail inspection            | No tenant business records exposed    |

Platform Admin does not include billing, impersonation, tenant-user management, or tenant business browsing.

---

# 8. Password reset and real email

Use a controlled mailbox.

| ID     | Check                           | Expected                         |
| ------ | ------------------------------- | -------------------------------- |
| RST-01 | Request reset                   | Generic accepted response        |
| RST-02 | Check mailbox                   | Real reset email received        |
| RST-03 | Open email link                 | Correct HTTPS Markab reset route |
| RST-04 | Change password                 | Successful                       |
| RST-05 | Login with new password         | Successful                       |
| RST-06 | Login with old password         | Rejected                         |
| RST-07 | Reuse consumed link             | Rejected safely                  |
| RST-08 | Request reset for unknown email | Same public response             |

---

# 9. Dashboard

Check:

- fleet counts;
- active/urgent rentals;
- tasks;
- financial summary;
- outstanding balances;
- recent activity where supported.

Reconcile Dashboard figures with source modules.

Expected:

- fleet counts match Vehicles;
- revenue uses authoritative payments;
- expenses use Expense records;
- net profit uses approved project definition;
- outstanding balances match Rental Detail;
- no false zero during loading/error.

---

# 10. Customers

Manually verify:

- list/search/detail;
- create customer;
- edit representative fields;
- duplicate/invalid input handling;
- rental history;
- document upload/download/delete;
- empty/loading/error states.

Expected:

- customer persists correctly;
- duplicate/invalid records are rejected;
- history contains only that customer’s rentals;
- documents remain tenant/customer scoped.

---

# 11. Vehicles

Manually verify:

- search and status display;
- add vehicle;
- edit representative fields;
- duplicate plate rejection;
- detail/history;
- photo/document flow;
- rental eligibility.

Expected:

- status and vehicle availability remain consistent;
- Maintenance/Out-of-Service vehicles are not rentable;
- conflicting periods do not offer the vehicle;
- media/documents remain vehicle and tenant scoped.

---

# 12. Rentals and contracts

Manually verify:

- list/search/filter;
- create reservation;
- double-booking rejection;
- availability presentation;
- pickup;
- return;
- extension;
- cancellation;
- detail composition;
- contract generation;
- contract print;
- PDF download;
- signed document flow;
- missing-contract state.

Expected lifecycle:

`RESERVED → ACTIVE → RETURNED`

Vehicle status must remain consistent with rentals and maintenance.

A conflicting rental must never be accepted.

Only one valid contract should exist per rental according to current product behavior.

---

# 13. Payments

Payments are recorded from Rental Detail.

Verify:

- partial payment;
- multiple methods where useful;
- invalid amount handling;
- outstanding balance;
- full-payment state;
- employee restriction.

Expected:

- paid/outstanding values reconcile exactly;
- no duplicate payment;
- no negative displayed balance;
- revenue appears according to payment-date reporting rules.

---

# 14. Maintenance

Verify:

- list/detail;
- create Scheduled maintenance;
- start maintenance;
- rental blocking while maintenance is active;
- complete maintenance;
- final cost;
- vehicle availability after completion.

Expected:

- only valid lifecycle actions appear;
- maintenance never incorrectly overrides an active rental;
- completing maintenance restores availability only when no other blocker exists.

---

# 15. Expenses and tasks

## Expenses

Verify:

- organization expense;
- vehicle-linked expense;
- edit/delete;
- invalid amount;
- Analytics/Reports impact.

Expected:

- expense appears in correct views;
- net profit updates;
- maintenance cost remains distinct from Expense records.

## Tasks

Verify:

- create;
- edit;
- complete;
- delete;
- employee restrictions;
- Dashboard effect.

Expected:

- task status remains correct;
- completed task cannot be completed again;
- owner-only controls remain protected.

---

# 16. Analytics and reports

## Analytics

Check:

- period controls;
- revenue;
- expenses;
- net profit;
- maintenance cost;
- outstanding balances;
- vehicle profitability;
- charts at desktop/mobile widths.

Values must reconcile with authoritative source records.

## Reports

Check:

- month/quarter/year controls where supported;
- summary figures;
- section totals;
- CSV export;
- printable report;
- empty/error states.

Downloaded/exported data must match the selected period.

---

# 17. Cross-module release workflows

These are the primary manual business checks.

## FLOW-01 — Full rental lifecycle

1. Create customer.
2. Select available vehicle.
3. Create reservation.
4. Generate contract.
5. Pick up.
6. Record partial payment.
7. Extend if non-conflicting.
8. Return.
9. Inspect customer/vehicle/rental history.
10. Compare Dashboard, Analytics, and Reports.

Expected:

- consistent lifecycle;
- correct vehicle status;
- correct balance;
- no duplicate or stale state.

## FLOW-02 — Maintenance availability

1. Create maintenance.
2. Start it.
3. Verify vehicle unavailable for rental.
4. Complete with cost.
5. Verify final availability.

## FLOW-03 — Expense reconciliation

1. Record baseline values.
2. Add selected-period expense.
3. Refresh Dashboard/Analytics/Reports.
4. Confirm only relevant financial values change.

## FLOW-04 — Payment reconciliation

1. Record partial payment.
2. Compare Rental Detail.
3. Compare Dashboard outstanding.
4. Compare Analytics/Reports.

## FLOW-05 — Tenant isolation

1. Compare A and B lists.
2. Open known cross-tenant URLs.
3. Attempt known file/document access.

Expected:

- no tenant data crosses organization boundary.

---

# 18. Files, contracts, and exports

Verify representative:

- customer document;
- vehicle photo/document;
- signed rental document;
- invalid file;
- oversized file;
- file deletion;
- cross-tenant file denial;
- contract print;
- contract PDF;
- report CSV;
- printable report.

Expected:

- private storage;
- correct tenant/resource scope;
- safe rejection;
- correct exported content.

---

# 19. Responsive and RTL verification

Review representative pages at:

- 375px;
- 768px;
- 1024px;
- 1440px;
- 1920px.

Use:

- shell/navigation;
- list;
- detail;
- form;
- Dashboard;
- Rental;
- Analytics;
- Reports;
- Platform Admin.

Expected:

- no unintended horizontal overflow;
- actions remain reachable;
- mobile/tablet layouts are intentional;
- desktop/wide layouts do not stretch excessively;
- long Arabic content does not overlap;
- LTR IDs/plates remain readable.

Do not repeat every workflow at every width.

---

# 20. Accessibility and keyboard

Verify critical paths using keyboard:

- Login;
- main navigation;
- mobile drawer;
- confirmation dialog;
- representative form;
- rental lifecycle action;
- payment action;
- Platform status action.

Check:

- visible focus;
- logical tab order;
- no keyboard traps;
- accessible labels;
- associated form errors;
- icon-only controls have names;
- focus returns after dialogs/drawers;
- status is not color-only;
- mobile touch targets remain usable.

A serious accessibility blocker on a critical workflow blocks release.

---

# 21. Browser, console, and network

## Chromium

Run the full manual release pass primarily here.

## Firefox

Repeat browser-sensitive critical checks:

- login;
- navigation;
- rental form/detail;
- dialogs;
- files;
- print/PDF;
- key responsive behavior.

## Safari

Run equivalent critical checks where Safari is realistically available.

If unavailable, record the exact limitation rather than marking it PASS.

## Console/network

During critical workflows verify:

- no unexplained uncaught errors;
- no new React warnings affecting behavior;
- expected HTTP status codes;
- no duplicate mutation request;
- API errors surface clearly;
- refresh/back does not repeat a mutation.

---

# 22. Offline boundary

Offline implementation exists, but Step 64 remains open.

Do not rerun the full reconnect performance investigation during Step 66 manual QA.

For the controlled online-first pilot, verify only:

- visible connectivity/sync state is truthful;
- normal online workflows remain usable;
- unsupported offline actions do not silently claim success;
- recovery to normal online operation does not expose another tenant’s data.

The following remain explicitly open:

- reconnect/reconciliation P95;
- offline customer/vehicle-search qualification;
- offline-first production qualification.

---

# 23. Operator and production smoke

## Operator rehearsal

Review current runbooks for:

- deployment;
- migration;
- Task atomic cutover;
- backup;
- restore;
- monitoring/alerts;
- rollback/fix-forward;
- Platform Owner bootstrap/recovery.

The operator should not need undocumented commands or direct database fixes.

## Production smoke

Production verification must be non-destructive unless using an approved disposable production account.

Verify:

- `/api/healthz`;
- `/api/readyz`;
- frontend root/login;
- controlled login;
- tenant shell;
- representative authenticated page;
- platform shell where safe;
- correct frontend/API origins;
- current release/version correlation.

---

# 24. Release blockers and final checklist

The following block the controlled online-first pilot:

- cross-tenant data/file exposure;
- broken authentication or server-side authorization;
- Platform Owner entering tenant workflows;
- tenant user accessing Platform Admin;
- incorrect rental lifecycle;
- incorrect vehicle availability;
- incorrect payment/balance/financial values;
- duplicate financial/business mutation;
- data loss/corruption;
- broken rental lifecycle workflow;
- broken real reset-email flow;
- broken private storage;
- critical export/contract corruption;
- serious keyboard/touch blocker;
- unresolved high/critical security issue;
- production login/navigation/readiness failure.

Minor visual/copy issues are triaged by business impact.

## Final checklist

- [ ] QA environment/accounts/data recorded.
- [ ] Sequential smoke passed.
- [ ] Authentication/authorization passed.
- [ ] Tenant isolation passed.
- [ ] Platform Admin lifecycle passed.
- [ ] Real password-reset email passed.
- [ ] Full rental lifecycle passed.
- [ ] Maintenance availability passed.
- [ ] Payment/outstanding reconciliation passed.
- [ ] Expense/Analytics/Reports reconciliation passed.
- [ ] Representative task workflow passed.
- [ ] File/storage checks passed.
- [ ] Contract print/PDF passed.
- [ ] Report CSV/print passed.
- [ ] 375/768/1024/1440/1920 reviewed.
- [ ] RTL/mixed-direction content reviewed.
- [ ] Critical keyboard/accessibility paths passed.
- [ ] Chromium passed.
- [ ] Firefox passed or blocker documented.
- [ ] Safari passed where available or limitation documented.
- [ ] Console/network review passed.
- [ ] Operator/runbook rehearsal completed.
- [ ] Production smoke passed.
- [ ] Remaining defects have explicit disposition.
- [ ] Step 64 remains `PAUSED / OPEN`.
- [ ] Offline-first is not claimed as production-qualified.
- [ ] Controlled online-first pilot go/no-go decision recorded.

---

# 25. Related documents

- [`testing-strategy.md`](./testing-strategy.md)
- [`automated-test-plan.md`](./automated-test-plan.md)
- [`e2e-test-plan.md`](./e2e-test-plan.md)
- `docs/development-milestones/6-production-readiness.md`

This file owns **manual QA for Markab — مَركب**.

It should reference automated/E2E evidence instead of duplicating it.

Step 66 manual verification can support a controlled **online-first pilot**.

It must not claim full offline-first or Milestone 6 completion while Step 64 remains `PAUSED / OPEN`.
