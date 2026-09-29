# Running ERP Foundation Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Run the approved independent ERP engine locally, connect a usable company workspace, and verify complete persisted business journeys while retaining the full NetSuite replication objective.

**Primary experience reference (user clarification, 2026-09-29):** NetSuite Next. The existing training account remains the source for its actual functions, users, role restrictions, data and customizations. Public Next documentation guides navigation, conversational interaction and workflow design; it does not prove account-specific configuration or replace any of the 83 role audits.

**Architecture:** ERPNext/Frappe owns documents, stock, accounting, permissions, jobs and files. A custom application and React frontend provide task-oriented interaction without a second ledger. Source-account observations determine configuration and parity work.

**Tech Stack:** ERPNext 16, compatible Frappe 16, MariaDB, Redis, official containers in a local Linux VM if no host container engine exists; React/TypeScript frontend.

**Spec:** `docs/superpowers/specs/2026-09-28-netsuite-replica-design.md`

## Global Constraints

- Separate application in CLONE ORACLE; never modify the source NetSuite account's transactions or permissions.
- Maintain all 83 role audit rows and all required functional parity rows; source catalog names alone are not copied permissions.
- User approved the foundation and explicitly instructed continuing implementation on 2026-09-29. Execute inline without another general authorization request.
- Persist confirmed data; no fake success, placeholder business actions, or frontend-only authorization.
- Local services bind to loopback. No external company deployment or migration cutover is implied.
- Preserve original upstream license/attribution. Pin exact dependencies and deployment images.
- Never expose a shared Administrator API secret to browser code.
- Performance targets remain unverified until measured; no crash-free or complete-parity claims from a smoke test.

## Review Focus

1. Partial shipments/invoices/payments preserve unconsumed quantities and balances — transaction scenarios in Task 2/4.
2. Retry after a lost response cannot duplicate a financial transition — command integration tests in Task 4.
3. Role changes cannot retain broader grants through direct API/native routes — allow/deny tests in Task 3/6.
4. Restart preserves posted data and a backup can restore it — runtime and recovery checks in Task 1/6.
5. Numeric rounding, mixed currencies and company boundaries remain correct — engine compatibility tests in Task 2, before accepting finance workflows.

## File Structure

- `infra/`: version-pinned local engine configuration, VM definition and source provenance.
- `scripts/erp`: start/status/stop/logs/backup operational entry point; does not delete volumes.
- `scripts/bootstrap-runtime.py`: verified local runtime acquisition when Docker is absent.
- `.runtime/`: ignored tools, downloads, logs and development credentials.
- `apps/quarter_erp/`: custom Frappe application for authorized task commands and source mappings.
- `web/`: React/TypeScript application, session proxy, accessible workspace and workflow UI.
- `tests/`: runtime and business integration checks against a named synthetic development company.
- `docs/implementation-ledger.md`: commands, results, decisions and remaining requirements.

### Task 1: A reproducible running ERP engine

**Files:** `infra/lima.yaml`, `infra/compose.yaml`, `infra/versions.json`, `scripts/erp`, `scripts/bootstrap-runtime.py`, `.gitignore`, `README.md`.

**Interfaces:** `scripts/erp start|status|stop|logs|backup` operates only the `clone-oracle` local instance; frontend is served on `http://127.0.0.1:8080`.

- [x] Verify host architecture, disk/memory and existing runtimes. Confirm official image/runtime requirements.
- [x] Pin/download official tools with published hash verification; use a bounded local VM if required, without mounting unrelated host files.
- [x] Configure database, queues, scheduler, realtime, backend and frontend with persistent named volumes and loopback binding. Generate local credentials into ignored mode-0600 files.
- [x] Start services and create a site with ERPNext installed. Inspect site-creation exit status and engine version.
- [x] Verify HTTP login page, successful authenticated API request, service health, clean restart, and persisted site identity. Record observed results, not intent.
- [x] Commit reproducible configuration and operating instructions; keep secrets/data/VM out of Git.

### Task 2: Company configuration and engine correctness

**Files:** `apps/quarter_erp/quarter_erp/fixtures.py`, `tests/test_engine_journeys.py`, `docs/engine-compatibility.md`.

**Interfaces:** `seed_demo(company_name: str)` idempotently creates an explicitly synthetic company, accounts, warehouse, customer/supplier, item and opening stock; returns their IDs.

- [ ] Write integration assertions for a synthetic order → partial delivery → invoice → payment, with linked documents and balance/stock/GL checks.
- [ ] Configure and seed through supported document APIs; run the journey and inspect actual accounting and storage/rounding behavior.
- [ ] Add purchase → partial receipt → bill → payment and BOM → work order → finished stock scenarios, including one return and mismatch.
- [ ] Resolve numeric and company-isolation discrepancies before marking finance parity verified; record unsupported source behavior explicitly.
- [ ] Re-run fixtures without duplicates; retain evidence and source mappings.

### Task 3: Sign-in and useful workbench

**Files:** `web/src/`, `apps/quarter_erp/quarter_erp/api.py`, `tests/test_authorization.py`.

**Interfaces:** user-scoped session; `workspace()` returns only permitted companies, counts and tasks; paginated authorized list/detail operations.

- [ ] Write allow/deny integration cases for lists, detail, company context and logged-out requests.
- [ ] Implement session handling, scoped workspace API and accessible navigation, search, lists, details, loading/error/empty states.
- [ ] Reuse configured native engine capabilities as explicitly identified fallback only when they enforce the same permissions.
- [ ] Verify browser sign-in, navigation, refresh, keyboard operation and denied actions; capture screenshots.

Task 3 progress: connected React workspace and read-only permission API shipped for four transaction views; 14 integration checks plus browser search, native drill-through, mobile and outage recovery observed. Active-role switching, full two-company isolation tests, full custom details and keyboard coverage remain pending. See `docs/workspace-verification.md`.

### Task 4: Redesigned complete order-to-cash

**Files:** sales workspace/forms/process view under `web/src/`; task commands and integration tests under custom app and `tests/`.

**Interfaces:** draft/save/submit/fulfill/invoice/apply commands return authoritative document IDs/state and recoverable validation errors.

- [ ] Write failing scenarios for partial quantities, stale updates, duplicate retries, rejected approval and unauthorized transitions.
- [ ] Implement document-backed actions, draft recovery, line editing, validation summary, linked process view and visible posting/audit results.
- [ ] Verify full browser journey and database effects after refresh/restart; measure actual response times.
- [ ] Commit tested flow with scope-specific coverage status.

Task 4 progress: native-backed sales draft save commands and atomic retry receipts pass eight command cases and two real HTTP cases, including concurrent duplicate retries. The custom form and downstream posting actions remain pending. See `docs/draft-command-verification.md`.

### Task 5: Account audit and remaining parity modules

**Files:** `docs/research/role-audit-checklist.csv`, `docs/research/parity-matrix.csv`, local excluded source captures, module-specific plans and custom app/frontend modules.

- [ ] Recheck restored NetSuite access and resume each role's permissions, restrictions, forms, users, integrations and customization layers read-only.
- [ ] Inventory feature/customization/workflow/report/integration dependencies; capture representative normal and exception paths.
- [ ] Implement and test remaining purchasing, inventory/manufacturing, finance, CRM/services, reporting and extension requirements in module plans tied to the complete parity matrix.
- [ ] Map users separately from employees; never infer grants from role names or copy authentication secrets.
- [ ] Add permission-aware AI using actual configured provider credentials only; no scripted assistant represented as a live integration.

### Task 6: Company readiness and full acceptance

**Files:** operational documentation, backup/restore tooling, integration/load suites, parity and migration reports.

- [ ] Verify source-to-target entity/document counts, balances, stock valuation, subsidiaries/currencies and all role grants using authorized exports/evidence.
- [ ] Exercise direct APIs, searches, exports, files, reports, jobs and AI under restricted roles; deny paths that exceed the active role.
- [ ] Verify restore, restart, failure recovery, concurrency and representative load; measure user journey completion and errors.
- [ ] Perform fresh whole-branch review, resolve material findings, and reconcile every full-objective requirement before claiming replacement readiness.

## Acceptance and scope

Task 1 produces a running foundation, not the completed clone. The objective remains active through all required NetSuite functionality, users/roles, redesigned workflows and company readiness checks. Missing account evidence, external credentials, or runtime prerequisites are recorded with their precise effect; they do not erase requirements or justify fabricated completion.
