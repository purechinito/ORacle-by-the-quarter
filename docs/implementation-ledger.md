# Implementation ledger

## 2026-09-29 — migration preview

- User approved the manufacturing expansion design and explicitly said to start building. Implementing its first migration-preview slice inline; later subsystems remain pending.
- Ruling: reuse the clean dedicated CLONE ORACLE checkout on `codex/public-erp-references` because its active local runtime/build scripts depend on it; no new checkout or production deployment is needed.
- Plan: `docs/superpowers/plans/2026-09-29-migration-preview.md`. Parser → authorized endpoint → wizard share the documented JSON contract. Preview is intentionally non-persisting; no import command is exposed.
- Task 1: nine pure-parser tests first failed for the absent module, then all passed. Checks include multiline CSV, leading zeros, limits, duplicates, mappings, boolean validation and full counts with bounded issue output.
- Task 2: six database-backed preview tests first failed for the absent endpoint module. Authorization and reference checks now under implementation.

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
