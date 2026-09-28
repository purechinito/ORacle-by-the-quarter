# ERPNext source acquisition and workflow mapping

Inspected: 2026-09-29. Status: source research; **not installed, configured, or running**.

## Reproducible source

- Official repository: https://github.com/frappe/erpnext
- Local checkout: `.reference-code/erpnext`
- Inspected release: `v16.36.0`
- Exact commit: `b30aa5334bcea94dba74f5b866af13c43a861948`
- Source license: GNU GPL version 3, retained in the checkout's `license.txt`.
- The checkout is ignored by the parent repository. No upstream product files were modified.
- This is a pinned research snapshot, not a claim to have selected the latest patch for deployment.

To reacquire the same source in a fresh workspace:

```sh
git clone --depth 1 --branch v16.36.0 --single-branch https://github.com/frappe/erpnext.git .reference-code/erpnext
git -C .reference-code/erpnext rev-parse HEAD
```

The original license and attribution must be retained when reusing source. An independently designed interface does not remove applicable upstream license obligations.

## Concrete source mapping

The [structured DocType catalog](erpnext-doctype-catalog.csv) inventories 529 source definitions with module, field count, declared role names, controller/test-file presence, and commit-pinned source links. Definitions include child tables and internal configuration objects; **529 is not a count of user-facing features or verified workflows**. Declared role names describe ERPNext source defaults, not the NetSuite account's permission assignments.

Paths below are relative to `.reference-code/erpnext`. Each transaction directory includes its DocType JSON schema, Python controller, and upstream tests. Presence of code and tests is source evidence; no upstream tests have been executed here.

| NetSuite concept | ERPNext implementation to evaluate | Source directory |
| --- | --- | --- |
| Customer and contacts | Customer, Contact links | `erpnext/selling/doctype/customer/` |
| Item catalog | Item and units | `erpnext/stock/doctype/item/` |
| Sales order | Sales Order | `erpnext/selling/doctype/sales_order/` |
| Item fulfillment | Delivery Note, with separate picking/packing concepts | `erpnext/stock/doctype/delivery_note/` |
| Invoice | Sales Invoice | `erpnext/accounts/doctype/sales_invoice/` |
| Customer payment and applications | Payment Entry and reference rows | `erpnext/accounts/doctype/payment_entry/` |
| Purchase order | Purchase Order | `erpnext/buying/doctype/purchase_order/` |
| Item receipt | Purchase Receipt | `erpnext/stock/doctype/purchase_receipt/` |
| Vendor bill | Purchase Invoice | `erpnext/accounts/doctype/purchase_invoice/` |
| Inventory movement | Stock Entry and Stock Ledger Entry | `erpnext/stock/doctype/stock_entry/`, `erpnext/stock/doctype/stock_ledger_entry/` |
| Journal and GL impact | Journal Entry and GL Entry | `erpnext/accounts/doctype/journal_entry/`, `erpnext/accounts/doctype/gl_entry/` |
| BOM and manufacturing order | BOM and Work Order | `erpnext/manufacturing/doctype/bom/`, `erpnext/manufacturing/doctype/work_order/` |
| Subsidiary/company context | Company and company-linked warehouse/account configuration | `erpnext/setup/doctype/company/` |

The [Sales Order controller](https://github.com/frappe/erpnext/blob/b30aa5334bcea94dba74f5b866af13c43a861948/erpnext/selling/doctype/sales_order/sales_order.py) includes mappings into delivery and invoicing. The [Purchase Order controller](https://github.com/frappe/erpnext/blob/b30aa5334bcea94dba74f5b866af13c43a861948/erpnext/buying/doctype/purchase_order/purchase_order.py) exposes receipt and invoice creation paths. These provide real starting points for complete workflows rather than a UI-only transaction list.

The [Payment Entry controller](https://github.com/frappe/erpnext/blob/b30aa5334bcea94dba74f5b866af13c43a861948/erpnext/accounts/doctype/payment_entry/payment_entry.py) validates amounts, referenced documents, currency relationships, and allocations. Its submit handler creates GL entries and updates outstanding balances. Its latest-reference validation rejects already-paid references. This inspection does **not** prove concurrent requests cannot over-apply funds; that needs integration tests under the chosen runtime and database.

Representative upstream tests found:

- `erpnext/buying/doctype/purchase_order/test_purchase_order.py`: `test_purchase_order_invoice_receipt_workflow`, `test_warehouse_company_validation`, `test_purchase_invoice_creation_with_partial_qty`.
- `erpnext/stock/doctype/delivery_note/test_delivery_note.py`: `test_over_billing_against_dn`, `test_sales_return_for_non_bundled_items_partial`, `test_make_sales_invoice_from_dn_for_returned_qty`.
- `erpnext/accounts/doctype/payment_entry/test_payment_entry.py`: `test_payment_entry_against_order`, `test_payment_against_sales_order_usd_to_inr`.

## Differences that prevent declaring parity

1. NetSuite document names do not map perfectly to ERPNext states or posting rules. A Delivery Note is a candidate fulfillment equivalent; pick/pack/ship details, item statuses, and fulfillment timing require explicit mapping.
2. Both invoices and fulfillment can link to the originating sales order. Preserve the source's actual graph; do not force every invoice to be a child of fulfillment.
3. ERPNext has its own financial precision, rounding, tax, stock valuation, and reversal implementation. The prior proposal's exact-decimal requirements must be evaluated against the engine before acceptance, not assumed satisfied.
4. Company support does not establish NetSuite OneWorld parity. Subsidiary restrictions, elimination entities, intercompany rules, FX, and consolidation need scenario-by-scenario validation.
5. Framework roles and user permissions are not a verified equivalent of NetSuite's active-role session. A role-switching visual control must not silently leave broader privileges active. The authorization design requires framework-level investigation before implementation.
6. Standard ERPNext fields cannot reconstruct the training account's uninspected custom fields, SuiteFlow definitions, scripts, saved searches, integrations, or the detailed grants of its 83 role definitions.
7. An open-source engine does not include Oracle's services, supplier credentials, ChatGPT credentials, or the account's private data.

## Local execution readiness

The inspected [ERPNext pyproject](https://github.com/frappe/erpnext/blob/b30aa5334bcea94dba74f5b866af13c43a861948/pyproject.toml) requires Python `>=3.14` and Frappe `>=16.21.0,<17.0.0`. This machine's discovered executables are Python 3.9.6 and Node 22.23.1. Docker, Homebrew, MariaDB, and Redis were not found on PATH; Docker Desktop and OrbStack were not found at the checked standard application paths.

The official [Frappe Docker deployment-method guide](https://github.com/frappe/frappe_docker/blob/main/docs/01-getting-started/01-choosing-a-deployment-method.md) separates quick exploration, development, and production. Its `pwd.yml` example is an exploration environment, not a production release. Runtime provisioning remains work; cloning source does not produce a working URL.

No service was started, no account data was uploaded, and no new ERP login account was created during source acquisition.
