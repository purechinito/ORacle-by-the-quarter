# Independent review and verification

The initial implementation received a separate, read-only whole-branch review. The reviewer found no critical issues, three important correctness issues and one minor audit issue.

Fixed with regression tests observed failing before the fix:

1. Exact alias ownership now has a PostgreSQL unique constraint and synchronization trigger, preventing competing previews or manual edits from claiming the same exact alias. Punctuation-normalized alternatives remain distinct candidates.
2. Receipt, return and adjustment requests preserve the original payload and idempotency key in session storage scoped to the signed-in user and workflow. Reopening an uncertain operation retries that operation; forms prevent edits during recovery and dismissal during a live request.
3. Adding to a saved cart preserves its ID and invalidates displayed totals instead of creating another draft.

The regression suite exercises competing alias commits, lost receipt/return responses with reopen, and resumed-cart editing. Snapshot verification includes stock, users, posted sales, payments and returns.

The previously deferred cancellation reason is now stored on the purchase order and visible in its detail screen.

The reviewer declined to judge visual/browser usability, production readiness and scanner behavior because browser access remained blocked. Those are still open checks. Existing tests were inspected by the reviewer; the author ran the test suite and regression fixes. A second independent read-only review covered the pilot expansion. It identified a delayed scanner response using old cart state, sales history filtering by draft date, and navigation during an in-flight checkout. These were corrected with current-context checks, posting-date filters and a shared navigation lock. The reviewer rechecked the fixes and reported no remaining important findings in that scope. Browser behavior remains unverified.

## Implementation decisions

- A fresh dedicated clone on a feature branch isolates this work; no prior user changes were present. Cost if unsuitable: relocate the checkout before integration.
- Embedded PostgreSQL provides real development/test transactions where Docker/PostgreSQL were absent; production uses DATABASE_URL. Cost: a local binary dependency.
- Small domain modules share an integration suite and transaction helpers. Cost: split modules as their responsibilities grow.
- Related workflow tests were introduced before domain implementation to make shared contracts explicit. Cost: failures in a prerequisite can cascade into later scenarios.
- One stock location uses a balance projection on each part and an immutable ledger. Cost: a per-location balance table is required before multiple locations.
- Consistent application snapshots supplement managed database backups. Cost: matching-schema restoration only, not point-in-time recovery.
- Browser denial was honored, including after conversational authorization did not change the saved setting. Cost: visual and browser workflow verification remains pending.
- The result is a review build with explicit coverage gaps, not a claim of complete production readiness. Cost: those gaps need resolving before live use.

## Pilot expansion verification

32 tests pass across eight files using temporary PostgreSQL databases. New failing-then-passing cases cover purchase draft edits and cancellation reasons, persistent cash tender/change, audited refund confirmation without repeated stock movement, checkout retry after navigation and session expiry, history beyond 100 records with role scoping, substitute validation, discontinued-part returns/corrections, and posted-date history. Type checking, production build and whitespace checks pass.

Import inputs are frozen during validation so the displayed CSV cannot diverge from the accepted preview. Receipt recovery is visible even after the order reaches received status. Browser/UI assertions have not been substituted for real browser testing.
