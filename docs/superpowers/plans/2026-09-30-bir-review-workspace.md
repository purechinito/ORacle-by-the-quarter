# BIR review workspace implementation plan

**Goal:** Make the ERP easy to inspect for Philippine accounting readiness with a saved taxpayer profile, explicit unresolved requirements, native accounting reports and a reproducible downloadable review pack.

**Architecture:** Extend the approved Philippine manufacturing design. Native ERPNext remains the ledger/report authority. A dedicated reviewer role exposes accounting reads only; custom endpoints validate exact company, period and complete within-company permissions before invoking native reports. Unknown taxpayer settings remain pending. No tax return is filed and no record is hidden for statutory review.

**Spec:** `docs/superpowers/specs/2026-09-29-ph-manufacturing-expansion-design.md`, Philippine accounting section, and the user-approved BIR review requirements in chat.

**Execution:** User explicitly requested revision and implementation. Continue without another general approval handoff. Research and independent UI/access tasks can run in parallel with distinct files. Root integrates and tests; a fresh reviewer checks final changes. Reuse the existing checkout/runtime.

## Constraints and review focus

- Keep original demo accounts/currency intact. Unconfirmed registration, non-PHP currency and missing accountant approval are blockers, not green badges.
- Native CAS registration, accepted invoice numbering/layout, tax mappings, filing/EIS integration, manufacturing reconciliation and production controls require separate taxpayer-specific evidence. The review workspace must show these open obligations rather than claim approval.
- Dedicated reviewer permissions have no create/write/submit/cancel/delete/share/email/import actions. Creating the role activates no real user. Additive Frappe roles require a clean reviewer account.
- Reject restricted-in-company reporting rather than disclose totals computed before native row filtering. Reject nonCompany user restrictions and owner-only GL/Account read permissions at the wrapper; company must be explicitly visible. Native APIs retain their own permissions.
- Require ISO dates within one applicable fiscal year; do not let native TB silently clamp dates. Explicitly name default finance-book scope. Bound GL counts before expensive generation and fail on oversized results, never silently truncate an export.
- Profile writes use CSRF, authorized accountant/manager, native document validation and optimistic modified comparison; track changes. No guessed TIN/tax/registration values.
- Exports contain generated-at, actor, exact filters, counts, SHA-256 file hashes, limitations, readiness checks, profile and reports. CSV textual cells neutralize spreadsheet formula prefixes. Export requires native export rights.

## Task 1: Reviewer boundary and profile

Files: `quarter_erp/bir_setup.py`, `hooks.py`; `quarter_erp/doctype/orbit_taxpayer_profile/*`; `tests/test_bir_access.py`.

- [x] Create failing tests for reviewer read/write boundary, company scope and tracked profile changes.
- [x] Implement idempotent dedicated role setup with explicit minimal document read/report/export/print/select grants. Deny direct native query reports; the custom complete-company boundary runs only the four fixed native controllers. Preserve other roles.
- [x] Implement taxpayer profile keyed by company: legal_name, tin, branch_code, registered_address, rdo_code, vat_status (Unconfirmed/VAT/Non-VAT), fiscal_year_end, cas_reference, books_reference, invoice_series, accountant_name, accountant_review_date, registration_notes. No completeness flag equates to government approval.
- [x] Verify real native document access and no write rights for a synthetic scoped reviewer; roll back fixtures. Eight access tests passed in the prior release run; final complete-suite acceptance remains below.

## Task 2: Accounting review APIs and export

Files: `quarter_erp/bir.py`, `quarter_erp/bir_export.py`; `tests/test_bir_review.py`, HTTP test additions.

Interfaces: GET `options()` returns user, companies, fiscal_years, can_configure, csrf_token. GET `review(company, from_date, to_date, fiscal_year)` returns company/currency/scope/profile/checks/summary/invoices/reports (GL, TB, BS, P&L). POST `save_profile(company, values, expected_modified)` saves allowlisted fields with conflict protection. GET `export_pack(company, from_date, to_date, fiscal_year)` downloads ZIP from the same review generation and export checks.

- [x] Verify invalid companies/date operator inputs, cross-year dates, restricted-company/nonCompany permissions, unauthorized profile save, stale saves, missing taxpayer data blockers and export contents/formula safety. Final suite passes; individual historical test-first ordering is not asserted for every case.
- [x] Build bounded wrappers with explicit report filters. Managers use native query_report.run; dedicated reviewers use native generate_report_result only after complete company/field preflight. Native query report roles remain unavailable to that reviewer. Show attachment presence separately from invoice sufficiency/tax eligibility.
- [x] Generate evidence manifest and native report CSVs. Retain exact native amounts and warnings; no tax computation inferred from invoice totals.
- [x] Verify native ledger/TB reconciliation on real synthetic transactions and no accounting writes. Nine review tests passed in the prior release run; the first-write HTTP CSRF regression required a subsequent fix and final rerun.

## Task 3: BIR review UI

Files: `web/src/BIRReview.tsx`, `web/src/bir.css`, `main.tsx` navigation, `api.py` navigation visibility.

- [x] Confirm missing route before implementation: the BIR URL initially rendered the Sales workspace.
- [x] Implement /orbit?view=bir: company/period filters, visible readiness gaps, profile form, reports with native voucher drilldown, invoice evidence list, downloadable pack. Responsive styles and keyboard controls are implemented; final browser verification remains below.
- [x] Loading/error/retry/conflict states, cancel stale responses on context changes, no taxpayer data cached in browser storage.
- [x] Build final candidate image `orbit-erp:0682cacb4d472380` successfully and document taxpayer/deployment gaps.
- [x] Accept final full-suite results (77 tests), verify browser valid/error/mobile flows and resolve fresh-review findings. The export endpoint passes HTTP tests; Chrome organization policy blocks actual browser delivery. See `docs/bir-review-verification.md`.

Commit/push is recorded in Git history after final verification rather than treated as a compliance gate.

## Completion boundary

This implementation makes accounting review concrete and records the remaining readiness gates. It cannot itself supply the user's registration records, perform accountant sign-off, register CAS/books, certify invoices/EIS, or turn the local development VM into an approved production system. These must remain visibly unresolved until proven.
