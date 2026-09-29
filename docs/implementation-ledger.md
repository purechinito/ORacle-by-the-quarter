# Implementation ledger

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
