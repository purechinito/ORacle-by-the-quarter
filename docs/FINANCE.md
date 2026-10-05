# Finance foundation

Finance is available to managers. It is a working manual general ledger in Philippine pesos, not a completed accounting suite. Sales, purchasing and inventory do not automatically post here. Existing quantity-only stock and past operational documents have not been assigned invented values or opening balances.

## Using the ledger

1. Open Finance → Chart of accounts. Add the reviewed codes, names and classifications used by the business. There are no assumed balances or seeded business accounts.
2. Add non-overlapping accounting periods using Philippine business dates.
3. Create a journal with at least two lines. Each line has a positive debit or credit, never both. Save the draft; drafts may be unbalanced while being prepared.
4. Review and post. Debits and credits must balance exactly, all accounts must be active and the date must lie within an open period. Posted headers and lines are immutable at database level.
5. Corrections use a separate linked reversal in an open period, dated on or after the original. The original remains in the books. A journal can have only one reversal.
6. Trial balance shows opening balances, movements during the selected dates and closing balances. Select an account to inspect its posted ledger lines.
7. Close a period after review. Reopening requires a reason and is audited. Close/post operations lock the same period so a pending posting cannot slip behind a close.

Journal saves with an explicit retry key, postings and reversals reuse the recorded result after a lost response. The interface retains uncertain requests in the same browser tab. Close an obstructing editor if necessary and use Recover previous action before attempting another journal. Recovery displays the retained action, date and reason/memo. An uncertain reversal freezes its original inputs; close the window and recover it from Finance. Check the journal reference returned by recovery.

## Recovery

Snapshots include accounts, periods, journals, lines, reversal links and audit history. Restore requires an empty database and the exact migration set. It restores dates as date-only values; reconstructs drafts/lines and posted states using ordinary integrity triggers; then restores closed-period and inactive-account states in the same transaction. Malformed or unbalanced posted entries roll back the whole restore. Deferred database checks also require each reversal to target a posted original, use an allowed date, and exactly swap its account amounts. Reversal drafts, chains, changed amounts and changed accounts are rejected even when independently balanced. No API-controlled trigger bypass is used. Sessions are excluded.

## Verified scope

Integration tests exercise account/period setup, overlap/invalid dates, balanced posting and idempotent retry, direct SQL immutability, invalid lines/unbalanced posting, manager-only access, period close/reopen and a deliberately blocked close/post race, date-only reversal boundaries, concurrent duplicate reversal, opening/movement/closing trial balance and atomic financial restore including corrupted snapshots. Browser acceptance remains separately blocked by the saved preview permission.

## Remaining full ERP requirements

Automatic operational GL posting; agreed costing policy and a reviewed accounting/valued-stock cutoff; AR/AP and allocations; received-but-unbilled treatment; tax profiles; complete income statement/balance sheet/cash flow reports; cash/bank reconciliation; budgets/assets; granular finance permissions; multiple company books and consolidation. These remain tracked in FULL-ERP-COVERAGE.md. A balanced trial balance alone does not establish complete business books or Philippine compliance.
