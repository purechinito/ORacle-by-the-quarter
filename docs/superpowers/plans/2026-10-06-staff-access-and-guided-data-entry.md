# Staff access and guided data entry implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the six real staff members secure personal setup links, separate department access and a guided workspace for preparing genuine data.

**Architecture:** Extend the existing Frappe/ERPNext application with explicit managed staff profiles, server-enforced department policy and narrowly shaped portal endpoints. Reuse native password setup and accounting controllers; store incomplete order intake separately from financial documents. Activate production accounts only after an isolated test release passes its access matrix.

**Tech Stack:** Existing pinned Frappe/ERPNext Python/MariaDB engine; React/TypeScript/Vite workspace; Python unittest and real HTTP integration tests; existing Lima/Docker infrastructure.

**Spec:** `docs/superpowers/specs/2026-10-06-guided-staff-pilot-design.md` (owner approved 6 October 2026).

## Global Constraints

- Preserve existing real records and the working hosted ERP. Do not populate production with synthetic customers, employees, transactions, prices, balances or stock.
- Keep the existing Administrator and purchasing account unchanged.
- AP cannot access AR finances; AR cannot access AP finances.
- Ann Ann can access both AR and AP, including bookkeeping and company assignment.
- The owner distributes first-login links personally. No staff messages are sent by the implementation.
- First-login links are single-use, expire after 24 hours, and are invalidated by reissue or disabling the account.
- One plant handles the entire customer order. Multi-plant allocation is excluded.
- NGOSIOK MARKETING is the provisional company for the migrated order intake. Physical plant selection does not change the selling legal company.
- Use PHP and Philippine company context. Unknown price, tax, balance or stock is not zero.
- The 42 imported shipping guides remain private intake Notes. They are not operational Sales Orders.
- The frozen local engine at `127.0.0.1:8080` is a recovery reference; never run mutating tests or reset scripts against it.
- Do not introduce new paid mail, carrier or hosting services; retain the existing PHP 3,000/month planning budget.

## Review Focus

1. A staff member guesses a native API, file URL, report, batch command or another company's record: deny access without leaking finance or attachment metadata (Task 3).
2. A password link is replayed, expires, or races with reissue/disable: only the latest valid link works; disabled accounts and existing sessions cannot continue (Tasks 3 and 5).
3. Real source data has disabled items, ambiguous units, missing prices or mixed VAT treatment: preserve uncertainty and source identity; never enable everything or post invented values (Task 4).
4. Network retry, double click or simultaneous data edit: produce one intake/draft, detect stale versions and retain the user's input (Tasks 4 and 6).
5. A department has no actionable work, changes scope, or uses a phone/keyboard: show truthful empty states and accessible guidance; do not expose stale counts or inaccessible buttons (Task 6).

---

## Release boundary and file responsibilities

This plan implements the spec's account/security requirements and first-data pilot.
Owner credit approval, whole-order plant claim/preparation, shipping/dispatch,
familiar print layouts and complete order migration need subsequent plans.
No approval, plant or dispatch action is presented as working in this release.
Real master preparation and incomplete order intake are useful independently;
financial posting remains available only to authorized Finance/Owner users.

Paths below are repository-relative. Define `APP = apps/quarter_erp/quarter_erp`
and `DT = apps/quarter_erp/quarter_erp/quarter_erp/doctype` when interpreting paths.

| Files | Responsibility |
|---|---|
| `scripts/staff-test-engine`, `infra/compose.staff-test.yaml`, `tests/staff_http.py` | Separate test volumes/site, safe test target and HTTP client |
| `APP/staff_contracts.py`, `web/src/staff/types.ts` | Shared field names and profile/access/onboarding DTO definitions |
| `APP/staff_setup.py`, `APP/staff_policy.py`, `DT/orbit_staff_access/`, `DT/orbit_staff_company/` | Idempotent managed roles, stored profile/scope and effective access audit |
| `APP/staff_access.py`, `APP/staff_files.py`, `APP/hooks.py` | Authenticated request, document, company and private attachment enforcement |
| `APP/staff_data.py`, `DT/orbit_order_intake/` | Validated master changes and incomplete order intake; no ledger posting |
| `APP/staff_onboarding.py` | Owner-only staff preparation and native password-setup lifecycle |
| `APP/staff_portal.py`, `APP/staff_guidance.py` | Scoped DTO endpoints, next steps and guide preferences |
| `web/src/staff/{StaffHome,StaffAdmin,StaffDataEntry,Guide}.tsx`, `staff.css`, `api.ts` | Department workspace, owner setup-link UI, guided forms and retry behavior |
| `web/src/main.tsx` | Select staff home after authenticated context; preserve unrestricted workspace |
| `APP/staff_release.py`, `scripts/staff-release-audit`, `docs/staff-pilot-runbook.md` | Read-only production gate and reversible six-account rollout |

Each new DocType directory includes its same-named `.json`, `.py` and `__init__.py`.
Do not restructure existing unrelated modules or replace native accounting logic.

## Shared contracts

Task 2 defines Python `TypedDict` contracts in `APP/staff_contracts.py`; Task 6
mirrors their JSON keys in `web/src/staff/types.ts`. Dates are UTC ISO strings;
the UI renders Asia/Manila. Amounts use decimal strings and currency `PHP`.

- `Profile = Literal['Logistics','Inventory','AR','AP','Finance','Owner']`.
- `AccessContext = {user: str, profile: Profile, companies: list[str], restricted: bool, enabled: bool}`.
- `AccessAudit = {passed: bool, findings: list[{code: str, detail: str}], policy_version: str}`; never include secrets or customer financial values in findings.
- `StaffSummary = {user: str, full_name: str, profile: Profile, companies: list[str], state: Literal['Prepared','Ready to invite','Invited','Password set','Active','Disabled'], audit: AccessAudit}`.
- `GuideStep = {id: str, label: str, action: Literal['review_items','prepare_customer','prepare_supplier','prepare_intake','review_intake','prepare_sales_invoice','prepare_purchase_invoice','review_customer_balances','review_supplier_balances'], kind: Literal['start','action','waiting'], count: int | None, waiting_for: str | None}`.
- `HomeDTO = {context: AccessContext, steps: list[GuideStep], guide_dismissed: bool, policy_version: str}`.
- `IntakeInput = {company: str, customer: str | None, source_note: str | None, source_order_id: str | None, delivery_details: str, items: list[{item_code: str, qty: str, uom: str | None, rate: str | None, tax_mode: Literal['inclusive','exclusive','unconfirmed'], tax_category: str | None}]}`.
- `IntakeDTO = {name: str, modified: str, company: str, readiness: Literal['Incomplete','Ready for finance review'], issues: list[{field: str, reason: str}], data: dict}`. `data` is the role-safe projection; Logistics/Inventory never receive prices or financial totals.
- `FinanceDraftDTO = {name: str, modified: str, company: str, kind: Literal['sales_invoice','purchase_invoice'], docstatus: Literal[0], currency: Literal['PHP'], grand_total: str}`. Draft values are native-controller results, not posted balances.
- `SetupLink = {user: str, url: str, expires_at: str}` is owner-only and returned once per issuance. It is excluded from persisted audit JSON and logs.

## Task 1: A safe, isolated engine for access tests

**Files:** Create `scripts/staff-test-engine`, `infra/compose.staff-test.yaml`, `tests/staff_http.py`, `tests/test_staff_test_target.py`. Read existing `scripts/erp`, `infra/compose.yaml`, `tests/runtime_smoke.py`; do not invoke their mutating engine commands.

**Interfaces:** CLI `scripts/staff-test-engine init|run <test-file>|all|stop`; `all` runs only the new staff suite and selected existing regression tests within the isolated project. `tests.staff_http.StaffHTTP` provides `login(user, password)`, `request(method, path, body=None)` and `assert_denied(response)`. Test credentials live in `.runtime/staff-test/engine.env` with mode 0600, outside Git.

- [ ] Write `test_rejects_recovery_and_public_targets`, `test_requires_matching_isolation_marker` and `test_uses_separate_project_volumes`. Assert that port 8080, `erp.superq.ph`, missing/mismatched marker, and shared sites/db volumes fail before any login or fixture write; port 8081 plus matching marker succeeds.
- [ ] Run `python3 -m unittest discover -s tests -p test_staff_test_target.py -v`; confirm failure because the isolated runner/client is absent.
- [ ] Implement project `superq-staff-test`, site `staff-test.local`, bind `127.0.0.1:8081`, private test-specific volumes and a nonce marker stored both in the test site's config and private runner manifest. Reuse the pinned images/existing VM without starting recovery containers. Pass test site explicitly to nginx and socket namespace. Limit runner execution to named repository test files; install/copy the changed app only into this isolated engine.
- [ ] Implement `StaffHTTP` with cookie sessions, CSRF for mutations and a mandatory runner-supplied target; no fallback to `runtime_smoke.BASE`. Seed synthetic company/users only after the marker check. Run target unit tests and `scripts/staff-test-engine init`; assert recovery service state and volumes did not change.
- [ ] Commit only these files: `test: add isolated staff access engine`.

## Task 2: Managed department profiles and effective access audit

**Files:** Create `APP/staff_contracts.py`, `APP/staff_setup.py`, `APP/staff_policy.py`, `DT/orbit_staff_access/*`, `DT/orbit_staff_company/*`, `tests/test_staff_profiles.py`. Modify `APP/hooks.py` install/migrate callbacks.

**Interfaces:** `staff_setup.install() -> None` retains `bir_setup.ensure_bir_role()` and installs only app roles/permissions, not real users. `staff_policy.context(user: str) -> AccessContext | None` returns `None` for unmanaged users. `staff_policy.audit(user: str) -> AccessAudit`; `staff_policy.require(user: str, action: str, company: str | None = None) -> AccessContext` denies disabled, unready or out-of-scope access. Managed marker belongs to Orbit Staff Access, never inferred from role names.

- [ ] Write `test_roles_are_idempotent_and_preserve_unmanaged_users`, `test_ar_ap_are_separate`, `test_finance_has_both_without_security_admin`, `test_scope_is_explicit` and `test_stacked_role_and_share_fail_audit`. Assert install twice preserves existing account roles/permissions; no broad Accounts/Sales/Stock roles for restricted users; Finance cannot prepare accounts or approve orders; unconfigured company is denied; extra role, share or user permission widening access produces `passed=False`.
- [ ] Run `scripts/staff-test-engine run tests/test_staff_profiles.py`; confirm missing module/DocType failure.
- [ ] Implement six `Orbit <Profile>` roles and managed access records with user, profile, Orbit Staff Company child rows, ready flag, policy version, setup timestamps and guide preference. Owner has explicit staff-admin capability; Finance inherits native bookkeeping capabilities only within configured companies. Ordinary staff initially have only NGOSIOK MARKETING. Store managed roles separately from pre-existing permissions; never strip Administrator/purchasing roles.
- [ ] Implement the audit using effective roles, shares, user permissions, company configuration and expected Custom DocPerm grants. Managed restricted users get no shared Payment Entry, Journal Entry, GL Entry or financial submit rights. Restricted portal operations use constrained services defined in Task 4 rather than broad native write grants. Only Finance/Owner get native financial posting. No plant accounts are installed.
- [ ] Run profile tests; assert each synthetic six-profile fixture produces its expected capabilities and forbidden grants fail the audit. Commit: `feat: define managed department access profiles`.

## Task 3: Enforce the policy beyond navigation and close file leaks

**Files:** Create `APP/staff_access.py`, `APP/staff_files.py`, `tests/test_staff_access.py`, `tests/test_staff_access_http.py`. Modify `APP/hooks.py` and managed branches of `APP/api.py`, `APP/commands.py`, `APP/credit.py`, `APP/bir.py`, `APP/migration.py` only where needed to deny or delegate.

**Interfaces:** `staff_access.enforce_request() -> None`; `staff_access.document_permission(doc, user=None, permission_type=None) -> bool | None`; `staff_access.query_conditions(user=None, doctype=None) -> str | None`; `staff_files.authorize(file_name: str, user: str) -> None`. Returning `None` leaves unmanaged native behavior intact. A shared `staff_access.authorize_route(user: str, method: str, path: str, command: str | None) -> None` makes the default-deny decision testable.

- [ ] Write a table-driven six-role matrix in `test_staff_access_http.py`. Assert AP cannot read AR via REST v1/v2, legacy `cmd`, batched requests, doc methods, report/export, search/link helpers, print, related Payment/GL records, or attachment names/content; assert symmetric AR/AP denial. Include native whitelisted helpers with bypassed doctype permission checks, cross-company filters, guessed document names and mixed-order photo pages. Logistics/Inventory DTOs omit debt, credit, bank, rate and total keys recursively.
- [ ] Write `test_disabled_session_is_immediately_denied`, `test_company_change_revokes_cached_scope`, `test_owner_finance_source_photos_only` and `test_unmanaged_account_behavior_unchanged`. An already authenticated cookie fails on its next request after disable; role/scope changes cannot reuse stale context. A whole page containing multiple orders is never made public or copied to a narrower user's attachment list.
- [ ] Run both tests through `scripts/staff-test-engine run <test-file>`; confirm the current native routes permit at least the expected unsafe helper/route or the policy modules are missing.
- [ ] Inspect the isolated pinned Frappe request/auth lifecycle before wiring enforcement. Install the route guard at a hook that runs after session identity is resolved and before dispatch; add an integration assertion that it sees the actual user, not Guest. The allowlist contains only staff portal methods, required authenticated session/logout/password functions and explicitly reviewed harmless boot/static assets. Preserve public native login/reset pages; Task 5's server password-mutation wrapper validates the managed key even for Guest. Unreviewed native financial APIs, batch dispatch and arbitrary document methods remain denied for restricted profiles.
- [ ] Implement document/company/private-file checks for restricted profiles, including native downloads and File metadata. Follow parent record permission before file access; ignore guessed `company` query values as authority. Keep Owner/Finance native routes subject to effective company permissions, while still protecting staff security operations. Re-evaluate enabled/profile/scope per request and invalidate cache on access-record changes. Never log request bodies, tokens or attachment contents.
- [ ] Run both matrix files plus isolated existing workspace/credit/BIR access regressions, using test-only fixture bootstrap where the legacy suite requires synthetic data. Confirm unmanaged Administrator behavior is preserved. Commit: `fix: enforce department scope across routes and attachments`.

## Task 4: Genuine data preparation without invented accounting values

**Files:** Create `APP/staff_data.py`, `DT/orbit_order_intake/*`, `tests/test_staff_data.py`, `tests/test_staff_data_http.py`. Use existing Orbit Command persistence for idempotency. Add scoped methods in `APP/staff_portal.py`.

**Interfaces:** Authenticated portal methods: `list_records(kind: str, company: str, search: str = '', page: int = 0) -> dict`; `save_master(kind: str, company: str, payload: dict, name: str | None = None, expected_modified: str | None = None) -> dict`; `save_intake(command_key: str, payload: IntakeInput, name: str | None = None, expected_modified: str | None = None) -> IntakeDTO`; `get_intake(name: str, company: str) -> IntakeDTO`; `save_finance_draft(kind: str, command_key: str, company: str, payload: dict, name: str | None = None, expected_modified: str | None = None) -> FinanceDraftDTO`. Implementation lives in `staff_data`; portal methods infer the actor exclusively from the session. `list_records` returns `{records: list[dict], page: int, has_more: bool}` with 20 rows per page; kinds are `customer`, `supplier`, `item`, `intake`, `sales_invoice`, `purchase_invoice`. `save_master` returns `{name: str, modified: str}`; field allowlists define the response projections too.

- [ ] Write `test_disabled_item_requires_specific_verification`, `test_unconfirmed_price_and_tax_stay_incomplete`, `test_mixed_tax_modes_are_preserved`, `test_duplicate_source_is_not_second_order`, `test_retry_is_idempotent` and `test_stale_edit_preserves_saved_version`. Assert missing rate remains `None`, tax remains `unconfirmed`, and unknown UOM blocks readiness; no native Sales Order/invoice/stock/GL is created; a retry returns the same name; changed payload under the same command key is rejected; stale `modified` returns a conflict without overwriting.
- [ ] Write `test_master_write_capabilities_and_field_allowlists`, `test_ar_ap_drafts_never_post` and `test_invoice_balances_are_own_department_and_company_only`. AR may prepare Customer contact/tax details but cannot change credit limits; AP may prepare Supplier but cannot touch Customer; Inventory may verify an existing Item's specific UOM/code mapping but cannot submit stock adjustments; Logistics can only select permitted operational customer/item projections and prepare intake. AR can save a verified native Sales Invoice draft; AP a verified Purchase Invoice draft; both remain docstatus 0 with no GL/stock/payment effects. AR cannot read or prepare supplier bills, nor AP customer invoices. Finance/Owner review prices/tax/company assignment. Client-provided roles, owner, docstatus, hidden financial fields, unknown keys and cross-company financial links are denied.
- [ ] Run both files in the isolated engine; confirm missing methods/DocType failures.
- [ ] Implement intake separate from Sales Order. Store source Note/order identity and links without exposing the whole original Note to restricted users. Keep a unique nonempty source identity when supplied, with transaction-safe command deduplication and optimistic version checks; allow genuinely new orders without a source ID. Scope all referenced Customer/Item/UOM records through the policy and validate positive decimal quantities. Never normalize an absent rate to zero.
- [ ] Implement real master services with per-profile field allowlists and native controller validation. Customer/Item/UOM are global native masters: expose only permitted nonfinancial fields in an authorized company workspace, without pretending each master belongs to one company. Financial documents and source intake retain strict company ownership. Show disabled items for individual verification; do not bulk-enable or guess ambiguous item codes/UOM. Maintain explicit inclusive/exclusive/unconfirmed tax mode per line and real tax classification; Finance determines confirmed prices/tax. `Ready for finance review` requires verified customer, company, items/UOM/quantities, prices/tax and delivery details; it is not approval or permission to dispatch. Restricted operational projections exclude prices even if Finance saved them.
- [ ] Define explicit master payload fields: Customer `customer_name`, `customer_type`, `customer_group`, `territory`, `tax_id`; Supplier `supplier_name`, `supplier_type`, `supplier_group`, `country`, `tax_id`; Item verification `item_name`, `stock_uom`, `uoms` (rows containing only `uom`, `conversion_factor`), `disabled`, `verification_note`. Require a nonblank verification note for item activation/UOM changes and store it as attributable audit evidence, not a nonexistent native Item field. Native controller validations still apply, and item codes cannot be renamed through this API. Operational customer projection contains only name/customer name and authorized delivery details; item projection only name/item name/UOM/disabled. AR/AP may additionally see tax identity and their own invoice/bill fields, not account/bank/credit fields. Any fuller contacts/address editor belongs to a subsequent explicit endpoint review.
- [ ] Implement AR/AP native invoice/bill draft preparation with confirmed genuine customer/supplier, items/UOM, quantities, PHP prices and tax classification/templates; missing prerequisites remain preparation issues rather than invented zero-price financial documents. Reject client totals, submit/docstatus, stock-update flags and shared payment/journal actions. Use the native controllers for calculations, plus command deduplication/version checks; verify draft saves create no GL/stock ledger entries. Show recorded invoice/bill balances only within the viewer's department/company, with an explicit opening-balance completeness caveat; this is not a complete-credit clearance. Finance/Owner retain native posting, outside these draft endpoints.
- [ ] Pin the financial draft payload to `party`, `posting_date`, `due_date`, purchase-only `bill_no`/`bill_date`, and `items` containing `item_code`, `qty`, `uom`, `rate`, `tax_mode`, `item_tax_template`; verify templates belong to the authorized Philippine company. Translate confirmed inclusive/exclusive input into the native tax calculation consistently, preserving original price basis as evidence. Add `test_mixed_vat_draft_total`: one VAT-inclusive PHP 112 line and one VAT-exclusive PHP 100 line, each quantity 1 at verified 12% VAT, yield PHP 200 net, PHP 24 VAT and PHP 224 total, with no ledger entry. Do not accept unconfirmed treatment or a default tax template silently.
- [ ] Run data tests and selected existing draft-command regression tests in isolation. Assert source Notes and existing item codes are unchanged except a specifically authorized item verification. Commit: `feat: add scoped real-data preparation and order intake`.

## Task 5: Owner-only personal setup links and lifecycle

**Files:** Create `APP/staff_onboarding.py`, `tests/test_staff_onboarding.py`, `tests/test_staff_onboarding_http.py`; extend Orbit Staff Access fields and `APP/hooks.py` only for verified native password hooks/overrides.

**Interfaces:** Owner-only portal methods `prepare_staff(roster: list[dict]) -> list[StaffSummary]`, `list_staff() -> list[StaffSummary]`, `issue_setup(user: str) -> SetupLink`, `record_link_shared(user: str) -> StaffSummary`, `disable_staff(user: str) -> StaffSummary`. `staff_onboarding.require_staff_admin(user: str) -> None` admits only the enabled existing Administrator for bootstrap or a passing, ready managed Owner; Finance is denied. Native reset URL remains the password-entry page. `staff_onboarding.validate_setup(user: str, key: str) -> None` applies the managed 24-hour/current-key/enabled checks at the native password mutation boundary, not only when the form opens.

- [ ] Write `test_no_link_before_access_passes`, `test_only_owner_can_manage_accounts`, `test_native_setup_is_single_use_24_hours`, `test_reissue_invalidates_previous_link`, `test_disable_races_with_setup`, `test_real_roster_is_private` and `test_unmanaged_password_reset_unchanged`. Assert exactly 24 hours is expired; replay fails; reissue prevents the old key from setting a password; concurrent disable wins before credential mutation; tokens never enter audit DTO/log messages; Finance cannot issue links. Account preparation sends zero emails and changes no existing account roles.
- [ ] Run onboarding tests through the isolated engine; confirm missing onboarding methods.
- [ ] Inspect the pinned native reset/update-password implementation and reuse its hashing, password validation and login page. Wrap the server mutation for managed setup with row locking, active issuance timestamp/current native key and enabled checks. Do not change global reset expiry or password policy for existing accounts. Reissue invalidates the old native key atomically; disable clears issuance, disables User and invalidates active sessions. Do not create a second password database or return a password.
- [ ] Implement `prepare_staff` with validation of profile/name/email and clean System User roles; use the private approved roster only at release time. Set native welcome/reset email options off explicitly. Permit the existing Administrator to bootstrap Winnie's Owner account without changing Administrator roles; test `test_administrator_bootstrap_preserves_existing_account` alongside the Owner/Finance boundary. Existing accounts with conflicting access require audit review, not automatic role removal. Maintain explicit lifecycle: Prepared → Ready to invite after passing audit → Invited after the owner confirms sharing → Password set after native setup → Active after first successful login; Disabled takes precedence. Preserve normal later account password changes through the native account page. Links are returned once, owner-only, with no-store responses and no automatic email.
- [ ] Run onboarding, replay/race and existing login regressions in isolation. Inspect request/response logging and assert no setup URL reaches ordinary audit records. Commit: `feat: add owner-distributed personal password setup`.

## Task 6: Department home, guided forms and owner distribution screen

**Files:** Create `APP/staff_guidance.py`, extend `APP/staff_portal.py`; create `web/src/staff/types.ts`, `api.ts`, `StaffHome.tsx`, `StaffAdmin.tsx`, `StaffDataEntry.tsx`, `Guide.tsx`, `staff.css`; modify `web/src/main.tsx`; create `tests/test_staff_guidance.py`, `tests/test_staff_journeys_http.py`.

**Interfaces:** `staff_portal.context() -> AccessContext | None`, `staff_portal.home(company: str | None = None) -> HomeDTO`, `staff_portal.set_guide_dismissed(dismissed: bool) -> None`. `staff_guidance.steps(context: AccessContext, company: str) -> list[GuideStep]` computes actionable work from authorized records, never global totals. React `StaffHome({context})`, `StaffAdmin()` and `StaffDataEntry({action, company, onSaved, onCancel})` consume Tasks 2–5 DTOs. `Guide({steps, dismissed, onDismiss, onResume})` supplies accessible help without performing an action.

- [ ] Write `test_empty_home_uses_start_not_red_alert`, `test_counts_are_role_and_company_scoped`, `test_waiting_names_responsible_department`, `test_guide_preferences_do_not_change_permissions` and `test_context_switch_does_not_leak_old_counts`. With zero work, assert Start here and no positive red count; another company's record never increments counts; incomplete price/tax intake indicates Waiting for Finance; guide dismissal never grants a capability.
- [ ] Write HTTP journeys for each profile: login → permitted home → permitted master/intake write → retry → scoped list. Assert unsupported actions/native financial submit attempts fail, and Owner alone can retrieve setup links. Run both files in isolation to confirm missing home/guide methods.
- [ ] Implement scoped home and guide endpoints. Logistics starts at customer-order intake; Inventory at item/UOM verification; AR at customer data and permitted invoice preparation/balances; AP at supplier data and permitted bill preparation/balances; Finance at incomplete intake/bookkeeping; Owner at staff readiness. Use red dot plus text/count for real actionable work, a distinct Start here treatment and neutral Waiting with the responsible person/department. Never imply owner approval/plant/dispatch is available in this release.
- [ ] Implement frontend context bootstrap before rendering any records. Managed staff land on Today; disallowed query/deep links show a useful permission message without loading another workspace. Preserve unrestricted existing routes after the context result. Remove generic All ERP modules links from restricted views. Forms retain input on timeout/conflict, issue one command key per save attempt, and avoid storing prices or setup tokens in localStorage. No sensitive pending-data cache survives logout/profile change.
- [ ] Implement Owner staff table, access findings, copy-link button, expiry and manual Shared confirmation. Ready-to-invite gating must come from the server. Show the existing `/login` page and own-password setup, never a shared password. Add Help me, dismiss/resume, visible focus, keyboard-operable next-step controls and mobile layout at 390px; financial UI formats PHP amounts only.
- [ ] Run `cd web && npm run build` and both new integration files. Verify isolated browser journeys at desktop and 390px: each first useful button is identifiable, no horizontal overflow, keyboard guide opens/closes/resumes, AR/AP forbidden views never flash, interrupted save retains input, and copying a setup link is owner-only. Record screenshots using synthetic accounts only, with setup URLs/passwords out of frame. Commit: `feat: guide staff through permitted first-data tasks`.

## Task 7: Release gate, six-account rollout and private handoff

**Files:** Create `APP/staff_release.py`, `scripts/staff-release-audit`, `docs/staff-pilot-runbook.md`, `tests/test_staff_release_audit.py`; update deployment notes only with nonsecret release verification.

**Interfaces:** `staff_release.audit(site: str) -> dict` and its CLI `scripts/staff-release-audit --site <site> --read-only --output <private-path>` run inside the target bench environment and emit counts, effective access findings, managed user state and release policy version without business contents or credentials. `--site` must be explicit; output is mode 0600. The runbook uses this report as a gate; the audit cannot generate links, send email or activate users.

- [ ] Write `test_audit_is_read_only_and_redacts_secrets`, `test_gate_rejects_access_findings` and `test_rollout_allows_only_approved_six_new_accounts`. Assert zero doc saves/queue sends in audit, no reset key/password in output, unresolved forbidden grants block Ready to invite, and Administrator/purchasing roles plus unrelated account states remain unchanged.
- [ ] Run `python3 -m unittest discover -s tests -p test_staff_release_audit.py -v`; confirm missing audit script/module behavior.
- [ ] Implement read-only audit and runbook. Document private roster input, backup/restore commands already used by this deployment, access findings, account readiness, manual link distribution and separate future workflow scope. No real names/emails beyond what the private owner screen needs are committed. Include a short staff instruction: open personal link, set password, sign in, follow Start here, enter real data, stop at missing information or Waiting for Finance.
- [ ] Run `scripts/staff-test-engine all`, selected existing isolated regression suites, `cd web && npm run build` and `git diff --check`. Have the chosen execution method's reviewer check the branch before deployment; fix findings and repeat only affected checks. Do not claim delivered emails, active staff, BIR certification or operational approval from these tests.
- [ ] Commit: `docs: add gated staff pilot rollout and handoff`.
- [ ] Deploy with the authorized existing Google Cloud release procedure, after fresh private database/files backup and baseline read-only audit. Preserve outgoing Office ERP Notifications settings and working scheduler. Compare existing record counts, protected account roles and private-file permissions before/after. Do not seed production test data or run fixture tests there.
- [ ] Prepare only the six approved real users from `.runtime/department-access-2026-10-06/staff-roster.json`, run production effective-access checks, then mark only passing profiles Ready to invite. If a check fails, keep that user unready and report the concrete issue; do not widen permissions to get past it.
- [ ] Generate personal links only after readiness, present them in the authenticated Owner screen for manual distribution, and report the login URL plus six account names/roles/readiness. Do not place link tokens in Git, screenshots or broad chat output. Confirm the owner can use staff administration; verify forbidden access through read-only checks without resetting any staff password. No automatic invitation emails are sent.

## Self-review and acceptance

Reviewed against the approved spec: Tasks 2, 3 and 5 cover accounts/effective
access/link security; Tasks 4 and 6 cover genuine preparation and guide behavior;
Tasks 1 and 7 cover isolated testing and production preservation. All five Review
Focus conditions have named tests above. Later owner approval/credit completeness,
plant concurrency, dispatch stock effects, financial prints and migration posting
are explicitly deferred; staff must not mistake intake readiness for fulfillment.

Execution requires reviewing this plan and choosing Native or Subagent-driven.
Until that decision, no product implementation or real staff links are activated.
