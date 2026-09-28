# Full ERP foundations implementation plan

> **For agentic workers:** Use superpowers:executing-plans. The user supplied the full specification and explicitly requested implementation in the existing repository; native execution is already selected.

**Goal:** Extend the existing Philippine auto-supply application toward the full M01–M15 ERP scope, starting with money integrity, relationship records, staff lifecycle and a sound ledger.

**Architecture:** Preserve the React/Fastify/PostgreSQL modular monolith. Add small domain modules and forward-only migrations. Existing operational flows remain available while new financial functionality states its exact coverage.

**Tech Stack:** TypeScript, React, Fastify, PostgreSQL, Zod, decimal.js, Vitest.

**Spec:** User-supplied “Build the full Philippine auto-supply ERP”; private master prompt and ERP-REFERENCE-MAP.md in the workspace outputs/auto-supply-erp directory. Public scope tracking: docs/FULL-ERP-COVERAGE.md.

## Global constraints

- PHP/₱ only; Asia/Manila business dates. Reject explicit foreign labels without conversion.
- Preserve existing data and features. No Oracle source/assets, private audit data or credentials in Git.
- Real business identity and VAT treatment remain unanswered; no compliance claim.
- Native execution: root implements; independent agents supply read-only evidence and final review.
- Reuse clean feat/auto-supply-erp checkout; no new checkout or branch is necessary.
- Browser verification uses only permitted tools. A saved preview denial remains a verification limitation until resolved.

## Review focus

- Foreign-currency fields that schemas discard, including nested lines, CSV headers and backup records.
- Customer/supplier selection beyond the first page, inactive records and stale edits.
- Lost-response retries, concurrent account administration, and accidental loss of the last manager.
- Unbalanced journals, edits after posting, period-close races and repeat reversal.
- Snapshot ordering, deferred integrity checks and financial ledger restoration.

## Task 1 — Establish full-scope coverage and close currency gaps

Files: docs/FULL-ERP-COVERAGE.md; tests/integration/currency-boundaries.test.ts; apps/api/src/currency.ts; apps/api/src/app.ts; modules/catalog.ts; modules/opening-import.ts; db/migrations/007-peso-boundaries.sql; scripts/snapshot.ts.

Interface: assertPesoCurrency(value: unknown): void validates explicit currency labels at a boundary before Zod strips unknown data. Existing JSON/API response shapes remain compatible. Monetary database records gain currency='PHP' constraints.

- [x] Write boundary tests: catalog and nested purchase/cart payloads with USD reject; PHP persists; CSV preview records foreign rows as errors and commit refuses; foreign snapshot stops before writes; direct DB currency update fails.
- [x] Run new tests and observe expected failures; implement boundary validator, CSV validation and migration.
- [x] Run full tests, typecheck and build. Record evidence and commit.

## Task 2 — Relationship records and complete lookup

Files: db/migrations/008-relationships.sql; apps/api/src/modules/relationships.ts; sales.ts; purchasing.ts; app.ts; apps/web/src/features/Relationships.tsx; apps/web/src/PartyPicker.tsx; Counter.tsx; Purchasing.tsx; App.tsx; tests/integration/relationships.test.ts.

Interfaces: GET /api/parties/:kind returns {items,total,page,limit}, kind customers|suppliers; POST /api/parties/:kind and PUT /api/parties/:kind/:id provide audited profile maintenance and version checks; GET /api/parties/:kind/:id returns profile plus paginated operational history. Existing /customers and /suppliers routes remain compatible and gain search/paging. PartyPicker resolves selected ID independently from its current search page.

- [x] Test finding a customer after record 500; creating/updating Philippine addresses and terms; rejecting stale version; role restrictions; inactive-party rejection at new order/cart and posting boundaries; history authorization.
- [x] Run failures, implement migration/API and original list/form screens informed by private captures039/040.
- [x] Switch counter and purchase forms to server search; preserve draft selections across lookup and reload.
- [x] Run tests/typecheck/build; record evidence and commit.

## Task 3 — Staff lifecycle

Files: db/migrations/009-staff-lifecycle.sql; apps/api/src/auth.ts; apps/web/src/features/Staff.tsx; Operations.tsx; App.tsx; tests/integration/staff.test.ts.

Interfaces: PUT /api/users/:id updates role/active state under an administration lock; POST /api/users/:id/password sets a manager-provided password and revokes sessions; POST /api/users/:id/revoke-sessions invalidates all sessions. Secrets never enter audit or returned profiles.

- [x] Test deactivation invalidates login and sessions, role change invalidates prior sessions, last-manager/self-lockout rules survive concurrent requests, managers alone can reset password, previous password stops working, no credentials exposed.
- [x] Run failures, implement transactional API and staff screen with consequential-action confirmation and reasons.
- [x] Run suite/typecheck/build; record evidence and commit.

## Task 4 — Manual accounting foundation

Files: db/migrations/010-finance.sql; apps/api/src/modules/finance.ts; apps/api/src/modules/ledger.ts; app.ts; scripts/snapshot.ts; apps/web/src/features/Finance.tsx; App.tsx; tests/integration/finance.test.ts.

Interfaces: chart accounts, fiscal periods, draft journals/lines, post/reverse actions, ledger/trial balance/statement reads. Posting uses one transaction with shared period lock; close/reopen uses exclusive lock. All records PHP; existing pilot operational documents are not automatically backfilled from invented costs.

- [x] Test balanced post, unbalanced/zero/invalid-account rejection, repeat-safe posting, locked periods, linked single reversal, denied roles, posted immutability, trial balance and statement amounts, snapshot restoration.
- [x] Run failures, implement constrained schema and routes; build working ledger forms and reports.
- [x] Test close/post races and direct DB invariant violations. Run full suite/typecheck/build.
- [x] Record remaining operational posting/costing work explicitly; review and commit.

## Subsequent dependent slices (remain required)

Multi-location quantity/valuation ledgers and reservations → linked order/fulfillment/invoice/AR and PO/receipt/bill/AP with integrated accounting → cash/bank reconciliation and period-close controls → BOM/work orders → CRM/activities/cases/projects/expenses → documents/notifications → governed reporting/configuration/workflows → integrations/commerce. Each gets its concrete plan and acceptance tests before implementation; FULL-ERP-COVERAGE.md remains authoritative for unimplemented scope.

## Verification and handover

Run meaningful database tests, typecheck and build. Request one independent code review after the planned foundation tasks. Preserve blocked browser acceptance honestly; do not use alternate browser mechanisms. Update operating instructions and coverage with actual test evidence, not anticipated results. Do not call the full ERP complete while required rows remain planned or blocked.

Foundation verification: 71 tests passed, typecheck/build passed. One independent source review completed; its four findings were corrected with regression checks. Browser acceptance remains blocked by the saved preference, and the full M01–M15 scope remains incomplete.
