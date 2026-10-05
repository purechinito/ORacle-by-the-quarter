# Pilot coverage and subsequent additions

The current full-scope status is in [FULL-ERP-COVERAGE.md](FULL-ERP-COVERAGE.md). New foundations add party profiles/search, staff lifecycle, broad PHP validation and a separate manual ledger; they do not complete the remaining ERP modules.

## Implemented

The catalog, stock, purchasing, counter sale and return workflows described in README are implemented against PostgreSQL. Purchase cancellation reasons, cash tender/change and subsequent external-refund confirmation are retained. Discontinued parts remain returnable and count-adjustable while new sales/receipts are blocked. Money uses decimal arithmetic; posted stock changes are transactional and reject negative balances. Stock opening is once per part. The API enforces roles, CSRF, session expiry and login throttling. Search/import tests exercise 5,000 synthetic SKUs.

## Remaining verification and limitations

- 2026-09-29: the pilot loop was verified in headless Chromium at 1280×720 (`tests/e2e/pilot-loop.spec.ts`: setup, staff, two-delivery receipt, scanner-style entry, cash change, last-unit race, restockable/damaged returns, direct API denial). Three UI/API defects found there were fixed; see [IMPLEMENTATION-READINESS.md](IMPLEMENTATION-READINESS.md). Physical scanners, printers, phones/tablets and screen readers are still **not verified**.
- This is a single-location, whole-unit release. Currency is PHP only; monetary displays use ₱ with two decimal places. Dates and daily filters use Asia/Manila. One shop-level tax rate is supported; legal/tax invoice compliance is not certified.
- Inventory is a ledger with a single-location balance on each part. Reservations, multi-location transfers, costing/valuation and profit reports are deferred.
- Substitute links, manager price overrides, purchase draft editing, date/search/status filters, activity-log browsing and paginated sales/order/movement/report history are now exposed in the UI. Visual and keyboard behavior still need browser verification.
- Managers see business-wide gross posted sales/payment/return totals; counter staff see only their own sales and linked records. Stock staff receive inventory/receiving figures without sales amounts or references. Reports read one consistent database snapshot. Today’s dashboard uses Philippine dates and preserves that range when opening Reports. Supporting sales are paginated; authorized staff can open their source receipts. These are operational totals, not net revenue or accounting statements.
- Cart edits and uncertain postings survive page changes/reload in the same browser tab, scoped to the signed-in staff member. Do not close the tab or clear browser data during an uncertain posting; consult history before recreating it. Navigation is temporarily locked while a counter save/checkout is actively running.
- Staff accounts have three roles. Managers can create, deactivate/reactivate, change roles, reset passwords and revoke sessions with reasons. Self-service reset and a granular permissions editor remain unimplemented.
- Saved filter presets, multi-currency operation and customer-account credit/receivables are outside this release. Customer and supplier selection now uses server search without a fixed directory ceiling.
- PHP/tax settings snapshot onto posted sales. Other currencies are rejected even before the first sale, including database/restore writes. Upgrading data labelled in another currency stops for an explicit migration; existing amounts are never silently relabelled or converted.
- Login throttling is in-process; a multi-instance production deployment requires a shared limiter or gateway policy.
- Application snapshots include manual finance and are tested for this schema version, not a replacement for managed PostgreSQL point-in-time recovery. Restore requires an empty database with matching migrations. Sessions and uncommitted import previews are excluded.
- No production deployment, real catalog import, payment execution or production cutover was performed.

These gaps are explicit review/pilot blockers where relevant. The application is an initial build, not a claim that every item in the plan is complete.
