# Draft command boundary — 2026-09-29

## Scope

The custom backend now exposes `quarter_erp.commands.save_sales_draft` as an authenticated POST endpoint. It creates stock-item sales-order drafts and updates existing drafts through ERPNext's normal document controllers. The current workspace has no custom draft form yet; the endpoint is a prerequisite for that interface, not a claim of a finished creation workflow.

A request supplies a user-generated command key, company/customer/delivery date and item lines. Updates additionally supply the document name and saved `modified` value. Existing line IDs preserve other line fields; new lines receive native defaults. Customer changes, existing header schedule changes and in-place item substitutions are explicitly rejected by this limited command because they require additional recalculation behavior; the full ERP remains available for them. The workspace command accepts up to 200 lines, bounded numeric input, positive quantities and non-negative rates. Native ERPNext remains the arithmetic and posting authority; full source currency/rounding parity is still unverified.

## Transaction and permission design

- Current user, company, customer, items, warehouses, and order permissions are checked on every call.
- Submitted/cancelled orders cannot be edited through this command.
- Updates load the parent and children for update and reject stale versions.
- An internal `Orbit Command` row has a unique hash of actor/company/key. Its payload hash prevents reuse for different changes. The receipt and saved business document commit together.
- Internal receipt SQL does not bypass business-document permissions. Normal users cannot create or edit receipt records through the generic resource API.
- Same-key retries return the original saved document identity/version, and recheck access. Consumers must read the current document before subsequent edits.
- Native validation errors roll back the receipt and draft together. Deadlocks/snapshot conflicts can invalidate savepoints; only the HTTP request boundary retries the complete transaction, at most three attempts, with permissions rechecked. Exhaustion returns a retryable 409; direct internal callers receive the original database conflict.
- The native CSRF session token is available through an authenticated GET endpoint. No administrator secret is embedded in frontend code.

## Evidence and findings

The initial backend tests failed because the command module was absent. After implementation, serial native-controller checks passed. A real two-session HTTP test then exposed MariaDB error 1020 (snapshot conflict) and a secondary missing-savepoint error. Preserving that original conflict and retrying at the request boundary made both simultaneous requests return the same draft/version. This is stronger evidence than serial replay alone; it is not a general load test.

Temporary HTTP test drafts and receipts are deleted after inspection. One unchanged draft left by the original failed harness was inspected against its exact receipt/version/company/customer/quantity before cleanup. No source-account transaction or real payment was touched.

The final image `orbit-erp:8cd2a70c2854b245` passed all 35 current integration checks: 10 runtime/session, 4 business journey, 11 workspace/detail, 8 draft command and 2 real HTTP command checks. Evidence: `.runtime/draft-final-suite.log`. An append-line regression exposed mixed string/date schedule values inside the native controller; canonicalizing header and line dates resolved it while retaining existing individual schedules.

The custom draft UI, submission/approval actions, inventory allocation concurrency, complete multi-company/role coverage and full replacement readiness remain pending. These checks validate the named cases, not all NetSuite behavior or production load.
