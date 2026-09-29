# Clone map: from observed flows to our ERP

"Clone" here means re-implementing the **business process** in our own design. We never copy vendor code, configuration or screens.
Milestone and task numbers refer to `../superpowers/plans/2026-09-28-auto-supply-erp.md`.

## Summary
| Observed flow | Our module | When | Decision |
|---|---|---|---|
| Cash sale (sale + stock + payment in one step) | Counter sales | Milestone 3, task 5 | **Clone now.** This is our core counter flow. |
| Sales order → fulfillment → invoice | Sales orders | Later | Defer. Needs reservations and receivables, which release one excludes. |
| Sales order → purchase order (special order) | Special orders | Later | Defer. Record it as a known need for parts the shop doesn't stock. |
| Purchase order → receipt, partial receipts | Purchasing | Milestone 2, task 4 | **Clone now.** Already in the plan. |
| Purchase order approval gate | Purchasing | Milestone 2, task 4 | **Clone now**, lightweight: only a manager can submit. |
| Purchase order → vendor bill → payment | Payables | Later | Defer. The spec already lists supplier invoices and payables as later work. |
| Return authorization → receipt → refund | Returns | Milestone 3, task 5 | **Clone a simplified version** (see below). |
| Vendor return → shipment → credit | Supplier returns | Later | Defer. Add to the backlog. |
| Inventory adjustment | Stock ledger | Milestone 1, task 3 | **Clone now.** Already in the plan. |
| Physical count → approval | Stock counts | After milestone 4 | Next candidate after the pilot. |
| Transfer order, bin transfer | Multi-location | Later | Defer. Release one has a single location. |

## Rules each cloned flow adds to our plan

### Counter sales (task 5)
- One posting does three things atomically: the sale document, the payment record and the stock deduction. This matches the cash-sale pattern and is already in the spec.
- Keep "fulfilled" and "billed" as separate concepts in the data model, even though release one posts both together. That way, adding sales orders later won't need a schema rewrite.

### Purchasing (task 4)
- Status is derived from line quantities (ordered, received), never typed in by hand. States: draft → submitted → partially received → received, plus cancelled.
- Leave room for a future "billed quantity" per line, because in the observed flow receipt and billing are independent.
- Approval: submitting is manager-only in release one. A configurable approval threshold is a later feature.

### Returns (task 5)
The observed flow uses four steps: authorize → approve → receive goods → refund. For a counter shop, release one collapses these into one posted return that:
- references the original sale lines (observed: returns always point to the original sale)
- records disposition (restockable or damaged) and refund status separately (observed: goods and money are separate steps)
- needs manager authority (this replaces the separate approval state)

Later, a pending approval state can be added without changing the link to the original sale.

### Stock ledger (task 3)
- Adjustments are rare in a healthy operation. The "Movements" report should make adjustments easy to review, because they are the main place errors and shrinkage show up.
- Child documents dated before their parent document get flagged (see the data-quality note in workflows.md).

## New tests to add
- [ ] Purchasing: a line's receipt total never exceeds its ordered quantity, and status is computed from quantities after every receipt.
- [ ] Sales data model: a posted counter sale stores separate fulfilled and billed quantities, and they are equal in release one.
- [ ] Returns: a return that isn't linked to a posted sale line is rejected.
- [ ] Ledger: a document dated before its parent is rejected unless a manager gives a backdate reason.

## Backlog created by this study
1. Sales orders with partial fulfillment and billing (needs reservations).
2. Special order: sales order creates a purchase order.
3. Supplier bills, approval and payments.
4. Supplier returns and credits.
5. Physical counts with approval.
6. Transfers between locations and bins.

## Pre-planned pivots
| If this happens | Then do this |
|---|---|
| The shop needs customer accounts (invoice now, pay later) before release one ships | Promote backlog item 1 and add receivables. Don't hack credit into the cash-sale flow. |
| Special orders turn out to be common at the counter | Build backlog item 2 next, reusing the purchasing module. |
| A SuiteQL query fails during a future study | Query `transaction` and `transactionline` by type code. Some record types (for example `workflow` and `employee`) weren't exposed to this connector role. |
