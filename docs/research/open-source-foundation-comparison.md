# Open-source ERP foundation: ERPNext versus Odoo Community

Research date: **2026-09-29**. Public official documentation and source repositories only. No NetSuite account access. This is an engine-selection recommendation, not an implemented integration or a claim of NetSuite feature parity.

## Recommendation

**Use ERPNext 16 on Frappe 16 as the initial functional foundation, with a new frontend and a small authenticated application adapter.** It provides an integrated open-source accounting, selling, buying, inventory, and manufacturing engine without the Community/Enterprise feature split documented by Odoo. That makes it the stronger starting point when the priority is real end-to-end ERP behavior rather than a visual replica. The relevant coverage is documented in [ERPNext accounting](https://docs.frappe.io/erpnext/accounting-introduction), [selling](https://docs.frappe.io/erpnext/selling), [buying](https://docs.frappe.io/erpnext/buying), and [manufacturing](https://docs.frappe.io/erpnext/manufacturing); Odoo's split is explicit in its [edition comparison](https://www.odoo.com/page/editions).

This is a fit judgment, not a benchmark: no performance superiority has been measured. ERPNext still needs company, chart-of-accounts, tax, warehouse, costing, permissions, and workflow configuration; external bank/payment services and country-specific requirements require individual validation. Neither candidate automatically reproduces NetSuite custom records, scripts, saved searches, approval rules, subsidiary behavior, or integrations.

**Odoo Community remains a serious alternative** when existing Odoo expertise, Odoo modules, or LGPL licensing are decisive. Its public source contains real transaction and ledger-related models. Calling it merely an invoicing mockup would be incorrect. The drawback for this project is the extra gap analysis and add-on work needed to match the broader ERP experience marketed under the Odoo name.

## Current releases and runtime requirements

| Topic | ERPNext / Frappe | Odoo Community |
| --- | --- | --- |
| Current stable major | ERPNext **16** and Frappe **16**. Latest ERPNext patch found: **v16.36.1**, released 2026-09-28. Latest Frappe v16 release found: **v16.35.0**, released 2026-09-22. [ERPNext release](https://github.com/frappe/erpnext/releases/tag/v16.36.1), [Frappe release](https://github.com/frappe/frappe/releases/tag/v16.35.0). | **20.0**, released September 2026. Official nightly page identifies it as stable, and the public release file marks version 20.0 as FINAL. [Official builds](https://nightly.odoo.com/), [20.0 release source](https://raw.githubusercontent.com/odoo/odoo/20.0/odoo/release.py). |
| Version selection | Pin ERPNext and Frappe independently to compatible tags and record commits. The inspected ERPNext v16.36.0 manifest requires Frappe `>=16.21.0,<17.0.0`. [ERPNext manifest](https://github.com/frappe/erpnext/blob/v16.36.0/pyproject.toml). | Pin a commit on the stable `20.0` branch rather than a moving development branch. Add-ons must match that major version. [Source installation](https://www.odoo.com/documentation/20.0/administration/on_premise/source.html). |
| Python and JavaScript | Tagged Frappe v16.35.0 requires **Python `>=3.14,<3.15`** and **Node `>=24`**. The current installation matrix also lists Yarn 1.22+ and pip 25.3+. [Python manifest](https://raw.githubusercontent.com/frappe/frappe/v16.35.0/pyproject.toml), [Node manifest](https://raw.githubusercontent.com/frappe/frappe/v16.35.0/package.json), [installation](https://docs.frappe.io/framework/user/en/installation). | **Python 3.12+** and the branch's pinned Python dependencies. The engine does not have the same Node/Redis runtime architecture as Frappe. The installation guide uses Node/npm for `rtlcss` when right-to-left support is needed. [Source installation](https://www.odoo.com/documentation/20.0/administration/on_premise/source.html), [requirements](https://raw.githubusercontent.com/odoo/odoo/20.0/requirements.txt). |
| Database and services | The v16 installation matrix specifies **MariaDB 11.8** and **Redis/Valkey 6+**. Plan for web workers, background jobs, scheduler, realtime service, persistent files, and backups. Use the ERPNext-supported configuration rather than assuming every database supported by the framework is interchangeable. [Installation](https://docs.frappe.io/framework/user/en/installation), [official Docker repository](https://github.com/frappe/frappe_docker). | **PostgreSQL 16+**, Odoo server processes, persistent filestore, and backups. The version minimum is independently recorded in source. [Release constants](https://raw.githubusercontent.com/odoo/odoo/20.0/odoo/release.py), [source installation](https://www.odoo.com/documentation/20.0/administration/on_premise/source.html). |
| Documents / PDF | Installation documentation lists patched-Qt wkhtmltopdf 0.12.6; confirm the renderer used by the pinned deployment and its dependencies. [Installation](https://docs.frappe.io/framework/user/en/installation). | Source-install guidance specifies wkhtmltopdf 0.12.6 for report headers and footers. [Source installation](https://www.odoo.com/documentation/20.0/administration/on_premise/source.html). |
| Maintenance horizon | Official support plan lists v16 through end-2029 and v15 through end-2027; these are explicitly planned dates. [Supported versions](https://github.com/frappe/erpnext/wiki/Supported-Versions). | Official build page says Odoo 20 is supported until Odoo 23. Community deployment ownership and service entitlements still differ from Enterprise. [Official builds](https://nightly.odoo.com/). |

Do not select versions from an unqualified `latest` URL alone. During this research GitHub's Frappe `releases/latest` pointed to a v15 maintenance release even though the v16 line is newer. Runtime guidance from Odoo 19 or ERPNext 15 is also insufficient for these latest major versions.

## Functional coverage that can power a new frontend

“Included” below means documented functionality or public source is present. It does not certify a particular localization, configuration, integration, or edge case.

| Workflow | ERPNext 16 | Odoo Community 20 |
| --- | --- | --- |
| Accounting | Integrated double-entry accounting, company books, receivables/payables, financial statements, payment allocation, reconciliation, assets, budgets, and accounting dimensions are documented. Posting follows transaction submission. [Accounting](https://docs.frappe.io/erpnext/accounting-introduction). | The public `account` module is titled Invoicing and contains invoices, payments, journals, accounts, taxes, reversals, reconciliation models, and analytic dependencies. Thus real financial models are present, but the official **Comprehensive Accounting** product bundle is Enterprise-only. Do not infer either “no ledger exists” or “all Enterprise accounting is available.” [Account manifest](https://raw.githubusercontent.com/odoo/odoo/20.0/addons/account/__manifest__.py), [editions](https://www.odoo.com/page/editions). |
| Fulfillment → invoice → payment | Quotation → Sales Order → Delivery Note → Sales Invoice → Payment Entry is documented, including partial fulfillment and service/direct-invoice variants. Correct source-document links determine order progress. [Selling](https://docs.frappe.io/erpnext/selling). | Community `sale_stock` explicitly joins quotations, orders, deliveries, and invoicing control; `account` supplies payment functionality. Full or partial delivery is represented. [Sales/warehouse module](https://raw.githubusercontent.com/odoo/odoo/20.0/addons/sale_stock/__manifest__.py), [invoicing/payments module](https://raw.githubusercontent.com/odoo/odoo/20.0/addons/account/__manifest__.py). |
| Procurement → receiving → bill → payment | Buying covers supplier/RFQ/order processes; receipt, invoice, and supplier payment have distinct stock/accounting effects. A draft does not equal a ledger posting. [Buying](https://docs.frappe.io/erpnext/buying), [purchase-cycle ledger effects](https://docs.frappe.io/erpnext/purchase-cycle-ledger-impact). | `purchase_stock` explicitly covers purchase orders, receipts, and vendor bills, and depends on stock accounting and purchase. Payment support is in `account`. [Purchase stock module](https://raw.githubusercontent.com/odoo/odoo/20.0/addons/purchase_stock/__manifest__.py). |
| Inventory | Delivery/receipt operations integrate with purchasing, selling, and manufacturing. Item tracking and valuation requirements still need scenario validation. [Selling](https://docs.frappe.io/erpnext/selling), [manufacturing](https://docs.frappe.io/erpnext/manufacturing). | Community `stock` includes logistics, tracking reports, backorders, returns, and replenishment artifacts; `stock_account` links stock and accounting. The marketed **Barcode** application is separately Enterprise-only, despite barcode-related base utilities existing publicly. [Stock module](https://raw.githubusercontent.com/odoo/odoo/20.0/addons/stock/__manifest__.py), [stock accounting](https://raw.githubusercontent.com/odoo/odoo/20.0/addons/stock_account/__manifest__.py), [editions](https://www.odoo.com/page/editions). |
| Manufacturing | BOMs, work orders, production planning, workstations, job cards, and quality inspection are documented as part of the manufacturing offering. Fit for complex scheduling/subcontracting must be tested. [Manufacturing](https://docs.frappe.io/erpnext/manufacturing). | Basic MRP is Community: public `mrp` includes BOMs, production, work centers, work orders, routing, and related stock operations. The marketed **Shopfloor / Control Panel / Scheduling**, **PLM**, and **Quality** applications are Enterprise-only. Avoid the outdated simplification that Community has no work-order model. [MRP source](https://raw.githubusercontent.com/odoo/odoo/20.0/addons/mrp/__manifest__.py), [editions](https://www.odoo.com/page/editions). |
| Roles and record scope | Multiple roles, DocType permissions, submit/cancel/amend permissions, field permission levels, and user restrictions are documented. [Users and permissions](https://docs.frappe.io/framework/user/en/basics/users-and-permissions). | Groups, model access rights, record rules, and restricted fields are built in. Company restrictions must be configured and respected, including through custom API methods. [Security reference](https://raw.githubusercontent.com/odoo/documentation/20.0/content/developer/reference/backend/security.rst). |

### Important gaps and separate products

ERPNext's HR/payroll functionality is now the separate open-source **Frappe HR (`hrms`)** application, rather than everything living in the ERPNext repository. Its version compatibility must be checked independently. Current item documentation also directs website publishing through the separate **Webshop** app. These are additional installation/configuration dependencies, not evidence of an Enterprise license tier. [Frappe HR](https://github.com/frappe/hrms), [item/Webshop documentation](https://docs.frappe.io/erpnext/item).

Odoo's official matrix marks comprehensive accounting, barcode, advanced shopfloor features, PLM, quality, payroll, and Studio as Enterprise-only. Its public core remains extensible, so alternative open-source add-ons or purpose-built modules can fill some gaps; each candidate would need its own code, license, upgrade, localization, and integration review. Replacing the frontend does not make absent backend features appear. [Edition comparison](https://www.odoo.com/page/editions).

For both engines, advanced consolidation, revenue recognition, taxation/e-invoicing, banking, payroll jurisdictions, manufacturing constraints, and NetSuite-specific customizations belong in an explicit fit-gap matrix. A product name or a module checkbox is not enough to establish equivalence.

## APIs and the independent-frontend boundary

**ERPNext/Frappe:** REST endpoints expose DocType CRUD at `/api/resource/{doctype}`; `/api/method/{dotted.path}` invokes whitelisted methods. API v2 adds document metadata and methods including submit/cancel. API tokens operate as a user, and session/OAuth authentication is documented. These are a credible foundation for a separate interface, not an automatic exporter of all Desk workflows. [HTTP API](https://docs.frappe.io/framework/user/en/guides/integration/rest_api), [REST authentication](https://docs.frappe.io/framework/user/en/api/rest).

**Odoo Community:** The public 20.0 source includes the bearer-authenticated JSON-2 route `/json/2/{model}/{method}`. Its API documentation says access follows model/record/field permissions. Each request is its own database transaction; coupled business effects should use one appropriate server method. The hosted pricing-plan restriction in the docs must not be misrepresented as removal of the endpoint from self-hosted LGPL Community source. [Community JSON-2 controller](https://raw.githubusercontent.com/odoo/odoo/20.0/addons/rpc/controllers/json2.py), [API specification](https://raw.githubusercontent.com/odoo/documentation/20.0/content/developer/reference/external_api.rst).

For new Odoo integrations, prefer JSON-2 over legacy XML-RPC/JSON-RPC services. Current 20.0 documentation distinguishes the database service, removed in 20, from common/object services scheduled for removal in 22. Blanket claims that all legacy RPC disappeared in 20 are inaccurate. [API migration reference](https://raw.githubusercontent.com/odoo/documentation/20.0/content/developer/reference/external_api.rst).

**Recommended architecture, as an engineering proposal:**

```text
New ERP frontend
       │ user-scoped session and task-oriented requests
       ▼
Authenticated application adapter / custom Frappe app
       │ validated document operations and business methods
       ▼
ERPNext + Frappe
       │ accounting, stock, permissions, workflow, jobs, files
       ▼
MariaDB + Redis/Valkey + persistent storage
```

Keep pricing, taxes, posting, stock valuation, permissions, and document transitions authoritative in the engine. The adapter translates frontend tasks and familiar record labels; it should not become a second accounting implementation. Normal Frappe document operations run permissions/validation, while direct database setters can bypass controller validation. Odoo likewise documents risks from bypassing its ORM. [Frappe Document API](https://docs.frappe.io/framework/user/en/api/document), [Odoo security](https://raw.githubusercontent.com/odoo/documentation/20.0/content/developer/reference/backend/security.rst).

Use user-scoped authorization; do not ship a shared Administrator API secret to browsers. Define retry/idempotency, stale-record conflicts, task-level audit attribution, and multi-company scope explicitly. Build complete vertical workflows before widening the custom UI. During development, the native engine UI can be an explicitly labeled operational fallback for workflows not yet covered by the new frontend; do not claim those workflows have already been redesigned.

## Licenses and public-source reuse

| Component | Verified license | Practical boundary |
| --- | --- | --- |
| ERPNext | GPL v3. [License](https://github.com/frappe/erpnext/blob/v16.36.1/license.txt). | Public source can be studied, modified, and used under its license. Distribution of covered modifications carries GPL obligations; preserve notices and corresponding-source arrangements. |
| Frappe Framework | MIT. [Repository](https://github.com/frappe/frappe), [tagged package metadata](https://raw.githubusercontent.com/frappe/frappe/v16.35.0/package.json). | Framework licensing does not replace ERPNext's GPL terms. |
| Frappe HR | GPL v3. [Repository](https://github.com/frappe/hrms). | Treat it as another versioned licensed dependency if HR/payroll is in scope. |
| Odoo Community 20 | LGPL v3; bundled components can have other compatible terms. [20.0 license](https://github.com/odoo/odoo/blob/20.0/LICENSE). | Preserve source/license obligations applicable to the actual modifications and distribution. Its linking model differs from ERPNext's GPL. |
| Odoo Enterprise | Odoo Enterprise Edition License v1.0. [License text](https://raw.githubusercontent.com/odoo/documentation/20.0/content/legal/licenses/enterprise_license.txt). | A valid subscription is required for use; publishing/distributing copies or modified copies is prohibited by the license. It is not a freely redistributable extension of the Community clone. |

An HTTP boundary does not by itself settle whether a particular frontend or extension is a derivative work. Record the intended distribution model and review the actual dependency/license boundaries before promising a closed-source redistribution. This recommendation assumes compliant reuse of public open-source components; it does not require Oracle or Enterprise source code.

## What exists locally, and what still has to be proven

The root task has cloned **ERPNext v16.36.0** into `.reference-code/erpnext`, at commit **`b30aa5334bcea94dba74f5b866af13c43a861948`**, for source inspection. Its local version file and dependency manifest were read during this research. That reproducible reference is distinct from the newer published **v16.36.1**, commit **`fb78e58b8c037bcff4f90b7361ad81ff7b1c42ba`**. This research did not update the checkout.

The root's environment check found no Docker/Homebrew, MariaDB, Redis, Docker Desktop, or OrbStack. Node/npm and system Python alone do not satisfy the selected ERPNext stack. **No ERP engine is installed, configured, or proven runnable by this research.** A repository clone is source material, not a deployed ERP.

The next implementation evidence should be a version-pinned development engine with synthetic fixtures and five verified journeys:

1. Order → partial delivery → invoice → payment allocation, with correct outstanding quantities, balances, and ledger effects.
2. Purchase order → partial receipt → bill → supplier payment, including a mismatch and a return/credit.
3. BOM → work order/job execution → finished stock, including consumption, costing, and an exception.
4. Role and company restrictions across lists, search, reports, attachments, exports, and state transitions.
5. Retry, cancellation/amendment, backup/restore, and an upgrade rehearsal without lost or duplicated financial effects.

These journeys are staged acceptance targets. An individual workflow may be described as functional only after that journey and its relevant authorization, retry, and recovery checks pass; for example, order-to-cash can be accepted before manufacturing is built. Keep the claim scoped to the verified workflow. All required module and release checks must pass before claiming whole-system readiness. Performance and usability claims require matched measurements; neither a source clone nor a polished screen establishes them.

## Source-quality notes

Release constants and tagged manifests were used where versioned documentation contained stale example text. The official Odoo edition page's HTML check/cross cells were inspected because plain-text extraction omitted those indicators. Some Odoo documentation pages timed out through direct extraction; the official indexed text or the corresponding public documentation source was used instead. No secondary comparison blog was used as evidence. Links to moving branches describe the state researched on the date above; implementation must pin exact revisions.
