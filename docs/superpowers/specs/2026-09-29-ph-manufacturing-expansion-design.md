# Manufacturing ERP: migration, controls and Philippine operations

Status: proposed design for review, not implemented. Date: 2026-09-29.

## Outcome and boundaries

Extend the separate CLONE ORACLE application into a usable Philippine manufacturing ERP. Preserve source data and business meaning; make responsibilities and exceptions visible; support app-owned AI history/files and selectable providers; prove production readiness with measurable tests. Existing ERPNext remains the transaction and ledger authority.

Confirmed: manufacturing; internal operational and external statutory reporting; AI data stored in the app. Unknown: VAT registration, company/branch structure, actual source ERP beyond the NetSuite demo, process/discrete manufacturing, volumes, hosting region, budget and recovery expectations. Use configurable tax/organizational settings and generic manufacturing workflows until these facts are known. Do not invent named staff assignments or source rules.

One complete accounting record supports both management and statutory reporting. Internal views can contain forecasts and unposted scenarios clearly labeled as such. Statutory outputs reflect applicable reporting rules and documented adjustments, with a reconciliation bridge. Missing documentation is an exception to resolve, never a switch for concealing a sale or excluding a real transaction from the books.

## Approaches considered

1. **Extend ERPNext with focused custom services (recommended):** preserve native accounting/manufacturing controllers, add migration staging, evidence-backed policy mapping, Philippine outputs and consistent workspaces. Lowest duplication; exact NetSuite behavior still needs explicit mapping.
2. **Configure only native ERPNext:** faster access to modules, but does not deliver the intended UX or active-role equivalence without additional work.
3. **Rewrite the accounting engine:** maximum freedom, but greatly expands posting, inventory, tax, security and migration risk. Not recommended for this project.

## Architecture

Browser workspace → authenticated domain services → native ERPNext documents/ledger. The same authorization applies to UI, imports, reports, files, background jobs and AI tools. Store migration staging separately from posted business records. Private object storage holds originals and attachments; a secrets store holds provider/connector credentials. Durable queues handle bounded imports, report generation and external requests. An audit event links actor, effective context, source, command, target and result.

### 1. Guided migration

Flow: choose source → upload/export manifest → profile columns → map and preview → resolve exceptions → rehearse → reconcile → cut over.

- Start with CSV templates and NetSuite export mappings. XLSX and direct connectors follow the same normalized contract after their parser/API behavior is verified. Do not advertise support for arbitrary ERP schemas.
- Each batch captures source system/account, export time/filter, cutoff/timezone, schema version, file hash, object counts and control totals. IDs/TINs are strings; amounts use explicit decimal/currency semantics.
- Keep immutable input files, versioned mappings and per-row provenance. A normalized record carries source type/ID, source line ID, parent/reference IDs, target company, values and source status. Unsupported fields are reported, not discarded.
- Mapping suggestions are proposals, not silent decisions. Separate invalid values, duplicates, missing references, unknown taxes, inactive masters and rejected permissions. Return downloadable corrections without exposing formulas as executable spreadsheet content.
- Stable key: source system/account + target company + object type + source ID. Repeating identical content reuses the result; changed content requires a reviewed update. Batch restarts resume from durable receipts; no blind retry of non-idempotent writes.
- Dependency order: organizational/accounting settings → units/warehouses/accounts/taxes → parties/items → BOM/routings → balances/open documents → applications/relationships/files. Roles are staged separately and never activated merely because they were imported.
- First operational cutover: masters, open orders, AR/AP open items, stock/lot quantities and valuations, reconciled opening ledger; preserve full older history as a source archive. Full-history replay is a separate choice validated period by period. A coverage report accounts for every exported object.
- Prevent duplicate balances: assign exactly one posting strategy to each period/object. Open AR/AP and stock entries must be reconciled against and excluded from overlapping GL opening postings. Historical archive records are non-posting.
- Rehearsal runs on an isolated copy with external email/payment/webhooks disabled. After validation, use a scheduled source cutoff, delta extraction, final reconciliation and read-only legacy access. Posted corrections use reversals, not destructive rollback; restore is for controlled recovery before cutover acceptance.

First implementation slice: a migration preview for customers, suppliers and items, with template download, column mapping, duplicate/link validation and an explicit no-write preview. Then native draft import with receipts and provenance. Opening balances and historical transactions wait for accounting mapping tests.

Acceptance: malformed data writes nothing; identifiers preserve leading zeros; repeated batches do not duplicate records; changed mappings invalidate stale previews; partial failures resume safely; rejected rows and unmatched references remain visible; final counts and monetary totals reconcile.

### 2. Access audit and enforcement

Preserve the existing 83-role checklist. Evidence records must distinguish observed source configuration, documented product behavior, inferred requirements, target implementation and tested result.

Capture identity-role assignments separately from employees; include inactive/external/service identities and global overrides. For every role collect permission levels, record and subsidiary restrictions, forms/fields, search/report audiences, custom records, workflows, integration scopes and authentication rules. SDF supplements inspection; it omits some role areas. No source access can be audited while the saved browser block remains.

Target policy evaluation considers authenticated identity, authorized active context, company, action, record/field, global rules and workflow state. Never equate NetSuite Full directly with every Frappe action. Unknown mappings deny the action and require review. A policy-versioned decision records the reason.

Critical design constraint: a custom role selector cannot narrow native ERPNext access by itself. Before exposing source-role switching, prove enforcement across `/orbit`, `/desk`, generic APIs, downloads, reports, exports, sockets, background jobs and AI tools. Evaluate a central permission layer integrated with supported Frappe hooks; if an access path cannot be constrained, it must not be available to restricted production accounts. Do not mutate a user's roles globally when switching contexts: concurrent sessions would race.

Revocation invalidates relevant sessions/caches/jobs. Role/company changes clear visible data. Jobs carry the requesting identity/context and recheck permission at execution and delivery. Audit reports may show policy reasons but cannot disclose records the viewer is not authorized to see.

Acceptance: all imported roles have a coverage manifest and allowed/denied cases; two real companies are tested; forbidden fields stay absent from responses and exports; revocation affects open sessions and queued work; changing URL/body identifiers cannot bypass access; creator/approver/payment segregation is proven where required.

### 3. Workflow discovery and operational execution

Use the companion workflow CSV as a proposed manufacturing baseline. It is not a claim about the training account. Every step has purpose, responsible job function, accountable function, actual person when confirmed, inputs, micro-actions, outputs, gate, exception and evidence status.

Discovery method: record configuration → trace representative source documents → observe the operator's micro-actions → compare event history → identify handoffs/waits/rework → validate the map with the process owner. Event logs alone cannot reveal all offline work or business purpose.

Each published workflow definition is versioned. An in-flight case retains its version. Approval delegations have scope, expiry and audit history. No approval threshold is guessed from a role title. Support partials, substitutions, shortages, quality holds, supplier returns, credit notes, cancellations, rescheduling and period restrictions.

UI presents a case timeline, current owner, due date, required evidence, next permitted action and reason for any block. Start with purchasing/production/sales chains; expand into maintenance, fixed assets, HR/payroll and advanced manufacturing only after account discovery confirms requirements.

### 4. Philippine accounting and manufacturing localization

Use a taxpayer profile per legal entity/branch, effective-dated tax rules and a separately versioned output package. Keep configuration and calculation evidence with each issued document. Do not mutate historical invoices when templates or tax rules change.

Manufacturing requires versioned BOMs, units/conversions, material planning, work orders/job cards, material issues and returns, quality holds, finished-goods receipts, lot/serial genealogy where applicable, scrap/rework, subcontracting and actual cost/variance review. Raw material, WIP and finished-goods accounts reconcile to stock valuation and the GL. Financial reporting framework and costing policy are accountant-approved company settings, not inferred from BIR invoicing rules.

Document status and tax eligibility are separate. A missing supplier invoice can leave a transaction recognized with supporting operational evidence while its input-credit treatment is pending review. Capture counterparty, transaction date, amount, purpose, available evidence, missing-document reason, responsible collector, due date and accountant decision. An internal voucher is not automatically a valid VAT invoice. Sales issuance obligations still apply.

Prepare current applicable invoice fields/series, VAT classification, withholding/ATCs and certificates, books and tax schedules. Candidate BIR outputs are listed in the research report; actual applicability is unresolved. BIR submission is a separate, authenticated and logged integration, not automatic when a draft is saved. Track generated, issued, queued, sent, acknowledged, rejected and corrected states without conflating HTTP success with BIR acceptance.

Release requires taxpayer-specific registration review, current official circular/schema verification (including reported RMC 98-2026), accountant-reviewed examples and reconciliation. Neither US NetSuite parity nor generic ERPNext VAT support proves Philippine compliance.

### 5. Provider-selectable AI with app-owned storage

App database stores conversations, message versions, model/provider metadata, tool results, usage and citations; private object storage stores files. Separate personal drafts from shared company records. Business record retention survives employee departure; private chat access and administrator access policy must be explicit.

Provider adapters declare supported capabilities: streaming, tools, images, structured output, context size and cancellation. Initially implement a small verified set; extend by adapters. Compatibility labels do not mean every endpoint supports all functions. Tenant administrators allow providers; users select an allowed provider and either an authorized company credential or their own credential stored encrypted server-side. Restrict arbitrary endpoint URLs to prevent access to internal network services.

Authorize file retrieval and record context before model calls, and reauthorize tools and citations afterward. Embeddings, caches and file indexes are scoped to tenant/user/sharing policy with revocation handling. Uploaded content is data, never an authority to expand tool access. Only minimal necessary context is transmitted; show the provider and sharing scope. Provider-specific retention terms remain applicable to transmitted data.

AI can explain, find records, draft and propose actions. Calculations/postings run through deterministic ERP controllers. Consequential writes require an authorized user to review the exact action; bind confirmation to payload/version and recheck permissions. Use command receipts, tool limits, budgets, cancellation and timeouts. No hidden fallback to another provider and no direct model SQL access.

Acceptance: user A cannot retrieve B's private files or chats; revoked records vanish from retrieval; a malicious document cannot execute tools; provider outage leaves ERP work usable; duplicate tool delivery creates one transaction; budget limits and provider changes are visible.

### 6. Production reliability

The laptop VM stays a development environment. Choose managed Frappe-compatible hosting or a properly operated deployment after sizing and region/cost requirements are supplied. Separate staging/production databases, file buckets, credentials and outbound integrations.

Proposed initial targets, subject to workload validation: 99.9% monthly availability; p95 common list/detail response under 1 second and ordinary save under 2 seconds at 50 concurrent active users with 100,000 representative documents; long operations use observable background jobs. Define measurement from authenticated request acceptance to response, exclude neither failures nor slow queries, and separately measure browser render time. These are targets, not current results.

Proposed recovery targets: RPO ≤15 minutes and RTO ≤4 hours, backed by database log recovery and encrypted off-host backups of database/files/configuration. Confirm achievable hosting support before promising them. Run isolated restore rehearsals and verify counts, checksums, ledger totals, files, login and critical workflows. Keep payment/email endpoints disabled in restore environments.

Add readiness/liveness and worker heartbeat checks, queue age/failure dashboards, disk/DB capacity alerts, sanitized structured logs with request IDs, metrics and runbooks. Explicitly handle retry exhaustion/dead letters and replay permission checks. Use transactional outbox for external side effects. Distinguish worker retry from duplicate business execution.

CI gates: focused unit/integration tests, two-company authorization matrix, accounting reconciliations, end-to-end manufacturing exceptions and load/failure tests. Stage schema upgrades against restored data, back up before release, and define compatible application rollback versus database restore. Do not presume every schema migration is reversible.

### 7. UI/UX delivery

- Role-specific Today page: assigned work, approval queues, shortages, overdue balances and document exceptions.
- Dense/comfortable tables, saved views, configurable columns, server-side sorting/filtering and carefully scoped bulk actions.
- Consistent transaction shell with header status, next action, line items, related records, attachments, approvals and audit timeline.
- Persistent private drafts, clear save/sync state, conflict recovery, keyboard support and accessible focus/error messages.
- Global search only across permitted records; role/company scope always visible.
- Migration wizard and access-audit screens show progress and unresolved evidence without false completion badges.
- AI opens beside the current task, with citations and a preview of proposed changes.

Measure current and new flows on the same tasks/users: time, clicks, errors, completion rate and perceived clarity. Target improvements after baseline measurement; do not claim tenfold improvement without evidence. Test keyboard-only operation, screen-reader labels, contrast, focus, small screens and large datasets.

## Delivery order and evidence gates

1. Migration preview and evidence manifest; retain current working app.
2. Source access audit when available; target policy design/proof before user activation.
3. Complete purchasing → production → sales workflow in native engine, with micro-step coverage and exception tests.
4. Philippine taxpayer profile, invoice/tax rules and accounting reconciliation.
5. Unified workflow UI and persistent drafts; release in vertical slices.
6. AI adapters and app-owned history on top of verified authorization.
7. Production restore/load/release rehearsals; controls develop throughout, not only at the end.

Each subsystem needs its own detailed implementation plan and acceptance evidence. The first plan should cover migration preview only; later phases must not be represented as completed by a navigation link or placeholder page.

## Review questions still open

Required before live tax configuration: VAT registration, legal entities/branches, BIR registrations and manufacturing/costing method. Required before production sizing: realistic record/line/file volumes, concurrent users, hosting constraints and recovery needs. Required for exact source parity: restored authorized access or user-supplied exports plus full workflow evidence. None prevents building the generic migration preview after design approval.
