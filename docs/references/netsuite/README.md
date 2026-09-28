# NetSuite reference gallery

Captured 2026-09-28 from the user-confirmed training account through read-only browser exploration. These are viewport screenshots, not full-page captures. Some views contain Oracle's file-drag tutorial overlay, and wide tables extend beyond the viewport. The accompanying Markdown observations retain additional visible UI text and links.

Raw captures are local and excluded from Git. This gallery references those local files; it is not intended as a public dataset.

| Reference | What it establishes | Limitation |
| --- | --- | --- |
| [01 — Home](01-home-dashboard.png) | Reminders, subsidiary navigation, financial dashboard structure | Dashboard metrics were not reconciled |
| [02 — Role switcher](02-role-switcher.png) | Five roles assigned to the current user | Not the full catalog of role definitions |
| [03 — Transactions hub](03-transactions-hub.png) | Transaction navigation and grouping | Links establish availability, not tested behavior |
| [04 — Sales order form](04-sales-order-form.png) | Header fields, form selector, summary, primary actions | No draft was saved |
| [05 — Sales order list](05-sales-orders-list.png) | Filtering, views, export controls, status columns | Not a full transaction export |
| [06 — Sales order detail](06-sales-order-detail.png) | Existing SO353 with billed status | Alternate statuses and exceptions untested |
| [07 — Related records](07-sales-order-related.png) | SO353 links to IF364 and INV336 | Fulfillment detail not yet opened |
| [08 — Invoice detail](08-invoice-detail.png) | INV336 paid in full; zero amount due | Posting behavior not executed |
| [09 — GL impact](09-invoice-gl-impact.png) | Invoice accounting-impact layout | Full three-entry evidence is in invoice-gl-impact.md |
| [10 — Employees](10-employees-list.png) | Employee list structure | 55 records do not imply 55 login accounts |
| [11 — Employee access](11-employee-access.png) | Employee record and access tab context | See employee-detail.md for the five role rows |
| [12 — Manage users](12-manage-users.png) | One visible identity represented by five role assignments | The current unfiltered view is the scope of this observation |

## Dashboard

![NetSuite home dashboard](01-home-dashboard.png)

## Sales order entry

![NetSuite sales order form](04-sales-order-form.png)

## Document relationships

![Order related documents](07-sales-order-related.png)

## Users and roles

![NetSuite manage users](12-manage-users.png)

## Raw observations

- `transactions-hub.md`, `transactions-links.json`: observed transaction menu entries.
- `lists-hub.md`, `master-links.json`: master data and other list entry points.
- `sales-order-form.md`, `sales-orders-list.md`, `sales-order-detail.md`, `sales-order-related.md`: sales discovery.
- `invoice-detail.md`, `invoice-related.md`, `invoice-gl-impact.md`: invoice, payment relationship, and ledger evidence.
- `employees-list.md`, `employee-roster.json`, `employee-detail.md`: captured employee data; not imported users.
- `manage-users.md`: current visible user-to-role assignments.
- `roles-list.md`: 83 catalog entries, not their detailed permission configurations.
- `setup-hub.md`: setup manager entry points.

The original workflow screen was read but not saved as a screenshot: **3 Way Match Vendor Bill Approval**, released, event-based, Vendor Bill transaction, triggered on create/view/update with a supervisor condition and 37 fields. Quantity tolerance, quantity difference, and amount validation nodes were visible. Its exact conditions and actions still require inspection.
