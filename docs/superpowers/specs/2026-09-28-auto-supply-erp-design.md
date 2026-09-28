# Auto Supply ERP — first release design
Date: 2026-09-28
Status: Proposed design for review; no operational application has been implemented yet.

## Purpose
Build an original ERP for an auto supply business with more than 3,000 small-parts SKUs. Help counter staff find the correct part, see reliable stock, complete a sale, receive purchases and trace stock changes. Repository: purechinito/ORacle-by-the-quarter.

Confirmed: business type, 3,000+ SKUs, and repository.
Assumptions for the first release: one business, one stock location with shelf/bin labels, multiple staff, whole-unit sales, online shared database, and manual payment recording. Currency, taxes, receipt requirements and real product data must be configured before live use. No jurisdiction is inferred from the operator's location.

## Approach
Recommended: one modular web application and PostgreSQL database. Modules share transaction boundaries but keep catalog, purchasing, sales and access logic separate.
Alternative: browser-only local storage is quick for a demonstration but unsuitable as the shared shop record.
Alternative: a large distributed ERP adds operational complexity before the core shop workflows are proven.

## Release sequence
1. Catalog, access control and stock ledger, with tested opening-stock import.
2. Purchasing and partial receipts.
3. Counter sales, payment records and linked returns.
4. Operational reports, export, backup/restore and supervised pilot.
Later: reservations, credit accounts/receivables, multi-branch transfers, supplier invoices/payables, ecommerce and accounting integration.
Manufacturing, payroll, full general ledger, tax filing and automated payment collection are outside this first release.

## Daily navigation and interface
Overview / Parts / Counter sales / Purchasing / Stock movements / Reports / Settings.
Use an original industrial visual style: charcoal navigation, warm neutral surfaces, restrained orange action accent, compact readable tables and prominent stock status.
The counter screen prioritizes barcode or part-number search, stock and selling price, then cart and payment summary. Support keyboard operation and barcode scanners that type text and Enter.
Tables use server-side search, pagination and filters; never render all 3,000+ products into a picker.
Provide explicit empty/error/loading states, inline validation, visible saving status and preserved drafts after failure.

## Catalog and fitment
Each part has a stable internal ID, unique SKU, description, brand, category, stock unit, default selling price, reorder point, bin label and active status.
Separate many-to-one aliases store barcode, OEM number, manufacturer part number and supplier number. Preserve original spelling; also index a normalized search key. Do not treat punctuation-stripped collisions as identical parts.
A part may have multiple fitment entries: make, model, year range, engine/variant and notes. Fitment is manually entered or legitimately imported, never guessed from a similar part.
Cross-reference/substitute relationships are suggestions; a user confirms compatibility.
Retiring a part preserves transaction history.

## Stock rules
One immutable movement ledger records opening stock, receipts, sales, returns and adjustments. Every movement links part, location, quantity, actor, timestamp, reason and originating document.
Stock on hand is the sum of posted movements. A balance projection updates in the same database transaction.
Negative stock is rejected. Concurrent sales lock affected stock rows in deterministic order and recheck availability before commit.
There are no reservations in the first release: unposted carts do not promise stock.
Posted documents cannot be silently edited or deleted. Correct errors with authorized, linked reversals.
Duplicate posting requests return the previous result using a unique idempotency key and validated request fingerprint.
Adjustments require manager authority and a reason. Initial stock is imported through an explicit opening-stock transaction, never by changing a balance field.

## Purchasing
Create supplier and draft purchase order; add parts, quantities and expected unit costs; submit the order.
Receive any positive whole quantity up to the remaining ordered amount. Over-receipt is blocked for this release.
A receipt atomically posts stock and advances the order to partially received or received. Repeated submission cannot receive twice.
Cancellation only closes outstanding quantities; previous receipts remain in history.
Supplier invoices and outgoing payments are later modules, not implied by a received PO.

## Counter sales and returns
Search parts, add quantities, select customer or walk-in, and review totals. Draft carts persist.
Prices are copied onto sale lines; authorized overrides require a recorded reason. Use decimal arithmetic, never binary floating point for money.
Posting requires a configured currency and tax treatment, sufficient stock and recorded payment covering the total. Payment methods are cash or manually recorded external payment; no card processing or card details are stored.
Posting sale, payment record and stock deduction is atomic. Generate a printable operational receipt; do not label it a compliant tax invoice without jurisdiction-specific validation.
Returns reference original sale lines. Cumulative returned quantity cannot exceed sold quantity. Staff select restockable or damaged; only restockable units increase sellable stock.
Returns record refund status separately. Recording a refund does not execute a bank or card refund.

## Roles and audit
Owner/manager: configuration, users, cost visibility, adjustments, returns and price overrides.
Counter staff: catalog lookup, draft/post sales, customer maintenance; no costs, adjustments or user administration.
Stock clerk: catalog lookup, purchase receipts and movement lookup; no sales overrides or user administration.
Enforce permissions and data access on every server request, including exports and direct URLs.
Use individual accounts, hashed passwords or a managed identity provider, secure sessions, CSRF protection, login throttling and no default shared credentials.
Audit posted actions and sensitive changes with actor, action, timestamp and record reference. Never log passwords, cookies or payment credentials.

## Data boundaries
Core tables: users/roles, settings, parts, part_aliases, fitments, substitutes, suppliers, customers, locations/bins, purchase_orders/lines, receipts/lines, sales/lines, payments, returns/lines, stock_movements, stock_balances, audit_events, idempotency_records.
Foreign keys and unique constraints preserve references. Persist quantities as whole units for release one and money/cost as explicit decimal precision with currency.
Document states and permitted transitions are centralized server rules, not free-text edits.

## Import and export
CSV import is a preview-first workflow: map headers, validate required fields, detect duplicate SKUs and alias conflicts, show row errors, then explicitly commit a validated batch.
Catalog import does not overwrite stock. Opening-stock import is separate and cannot be accidentally rerun.
Export only role-authorized fields and neutralize spreadsheet formula prefixes in text cells.
Sample records are visibly synthetic. No Oracle account records, screenshots, credentials or proprietary assets belong in this public repository.

## Reports
Daily sales and payment totals; stock on hand; low-stock parts; purchases outstanding; movements by part/date; returns.
Every total links to supporting posted documents and displays currency, date range and location.
Cost and margin reports are deferred until inventory costing policy is selected and validated. Do not call sales revenue profit.

## Architecture and deployment
Proposed implementation: TypeScript web frontend and server API, PostgreSQL migrations, and a containerized development environment.
Keep business posting services independent of page rendering. Validate inputs on the server and use database transactions for every posting.
Use indexed SKU, normalized aliases, descriptions and fitment columns; measure search against at least 5,000 synthetic parts.
Secrets are supplied through environment configuration, never committed. Database access is private to the server. Production requires HTTPS.
Backups run independently of the app; test restoration into a separate database before pilot use.

## Verification and acceptance
- Import at least 5,000 synthetic SKUs, report invalid rows, and retrieve exact SKU/barcode matches without downloading the full catalog.
- Partial receipts increase stock exactly once and cannot exceed outstanding quantities.
- Selling the last unit concurrently allows only one sale; losing requests retain an actionable cart.
- Retry a posted sale or receipt and get the same document with no duplicate movements.
- Return quantities cannot exceed the original sale; damaged returns do not increase sellable stock.
- Counter staff cannot access costs or post adjustments through either UI or direct API calls.
- Money totals use decimal arithmetic and reconcile to lines and payment records.
- Restart the application and verify persistence; restore a backup and reconcile stock and document totals.
- Check keyboard navigation, scanner input, readable labels, empty states and error recovery.
- Pilot with synthetic data first, then approved catalog/opening-stock data. The shop owner validates currency, tax treatment, receipt wording and operational process before live use.

## Decisions required before live operation
Currency and jurisdiction; tax-inclusive versus exclusive pricing; actual sales/returns rules; fractional/pack-unit needs; number of locations and concurrent staff; approved hosting and backup retention; fitment/catalog data source.
These remain explicit launch decisions, not silently invented settings.

## Confirmed localization amendment — 28 September 2026

The user explicitly selected Philippine pesos only and Philippine context. PHP and Asia/Manila supersede the earlier selectable currency/timezone assumption. Currency enforcement covers settings, posted sales and restored data; no automatic conversion or relabelling of incompatible historical amounts. VAT treatment remains a separate explicit shop decision.
