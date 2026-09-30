# BIR review workspace verification — 2026-09-30

## Delivered and tested

Local runtime: `http://127.0.0.1:8080/orbit?view=bir`. Installed image: `orbit-erp:0682cacb4d472380`.

`scripts/build-workspace` completed successfully, including the TypeScript/Vite build and custom application migration. `scripts/test-engine` then exited 0 on that installed image: **77 tests passed**, comprising the existing 55 and 22 new BIR tests (3 export, 8 native access/profile, 9 native review, 2 HTTP). Local logs are `.runtime/bir-final-build.log` and `.runtime/bir-final-tests.log`; runtime logs and credentials are not committed.

Tests exercise complete company authorization, restricted fields and records, read-only reviewer grants, denial of direct native query-report access, exact fiscal dates, future opening-entry rejection, optimistic profile conflicts, native change tracking, export permissions and contents, CSV formula safety, and authenticated HTTP method/session/CSRF controls. The first-session missing-CSRF regression failed before the explicit endpoint check and passes in the final image. Its earlier synthetic profile was removed; no accounting record was modified by that test.

The final independent review found no material flaws in the dirty-form protection, save locking, export state and explicit first-write CSRF patches. This is scoped verification, not a full security audit or BIR certification.

## Browser evidence

Verified in Chrome against the installed runtime:

- Open BIR review, select fiscal year to date and prepare January 1–September 30, 2026. The synthetic company shows 5 unresolved requirements, 6 review items and 1 recorded arithmetic check; no overall compliance badge.
- Native ledger debits and credits both show USD 1,736.00. Two posted invoices have zero visible attachments. The company remains United States/USD.
- An unsaved legal-name draft triggers a discard confirmation before a period change. Cancel preserves both the draft and September 30 end date. Export is unavailable while dirty. The browser automation's dialog handler stalled; native Chrome Cancel completed the same user action.
- A three-digit TIN is rejected with a useful message. Clearing it and saving an explicit synthetic-company note succeeds and refreshes the checks. All actual taxpayer, tax-status, registration and accountant facts remain blank/Unconfirmed. The saved note warns that the demo is not for BIR filing.
- General Ledger, Trial Balance, Balance Sheet and Profit and Loss views render. The observed sales-invoice link resolves from `/app/sales-invoice/ACC-SINV-2026-00001` to the native `/desk/…` record showing Paid and USD 100.00. The direct link was verified in a new tab.
- The download link requests the exact company and selected dates. **Chrome reports “Blocked by your organization” for this download.** No browser policy was changed or bypassed. Actual browser file delivery is therefore blocked, despite passing authenticated HTTP ZIP/manifest/report-content tests.
- At 390 × 844, document width and viewport width both equal 390 px. Controls wrap without page-wide overflow. Desktop sizing was restored afterward.
- No browser warning/error console entries were captured during the final checks.

Screenshots: [desktop](verification/2026-09-30-bir-review.png), [full review](verification/2026-09-30-bir-review-full.png), [mobile](verification/2026-09-30-bir-review-mobile.png).

## Boundaries still open

This is an accounting preparation workspace. Real Philippine taxpayer/company setup, applicable registration evidence, accepted invoice controls, tax/withholding schedules, manufacturing reconciliation, electronic-invoice integration if applicable, and production retention/recovery evidence remain unresolved. See [operating guide](bir-review-guide.md) and [primary-source research](research/2026-09-30-bir-readiness.md). The local demonstration must not be represented as a registered, certified or production-ready Philippine accounting system.
