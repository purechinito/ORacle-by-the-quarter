# Implementation coverage

## Implemented

The catalog, stock, purchasing, counter sale and return workflows described in README are implemented against PostgreSQL. Money uses decimal arithmetic; posted stock changes are transactional and reject negative balances. Stock opening is once per part. The API enforces roles, CSRF, session expiry and login throttling. Search/import tests exercise 5,000 synthetic SKUs.

## Remaining verification and limitations

- Browser preview access was denied by a saved user permission setting even after conversational authorization. Screenshots, keyboard/scanner testing, responsive visual inspection and end-to-end browser tests are **not verified**. Do not treat the frontend build as visual validation.
- This is a single-location, whole-unit release. Currency must have two minor-unit digits. One shop-level tax rate is supported; legal/tax invoice compliance is not certified.
- Inventory is a ledger with a single-location balance on each part. Reservations, multi-location transfers, costing/valuation and profit reports are deferred.
- Substitute IDs are supported by the catalog API; a dedicated substitute management UI still needs refinement.
- Manager price overrides exist in the API with required reason; the counter screen uses catalog prices. A dedicated override UI is not yet exposed.
- Purchase drafts can be created/submitted/cancelled, but an in-place draft editor is not implemented. Cancel and recreate an incorrect draft.
- Movement list pagination is implemented; advanced date/part filters, saved views and a UI for audit records are not complete.
- Sales/order/history lists currently return the most recent 100 records. Long-term historical browsing needs pagination before sustained business use.
- Reports show gross posted sales and recorded payments, current stock and low stock, outstanding order count and return count. They are not net revenue or accounting statements. The report's supporting sales show only the most recent 25 within the selected date range.
- Currency/tax settings snapshot onto posted sales. Currency changes are rejected after the first posted sale; a multi-currency migration remains outside this release.
- Login throttling is in-process; a multi-instance production deployment requires a shared limiter or gateway policy.
- Application snapshots are tested for this schema version, not a replacement for managed PostgreSQL point-in-time recovery. Restore requires an empty database with matching migrations. Sessions and uncommitted import previews are excluded.
- No production deployment, real catalog import, payment execution or production cutover was performed.

These gaps are explicit review/pilot blockers where relevant. The application is an initial build, not a claim that every item in the plan is complete.
