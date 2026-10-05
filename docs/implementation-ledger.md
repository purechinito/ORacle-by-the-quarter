# Implementation ledger

## 2026-09-30 — Philippine VAT company context

- User clarified five VAT-registered Philippine companies, Cebu branch/RDO context, and bookkeeper-prepared company assignment. Recorded the confirmed context and remaining identities/source-of-truth questions in `docs/philippine-company-setup.md`.
- Bounded localization: `/orbit` now opens Philippine VAT accounting. Explicit sales/record/migration routes are preserved. The BIR selector queries only native permission-filtered Philippine companies. With none configured, it shows five-entity setup guidance, native Company setup and refresh, without unusable report filters.
- This selector is product relevance, not an additional security boundary. Historical diagnostic endpoints retain existing authorization and non-Philippine readiness warnings. No record suppression/receipt-only subset, reassignment command, legal entity, tax identity, user grant or currency conversion was introduced.
- New native selector regression failed for inclusion of the US demo, then passed after the filter. Existing BIR fixtures failed after a profile had been saved through the UI; isolated profile fixtures within their existing rollback savepoints, preserving the actual saved note.
- Installed image `orbit-erp:60167395f6cbd407`; build passed and all 78 tests passed. Chrome verified default accounting home, refresh, native Company setup redirect, preserved sales route, return to BIR and 390px layout without page overflow. No warning/error logs captured. Post-suite check confirmed zero persistent Philippine test companies, unchanged US/USD demo metadata, and the saved profile still present.
- No material findings in independent review. Screenshots: `docs/verification/2026-09-30-philippine-setup.png` and `docs/verification/2026-09-30-philippine-setup-mobile.png`. Actual five-company configuration, assignment/intake and reconciled reporting-source integration remain pending legal identities and scope clarification.

## 2026-09-30 — Philippine accounting review workspace

- User asked to revise the ERP for BIR readiness. Implemented accounting-review preparation within the approved manufacturing design; this release does not establish BIR registration, government approval or live taxpayer compliance. Keep one complete ledger, with missing documentation visible for accounting review.
- Plan: `docs/superpowers/plans/2026-09-30-bir-review-workspace.md`. Operating guidance and limits: `docs/bir-review-guide.md`. Current primary-source requirements, including the September 2026 electronic-invoicing circular, are recorded in `docs/research/2026-09-30-bir-readiness.md`.
- Added `/orbit?view=bir` with company/fiscal-year/date selection, unresolved readiness requirements, saved taxpayer profile, native General Ledger/Trial Balance/Balance Sheet/Profit and Loss reports, voucher links, invoice references and visible attachment counts. Attachment presence is not treated as invoice sufficiency or input-tax eligibility.
- Taxpayer facts remain blank or Unconfirmed until supplied. Profile changes use native permissions and Version tracking, CSRF and optimistic conflict checks. Format validation accepts numeric and letter-suffix RDO codes, including 039, 17A and 25B; the new regression first reproduced rejection of 17A. Supporting registration documents use native attachment permissions; sensitive evidence belongs in private files.
- Added a dedicated Orbit BIR Reviewer role without activating any person or granting an existing user access. Its accounting grants omit create/write/submit/cancel/delete/share/email/import. It requires a clean user and explicit Company User Permission because Frappe roles are additive.
- Security finding: native query reports accepted the reviewer's unauthorized-company filters. Twelve expected-denial assertions reproduced this across four reports and two company contexts. Removed the reviewer's native Report/Custom Role grants, preserving other roles. The custom endpoint performs complete company and accounting-field checks before running only its four fixed native report controllers; native document drilldowns retain their own permissions.
- The review endpoint rejects nonCompany restrictions, owner-only accounting grants, unavailable required fields, filtered source counts, out-of-year date ranges and future opening entries that could distort the requested period. It identifies default-finance-book scope and flags additional books. Size limits reject oversized reviews instead of silently omitting rows; tables show at most 100 rows while exports retain all returned report rows.
- Added a review ZIP with native report CSVs, invoice register, readiness checks, profile/filter metadata, generation actor/time and SHA-256 file hashes. Textual formula prefixes are neutralized; numeric signs are preserved. Export requires native export rights. The ZIP is neither a validated BIR Standard Audit File nor a filing, immutable archive or digital signature, and it does not contain the source attachment files.
- Tests cover reviewer document reads and denied writes, cross-company and native report denial, tracked profile changes, format validation, reporting/reconciliation without accounting writes, stale profile saves, export content, and HTTP session/method/CSRF boundaries. The previous release run exposed a first-write CSRF gap; the endpoint now explicitly checks the session token. The final installed image passes all 77 tests, including 22 new BIR checks.
- Image `orbit-erp:0682cacb4d472380` built successfully. Chrome verified report generation, profile rejection/recovery/save, dirty-form protection, native invoice links and 390px layout. The ZIP endpoint passes HTTP tests, but browser download delivery is blocked by Chrome's organization policy; no bypass attempted. Full evidence and limits: `docs/bir-review-verification.md`.
- The existing Orbit Demo Company remains United States/USD with synthetic posted records. No values were relabeled as pesos. Actual legal entity/branches, Philippines/accounting-currency setup, registered taxpayer facts, chart of accounts, reconciled opening balances and accountant review remain required; actual migration is not implemented by this workspace.
- Remaining readiness work includes authentic CAS/books registration evidence and applicable invoice/EIS authorities; approved invoice layout/series/correction controls; tax and withholding mappings plus validated schedules; manufacturing inventory/WIP/finished-goods reconciliation and applicable statutory inventory output; production hosting, recovery tests, retention/legal holds and audit controls. Exact NetSuite account/role parity and other approved expansion work remain open.

## 2026-09-29 — migration preview

- User approved the manufacturing expansion design and explicitly said to start building. Implementing its first migration-preview slice inline; later subsystems remain pending.
- Ruling: reuse the clean dedicated CLONE ORACLE checkout on `codex/public-erp-references` because its active local runtime/build scripts depend on it; no new checkout or production deployment is needed.
- Plan: `docs/superpowers/plans/2026-09-29-migration-preview.md`. Parser → authorized endpoint → wizard share the documented JSON contract. Preview is intentionally non-persisting; no import command is exposed.
- Task 1: nine pure-parser tests first failed for the absent module, then all passed. Checks include multiline CSV, leading zeros, limits, duplicates, mappings, boolean validation and full counts with bounded issue output.
- Task 2: six database-backed preview tests first failed for the absent endpoint module. Authorization and reference checks now under implementation.
- Task 2 findings: direct Python test calls have no HTTP session object, so CSRF/options verification moved to real HTTP tests rather than weakening the endpoint. The scoped manager fixture requires native Sales Master Manager grants, not Sales Manager. Six data/permission tests and two HTTP tests then passed.
- Additional negative input test reproduced acceptance of null and query-operator company inputs; validate the exact company string before using native filters. Final runtime verification is pending the rebuilt image.
- Task 3: confirmed the migration URL still showed Sales before implementing the wizard. Connected source selection, column mapping, live preview, counts/issues, templates and JSON review download. No source data is stored in localStorage/sessionStorage or uploaded as a File record.
- Fresh reviewer identified ambiguous normalized header suggestions. Added a failing regression for `customer_name` plus `customer name`, then left ambiguous targets unmapped. All ten parser tests now pass. Timestamp output now carries UTC offset; form controls have stable accessible names.
- Release verification: image `orbit-erp:786ce91d2e6abf7d` installed; TypeScript/Vite build and all 55 current tests passed. Strict company validation, native permissions, CSRF and no-write checks passed on the rebuilt runtime.
- Chrome verified customer/supplier/item examples, malformed-input recovery, required remapping, duplicate/reference/existing-record issues, unmapped columns and downloaded JSON without raw rows. At 390px, page width remained 390px. File-picker automation remains unverified because the extension does not allow file URL access; pasted CSV and samples work, and no permission bypass was attempted.
- Migration preview is delivered; actual import and the other approved expansion subsystems remain pending. Evidence, screenshots and limitations: `docs/migration-preview-verification.md`.

## 2026-09-29 — foundation execution

- User approved ERPNext/Frappe foundation and explicitly directed implementation; reported NetSuite unblocked.
- Previous turn classification: no implementation progress; it supplied permission-setting guidance. Current goal begins by revalidating external state and implementing the runtime.
- Ruling: execute the approved foundation inline and record the plan without another general permission handoff. The user's explicit instruction is to continue building now.
- Host inspected: Apple Silicon arm64, macOS 26.7, 16 GiB RAM, approximately 19 GiB free disk. No Docker/Colima/Lima/Podman/Homebrew/uv found on PATH.
- Plan: `docs/superpowers/plans/2026-09-29-running-erp-foundation.md`.
- Pre-flight: Task 1 produces running site for Task 2 fixtures; Task 2 produces synthetic document IDs for Task 3/4; Task 3 provides user-scoped session for Task 4 commands; Task 5 account evidence governs final Task 6 acceptance.
- Runtime selected and verified: isolated Lima 2.2.0 VM using macOS VZ, official checksum-verified binary, digest-pinned ERPNext/MariaDB/Redis containers; no host filesystem mounts. Approximately 13 GiB host disk remained after provisioning.
- NetSuite retry: existing account tab was rejected by a saved permission setting, despite the user's unblock report. Kept account audit pending and continued local implementation; no bypass attempted.
- Launcher diagnosis: starting a YAML template with an existing instance name requested creation and failed. Corrected startup to query Lima inventory and reuse the named instance. Full stop/start subsequently passed.
- Launcher diagnosis: helper SSH calls consumed piped stdin before the target command. Verified a zero-byte copied test and an empty `cat` response, then preserved input explicitly for the final command. The same `cat` probe returned `stdin-check`, and the real test file executed.
- Fixture diagnosis: ERPNext rejects group-type customer categories. Created explicitly synthetic leaf customer/item/territory groups; retained the native validation rather than bypassing it.
- Task 1: engine site created, version verified, browser sign-in verified, scheduler enabled, backup copied to host, full VM/service restart passed. `scripts/test-engine`: 3 HTTP/session/guest checks + 1 persisted business-journey check passed after restart and after fixture replay.
- Task 2 partial: native sales order → partial delivery → invoice → payment fixture implemented and verified. Procurement, manufacturing, adverse cases, numeric compatibility and multi-company permission checks remain pending.
- Full objective not complete: custom UI and exact NetSuite module/user/role parity remain open. See `docs/runtime-verification.md` for scope and evidence.

### Continuation: purchasing foundation

Previous permission-advice turn was no implementation progress. Revalidated the live runtime: all application services running, MariaDB healthy, source site creation exited 0. Continued Task 2 instead of waiting on the independent private-account permission blocker.

Added a real synthetic supplier/item and native purchase order → partial receipt → bill → payment fixture. Watched the new integration test fail for the missing order, then pass after fixture execution. Replay returned identical IDs. Added native over-receipt rejection and supplier-return/GL tests with transaction rollback; all 7 integration checks pass. No source account data changed, and no money was sent.

Task 1 configuration and operating evidence are ready to commit. Task 2 remains partial: manufacturing, supplier credit/refund, currency/rounding and company-isolation cases remain. Full frontend, all 83 role configurations and replacement readiness are still outstanding.

### Continuation: connected workspace

Previous goal turn was progress: committed the running engine and purchasing tests as `41c8d59`.

Ruling: implement the workspace alongside the remaining Task 2 compatibility work — the verified native sales/purchasing records now support meaningful UI work and usability is an explicit priority — costs if wrong: adapter revisions when unverified source rules are learned; do not mark Task 2 complete.

Ruling: serve the React build through a custom Frappe app on the same origin rather than introduce a separate Next.js proxy — this retains the native session, CSRF boundary and native record permissions without an administrator token — costs if wrong: a later separate frontend deployment requires a reviewed session gateway.

Custom image includes `quarter_erp` with authenticated, permission-filtered paginated reads. No active-role switcher is presented: underlying current-account grants apply, and exact NetSuite role isolation remains pending. Native detail links use the same session.

Watched permission tests fail before the custom app existed. First deployment exposed two integration issues: upstream startup replaces sites/assets with baked assets (fixed by baking the custom app asset link); CSRF generation requires a real HTTP session and was unnecessary in a read-only workspace endpoint (removed from the read API). Production React compilation explicitly resolves NODE_ENV. Build contexts are fresh; asset URLs include content hashes.

Browser evidence so far: real sales/purchase records and progress visible; search produces an empty state and clears correctly; customer invoice shows Paid and zero outstanding. Service replacement interrupted a request, prompting a bounded request timeout and visible retry path.

Expanded suite: 14 passing checks after adding actual pagination records and literal-wildcard search. A duplicate customer PO validation correctly rejected the initial pagination fixture; gave each temporary draft a distinct PO reference and retained the upstream rule. Browser mobile width is 390/390 with table-contained scrolling. Native invoice drill-through succeeds. Stopped/restarted the backend and verified error → Retry → restored live records. Screenshots are in docs/verification. Native socket.io origin mismatch was observed and is explicitly pending in workspace-verification.md.

### Continuation: realtime connection diagnosis

Previous goal turn was progress: committed the connected workspace as `268d4ab`. Runtime inspection confirmed the services running on the custom image.

The pinned upstream proxy rewrote Origin to http://frontend while keeping the external Host. Frappe realtime rejects this mismatch, and uses Origin for its server-side authentication callback. Added a real Engine.IO/Socket.IO session test: failed with Invalid origin before the fix. Added unrelated-origin rejection coverage, then patched only the pinned proxy socket location to validate incoming origins before supplying matching internal Host/Origin at frontend:8080. Native session validation remains unchanged.

Source inspection and Chrome then exposed the browser's initial same-origin polling request, which omits Origin. A separate failing test captured its 403. The local proxy now also accepts missing Origin only with same-origin Fetch Metadata and the exact supported loopback host:port; missing evidence and unrelated origins stay denied. This is local-only configuration, not a general production proxy template.

Realtime result: all 19 integration checks pass in `.runtime/realtime-final.log`. Published a local Administrator-only connection-check event through the backend and observed the exact message in a Chrome dialog, then dismissed it and restored the workspace. Screenshot saved. Proxy build script runs with build-time root to edit the root-owned template, then returns to the original frappe runtime user. Full goal remains active; no parity requirement is closed by this infrastructure fix.

### Continuation: transaction details and related records

Previous goal turn was progress: realtime correction committed as `0ff36b0`. Added a read-only transaction endpoint for the four workspace record types. Watched the new tests fail because the endpoint did not exist, then pass after implementation. Authorize the company and parent through filtered native lists, check the document's read permission, apply native field-level removal/masking, and only then project explicit header/item fields. Related documents are separately queried as permission-filtered parents, with distinct results and an explicit 50-link bound.

Five new integration cases cover real sales/purchase quantities and links, invoices/payments, denied detail reads, and a Sales User whose invoice links are withheld. All 24 checks passed before adding the login deep-link regression. The login test then reproduced loss of record destination; the website controller now preserves only the known section/company/record query fields under a fixed internal /orbit destination.

UI uses a full-width transaction detail component with item quantities, warehouse, amounts, totals and related-record groups. Related orders/invoices stay inside Orbit; receipts/deliveries/payments and editing still open authorized native records. No lifecycle or posting action is fabricated. Applied the React best-practices review: bounded/cancelled requests, primitive effect dependencies, no cross-user data cache, field-safe rendering and focus after intentional record navigation.

Final transaction-detail validation: all 25 integration checks passed in `.runtime/detail-final-tests.log`; browser verified direct-link reload, sales order → custom invoice → native payment entry, and 390px viewport containment. Saved transaction-detail screenshot and returned the tab to the custom invoice. No source account records or permissions changed. Transaction editing, atomic commands and the remainder of full parity remain pending.

### Continuation: draft write boundary

Previous goal turn was progress: transaction detail pages committed as `d64a794`. Added the custom command receipt DocType and native-controller draft save endpoint. Application startup now migrates installed custom schema before workers/backend start. Initial tests failed for the missing module; serial create/retry/update/stale-version/permission/input checks then passed.

Real concurrent HTTP requests exposed MariaDB snapshot error 1020, followed by a missing-savepoint error that obscured it. Traced the original exception from the live server. The command now preserves database conflicts, and the HTTP boundary retries its own full transaction at most three times. A second request gets the committed receipt rather than a second order. A locking document read avoids relying on an earlier consistent-read snapshot.

Ruling: restrict the first draft editor command to changes whose dependent fields are handled safely — preserve existing row data/schedules and require the native ERP for customer/header-schedule changes and in-place item substitution until their dedicated recalculation paths are implemented — cost: these edits remain outside the redesigned form temporarily, rather than silently rewriting advanced data. Full parity remains required.

See docs/draft-command-verification.md for contract and test scope. No custom Save button is exposed yet.

Revalidated the prior running build handle: it completed successfully with image `orbit-erp:8cd2a70c2854b245`. Ran `scripts/test-engine`; all 35 current integration checks passed in `.runtime/draft-final-suite.log`. The new append-line regression previously failed on mixed string/date values; normalization now preserves native schedule semantics and passes both append and individual-schedule cases. This is backend progress, not a completed custom drafting journey.

User confirmed the foundation and explicitly named **NetSuite Next** as the continuing reference. Preserve the full original training-account functions, users and 83-role audit scope; use Oracle's current Next navigation and interaction documentation to guide subsequent custom UI work. The settings screenshot shows default browsing allowed and no visible site exception; it does not establish the cause of the earlier private-site denial. No permission bypass or source-account mutation was attempted.

### Continuation: custom sales drafting and Next reference

Committed the draft boundary as `2473902`. The source account access recheck through the existing Chrome tab was again denied by a saved user permission. No alternate access path was attempted. Research skill delegated a bounded primary-source investigation, recorded in `docs/research/netsuite-next-reference.md`. Captured Oracle's public multi-role profile image; Next role eligibility and Ask Oracle entitlement are distinct, and native Ask Oracle is not inherently a ChatGPT front end. Exact source-role behavior remains unverified.

Added a permission-filtered, bounded, literal name lookup endpoint; its regression failed before implementation. Connected a custom React sales creation form to the verified command. The form preserves request identity before sending, scopes recovery by user/company, prevents editing an uncertain command, and restores it after reload. Unsaved pre-submit entries and closed-tab recovery are still limitations. Applied React review for effect cancellation, bounded body reads, stable accessible field names, no shared user cache and explicit save states.

Chrome validation: invalid item rejected without losing entries; add/remove line worked; corrected draft saved as `SAL-ORD-2026-00002` (USD 75) and survived refresh. Scoped local response interception then reproduced a committed save whose response was lost. Cleared interception, reloaded, and retried the restored command: exactly one new order `SAL-ORD-2026-00003` (USD 50). Database verification matched the receipt and found no draft GL/stock entries. Mobile page width was 390/390; restored default viewport. Both synthetic drafts remain as demo records.

Release image `orbit-erp:14b4d62de518fa57`; TypeScript/Vite build and all 36 integration checks passed (`.runtime/draft-form-release-tests.log`). Screenshots and detailed coverage are in draft-command-verification.md. This advances Task 4 but does not complete it: custom editing, pricing/advanced fields, submission, downstream actions, full Next UI, all source roles, migration, AI and company readiness remain required.

### 2026-10-05: Philippine demo defaults

The native invoice demo exposed the original US bootstrap defaults. Created an explicit, repeatable Philippine setup with a separate synthetic `Orbit Philippines Demo` ledger, PHP price lists, customers, supplier, items and warehouse. Existing posted USD records retain their company, currency and amounts. Backed up the local site before configuration changes; backup files remain outside Git.

New native invoices and custom sales drafts default to PHP with separate 12% output VAT and input VAT templates. The custom draft regression initially found that the native tax helper skipped a document before insertion; materializing the selected master template before insertion fixed the missing VAT. Disabled whole-peso rounded totals so purchase balances retain centavos. Tests cover a PHP 2,000 sale plus PHP 240 VAT and a PHP 200.50 purchase plus PHP 24.06 VAT, with balanced ledger entries and rollback.

The workspace prefers permission-visible Philippine companies and retains explicit authorized access to historical company records with their true currency. Current-operator native list filters and legacy demo dashboard preferences now select the Philippine company without changing permissions or other users' preferences. Standard sales cards use the selected company and base grand totals. Frontend money/date formatting uses `en-PH`. Existing unsaved forms must be reopened to pick up new defaults.

Release image `orbit-erp:bed958da314790de` built and installed successfully. All 91 checks in `scripts/test-engine` passed against the installed build; output is in `.runtime/ph-localization-verified-tests.log`. Separate rollback verification exercised the Philippine sales and purchase fixture cycles and their idempotence. Browser verification confirmed a new invoice with `Orbit Philippines Demo`, peso amounts, the Philippine sales VAT template and a 12% Output VAT row; no invoice was saved. Screenshot: `docs/verification/2026-10-05-philippine-invoice.png`.

This is Philippine demo localization, not certification or completed onboarding of the five real companies. Their registered names, TINs, branch/RDO details, approved invoicing setup and accountant review remain pending. The full bootstrap path on a newly empty database was not run in this verification.

### 2026-10-05: customer credit at order review

Added a read-only customer credit endpoint and an order review panel in the workspace. The native Sales Order now also shows unpaid invoices, overdue amounts, available credits, the configured credit limit and exposure including the saved order directly beneath the approval controls. Its detailed-review link was verified in the browser. The workspace entry action is now **Review order & credit**.

Balances use native posted ledger allocations, native instalment overdue calculations and the native credit-limit hierarchy. The calculation includes other submitted unbilled orders and standalone unbilled deliveries; the current submitted order is counted once. Customer credits are already included in the posted balance. Company scope, document/field/child-field permissions and query completeness are enforced; a partial view fails closed. No user grants, new approval action or credit exception policy were enabled. The exact preparer/reviewer accounts and the requested override policy remain unanswered clarification items.

Watched the initial tests fail for the missing endpoint. Additional permission coverage exposed a child-field leak in overdue totals, which was fixed before release. Actual native invoice/payment fixtures verify partial payments, excess payments retained as credits, paid and cancelled invoices, overdue instalments, booked foreign amounts and order counting. Fixtures roll back. All 104 checks in `scripts/test-engine` passed (`.runtime/credit-review-final-tests.log`). The final native presentation-only adjustment was compiled and installed as `orbit-erp:a854b37d7e26f5ba`; its two HTTP boundary checks passed again, and native/browser verification confirmed the repaired display.

Browser testing found that native dashboard sections live in the Connections tab in this engine version. The final implementation uses the native headline-message area so credit context remains visible beside Submit. Captured native and detailed screenshots in `docs/verification/2026-10-05-native-credit-review.png` and `docs/verification/2026-10-05-customer-credit-review.png`. The synthetic PHP 2,240 demonstration order `SAL-ORD-2026-00004` remains a draft; it was not submitted and creates no accounting or stock entries. See `docs/customer-credit-review.md` for usage and limits.
