# Training account audit and parity baseline

Audit date: **2026-09-28**. Target: **trainingdemo**, confirmed by the user. Captured account host: `td3118036.app.netsuite.com`; account banner: **Inside the Suite | Products**, accessed in the **Administrator** role. The Transactions footer identifies **United States edition, Release 2026.2**. These labels establish the observed environment, not its complete entitlements or configuration. Sources: [Transactions capture](</Users/timothyngosiok/Documents/ChatGPT/CLONE ORACLE/docs/references/netsuite/transactions-hub.md:10>) and [release footer](</Users/timothyngosiok/Documents/ChatGPT/CLONE ORACLE/docs/references/netsuite/transactions-hub.md:476>).

**Complete parity has not been established. Implementation has not started. No users have been migrated.** This synthesis used existing local captures and a recorded session observation only; it did not access the account or browser after further access was denied.

## Evidence scope and status definitions

The source gallery records read-only exploration and viewport screenshots with some overlays and horizontally clipped tables. Markdown retains additional UI text. The sales-order creation form was opened but no draft was saved. Raw captures are local and excluded from Git; they are not a complete export. [Capture scope and gallery](</Users/timothyngosiok/Documents/ChatGPT/CLONE ORACLE/docs/references/netsuite/README.md>)

The [parity matrix](</Users/timothyngosiok/Documents/ChatGPT/CLONE ORACLE/docs/research/parity-matrix.csv>) contains **78 capability rows**, all with implementation status **not started**:

| Evidence status | Rows | Meaning |
| --- | ---: | --- |
| `read-path-verified` | 10 | Existing list, record, or related-record information was read in the captured path. This does not mean a write, transition, full workflow, or replacement implementation was tested. |
| `form-observed` | 5 | A form, field surface, or configuration summary was observed. Validation and save behavior remain untested. |
| `nav-observed` | 51 | A menu, link, tab, action, or related-record summary identifies an entry point. Its downstream behavior is unverified. |
| `uninspected` | 12 | No relevant detailed account evidence was captured. Product documentation may suggest a discovery candidate, but cannot establish account usage. |

Counts measure discovery coverage, not percentage parity. Broad capability rows can contain narrower uninspected areas, identified in each row's `unverified_scope`. CSV `source_files` are repository-relative local references separated by semicolons. Empty sources indicate no local capture. A catalog role name, button, or menu is not proof that its feature is configured or functional.

## Employees, users, and roles

| Observation | Correct interpretation | Local evidence |
| --- | --- | --- |
| Employee list reports **55**, and roster JSON contains **55** entries | Employee records; not 55 login identities or migrated users | [Employee list total](</Users/timothyngosiok/Documents/ChatGPT/CLONE ORACLE/docs/references/netsuite/employees-list.md:270>), [roster capture](</Users/timothyngosiok/Documents/ChatGPT/CLONE ORACLE/docs/references/netsuite/employee-roster.json>) |
| Manage Users reports **5** rows | All five rows refer to **Kathryn Glass**, employee ID **-5**. This is **one distinct identity with five role assignments** in the captured view, not five different users. Other login populations and account-wide completeness remain unverified. | [Manage Users](</Users/timothyngosiok/Documents/ChatGPT/CLONE ORACLE/docs/references/netsuite/manage-users.md:126>) |
| Employee Access tab repeats those five assignments | Corroborates the current employee's role mapping; Global Permissions and History were not inspected | [Employee Access tab](</Users/timothyngosiok/Documents/ChatGPT/CLONE ORACLE/docs/references/netsuite/employee-detail.md:247>) |
| Manage Roles reports **83** definitions | The saved list contains **50 Custom** and **33 Standard** roles. Definition presence does not establish assignment, effective access, or use. | [Role catalog](</Users/timothyngosiok/Documents/ChatGPT/CLONE ORACLE/docs/references/netsuite/roles-list.md:142>) |

The five observed assignments are Administrator (**3**), ITS - A/P Analyst (**2093**), ITS - A/R Analyst (**2094**), ITS - Inventory Manager (**2099**), and ITS - MCP (**2210**). No email addresses, phone numbers, or unnecessary employee contact details are repeated here.

The [role audit checklist](</Users/timothyngosiok/Documents/ChatGPT/CLONE ORACLE/docs/research/role-audit-checklist.csv>) preserves **exactly 83** source role IDs, names, types, and centers. Each row includes the observed non-edit role URL and raw evidence line. All **18 detail layers** are **pending**: role details; transaction, report, list, setup, and custom-record permissions; permission levels; record restrictions; subsidiaries; forms; assigned users; preferences; centers/dashboards/search audiences; integrations/OAuth/MCP; authentication/2FA; global overrides; workflow/script access; and allowed/denied operation tests. These URLs were extracted from saved evidence and were not revisited.

## Verified existing sales read path

The first sales-order list page reports **2,234 total orders** under the captured filters (Type Sales Order; Employee All; Status All). **2,234 is the reported list total, not the number of rows captured or exported.** [List filters and reported total](</Users/timothyngosiok/Documents/ChatGPT/CLONE ORACLE/docs/references/netsuite/sales-orders-list.md:78>)

The captured example establishes these existing records and relationships:

| Record | Evidence observed | Limits |
| --- | --- | --- |
| **SO353** | Billed; date 09/07/2024; USD; Subsidiary 1; San Francisco location; one item line at **1,799.00**; shipping **8.50**; tax **0.00**; total **1,807.50** | Existing record read only; no creation, editing, approval, or cancellation tested |
| **IF364** | SO353 Related Records lists Item Fulfillment, **Shipped**, date 09/07/2024 | Fulfillment detail, inventory detail, and COGS posting were not opened |
| **INV336** | SO353 Related Records links the invoice; invoice Created From points to SO353; Approved; **Paid In Full**; total **1,807.50**; amount due **0.00**; posting period Sep 2024 | Existing invoice read only; no invoice generation or accounting transition tested |
| **PYMT437** | INV336 Related Records lists Payment, **Deposited**, date 09/11/2024, **1,807.50** | Payment detail, application lines, deposit record, bank settlement, and payment GL remain uninspected |

Sources: [Sales-order detail](</Users/timothyngosiok/Documents/ChatGPT/CLONE ORACLE/docs/references/netsuite/sales-order-detail.md:87>), [order related records](</Users/timothyngosiok/Documents/ChatGPT/CLONE ORACLE/docs/references/netsuite/sales-order-related.md:300>), [invoice detail](</Users/timothyngosiok/Documents/ChatGPT/CLONE ORACLE/docs/references/netsuite/invoice-detail.md:127>), [invoice payment relationship](</Users/timothyngosiok/Documents/ChatGPT/CLONE ORACLE/docs/references/netsuite/invoice-related.md:343>). Dates above retain the account's displayed format.

The supported relationship description is **SO353 → IF364 and INV336; INV336 → PYMT437**. This forms a readable order/fulfillment/invoice/payment example, but does not prove that an invoice was created *from the fulfillment*, or that processing any of these transactions has been reproduced.

For **INV336**, the captured GL Impact table shows three posting rows:

| Account | Debit (USD) | Credit (USD) |
| --- | ---: | ---: |
| 1110 Accounts Receivable : Trade Receivables | 1,807.50 | 0.00 |
| 4110 Sales : Revenue | 0.00 | 1,799.00 |
| 4140 Sales : Shipping and Handling | 0.00 | 8.50 |
| **Sum of captured rows** | **1,807.50** | **1,807.50** |

The totals above are arithmetic from the captured rows, not a trial-balance reconciliation. All three rows show Posting Yes. The revenue row also records Department Sales and Class-A. This verifies one invoice's displayed balanced journal, not the complete revenue, inventory, cash, or tax ledger. [Invoice GL rows and columns](</Users/timothyngosiok/Documents/ChatGPT/CLONE ORACLE/docs/references/netsuite/invoice-gl-impact.md:359>)

## Observed form and customization surface

The unsaved sales-order form selected **ITS_SS MFG STD - Sales Order**. It exposes customer, date, subsidiary, memo/PO reference, location, currency, exchange rate, status, sales representative, lead source, opportunity, electronic-payment exclusion, and bill-of-lading notes. The captured defaults include USD and Pending Fulfillment. The item picker is marked required in its accessibility label; this does not establish a separate custom field named “Item Required Field.” The custom form name and numerous additional transaction columns require a metadata audit before generic standard forms can define parity. Tabs include Items, Promotions, Shipping, Billing, Accounting, Relationships, Tax Details, Communication, and Available to Build. Sources: [Creation form](</Users/timothyngosiok/Documents/ChatGPT/CLONE ORACLE/docs/references/netsuite/sales-order-form.md:112>), [required item control](</Users/timothyngosiok/Documents/ChatGPT/CLONE ORACLE/docs/references/netsuite/sales-order-form.md:423>), [existing line columns](</Users/timothyngosiok/Documents/ChatGPT/CLONE ORACLE/docs/references/netsuite/sales-order-detail.md:320>).

These observations establish labels and visible structure only. Field IDs, exact types, source formulas, mandatory conditions, role visibility, alternative forms, client/server scripts, and save side effects remain unknown.

## Workflow session observation

**Evidence basis: original read-only session observation, recorded in the local gallery summary; no raw workflow screenshot or Markdown page capture exists.** [Gallery workflow note](</Users/timothyngosiok/Documents/ChatGPT/CLONE ORACLE/docs/references/netsuite/README.md>)

Observed source URL, supplied in the session: [3 Way Match Vendor Bill Approval](https://td3118036.app.netsuite.com/app/common/workflow/setup/nextgen/workflowdesktop.nl?id=3&whence=). It is included for provenance and was not reopened.

The session observed **3 Way Match Vendor Bill Approval**, **Released**, **event-based**, for **Transaction / Vendor Bill**, with **create/view/update** triggers, a condition described as **Supervisor not empty**, and **37 fields**. Quantity tolerance/difference and amount-validation nodes were visible.

This does not establish exact thresholds, field IDs, every state/action, transition logic, execution contexts, exceptions, notifications, or successful matching behavior. The workflow's name and visible nodes support prioritizing PO/receipt/bill matching discovery; the full executable rule set is still pending.

## Broad navigation coverage and AI evidence

The saved Transactions and Lists hubs expose entry points across banking, sales, shipping, manufacturing, purchasing, AP/AR, inventory, journals, budgets, master data, CRM, campaigns, support, search, and customization. Each appears as its own scoped row in the matrix. Sources: [Transaction links](</Users/timothyngosiok/Documents/ChatGPT/CLONE ORACLE/docs/references/netsuite/transactions-links.json>), [master links](</Users/timothyngosiok/Documents/ChatGPT/CLONE ORACLE/docs/references/netsuite/master-links.json>), [Lists hub](</Users/timothyngosiok/Documents/ChatGPT/CLONE ORACLE/docs/references/netsuite/lists-hub.md>), [Setup hub](</Users/timothyngosiok/Documents/ChatGPT/CLONE ORACLE/docs/references/netsuite/setup-hub.md>).

Account-specific AI clues are limited to the **AI Companion Tools** setup label, role definitions **AI Companion Controller** and **AI Companion View Only**, the current user's **ITS - MCP** assignment, and a **Generate Insight** sales-order button. No successful connector request, ChatGPT connection, Ask Oracle conversation, or NetSuite Next eligibility screen was captured. Sources: [AI setup label](</Users/timothyngosiok/Documents/ChatGPT/CLONE ORACLE/docs/references/netsuite/setup-hub.md:96>), [AI role definitions](</Users/timothyngosiok/Documents/ChatGPT/CLONE ORACLE/docs/references/netsuite/roles-list.md:223>), [MCP assignment](</Users/timothyngosiok/Documents/ChatGPT/CLONE ORACLE/docs/references/netsuite/manage-users.md>), [Generate Insight action](</Users/timothyngosiok/Documents/ChatGPT/CLONE ORACLE/docs/references/netsuite/sales-order-detail.md:98>).

## Documentation, inference, and unknowns

The [official capability research](</Users/timothyngosiok/Documents/ChatGPT/CLONE ORACLE/docs/research/netsuite-capabilities.md>) documents NetSuite product behavior and links to Oracle sources. It explains feature-dependent fulfillment/billing, receipt/bill separation, roles/restrictions, native Ask Oracle versus external ChatGPT/MCP, incomplete CSV exports, and API limits. **Those product descriptions are not evidence that a feature is enabled or working in this account.**

Reasonable discovery hypotheses include a manufacturing-oriented configuration (custom form names and production navigation), multi-entity structure (subsidiary fields/hierarchy labels), and MCP-related setup (role names). None substitutes for feature settings, licenses, integration configuration, or executed workflows. Zero tax on this sample does not establish a tax-free business or a complete tax configuration.

No full data export, detailed per-role audit, permission enforcement test, bank/payment execution test, complete procurement chain, trial-balance reconciliation, inventory valuation reconciliation, performance benchmark, backup/restore test, or replacement-system validation has been performed.

## Next discovery checklist

All account-dependent items remain pending while account/browser access is unavailable. The checklist describes required evidence, not completed work.

- [ ] Record enabled features, licenses, subsidiaries, currencies, accounting books, fiscal periods, tax/localization settings, and relevant account preferences.
- [ ] Complete all 18 layers for each of the 83 role definitions; reconcile distinct identities separately from employees and assignments. Include external users, service identities, inactive scope, and denied-access behavior.
- [ ] Capture custom forms/fields/records, scripts and deployments, SuiteApps, workflows/states/actions, schedules, saved searches, reports, workbook datasets, integrations, and printed/emailed templates.
- [ ] Open the fulfillment, payment, and deposit behind the captured sales example; inspect their inventory, application, and GL details.
- [ ] Trace procurement from PO through partial receipt, bill, matching/approval, payment, and variance; capture the original three-way-match workflow in full.
- [ ] Inspect exception paths: partials, shortages, returns, credits, deposits/prepayments, duplicate attempts, rejected approvals, reversals, nonzero tax, foreign currency, and locked periods.
- [ ] Reconcile trial balance, AR/AP open items, inventory quantities/valuation, and bank balances on a consistent as-of date.
- [ ] Build a data/attachment/audit extraction manifest with counts, source IDs, line links, history depth, deltas, and completeness checks before migration.
- [ ] Verify actual Ask Oracle eligibility and MCP/ChatGPT setup with permitted read-only operations before defining AI action coverage.
- [ ] Measure representative task times, peak concurrency, error/retry behavior, reporting latency, and recovery needs; define acceptance targets.
- [ ] Create implementation and cutover acceptance tests only after required behavior is evidenced. Track implementation separately from discovery.

Only the current training account is within this evidence baseline. Copying role names, UI surfaces, or transaction samples does not migrate identities or establish equivalent business behavior.
