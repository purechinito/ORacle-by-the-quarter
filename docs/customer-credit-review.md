# Customer credit review for a two-person team

One person prepares and saves the sales order. The reviewer opens that saved order, checks the customer credit summary and invoice breakdown, then uses the existing ERP submit or workflow action. The workspace's **Review order & credit** button opens the detailed review; native Sales Orders show the summary beside their existing controls.

The review contains:

- Unpaid posted invoices and their remaining balances after payments.
- The overdue portion, including payment instalments whose final invoice due date is still in the future.
- Available credit balances, such as unallocated customer payments.
- The effective native credit limit, with a clear warning when none is configured.
- The posted customer ledger balance, other submitted unbilled orders, standalone unbilled deliveries, and this order's contribution.
- Projected exposure and remaining credit, with warnings for overdue amounts, exceeded limits, disabled/frozen customers and configured credit-check bypasses.
- Invoice links and the identity of the account that prepared the order.

All summary amounts use the selected company's booked currency. The five legal companies remain separate. Foreign invoice totals retain their original currency in the invoice breakdown alongside the booked company amount. Credits are already included in the posted balance; they are not deducted twice. A submitted order contributes only its unbilled portion and is not counted again under other orders. Other draft orders do not reserve credit.

Refresh immediately before deciding. The panel shows when it was checked and uses the saved order. Changes to an unsaved native form require saving and refreshing the review. The read endpoint does not submit, approve, change credit limits or post accounting entries. Native submission and workflow rules remain authoritative, including their configured credit-controller behavior.

## Accounts and approval policy

No user accounts or role assignments are changed by this feature. The preparer and the reviewer's exact accounts are still needed to configure a two-person assignment. Separation between preparer and approver is not newly enforced by this panel. The policy on whether overdue/over-limit orders may receive an exception with a recorded reason is also pending; no new exception or override mechanism has been enabled.

The reviewer needs complete read access to customer accounting for the selected company, including invoices, their source documents, ledger entries, orders and deliveries. Role, company, field and child-field restrictions are checked. Company-only user restrictions are supported. More selective record restrictions or incomplete query results cause the review to refuse to display a supposedly complete total. Existing roles are additive: evaluate effective access before assigning roles; the broader native roles used in integration fixtures are not a recommended least-privilege assignment.

This page does not invent a customer balance when records or permissions are missing. Each source query is capped at 20,000 rows; customers beyond that interactive limit must use full accounting reports. The invoice display initially shows 20 rows and can reveal the remaining rows.

## Verification

`tests/test_credit_review.py` exercises actual native posted invoices, partial and excess payments, overdue instalments, cancelled invoices, booked foreign-currency amounts, submitted-order counting, missing limits, company restrictions and both parent/child accounting field restrictions. Fixtures roll back. `tests/test_credit_http.py` checks authenticated read-only operation and guest denial through real HTTP sessions. The full suite runs with `scripts/test-engine`.

The browser demonstration uses the synthetic Philippine order `SAL-ORD-2026-00004`: two demo bearing kits, PHP 2,000 net plus PHP 240 VAT. It remains a draft and has no posted accounting or stock movement. The demonstration customer's actual balance is zero; the screen does not fabricate unpaid invoices to make the demo look populated.
