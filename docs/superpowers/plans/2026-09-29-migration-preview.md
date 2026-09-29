# Migration Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a working, authenticated CSV migration preview for customers, suppliers and items without creating business records.

**Architecture:** A pure Python parser validates bounded CSV and explicit mappings. Frappe endpoints authorize the user/company and check permitted existing records/reference values. A standalone React wizard provides file selection, mapping, validation results and a downloadable review report.

**Tech Stack:** Python standard library CSV/hashlib/json; existing Frappe 16 app; React 19/TypeScript/Vite. No new product dependencies.

**Spec:** `docs/superpowers/specs/2026-09-29-ph-manufacturing-expansion-design.md`, first implementation slice under Guided migration.

## Global Constraints

- Existing ERPNext remains the transaction and ledger authority.
- Unknown mappings must be reported, not discarded.
- Preview writes no business records, files, staging records or migration receipts.
- CSV only for this slice; 2 MiB UTF-8, 5,000 data rows, 64 columns, 4,096 characters per cell. Values/identifiers remain strings.
- Target master data is shared by the current ERPNext site; company selection is migration context, not a claim of company ownership of Customer/Supplier/Item.
- Administrator/System Manager plus target read/create/import permissions are required; companies and reference/existing queries use native permissions.
- User explicitly approved the design and instructed immediate building. Execute inline; no repeated general approval handoff. This plan does not authorize production cutover or data activation.

## Review Focus

- BOM/quoted commas/newlines/CRLF must parse correctly; malformed or ambiguous columns must fail visibly.
- Duplicate source IDs and target names must flag every implicated row; identifiers retain leading zeros.
- Hidden existing records must not leak through preview; uncertain collision checks do not imply safe import.
- File/mapping/type changes during an in-flight request must not show stale results.
- Formula-like text must stay inert in the UI and JSON report; no CSV correction export in this slice.

### Task 1: Bounded parser and mapping validator

**Files:** Create `apps/quarter_erp/quarter_erp/migration_core.py`, `tests/test_migration_core.py`.

**Interfaces:** `profile_csv(content, kind) -> dict`; `validate_csv(content, kind, mapping) -> dict`; `SCHEMAS` declares fields, defaults, required flags and references. Results contain fingerprint, rows/counts, issues with row/field/code/message and unmapped columns. Fingerprint includes type, exact input and mapping; it is provenance, not an authorization token.

- [ ] Write tests for quoted/Unicode data, malformed rows, limits, missing/duplicate headers, required mappings/values, duplicates, boolean values, unmapped columns, formula-like strings and fingerprint invalidation.
- [ ] Run `PYTHONPATH=apps/quarter_erp python3 -m unittest discover -s tests -p test_migration_core.py -v`; expect missing-module failure before implementation.
- [ ] Implement strict parsing and deterministic validation with bounded returned samples/issues.
- [ ] Run the same tests; expect all pass. Commit task.

### Task 2: Permission-checked preview endpoint

**Files:** Create `apps/quarter_erp/quarter_erp/migration.py`, `tests/test_migration_access.py`; modify `scripts/test-engine`, `api.py` and `www/orbit.py`.

**Interfaces:** authenticated `options()` GET; `profile(company, kind, content)` POST; `preview(company, kind, content, mapping)` POST. Preview consumes Task 1 results and checks allowed target/reference records. `options` supplies fields, limits, companies and CSRF token. No saved batch and no import endpoint.

- [ ] Write real Frappe tests for guest/nonmanager denial, invalid company/type, options, invalid references, existing-name conflicts and no-write counts; verify totals remain accurate beyond the displayed issue cap.
- [ ] Run tests against current engine; expect missing-module failure.
- [ ] Implement endpoints with native filtered queries and add suite runner coverage. Preserve `view=migration` through login.
- [ ] Build local workspace image and run endpoint tests; expect all pass. Commit task.

### Task 3: Connected migration wizard and release verification

**Files:** Create `web/src/MigrationPreview.tsx`, `web/src/migration.css`; modify `main.tsx`; add verification note and README link.

**Interfaces:** standalone `/orbit?view=migration` consumes Task 2 endpoints; source bytes are decoded as UTF-8 and remain in component memory only. JSON review downloads include fingerprint/mapping/counts/issues, not raw source rows.

- [ ] Verify missing migration route in browser before adding UI.
- [ ] Build a three-step wizard: source/type/company → mapping → validation. Use existing ivory/slate/teal style, readable tables, associated labels, errors, progress and keyboard focus. Template/example downloads use static synthetic text only.
- [ ] Invalidate old results immediately on edits; abort stale requests and guard async file reads. Provide clear loading, retry, empty, blocked and successful states. Results say preview only and identify shared masters/reference-check limits.
- [ ] Run TypeScript/Vite build and full integration suite. Browser-test valid/invalid CSV, remapping, duplicate reports, JSON download and 390px layout with no page overflow. Confirm no business records added.
- [ ] Run a fresh code review, address material findings, document evidence/limits, commit and retain running app.

## Coverage and deferrals

This plan implements only the approved migration-preview slice and improves its UX. Full import/durable receipts, opening balances, native schema validation, account-role audit, PH localization, AI, manufacturing workflows and production hardening remain later plans. A clean preview is not a completed migration or a guarantee that native import will accept every row.
