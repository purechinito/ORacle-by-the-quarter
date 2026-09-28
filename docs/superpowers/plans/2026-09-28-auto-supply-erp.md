# Auto Supply ERP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Deliver the approved auto-parts ERP in four independently testable milestones, starting with a working catalog and stock ledger.
**Architecture:** One web application with server-enforced business rules and PostgreSQL transactions. Browser components call authenticated APIs; posting services update documents, stock and audit records atomically.
**Tech Stack:** TypeScript, React, Vite, Fastify, PostgreSQL, node-postgres, Zod, decimal.js, Vitest and Playwright. Verify supported versions in official documentation and lock exact resolved dependencies during setup.
**Spec:** ../specs/2026-09-28-auto-supply-erp-design.md — approved by the user on 2026-09-28.
**Execution recommendation:** Native implementation in this session, followed by an independent whole-branch review. Keep each milestone usable; do not represent an unfinished milestone as a live ERP.

## Global constraints
- Tables use server-side search, pagination and filters; never render all 3,000+ products into a picker.
- Negative stock is rejected.
- There are no reservations in the first release: unposted carts do not promise stock.
- Posted documents cannot be silently edited or deleted.
- Use decimal arithmetic, never binary floating point for money.
- No Oracle account records, screenshots, credentials or proprietary assets belong in this public repository.
- Currency, taxes, receipt requirements and real product data must be configured before live use.
- Manufacturing, payroll, full general ledger, tax filing and automated payment collection are outside this first release.

## Review focus
1. Two staff sell or receive simultaneously: stock and outstanding quantities must remain valid (tasks 3–5).
2. Network failure after commit: retry must return the existing result, and changed payload with reused key must fail (tasks 3–5).
3. Similar normalized part numbers and malformed CSV rows: never merge distinct parts or partially import an invalid batch (task 2).
4. Direct API/export access by a lower-privilege user: hidden UI controls must not be the security boundary (tasks 1, 6).
5. Return retries, fractional quantities and decimal totals: reject invalid counts, prevent excessive returns and preserve exact totals (tasks 3, 5).

## Shared structure and interfaces
- apps/api/src/app.ts: buildApp(deps) constructs the HTTP server for tests and runtime.
- apps/api/src/db.ts: withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T>.
- apps/api/src/auth/: session handling and requirePermission(actor, permission): void.
- apps/api/src/modules/{catalog,inventory,purchasing,sales,reports}/: routes, validation, services and queries per domain.
- apps/web/src/features/: matching workflow screens; shared controls under components/.
- packages/contracts/src/: JSON DTOs, IDs as strings, ISO timestamps, money as decimal strings and quantities as integers.
- db/migrations/: ordered SQL migrations; scripts/: migration, seed and backup/restore helpers.
- tests/integration/: real PostgreSQL service/API tests; tests/e2e/: browser workflows.
- All mutations accept Actor { userId: string; role: 'manager'|'counter'|'stock' } from the session, never from request JSON.
- Posted-operation functions receive a database transaction and PostingContext { actor: Actor; idempotencyKey: string }. Keys are scoped to operation and actor, with a canonical payload hash.
- Standard errors: 400 invalid input, 401 no session, 403 permission denied, 404 missing record, 409 state/stock/idempotency conflict. Responses do not disclose stack traces.
- Commands established by task 1: npm run test:unit, npm run test:integration, npm run test:e2e, npm run typecheck, npm run build. Integration tests use a dedicated disposable database, never production.

## Milestone 1 — usable catalog and stock foundation

### Task 1: Authenticated application foundation
**Files:** package.json; package-lock.json; compose.yaml; .env.example; .gitignore; apps/api/src/{app,db,server}.ts; apps/api/src/auth/{routes,service,permissions}.ts; apps/web/src/{App,main}.tsx; apps/web/src/styles.css; db/migrations/001-foundation.sql; tests/integration/auth.test.ts.
**Produces:** authenticated Actor; withTransaction; permission guard; original navigation shell.
- [ ] Write tests for login/logout, expired session, login throttling, CSRF rejection, manager-only user creation and direct unauthorized API access.
- [ ] Run integration tests and confirm failures are missing behavior, not broken test infrastructure.
- [ ] Create the application workspace, migrations and local database service. Implement password hashing with scrypt, random database-backed sessions, HttpOnly/SameSite cookies, production Secure cookies and CSRF tokens. Bootstrap the first manager through an interactive local command with no default password.
- [ ] Implement the shell with Overview, Parts, Counter sales, Purchasing, Stock movements, Reports and Settings. Unimplemented sections clearly state unavailable rather than inventing data.
- [ ] Run tests, typecheck and production build; verify a login and logout in the browser. Commit the passing foundation.

### Task 2: Catalog, fitment and validated CSV import
**Files:** db/migrations/002-catalog.sql; apps/api/src/modules/catalog/{routes,schemas,service,import}.ts; apps/web/src/features/catalog/{PartsPage,PartForm,ImportPage}.tsx; tests/integration/catalog.test.ts; tests/e2e/catalog.spec.ts.
**Consumes:** Actor, permission guard, withTransaction.
**Produces:** searchParts({ query, cursor, limit, category, make, model, year }): Promise<PartPage>; savePart(actor, input): Promise<Part>; previewImport(actor, csv): Promise<ImportPreview>; commitImport(actor, previewId): Promise<ImportResult>.
- [ ] Write tests for unique SKU, exact barcode/OEM search, normalized collisions returning separate candidates, valid year ranges, inactive parts, explicit substitutes and fitment without inferred compatibility.
- [ ] Add import tests for quoted/newline cells, malformed rows, duplicate SKU, alias conflicts, unsafe numeric values and repeated commit. Invalid batches must not change catalog rows; import must not touch stock.
- [ ] Confirm tests fail, then implement schema, indexed queries, server pagination (default 25, maximum 100), CRUD and immutable server-held import previews with expiry and content hash.
- [ ] Build search, part detail/editor, fitment/substitutes and import preview screens. Cost fields are excluded from unauthorized responses.
- [ ] Seed 5,000 explicitly synthetic parts in a dedicated test database; verify exact match retrieval and bounded responses. Run tests and browser keyboard/scanner checks, then commit.

### Task 3: Stock ledger and opening balances
**Files:** db/migrations/003-stock.sql; apps/api/src/modules/inventory/{routes,schemas,posting,queries}.ts; apps/web/src/features/inventory/{MovementsPage,AdjustmentForm,OpeningStockPage}.tsx; tests/integration/inventory.test.ts.
**Produces:** postMovementBatch(tx, context, input): Promise<PostingResult>; readBalance(partId, locationId): Promise<number>. Internal posting services call this function; no generic unprivileged posting endpoint.
- [ ] Write tests for whole positive receipt quantities, signed manager adjustments with reason, zero/negative/unsafe quantities, permission denial and immutable posted rows.
- [ ] Add concurrency tests for two deductions of the last unit, atomic multi-line rollback, identical retry and changed-payload key conflict. Duplicate part lines are aggregated before availability checks.
- [ ] Confirm failures; implement ledger and balance tables, database constraints, deterministic stock-row locking, idempotency and audit records in one transaction.
- [ ] Build movement filtering, manager adjustment and preview-first opening-stock import. Opening batch identity prevents duplicate import even under retries.
- [ ] Reconcile ledger sums to balances after every integration scenario; restart services and verify persistence. Run tests and commit milestone 1.

## Milestone 2 — purchasing and receiving

### Task 4: Suppliers, purchase orders and partial receipts
**Files:** db/migrations/004-purchasing.sql; apps/api/src/modules/purchasing/{routes,schemas,service}.ts; apps/web/src/features/purchasing/{PurchaseOrdersPage,PurchaseOrderForm,ReceiveForm}.tsx; tests/integration/purchasing.test.ts; tests/e2e/purchasing.spec.ts.
**Consumes:** task 3 posting service.
**Produces:** savePurchaseOrder(actor,input): Promise<PurchaseOrder>; submitPurchaseOrder(actor,id): Promise<PurchaseOrder>; receivePurchaseOrder(context,id,lines): Promise<Receipt>; cancelOutstanding(actor,id,reason): Promise<PurchaseOrder>.
- [ ] Test draft/submitted/partially-received/received/cancelled transitions, required supplier, partial receipt, over-receipt, repeated receipt and concurrent receipt attempts.
- [ ] Confirm failures, then implement supplier maintenance and state transitions. Lock PO lines before checking remaining quantities; receipt, stock and state changes share one transaction.
- [ ] Define permissions: manager creates/submits/cancels orders and views costs; stock clerk receives quantities and sees a cost-redacted receiving view.
- [ ] Build draft order and receiving screens with retained input after conflicts. Cancellation preserves prior receipts.
- [ ] Run API and browser tests: order 10, receive 4, receive 6, confirm balance 10 and reject another receipt. Commit milestone 2.

## Milestone 3 — counter sales and returns

### Task 5: Sales, manual payment records and linked returns
**Files:** db/migrations/005-sales.sql; apps/api/src/modules/sales/{routes,schemas,service,money}.ts; apps/web/src/features/sales/{CounterPage,SaleDetail,ReturnForm,Receipt}.tsx; tests/integration/sales.test.ts; tests/e2e/counter.spec.ts.
**Produces:** saveCart(actor,input): Promise<Cart>; postSale(context,cartId,payment): Promise<Sale>; postReturn(context,saleId,lines,refundStatus): Promise<ReturnRecord>.
- [ ] Test persistent draft carts, walk-in/customer sales, required configured currency/tax mode, exact decimal totals, underpayment rejection and manager-only price overrides with reasons.
- [ ] Test last-unit concurrent sales, stale carts, inactive parts, duplicate lines, retry after committed response loss and total rollback if any line cannot post.
- [ ] Test cumulative return limits under concurrency, repeated returns, damaged/restockable disposition and independent refund status. No refund service is invoked.
- [ ] Confirm failures; implement decimal string parsing and decimal.js calculations. Configure inclusive/exclusive/no-tax modes, explicit rate and line-level rounding; snapshot values on sale lines. Restrict this release to configured currencies with two minor-unit digits and explain that limit in settings.
- [ ] Implement transactional sale/payment/stock posting and linked returns. Preserve draft carts on failed posting. Render printable operational receipts with configured shop identity and no unsupported tax-compliance claim.
- [ ] Build counter search/cart/payment workflow with barcode Enter support, visible stock and keyboard focus recovery. Run tests and commit milestone 3.

## Milestone 4 — reports, operations and pilot

### Task 6: Reconciled dashboards, settings and exports
**Files:** apps/api/src/modules/reports/{routes,queries,export}.ts; apps/api/src/modules/settings/{routes,service}.ts; apps/web/src/features/{overview/OverviewPage,reports/ReportsPage,settings/SettingsPage}.tsx; tests/integration/reports.test.ts.
**Produces:** readReport(actor,report,filters): Promise<ReportPage>; exportReport(actor,report,filters): Promise<string>.
- [ ] Test daily sales/payment totals, stock/low-stock, outstanding purchases, movements and returns against known posted records; drafts must not affect totals.
- [ ] Test permissions for every report and export, date boundaries, currency context and spreadsheet formula prefixes in exported text.
- [ ] Confirm failures; implement parameterized queries, date/location filters, source-document links and safe CSV serialization. Date ranges use the configured business timezone and half-open intervals.
- [ ] Build Overview queues, report filters and settings for currency, timezone, tax treatment and shop receipt details. Preserve historic transaction snapshots when defaults change.
- [ ] Run tests and commit. Exclude profit/margin reporting until costing is separately specified.

### Task 7: Restore proof, release verification and pilot instructions
**Files:** scripts/{backup,restore,seed-demo}.ts; docs/{RUNBOOK,PILOT,COVERAGE}.md; .github/workflows/ci.yml; tests/e2e/shop-loop.spec.ts; README.md.
**Produces:** documented local setup, repeatable synthetic demo and reviewed release branch.
- [ ] Test the complete browser loop: import parts, opening stock, order/partial receipt, counter sale, return and report reconciliation, using all three roles.
- [ ] Implement backup/restore commands with explicit destination validation. Restore to a separate disposable database and assert balances, document counts and totals match the source snapshot.
- [ ] Run typecheck, unit/integration/browser tests and build in CI with a service database. Record actual results and known limits; never mark skipped checks as passed.
- [ ] Check keyboard usability, narrow-screen layout, error recovery, no default credentials, no Oracle assets/data and no secrets in tracked files.
- [ ] Write setup and pilot instructions. Require live currency/tax/receipt/process validation and approved data import before real sales.
- [ ] Obtain independent whole-branch review; resolve findings, rerun affected checks, push a review branch and create a draft PR. Attach the PR to this chat. Deployment and production data migration are separate explicit actions.

## Coverage and completion
Tasks 1–3 deliver catalog, roles, fitment, imports, opening stock, adjustments and audit. Task 4 delivers purchasing; task 5 sales/payments/returns; task 6 reports/settings/exports; task 7 restoration, end-to-end proof and operating instructions.
Deferred modules stay deferred as stated in the approved spec. A passing build alone is not a usable ERP: the transaction and recovery checks above must also pass.
