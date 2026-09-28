# Implementation coverage

## Implemented

The catalog, stock, purchasing, counter sale and return workflows described in README are implemented against PostgreSQL. Purchase cancellation reasons, cash tender/change and subsequent external-refund confirmation are retained. Discontinued parts remain returnable and count-adjustable while new sales/receipts are blocked. Money uses decimal arithmetic; posted stock changes are transactional and reject negative balances. Stock opening is once per part. The API enforces roles, CSRF, session expiry and login throttling. Search/import tests exercise 5,000 synthetic SKUs.

## Remaining verification and limitations

- Browser preview access was denied by a saved user permission setting even after conversational authorization. Screenshots, keyboard/scanner testing, responsive visual inspection and end-to-end browser tests are **not verified**. Do not treat the frontend build as visual validation.
- This is a single-location, whole-unit release. Currency is PHP only; monetary displays use ₱ with two decimal places. Dates and daily filters use Asia/Manila. One shop-level tax rate is supported; legal/tax invoice compliance is not certified.
- Inventory is a ledger with a single-location balance on each part. Reservations, multi-location transfers, costing/valuation and profit reports are deferred.
- Substitute links, manager price overrides, purchase draft editing, date/search/status filters, activity-log browsing and paginated sales/order/movement/report history are now exposed in the UI. Visual and keyboard behavior still need browser verification.
- Reports show gross posted sales and recorded payments, current stock and low stock, outstanding order count and return count. They are not net revenue or accounting statements. Supporting sales are paginated; managers can reopen a receipt from the report.
- Cart edits and uncertain postings survive page changes/reload in the same browser tab, scoped to the signed-in staff member. Do not close the tab or clear browser data during an uncertain posting; consult history before recreating it. Navigation is temporarily locked while a counter save/checkout is actively running.
- Staff accounts can be created with one of three roles. Self-service password resets, staff deactivation controls and a granular permissions editor are not included in this pilot.
- Saved filter presets, multi-currency operation and customer-account credit/receivables are outside this release. Customer selection currently loads up to 500 names.
- PHP/tax settings snapshot onto posted sales. Other currencies are rejected even before the first sale, including database/restore writes. Upgrading data labelled in another currency stops for an explicit migration; existing amounts are never silently relabelled or converted.
- Login throttling is in-process; a multi-instance production deployment requires a shared limiter or gateway policy.
- Application snapshots are tested for this schema version, not a replacement for managed PostgreSQL point-in-time recovery. Restore requires an empty database with matching migrations. Sessions and uncommitted import previews are excluded.
- No production deployment, real catalog import, payment execution or production cutover was performed.

These gaps are explicit review/pilot blockers where relevant. The application is an initial build, not a claim that every item in the plan is complete.
