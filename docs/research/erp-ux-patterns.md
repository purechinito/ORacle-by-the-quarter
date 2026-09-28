# ERP UX patterns for a separate NetSuite-compatible product

Research date: 2026-09-28. Sources are official Odoo, Microsoft Dynamics 365 Business Central, and SAP documentation. This research does not inspect the NetSuite account, establish functional parity, or measure either product. Product proposals and targets below are design hypotheses, not claims about observed performance.

The useful direction is to preserve business meaning and outcomes while making the next action, current state, and consequences easier to understand. A replica needs a verified requirements matrix for the particular account; similar screens alone cannot demonstrate equivalent workflows, permissions, integrations, or accounting results.

## Eleven patterns to adopt or adapt

### 1. Role workspaces that start with actionable queues

**Evidence.** Business Central Role Centers present information and navigation appropriate to a user's role. Profiles can distribute page layouts, while permissions separately determine feature access. [Role customization](https://learn.microsoft.com/en-us/dynamics365/business-central/dev-itpro/developer/devenv-role-customization), [Manage user profiles](https://learn.microsoft.com/en-us/dynamics365/business-central/admin-users-profiles-roles).

**Proposal.** Give sales, purchasing, warehouse, finance, and administration distinct home pages. Lead with work awaiting the user, due dates, exception reasons, and direct actions. Every count opens the exact records counted. Show active company/subsidiary, role, and reporting period persistently. Permit personal shortcuts without allowing personalization to expand access.

**Tradeoff.** Role defaults reduce scanning but can fragment navigation. Keep a stable cross-role record model and command search; preserve a user's open work when the workspace changes. Avoid a dashboard dominated by expensive charts and unactionable totals.

**Acceptance.** At least 95% of representative users identify their next assigned task within 10 seconds. Every queue count reconciles with its filtered results under the same timestamp and scope.

### 2. One search entry point with explicit result types

**Evidence.** Business Central's Tell Me finds actions, pages, reports, data, and help; it supports synonyms and keyboard navigation. Its semantic Advanced mode is documented as a preview, so it is not a dependency for this proposal. [Tell Me](https://learn.microsoft.com/en-us/dynamics365/business-central/ui-search).

**Proposal.** Add a keyboard command palette with separate sections for records, actions, reports, and help. Search both familiar NetSuite names and improved labels. Show record number, party, amount, subsidiary, and status to disambiguate results. An action result opens its relevant context; it should not silently execute a posting or payment.

**Tradeoff.** Global search is convenient but can become slow or ambiguous. Use exact-ID matching first, scoped filters, visible result types, and cancel stale requests. Permissions must filter both results and counts.

**Acceptance.** In a 30-query fixture containing identifiers, aliases, and common tasks, the intended authorized result appears among the first three results in at least 90% of cases. Keyboard-only users can open it without losing focus.

### 3. Saved views as reusable work queues

**Evidence.** Odoo supports field searches, filters, grouping, favorites, default searches, and sharing favorites with selected users. [Search, filter, and group records](https://www.odoo.com/documentation/19.0/applications/essentials/search.html).

**Proposal.** Offer named views such as “My orders awaiting fulfillment,” “Bills due this week,” and “Inventory exceptions.” Represent applied filters visibly, including date basis and subsidiary. Save columns, grouping, sorting, and filter definitions. Distinguish personal views from administered team views and make sharing scope explicit.

**Tradeoff.** A dense table is effective for comparison; a board is useful for stage movement. Support both only where the business process benefits. Shared definitions must not share otherwise inaccessible data or conceal a user's active filters.

**Acceptance.** Returning from a record restores the view, scroll position, and selected row. Every seeded filter case produces the expected record IDs, including timezone boundaries and empty values. A copied view link reconstructs the same definition within the recipient's permissions.

### 4. List-to-record navigation that preserves working context

**Evidence.** SAP describes the list report as a place to filter, view, and work with multiple objects, paired with an object page for viewing, editing, or creating one object. [List report and object page](https://help.sap.com/docs/SAPUI5/b2f662dd9d7a4ec680056733050b4d34/c0eec49db81a441e878f528c8f3d28de.html).

**Proposal.** Use a reusable list and record layout. Open a concise preview beside the list for triage; open the full record when editing complex headers and lines. Pin the record identity, status, totals, and primary action. Keep related documents and exceptions discoverable without making users traverse unrelated menus. Support stable deep links and the browser Back button.

**Tradeoff.** Split panes reduce navigation but compress wide transaction tables. Let users expand the record and collapse secondary content; on narrow displays show one useful pane at a time.

**Acceptance.** Reviewing ten adjacent documents does not reset filters or scroll position. Direct links open the correct authorized record after refresh. Desktop and narrow layouts expose the same business actions.

### 5. Fast document entry with a clear draft boundary

**Evidence.** Business Central Quick Entry customizes the keyboard path through fields; focus mode expands document lines. Its data-entry guidance also describes copy/paste, lookups, and configurable in-context document checking. [Enter data](https://learn.microsoft.com/en-us/dynamics365/business-central/ui-enter-data).

**Proposal.** Keep header essentials compact and make line editing keyboard-friendly. Provide searchable item/customer/vendor pickers, paste with a mapping preview, sensible defaults with visible provenance, and an expanded line editor. Show “Saving,” “Draft saved,” or an actionable failure. Saving a draft and performing a business transition must remain distinguishable.

**Tradeoff.** Defaults and autosave reduce repetition but can preserve mistakes unnoticed. Show changed/defaulted values clearly, retain ordinary tab navigation, and prevent stale responses from replacing newer edits. Do not overload Enter with both field navigation and final submission.

**Acceptance.** A trained user creates a valid 20-line order without a mouse. Reload after a confirmed draft save preserves every value. A simulated failed save never displays a successful-save state or discards entered values.

### 6. A business process view with quantities and exceptions

**Evidence.** SAPUI5 process flow connects nodes representing business documents or approvals in lanes, provides lane-level status summaries, and varies detail through semantic zoom. Its guidance notes that layout optimization can affect performance. [Process flow](https://help.sap.com/docs/SAPUI5/538009aec85e4e99b31f4d2de2443abe/70307d4b63814dad9a95220e85a563dc.html).

**Proposal.** Show the relationships between quote, order, shipment, invoice, payment, and return records. Show ordered, fulfilled, invoiced, paid, and remaining quantities or amounts separately; do the equivalent for procurement. Each stage links to the actual documents and presents the next permitted action with any blocking reason.

**Tradeoff.** A single progress bar misrepresents partial fulfillment, multiple invoices, and returns. Use a compact summary for common cases and an expandable document graph/table for branches. Never infer completion solely from the presence of a downstream record.

**Acceptance.** Tests cover one-to-many documents, partial quantities, cancellations, returns, and reversals. Users correctly identify the current blocker and next owner in at least 90% of scenario questions without opening multiple modules.

### 7. Approval inboxes with enough context to decide

**Evidence.** Business Central provides multi-record approve, reject, and delegate actions, approval amount limits, overdue handling, and a pending state that blocks further processing until required approvals finish. [Approval workflows](https://learn.microsoft.com/en-us/dynamics365/business-central/across-how-use-approval-workflows).

**Proposal.** Centralize assigned approvals with amount, requester, policy/rule, source document, due date, attachments, and changes since submission. Show approval steps and substitute approvers. Explain rejection and resubmission paths. For a batch, preview eligible records and return per-record outcomes.

**Tradeoff.** Batch approval helps routine decisions but can hide exceptions. Group compatible decisions, highlight outliers, and keep failed/stale records selected for correction. Apply server-side role, limit, state, and version checks to each item.

**Acceptance.** The suite includes delegate, reject, revise/resubmit, expired authority, concurrent edits, and a partially failing batch. No unapproved record advances. Repeated requests cannot create duplicate approval transitions.

### 8. Record-linked history, evidence, and follow-up

**Evidence.** Odoo activities have owners and due dates and can be accessed from records and multiple views. Its Chatter documentation describes notes, attachments, communication, and timestamped changes on records. [Activities, Odoo 19](https://www.odoo.com/documentation/19.0/applications/essentials/activities.html), [Chatter, Odoo 18](https://www.odoo.com/documentation/18.0/applications/productivity/discuss/chatter.html).

**Proposal.** Put business events, approvals, internal notes, attachments, and follow-up tasks into a filterable record timeline. Show who changed what, when, and why, with links to related objects. Separate internal-note and external-message composers, display the actual recipients, and offer explicit follow-up ownership.

**Tradeoff.** A combined timeline gives useful context but becomes noisy. Default to important business events and offer filters. Treat a social activity feed and a durable audit log as separate data responsibilities even when the UI presents them together.

**Acceptance.** Every tested state transition has an attributable event and source link. A user can find the last approver and the reason for a rejection in under 15 seconds. Internal notes do not become outbound messages through an ambiguous control.

### 9. Validation that explains a remedy and a posting preview

**Evidence.** Business Central offers previews of the entries a document or journal will create before posting. [Preview posting results](https://learn.microsoft.com/en-us/dynamics365/business-central/ui-how-preview-post-results). SAP Fiori combines field-level value states and messages with a collected message popover, reserving blocking dialogs for cases that need a decision or acknowledgment. [Message handling](https://www.sap.com/design-system/fiori-design-web/v1-151/foundations/best-practices/global-patterns/messaging/messaging).

**Proposal.** Validate fields locally when possible, then show a linked document-level error list for cross-field and server rules. Use actionable language such as “Choose a receiving location for line 4.” Before a consequential transition, expose its document and ledger consequences. Revalidate at commit against the current record version.

**Tradeoff.** Early validation reduces failed submissions but must not interrupt incomplete typing or imply that server validation is unnecessary. A preview is a projection, so show its basis and refresh it after relevant edits. Allow incomplete drafts without allowing invalid final transitions.

**Acceptance.** Every seeded error points to the relevant field or remedy; correcting an error removes it. Preview and committed results agree for an unchanged version. Concurrent edits produce a recoverable conflict with no silent overwrite.

### 10. Progressive loading that exposes real business state

**Evidence.** Business Central documents small-batch list loading, cached page structure, and on-demand secondary parts. Its developer guidance recommends fewer page parts, dedicated lookup pages, and background calculation for some values. [User performance guidance](https://learn.microsoft.com/en-us/dynamics365/business-central/dev-itpro/performance/performance-users), [Developer performance guidance](https://learn.microsoft.com/en-us/dynamics365/business-central/dev-itpro/performance/performance-developer). SAP distinguishes responsive tables suitable for phones from denser desktop/tablet table types and recommends growing/filtering for larger responsive-table datasets. [Table comparison](https://help.sap.com/docs/ABAP_PLATFORM_NEW/468a97775123488ab3345a0c48cadd8f/148892ff9aea4a18b912829791e38f3e.html).

**Proposal.** Render navigation and first useful records before secondary analytics. Paginate/filter on the server; virtualize only where keyboard and assistive-technology behavior remains reliable. Fetch histories and expensive totals when needed. Give long imports, reports, and batch operations a durable job page with progress, results, and retry behavior.

**Tradeoff.** Fast initial rendering can conceal missing/stale totals. Label loading and freshness; avoid interpreting absent data as zero. Financial posting cannot be presented as completed until the authoritative operation commits.

**Acceptance.** Meet the latency budget below on declared data sizes. User input remains usable during secondary loading. Job status survives refresh, and retry does not repeat already committed financial effects.

### 11. Migration as a reviewable reconciliation workflow

**Evidence.** Odoo's accounting setup guide recommends practicing in a test database, importing in dependency order, and validating opening invoices, inventory, and trial balances against each other. Imported opening records have review stages before confirmation/posting. [Accounting setup and migration](https://www.odoo.com/documentation/19.0/applications/finance/accounting/get_started.html).

**Proposal.** Provide a migration workspace: inventory sources → map entities and fields → inspect sample rows → dry-run validation → review reconciliation → import into staging → verify → authorize cutover. Preserve source identifiers and mappings. Classify rejected rows by fixable cause, retain the exact import version, and make reruns explicit updates rather than accidental duplicates.

**Tradeoff.** A simple CSV wizard is approachable but insufficient for dependencies and historical balances. Put technical mapping behind a guided flow, while showing business-level counts and reconciliation differences. Historical detail, open transactions, and opening balances need an agreed strategy to avoid double counting.

**Acceptance.** Seeded reruns are idempotent; invalid rows report source row/field and reason. Counts and agreed control totals reconcile exactly at the specified rounding precision. A cutover cannot be marked verified while an unexplained reconciliation difference remains.

## Comparison and design choices

| Inspiration | Most useful here | Tradeoff to resolve in this product |
| --- | --- | --- |
| Odoo | Flexible list/board/activity views, reusable filters, record-centered collaboration | Flexible views still need shared definitions, explicit audiences, permission boundaries, and reliable business-state semantics. |
| Business Central | Role entry points, expert keyboard workflows, approvals, posting previews | Dense expert screens need a concise default; configuration and personalization must remain distinct from authorization. |
| SAP Fiori | Consistent list/detail composition, semantic status, process visibility, local and page-level messages | A generic component system still needs transaction-specific information architecture and handling for wide line-item tables. |

These are selected patterns, not a ranking or a claim that any one vendor has objectively better UX. The proposed combination should be tested against actual user tasks from the observed NetSuite account.

## Role and migration UX details

Use a role matrix with separate columns for workspace, allowed record scopes, allowed actions, amount limits, delegation, and approval responsibilities. Candidate roles are sales operator, buyer, warehouse operator, accounts receivable, accounts payable, controller, administrator, and auditor; actual roles must come from the account inventory. A role switch must update server authorization and cached data together. Show why a permitted-to-view record cannot be changed and who can resolve the block, without exposing information outside the user's access.

Give administrators a readable permission diff before assignment changes. Provide a clearly labeled preview of another role's workspace that cannot execute as that user. Saved views and counts must obey the same subsidiary/location/record restrictions as detail pages. Verify search, exports, attachments, reports, job results, and deep links as well as visible buttons.

The migration workspace should separately track source completeness, structural validation, business validation, and reconciliation. Record the cutoff timestamp and treatment of transactions changed during migration. Preserve original numbers, source-system IDs, documents, and relationships where required by the agreed scope. Make the legacy-to-new label mapping searchable. Use a representative rehearsal, including partial transactions and exceptions, before live cutover. This is proposed product behavior; the operational migration policy must be set from the actual data and business requirements.

## Proposed acceptance metrics and measurement method

All numerical thresholds below are initial engineering/design targets. None has been measured in this research. Agree the representative device, browser, hosting region, network, data distributions, and concurrency before treating them as release gates.

### Usability and task success

| Measure | Proposed initial gate | How to measure |
| --- | --- | --- |
| Unassisted success | ≥95% of attempts for ordinary tasks; ≥90% for exception recovery | At least 20 attempts per priority workflow across representative roles; report numerator, denominator, and uncertainty. A moderator hint counts as assisted. |
| End-to-end elapsed time | Median ≤60% of the observed baseline for the selected high-frequency tasks, with no material p90 regression | Counterbalanced baseline/new-product sessions with equivalent data and practice. Include validation, waiting, navigation, and correction time. |
| Serious errors | Zero in the acceptance suite | Count wrong-company posting, duplicate payment/posting, permission violations, lost confirmed work, or irreconcilable effects as failures regardless of time saved. |
| Findability | ≥90% correct destination among first three search results; next work identified within 10 seconds | Fixed, versioned task/query set; include legacy terminology and similarly named records. |
| Recovery | ≥90% recover from seeded permission, validation, stale-edit, and job-failure scenarios without help | Measure recovery time and confirm the authoritative final state. |
| Keyboard accessibility | All priority workflows operable with keyboard; no focus traps or lost focus after updates | Manual keyboard and screen-reader runs on the agreed browser/device matrix. |

Do not summarize improvement as “10×” without matched measurements. A defensible report states the workflow, baseline, dataset, sample, time/error results, and whether results cover novices, experts, or both. Faster clicks do not compensate for incomplete business outcomes.

### Responsiveness and throughput

For an initial reproducible test profile, use a midrange laptop, current supported Chromium, 100 ms network RTT, 10 Mbps downstream, and 100 concurrent active sessions. Seed 100,000 transaction headers, 1,000,000 lines, 10,000 parties, and 10,000 items with realistic skew and permissions. Revise this profile when actual account scale is known; also test tenfold data growth and a slower-network profile without silently relaxing correctness.

| Operation | Proposed budget | Measurement boundary |
| --- | --- | --- |
| Local input/menu feedback | p95 ≤100 ms | User event to visible response, excluding server completion; collect input-to-render separately from network latency. |
| Warm list / record navigation | p95 ≤1.0 s | Navigation event to first useful, authorized data and usable primary controls. |
| Cold authenticated workspace | p95 ≤2.5 s | Start of app navigation to useful work queue; exclude human sign-in time and report it separately. |
| Exact-ID lookup / ordinary filtered search | p95 ≤500 ms after submitted query | Query event to usable returned results under the declared workload. Broad reporting searches have a separate budget. |
| Draft save | p95 ≤1.0 s | Save event to authoritative server acknowledgment; show pending state immediately. |
| Simple document transition | p95 ≤2.0 s | Submit to committed result for a defined 20-line fixture; correctness and duplicate protection are gates. |
| Long report/import/batch | Job acknowledgment p95 ≤1.0 s; status visible on refresh | Record queue delay, total completion time, throughput, progress freshness, and per-item results separately. Set completion targets from actual payloads. |

Measure cold and warm caches separately, retain errors/timeouts in the results, and report p50/p95/p99. Record request counts, bytes, server time, database time, and long client tasks to explain regressions. A fast empty shell is not a successful page load. Benchmark seeded synthetic data without embedding production secrets in telemetry.

### End-to-end flow completion

Start with an account-confirmed acceptance matrix. Candidate cross-module scenarios are:

| Journey | Completion evidence | Required exception branch |
| --- | --- | --- |
| Order to cash | Linked order, fulfillment, invoice, receipt/application, stock movement, and balanced posting effects | Partial fulfillment/invoicing, backorder, return/credit, payment reversal |
| Procure to pay | Linked request/approval, order, receipt, bill, payment/application, stock and ledger effects | Partial receipt, quantity/price mismatch, rejection/resubmission, vendor credit |
| Inventory movement | Source/destination quantities, item tracking, valuation effects where applicable, linked documents | Insufficient stock, invalid lot/serial, cancellation or reversal |
| Finance and reconciliation | Balanced entries, matching balances, traceable originating documents, reproducible reports | Closed period, duplicate reference, currency/rounding edge, unmatched item |
| Migration and access | Source-to-target relationships, reconciled controls, preserved identifiers, role-scoped access | Rerun, rejected row, missing dependency, unauthorized lookup/export |

Each scenario needs authoritative server state, user-visible results, audit evidence, and refresh/retry verification. Mark unsupported account features explicitly. Do not call the product complete because the happy-path UI is clickable.

## Evidence limits

Vendor documentation establishes available patterns; it does not establish comparative usability or speed. Some Odoo and SAP Help pages were available through official indexed documentation text while direct extraction failed. Chatter is cited to the readable Odoo 18 documentation rather than implying every behavior is verified for every later deployment. Account-specific workflows, customizations, permissions, tax/localization behavior, integrations, and actual baseline performance remain inputs for the separate NetSuite discovery work.
