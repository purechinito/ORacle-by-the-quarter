# Full ERP coverage

This is the living acceptance record for the user-supplied full ERP specification (M01–M15). A tested subset does not complete its parent module. Private screenshot IDs refer to the local audit collection; no account screenshots or source data are shipped here.

Status: **planned** = absent; **implemented** = code exists but acceptance incomplete; **tested** = stated API/database tests passed; **blocked** = required evidence or input unavailable. Browser verification is separate and currently blocked by the saved local-preview permission. Business acceptance, production deployment and Philippine compliance are not established.

Evidence classes: **S** screenshot observed; **A** audit narrative; **D** officially documented; **I** inferred; **P** proposed business requirement. Confirmed user requirements are identified as P/user. Current baseline: 37 tests passed on 2026-09-28; runtime requires permission for PostgreSQL shared memory in this sandbox.

Paths below are repository-relative. `api` = apps/api/src/modules; `web` = apps/web/src/features; `tests` = tests/integration. Planned rows have no implementation or passing acceptance evidence yet.

| ID / capability | Source | State | UI / API / data | Acceptance / evidence / unresolved decision |
|---|---|---|---|---|
| M01.1 Role-aware shell | S001/002/035 | implemented | App.tsx; auth.ts | Existing manager/counter/stock navigation; browser unverified |
| M01.2 Real shop indicators | S001/032 | tested | reports.ts; App.tsx | report-scope/shop tests; role-scoped Philippine-today gross sales, active stock/low-stock and authorized PO counts; not financial books |
| M01.3 Global search/recent records | P | planned | — | Search authorized records and navigate to result |
| M01.4 Saved views/dashboard arrangement | S007/021; P | planned | — | Persist each user's views and arrangement |
| M01.5 Scoped queues/drilldowns | S001/005 | implemented | reports.ts; App.tsx | Today’s sales → Reports preserves resolved date range and actor scope; remaining low-stock/PO/AR/AP/approval drilldowns planned |
| M02.1 Catalog/aliases/fitment/substitutes | S013/014; P/user | tested | catalog.ts; Catalog.tsx; parts | shop/edge/pilot/review-regressions; inactive, duplicates and fitment |
| M02.2 3,000+ SKU search/page scale | P/user | implemented | catalog.ts; parts search_key | 5,000-SKU result test exists; p95/index proof pending |
| M02.3 Catalog import preview/commit | P | tested | catalog.ts; import_previews | shop/edge tests; duplicate errors and atomic commit |
| M02.4 Typed identifiers/supplier links | P | planned | — | Preserve leading zeros and uniqueness rules |
| M02.5 Units/packs/quantity precision | A; P | planned | — | Pack receipt and unit sale reconcile base quantity |
| M02.6 Price lists/breaks/effective dates | A; P | planned | — | Correct customer/date/quantity price with override history |
| M02.7 Images/warranty/attachments | S014; P | planned | — | Protected assets and sold-item warranty link |
| M03.1 Immutable quantity ledger/opening | A; P | tested | inventory.ts; opening-import.ts; movements | shop/edge/opening-import; no negative stock, opening once |
| M03.2 Locations/bins/transfers | S015; P | planned | — | Dispatch/receive tracked in transit with scoped balances |
| M03.3 Reservations/backorders/availability | A; P | planned | — | Last unit cannot be reserved/sold twice |
| M03.4 Count approval/quarantine | A; P | planned | — | Counts and damaged stock reconcile by disposition |
| M03.5 Lot/serial/expiry traceability | S014/015 tabs only; P | planned | — | Receipt → sale → return tracing and serial uniqueness |
| M03.6 Costing/valuation/COGS | P | planned | — | Requires costing policy and reviewed valued opening/cutoff |
| M03.7 Replenishment suggestions | A; P | implemented | reports.ts | Reorder threshold list only; lead time/preferred supplier pending |
| M04.1 Counter/draft/tender/change | S017; P | tested | sales.ts; Counter.tsx; sales/payments | shop/pilot/checkout; cash math and uncertain-response recovery |
| M04.2 Returns/refund records | P | tested | sales.ts; returns | Quantity bounds and pending/recorded refund; credit amounts not yet modeled |
| M04.3 Quotes/SO/approval/credit holds | A; P | planned | — | Convert quote, authorize held order, preserve pricing/history |
| M04.4 Partial fulfillment/packing/delivery | A; P | planned | — | Separate reservation, fulfillment and invoicing quantities |
| M04.5 Invoice/AR/payment allocation | A; P | planned | — | Partial settlement and returns reconcile to open balance |
| M04.6 External payment verification | P | planned | — | Reference, unverified/confirmed status and settlement reconciliation |
| M05.1 PO draft/submit/receive/cancel | S018; A | tested | purchasing.ts; Purchasing.tsx; purchases/receipts | shop/pilot/review-regressions; bounded partial receipt and retry |
| M05.2 Requisition/approval/supplier confirmation | A; P | planned | — | Authorized transitions and approval history |
| M05.3 Discrepancies/landed costs/vendor returns | A; P | planned | — | Cost/quantity/credit corrections preserve ledgers |
| M05.4 Vendor bills/three-way match/AP | S042; P | planned | — | Quantity/price tolerances and exception approvals |
| M05.5 Vendor credits/payment schedules | A; P | planned | — | Allocation never exceeds payable |
| M06.1 Customer/supplier creation | S039/040 | tested | relationships.ts; Relationships.tsx; migration008 | Audited creation; role-restricted fields; relationships.test |
| M06.2 Paginated lookup/rich maintained profiles | S039/040; P/user | tested | relationships.ts; Relationships.tsx; PartyPicker.tsx | relationships.test finds record650, stable pages, PH fields, inactive rejection and stale edit; browser pending |
| M06.3 Relationship history | A; P | tested | relationships.ts; Relationships.tsx | Customer history scoped to own sales for counter; supplier costs hidden from stock role; browser pending |
| M06.4 Terms/limits/tax/parent/groups | A; P | implemented | relationships.ts; customers/suppliers | Terms/credit limits stored only; credit enforcement, tax profiles, parent/groups still planned |
| M06.5 Statements/AR/AP aging | A; P | planned | — | Due-date buckets reconcile to balances |
| M07.1 Chart/manual journals/post/reverse | S019; P | tested | finance.ts; ledger.ts; Finance.tsx; migrations010/011 | finance.test: balanced PHP posting, immutable headers/lines, retry-safe save/post, one reversal and exact reversal integrity on restore;71 total tests pass; browser pending |
| M07.2 Fiscal close/reopen | P | tested | finance.ts; gl_periods | finance.test: close/reopen reasons, non-overlap, date-only handling and deterministic close/post lock test; current manual journals only |
| M07.3 Integrated document posting | P | planned | — | Unique source; stock and financial changes atomic |
| M07.4 GL/trial balance/statements | S020; P | implemented | finance.ts; Finance.tsx | Manual GL and opening/movement/closing trial balance tested; income statement, balance sheet and cash flow remain planned |
| M07.5 Reviewed opening books | P | blocked | — | Business accounting cutoff and valued stock not supplied; development can continue |
| M07.6 Budgets/fixed assets | P | planned | — | Depreciation/disposal and budget-versus-actual |
| M07.7 Separate company books/consolidation | P | planned | — | PHP only; company boundaries and eliminations reviewed |
| M08.1 Cash sessions/counts | P | planned | — | Tender ledger agrees with counted close and differences |
| M08.2 Expense/petty cash approvals | A; P | planned | — | Authorized claim → posting → settlement |
| M08.3 Bank import/match/reconciliation | A; P | planned | — | Duplicate imports/allocations rejected; differences preserved |
| M08.4 Deposits/transfers/payment batches | A; P | planned | — | Linked entries and real execution separate from recorded intent |
| M09.1 Kits/assemblies/BOM revisions | S003/006/009; P | planned | — | Prevent cycles; revision effectivity; kit vs assembly distinction |
| M09.2 WO/material/build/scrap/unbuild | S004–010; P | planned | — | Partial production, quantities, costs and GL reconcile |
| M09.3 Production queues/mobile picking | S005/036 empty; P | planned | — | Real shortage and completion states; mobile flow proposed |
| M10.1 Tasks/calendar/reminders | S031 | planned | — | Persist owner, due date, status and related record |
| M10.2 Leads/opportunities/forecast | A; P | planned | — | Stage history, quote link and forecast assumptions |
| M10.3 Support/warranty cases | A; P | planned | — | Assignment/resolution and sold-part traceability |
| M10.4 Marketing/contact preferences | A; P | planned | — | Campaign register; sending needs explicit authorization |
| M10.5 Employees/projects/time/cost | A; P | planned | — | Persist activities/costs and job profitability |
| M10.6 Payroll/advanced extensions | P | blocked | — | Discovery-needed scope and statutory requirements, not claimed supported |
| M11.1 Operational summaries/export | S019; P | tested | reports.ts; Operations.tsx | report-scope/shop/philippines; actor-scoped totals and rows in one snapshot, explicit inventory-only response, date filters, safe CSV |
| M11.2 Governed measures/datasets/workbooks | S021/022 library only; P | planned | — | Authorized field selection, aggregation, pivot/chart output |
| M11.3 Saved reports/schedules | A; P | planned | — | Persist filters/columns; authorized job delivery |
| M11.4 Margin/aging/turnover/supplier/returns reports | A; P | planned | — | Source-ledger reconciliation and consistent access scope |
| M12.1 Original operational sales print | P | implemented | Counter.tsx | Browser/print unverified; not tax invoice compliance |
| M12.2 Attachments/folders/versioning | S023; P | planned | — | Safe uploads, scoped download, version history |
| M12.3 Full print document templates | S017/018; P | planned | — | PHP totals, identity and reprint history |
| M12.4 In-app notifications/preferences | A; P | planned | — | Persist delivery/read state; record links and reminders |
| M12.5 Email/SMS adapters | P | planned | — | Unconfigured until authorized connection and delivery proof |
| M13.1 Authentication/three roles | S025/026; P | tested | auth.ts; users/sessions | auth.test; scrypt, CSRF, expiry, throttling |
| M13.2 Staff lifecycle/reset/revoke | P | tested | auth.ts; Staff.tsx; migration009 | staff.test:6 scenarios including inactive login/session denial, password reset, stale updates, concurrent managers;52 total tests pass; browser pending |
| M13.3 Granular rights/company/location scopes | A; P | planned | — | Direct API/export/job denial; maker/approver separation |
| M13.4 Audit/record history | S010 tabs; A | implemented | audit_events; Audit UI | Actor/action/id/time; structured staff/profile/finance details added; complete record diffs and correlation remain planned |
| M13.5 PHP/Manila settings | P/user | tested | migration006; reports.ts; locale.ts | philippines.test; settings/sale snapshot/date boundaries |
| M13.6 Currency across every existing boundary | P/user | tested | currency.ts; migration007; catalog/opening-import; snapshot.ts | currency-boundaries.test: seven API/CSV/DB/restore regressions including duplicate headers;71 total tests pass |
| M13.7 Company/tax/numbering setup | P/user | blocked | settings | Registered name, VAT/treatment and invoice needs awaiting user; configurable implementation can continue |
| M14.1 Typed custom fields/forms | S029 navigation; P | planned | — | Safe types, validation, permission and layout persistence |
| M14.2 Versioned approval/workflow rules | S042; P | planned | — | Draft/publish/version/rollback, run history, constrained actions |
| M15.1 Catalog/opening import/export | P | tested | catalog/opening-import/reports | Repeat-safe commit and error preview; PHP contract and duplicate-header rejection |
| M15.2 Backup/restore | P | tested | scripts/snapshot.ts | recovery.test and finance.test; stock, posted journals, reversal links, closed periods and corrupt snapshot rollback; schema must match |
| M15.3 Integration registry/scoped API | S027; D; P | planned | — | Real health separate from enabled flag; versioned API/permissions |
| M15.4 Outbox/webhooks/retry/jobs | D; P | planned | — | Signed delivery, idempotency, backoff, failure inspection |
| M15.5 Commerce/portal/payment/delivery adapters | S033/034 menus; P | planned | — | Authorized prices/orders/history; real sandbox/contract verification |

## Active sequence

Execute docs/superpowers/plans/2026-09-28-full-erp-foundations.md first. All later required capabilities remain listed here. Do not replace planned rows with placeholder screens or mark a module complete because a subset passes.

## Evidence and business decisions

The audit comprises42 viewport images, two saved accessibility snapshots, narrative observations and browser-visible asset references. Loading/denied/mislabeled captures are qualified in the private reference map. No NetSuite transaction posting was tested. React/Fastify/PostgreSQL is our chosen implementation, not an inference about Oracle internals.

Questions pending: business identity, VAT status/tax pricing treatment, initial shop/warehouse count; later reviewed costing policy and valued opening/cutoff. No real business data has been imported and no external financial action performed.
