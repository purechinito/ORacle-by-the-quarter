# Quarter shop walkthrough

This is a local pilot using synthetic parts. Browser verification and shop setup are still required before real trading.

1. Open the local preview at http://127.0.0.1:5173 and sign in with your private generated owner login.
2. In **Settings**, enter the shop name, currency, timezone and confirmed tax treatment/rate. Add individual accounts for counter staff and stock clerks.
3. In **Parts**, search a SKU or barcode. Open a part to maintain its price, bin, aliases, vehicle fitment and verified alternatives. CSV import validates the catalog before saving it.
4. In **Stock movements**, import opening stock separately after a physical count. Each part's opening quantity can be recorded once. Later corrections require a manager's reason.
5. In **Purchasing**, choose/add a supplier, add parts and save a draft. Edit mistakes before submitting. Use Receive stock for each delivery; enter only quantities physically received. View order shows quantities and any cancellation reason.
6. In **Counter sales**, scan/type a part and Enter. Multiple matches require choosing a part. Adjust quantities, choose a customer or Walk-in, then Save draft & calculate. A manager may override a price with a reason. Enter payment received and complete the sale. The receipt shows tender and change.
7. For a return, reopen the original receipt. Enter only returned quantities and whether each part is sellable. Record the reason and whether a refund has already been handled externally. Pending refunds can later be marked recorded with a reference; this does not move stock again or send money.
8. Use the history filters and Previous/Next controls to find older sales, purchases and movements. Managers can inspect the Activity log and open supporting sales from Reports.

## Interrupted connection

Keep the same tab open. If a result is uncertain, use its Retry/Recover action. The original request is preserved even when moving to another page and back. Do not recreate the sale or receipt just because a response was lost. Navigation temporarily pauses while a sale is saving or completing. If the session expires, sign in as the same staff member to recover it.

## Before using your real stock

Use a fresh database without demo records. Confirm currency, tax treatment, number of stock locations, receipt wording and staff roles. Import approved catalog and opening stock, reconcile a sample against shelves, verify scanner and printer behavior, test a complete sale/return, and restore a backup into a separate database. The provided reports are operational totals, not an accounting ledger.
