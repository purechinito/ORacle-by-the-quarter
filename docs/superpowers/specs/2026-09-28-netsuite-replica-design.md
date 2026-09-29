# NetSuite replica: architecture and first build proposal

Date: 2026-09-28; revised 2026-09-29 for the user's public-source direction.
Status: **ERPNext/Frappe foundation approved by the user on 2026-09-29; implementation in progress.**
Target: a separate application in CLONE ORACLE, using the user-confirmed Inside the Suite | Products training/demo account as its behavioral reference.

## Intended outcome

The user wants the account's functions, users, roles, and complete business journeys reproduced, with a much easier, attractive, reliable interface. The user explicitly requested screenshots, competitive ERP research, and inspection of every layer of all roles. Functional correctness is the primary requirement; appearance, usability, responsiveness, and stability are also essential. The latest instruction explicitly authorizes public videos, documentation, and GitHub/open-source references as a way to continue without private-account browsing.

Interpretation proposed for review: reproduce business outcomes, data relationships, permission boundaries, and supported workflows while redesigning navigation and interaction. Exact pixels and a redesigned interface cannot both be the acceptance criterion for the same screen. Preserve familiar business terminology, original document numbers, and access to detailed fields; measure fidelity through workflow and data tests. Keep the original screenshots as comparison evidence.

This document does not claim a complete account inventory, complete export, complete replica, or measured speed improvement. The first implementation milestone is a real subset of the final system, explicitly identified below. The final objective still includes all confirmed account functionality.

## Evidence collected

- The UI reports NetSuite United States edition, **2026.2**.
- Navigation exposes sales, purchasing, payables, receivables, inventory, manufacturing, financials, banking, CRM, support, marketing, analytics, documents, administration, and customization.
- The home screen shows Headquarters, Subsidiaries 1–3, and an eliminations node. Entity/currency rules require deeper inspection.
- The employees view contains **55** records. Manage Users contains **five assignment rows for one visible identity**, Kathryn Glass. The role catalog contains **83 definitions**. These are three different counts.
- Assigned roles observed: Administrator, ITS - A/P Analyst, ITS - A/R Analyst, ITS - Inventory Manager, ITS - MCP.
- The role catalog also contains AI Companion roles, service roles, standard roles, custom roles, and manufacturing/warehouse/sales roles.
- The sales-order form contains a custom form selector, currency/exchange rate, location, approval state, and many line-level inventory and customization fields.
- Existing **SO353 → IF364**, **SO353 → INV336**, and **INV336 → PYMT437** relationships were read. This does not establish that the invoice was created from the fulfillment. The invoice is paid in full at **USD 1,807.50**. Its GL impact is debit trade receivables 1,807.50, credit revenue 1,799.00, credit shipping 8.50. Payment and fulfillment detail screens remain uninspected.
- The original screen exposes a released three-way vendor-bill approval workflow with quantity and amount checks. Its full executable conditions are not captured yet.

See [account audit](../../research/account-audit.md), [parity matrix](../../research/parity-matrix.csv), and [screen gallery](../../references/netsuite/README.md). Sources establish different evidence levels: a menu entry is not a verified transaction, and reading a completed transaction is not an executed end-to-end test.

## Approaches considered

| Approach | Benefits | Constraints |
| --- | --- | --- |
| **Independent app using ERPNext/Frappe with a redesigned frontend — recommended after public-source research** | Real open-source accounting, selling, buying, inventory, and manufacturing provide an inspectable foundation; preserves the requested separate application | Requires ERPNext configuration, a task-oriented adapter, permission design, new frontend, gap modules, migration, and verified NetSuite mappings; respect upstream licenses |
| Independent ERP engine written from scratch | Complete control over every business rule and data model | Reimplements posting, stock valuation, document consistency, permissions, and recovery; substantially more implementation and validation work |
| New frontend using NetSuite as the backend | Reuses much existing business behavior and account data | Still depends on NetSuite availability/licensing/API coverage; inherits upstream concurrency and customization limitations |

The recommended product is an independent application powered by **ERPNext 16 / Frappe 16**, with the custom frontend and workflows described below. The [foundation comparison](../../research/open-source-foundation-comparison.md) explains the choice over Odoo Community; the [source map](../../research/erpnext-source-map.md) records the acquired repository and exact commit. Public NetSuite videos provide interaction references, while executable source supplies a functional starting point. Neither establishes full parity by itself.

A NetSuite connector can remain a bounded import/reference integration. Continuous two-way synchronization is not assumed: it needs conflict rules, ownership, and separate acceptance tests.

## Work breakdown and dependency order

Each phase gets a focused specification and implementation plan. The inventory remains open until the source account's modules and customizations are accounted for.

1. **Evidence, source acquisition, and role audit.** Continue public documentation/video/source mapping now. Finish private-account role layers and customizations when access or an authorized export becomes available. Exact source parity cannot be certified before these gaps close, but they do not block development of documented standard workflows with labeled synthetic fixtures.
2. **Engine, core platform, and order-to-cash.** Provision compatible pinned ERPNext/Frappe versions, configure synthetic companies/accounts/warehouses, verify native document and ledger behavior, implement identity/role boundaries and the frontend adapter, then deliver the redesigned complete sales chain with real persistence.
3. **Procure-to-pay.** Purchasing, approvals, partial receipts, three-way matching, bills, vendor credits, payment applications, and matching inventory/GL effects.
4. **Inventory and manufacturing.** Locations, statuses, bins, lot/serial tracking, units, transfers, counts, valuation, replenishment, BOMs, work orders, assembly build/unbuild, and the discovered manufacturing extensions.
5. **Financial operations and reporting.** Journals, AR/AP, bank reconciliation, fiscal close, FX, intercompany/consolidation, budgets, statements, searches, workbooks, and exports as confirmed in the account.
6. **Remaining business modules and extensions.** CRM, marketing, support, employee services, commerce, attachments, custom workflows, integrations, document templates, and any additional discovered features. Modules do not disappear because they are later in the order.
7. **AI, full migration rehearsal, and release verification.** Integrate assistant capabilities incrementally once business services exist; finish source-to-target reconciliation, role tests, load tests, restore tests, and complete-module acceptance before calling it a replacement.

These are dependency stages, not a promised delivery date. No stage with required unfinished items is labeled complete.

## First build specification: core platform and order-to-cash

### Scope and completion

A user can sign in, select an assigned role and subsidiary, find a customer/item, create and recover a draft, enter a valid order, follow its approval policy, fulfill permitted quantities, invoice eligible quantities, record and apply a payment, and inspect the resulting linked documents, inventory movements, journal entries, and audit history. Persisted state survives browser refresh and server restart.

The initial workbench exposes Today, Sales, Purchasing, Inventory, Finance, Reports, People, and Administration as the long-term information architecture. Only implemented routes appear as usable actions. Unavailable modules are explicitly identified in the development coverage view; no clickable empty pages are presented as completed functionality.

Account-specific taxation, costing, approval thresholds, forms, and permission configurations that are still uninspected must be obtained before claiming fidelity for those paths. A validated synthetic dataset may be used for development, clearly labeled and separate from captured reference data.

### User journey

1. Sign in → assigned role → permitted subsidiary/location context → task queue. Returning users resume their prior authorized view.
2. Search or Sales → saved list with filters, sorting, stable pagination, status, outstanding quantities, and next action.
3. Create draft → customer and applicable terms/currency → searchable item lines → quantities/prices/discounts → shipping/tax → validation summary. Preserve advanced fields behind an explicit details section.
4. Save draft with visible acknowledged state. Submission applies required business rules and approval routing; the client cannot set an arbitrary status.
5. Fulfill one or more eligible lines, preserving ordered/committed/picked/packed/shipped/remaining quantities and lot/serial requirements where supported.
6. Create invoices from eligible quantities; show posting preview and commit deterministic totals and balanced journal effects together.
7. Record/apply payment to invoice(s); distinguish bookkeeping from moving money through a provider. Show applied, unapplied, and remaining amounts and retain source links.
8. Open the process view from any document to inspect each linked object, exception, approval, attachment, and audit event.
9. Handle partial fulfillment, multiple invoices/payments, cancellations, credit/return/reversal, retries, permission denials, and concurrent edits with explicit valid transitions and recoverable messages.

Quotes/opportunities and additional CRM stages are included in the final parity scope. Their first-build inclusion depends on inspection of their account-specific conversion rules; they must not be represented as implemented by an empty screen.

### Data and invariants

Core records: users, employees, roles, permission grants, role assignments, organization/subsidiary hierarchy, departments, classes, locations, currencies, exchange rates, accounting periods, accounts, parties/contacts, items/units, document headers/lines, document links, fulfillment allocations, invoice allocations, payment applications, stock movements, journal headers/lines, approvals, audit events, attachments, saved views, jobs, and source-ID mappings.

- Source identity is `(source account, record type, internal ID)`; do not collide a negative source user ID with local IDs.
- Currency values and exchange rates use exact decimal representations and defined currency rounding; binary floating point is not the ledger authority. This remains an unresolved engine-compatibility requirement, not a verified property of ERPNext. Resolve the engine's arithmetic and storage behavior against this requirement before accepting financial workflows; decimal conversion in the frontend or adapter alone cannot establish compliance.
- Business transitions run within database transactions with current-version and authorization checks. A retry with the same idempotency key cannot duplicate a posting, payment application, or movement.
- Distinct concurrent commands must also preserve aggregate bounds: fulfilled quantities cannot exceed the source policy's eligible quantities; billed allocations cannot reuse already billed eligibility; and payment applications cannot exceed available payment funds or the eligible invoice balance. Lock or otherwise serialize the affected allocation totals and revalidate inside the same transaction. Any source-authorized overage is an explicit verified rule, not an accidental race.
- Journal entries balance in the relevant accounting currency. Closed-period changes follow the verified source policy. Corrections preserve original entries and traceable reversals.
- Every document, account, party, location, application, and posting must obey verified subsidiary and currency relationships. Cross-subsidiary and cross-currency operations use explicit supported rules. Record the applicable exchange-rate basis/date, rounding, and realized/unrealized FX treatment; balanced totals alone do not establish correct entity or currency treatment.
- Stock and value derive from movements and the verified costing rules. An editable dashboard count cannot become the stock ledger.
- Partial progress is computed per line/application. A downstream document's existence does not mean the entire order is complete.
- Document numbering is unique and concurrency-safe. Original imported numbers are preserved with source provenance.
- An append-only audit records actor, active role, subsidiary, timestamp, operation, affected identifiers, and relevant changes; imported history remains labeled as source evidence.

### Roles: all layers, without conflating roles and people

For all **83 catalog roles**, record source ID/name, standard/custom classification, center, active state, subsidiary access, department/class/location/employee restrictions, permission categories and levels, custom record access, forms/preferences, dashboards/search access, integration restrictions, and assigned users wherever the UI exposes them. Capture inheritance/global permission interactions and audit the applicable fields rather than assuming a universal layout.

The role audit tracks each layer as captured, absent, inaccessible, or pending. Screenshots plus structured rows must retain source and observation time. A role with only its catalog name captured is not marked copied.

The independent application enforces authorization on the server for reads, writes, search, counts, exports, attachments, reports, background jobs, and AI tools. Switching roles invalidates role-scoped caches. Role preview is separate from authenticating as another employee.

Import employees as employee records. Recreate only verified login assignments as user configuration. Do not turn all 55 employees into enabled users or assign every role to the one administrator by convenience. Passwords, session cookies, MFA secrets, passkeys, and OAuth credentials are not copied. New authentication is established through the new application's configured identity system; captured identities can remain disabled until activation is deliberately configured.

### Technical structure

Revised proposed stack: TypeScript/React frontend with Next.js routing, a small custom Frappe application exposing authenticated task operations, ERPNext/Frappe 16 as the business engine, and the supported MariaDB/Redis deployment. This replaces the earlier proposal to write a new Node/PostgreSQL accounting engine. Pin compatible releases and retain upstream licenses. Keep document, inventory, and accounting commands in the engine's transaction boundary.

- **Interface layer:** reusable accessible forms, query-backed tables, contextual record panel, command search, task queue, and process view.
- **Application services:** explicit task operations for draft/save/submit/approve/fulfill/invoice/apply/reverse that invoke validated ERPNext/Frappe document methods. Do not directly update status fields or bypass controllers through SQL.
- **Domain modules:** reuse the engine's company, catalog, selling, buying, stock, accounts, manufacturing, workflow, files, and reporting modules. Add source mappings, missing parity rules, task context, migration, and assistant integration in a versioned custom application. Keep pricing, stock valuation, and posting authoritative in one engine.
- **Persistence:** use engine-managed schema migrations and supported MariaDB storage. Verify transaction boundaries, numeric precision/rounding, concurrency, indexes, source identities, retry handling, and durable event delivery. The listed financial invariants are acceptance requirements; source reuse does not prove they are already met.
- **Background work:** use Frappe workers and scheduler with persistent job outcomes for imports, reports, recalculation, files, and integrations. Add idempotency and visible recovery state where the chosen operations need them.
- **Attachments:** use permission-checked engine file access and the configured private storage backend. Never assume a file is safe to expose by a public URL.
- **Authentication:** user-scoped Frappe sessions/OAuth behind the new interface; local development identities clearly isolated. No shared Administrator token in the browser. Resolve active-role semantics at the server before exposing a role switcher: displaying one role cannot leave unioned grants from other roles active. Apply the same restrictions to direct resource/method API calls and native ERPNext routes, not only the custom adapter's task operations.

During implementation, the native ERPNext interface may be an explicitly labeled fallback for engine capabilities that have not yet been redesigned, only where it enforces the same authorized role and company scope. Do not expose it as a fallback for an active-role session until that enforcement is verified. It is not evidence that the custom interface or NetSuite parity for those capabilities is finished. HR/payroll and Webshop are separate applications where needed, subject to compatibility and fit testing.

### Interface design

The proposed workbench uses a restrained slate, warm-white, and teal palette, clear typography, readable numbers, and compact but comfortable spacing. The primary surface is actionable work, not a wall of decorative KPI tiles. The [static workspace proposal](../../design/workspace-concept.md) is a design artifact, not a running application.

- Stable left navigation groups work by business domain; a command field accepts document IDs, people/items, actions, and familiar NetSuite terms.
- Role and subsidiary context stay visible. Context changes retain only state the new context may access.
- Lists preserve filters and scroll position while a right-side panel shows a selected record's status, totals, exceptions, and next permitted action.
- Complex editing has a full-width line mode with keyboard entry, searchable lookups, pinned identity/totals, inline validation, and an error summary that links to each problem.
- Document chains show branching/partial fulfillment and payment states. Detailed fields and audit history remain available without dominating routine work.
- Loading is scoped to each section. Unloaded values never masquerade as zero, failed saves never display success, and stale edits present a recoverable conflict.
- Keyboard access, focus management, sufficient contrast, reduced motion, semantic status text, and a useful narrow layout are release requirements.

### AI design and verified distinction

Oracle documentation distinguishes native **Ask Oracle** from **AI Connector Service**, which connects external assistants such as ChatGPT via MCP. The [current NetSuite Next FAQ](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/article_7130219835.html) says eligible administrators can enable Ask Oracle in their current account or request a Next preview; availability remains phased. Native Ask Oracle and an external ChatGPT connection are separate capabilities. This account has MCP/AI Companion role names and shortcuts, but that does not prove eligibility, activation, or a working integration.

The proposed assistant answers with permission-filtered record/report citations, explains calculations from deterministic services, and presents proposed business changes with their consequences. It uses the same commands and authorization as ordinary UI actions, with attributable audit events and idempotency. The assistant must not invent a posting result, bypass approval routing, or expose records from a broader role. Start with help, record lookup, and supported analysis before enabling material write commands.

An actual provider connection and model configuration are required for real AI. A scripted response panel is not an implemented ChatGPT integration. Oracle backend credentials or access expansion require their own concrete configuration step when relevant.

### Performance and recovery targets

Initial targets, **not measured results**: p95 warm list/detail useful data within 1 second; cold authenticated workspace within 2.5 seconds; local input feedback within 100 ms; ordinary search within 500 ms after submit; acknowledged draft save within 1 second; a simple 20-line transition within 2 seconds. Establish device/network/region, data volume, and concurrency before accepting these gates.

Use server pagination/filtering, indexed access paths, lazy secondary panels, request cancellation, bounded caches, route-level loading, error boundaries, and long-running job records. Invalidate caches on data/role changes. Authoritative financial and stock changes are shown complete only after commit.

Test timeout, duplicate requests, lost responses, two-user edits, worker crashes, service restarts, backup restoration, and refresh during a job. There is no supportable promise that software can never crash; the requirement is to contain failures, preserve confirmed work, and recover without inconsistent effects.

### First-build acceptance

1. An authorized user completes the sales chain against persistent server data, with every related document reachable after refresh and restart.
2. The SO353 reference values and ledger arithmetic can be reproduced in an appropriate fixture, while acknowledging that reading source records did not verify all posting rules.
3. Partial quantities/applications, rejection/resubmission, cancellation/return/reversal, duplicate retries, and stale updates produce the specified business outcomes.
4. Authorization tests cover allow and deny cases across search, detail, edits, exports, files, jobs, and assistant tools. Uncaptured permission rules are visible blockers to parity certification.
5. Every posting balances; AR and stock controls reconcile for the implemented sales scenarios. AP reconciliation is a procure-to-pay acceptance requirement in the following phase. Migration control totals are separate from unit-test arithmetic.
6. No final action is a decorative button, no fake success replaces a server result, and no unsupported feature is represented as complete.
7. Workflow keyboard checks and representative usability sessions measure completion time, errors, and recovery against the source UI. “Ten times better” remains an ambition until measured on defined tasks.
8. Functional tests, browser flows, performance measurements, and failure-recovery evidence accompany the coverage matrix. The final system is accepted only when all required rows are implemented and verified.

## Migration and source-account discovery

Screenshots cannot export executable behavior or all data. Use authorized account metadata and supported data extraction, preserving internal/external IDs, line relationships, files, statuses, balances, and provenance. Validate extraction coverage: Oracle documents that Full CSV Export omits data and that REST has record/feature limitations.

Import into staging in dependency order; dry-run validation catches missing dependencies and invalid fields. Compare source/target counts, document totals, AR/AP applications, stock quantities/values, trial balance, subsidiary/currency segmentation, and role assignments. Report every rejected/unmapped row. Reruns are idempotent and versioned. Rehearse a cutoff/delta/rollback process before any production cutover. No production cutover or external deployment has been performed or scheduled.

## Current limitations and next decision

Private-account browser access remains blocked. No alternative URL can provide its hidden configuration, and no alternate access method is used to evade that restriction. The user's new public-reference direction is actionable: the official ERPNext source is cloned, the public NetSuite SuiteProcurement transcript is reviewed, and three sampled video screenshots are saved in the [public reference gallery](../../references/public/README.md).

The runtime is now provisioned in a local isolated VM. ERPNext/Frappe is served on loopback with synthetic company data and one tested sales journey; see [runtime verification](../../runtime-verification.md). This does not establish the custom frontend or full source-account parity.

The user approved the central choice: **ERPNext/Frappe as the independent business engine, a redesigned task-focused interface, and verified NetSuite mappings in dependency stages**, starting with the core platform and complete order-to-cash flow while preserving the full module objective. Exact role and customization discovery remains required work, not an assumed implementation shortcut.

The [implementation plan](../plans/2026-09-29-running-erp-foundation.md) records execution and acceptance; the full objective remains active until its required behavior is verified.
