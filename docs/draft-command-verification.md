# Draft command boundary — 2026-09-29

## Scope

The custom backend exposes `quarter_erp.commands.save_sales_draft` as an authenticated POST endpoint. It creates sales-order drafts and updates existing drafts through ERPNext's normal document controllers. The Sales workspace now exposes a custom new-order form. Existing-order editing, advanced fields and submission remain in the full ERP.

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

Submission/approval actions, inventory allocation concurrency, complete multi-company/role coverage and full replacement readiness remain pending. These checks validate the named cases, not all NetSuite behavior or production load.

## Custom creation form

`SalesDraft.tsx` provides permitted record-name suggestions, delivery date, add/remove item rows, quantity and rate, explicit save state and native validation messages. Draft totals are read back from the saved ERP record rather than represented as a frontend estimate. A bad item was rejected in Chrome while preserving entries; correcting it saved `SAL-ORD-2026-00002` with three bearing kits at USD 25, total USD 75, expected delivery 2026-11-01. Refresh retained the draft. Adding/removing a second line was exercised. This synthetic draft is intentionally retained as a demo record.

The new lookup regression failed before the endpoint existed, then all 36 current integration checks passed on image `orbit-erp:5c98b9521d4985c2` (`.runtime/draft-form-tests.log`). Customer/item choices use permission-filtered queries; warehouses additionally require the selected company. Searches are literal and bounded to 20 results. The form keeps an in-flight command payload/key in versioned session storage scoped to signed-in user and company. It is removed on success or a definitive initial rejection. A later rejection cannot prove an earlier attempt did not commit, so recovery retains the command. Unsaved inputs before Save are not persisted; tab closure may discard session recovery. No durable offline-draft or complete recovery claim is made.

Final release: `orbit-erp:14b4d62de518fa57` compiled successfully and passed all 36 integration checks again (`.runtime/draft-form-release-tests.log`). Chrome confirmed stable field labels and a 390px viewport with a 390px document width. Captures: `2026-09-29-sales-draft-form.jpg`, `2026-09-29-sales-draft-mobile.jpg`, `2026-09-29-sales-draft-saved.jpg` under `docs/verification`.

Lost-response browser test: scoped interception only to the local draft-save response, observed HTTP 200 after processing, then simulated connection closure before the browser received it. Removed interception immediately. The form locked the submitted entries and offered the identical retry. Reload restored this state from session storage. Retry opened `SAL-ORD-2026-00003`, two units at USD 25, total USD 50. Read-only database verification matched its exact command receipt, found three total demo-company orders (the original order plus the two browser-created drafts), and zero GL or stock-ledger entries for the recovered draft. Capture: `2026-09-29-sales-draft-recovery.jpg`. The viewport was reset and the temporary test tab closed. This verifies this interruption path, not all browser-storage or network failures.
