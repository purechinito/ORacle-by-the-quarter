# Preparing the ERP for a Philippine accounting review

Open [BIR review](http://127.0.0.1:8080/orbit?view=bir) after signing in. This is a local development installation. The workspace and its exports are accounting-review materials, not a BIR filing, CAS registration or electronic-invoice certification.

## Establish the actual company

The intended business setup is now confirmed as **five Philippine VAT-registered companies with Cebu branch/RDO context**. The five legal names, exact branch/RDO registrations and source accounting system still need to be supplied. The BIR company selector shows only authorized Philippine companies; an empty selector becomes a company-setup screen. See [company setup and bookkeeping scope](philippine-company-setup.md).

The existing **Orbit Demo Company** contains synthetic US/USD transactions. Keep them as test evidence. Do not change the currency of its posted ledger or relabel those amounts as pesos.

Create each actual legal entity in native Company setup after confirming its registered name, Philippines jurisdiction, accounting currency, branches, chart of accounts and fiscal year with the responsible accountant. PHP is the expected starting configuration here; any permitted functional-currency exception needs specific review. The bookkeeper's company assignment must follow the transaction evidence before posting, with ambiguous cases held for review. Reconcile imported opening balances and subledgers before actual use. This release does not perform that migration or implement an intake/assignment queue.

## Prepare and inspect a review

1. Choose the authorized company, fiscal year and dates. “Fiscal year to date” provides a convenient review period. All dates must remain within the selected fiscal year; they are never silently clamped.
2. Read every unresolved requirement and review item. A balanced ledger checks arithmetic, not compliance or correctness of every transaction.
3. Enter the actual taxpayer profile: legal name, nine-digit TIN, branch code, address, RDO (including applicable letter codes such as 17A), VAT status and fiscal year end. Keep unknown fields blank/Unconfirmed.
4. Record authentic CAS and books references, invoice-series details and accountant-review information. These fields record supplied facts; they do not verify or generate approvals. Use **Registration record & attachments** to manage supporting documents under native permissions. Keep sensitive registration attachments private.
5. Inspect native General Ledger, Trial Balance, Balance Sheet and Profit and Loss Statement. Follow supported voucher links to the underlying records. Review invoice references and visible attachment counts separately from tax eligibility.
6. Save any profile edits, then download the review ZIP. Generation rereads the current saved data with the displayed company/period filters. Its manifest has a generation time, actor, scope and file hashes. Share it with the intended accountant/reviewer through an appropriate private channel.

The pack includes the full returned native report rows, an invoice register, readiness checks and JSON metadata. It does not include source attachment files, a signed registration dossier, validated BIR SAF, tax returns, withholding certificates, statutory inventory Annex A or certified EIS output. Text that could become a spreadsheet formula is prefixed with an apostrophe; numeric amounts retain their signs. Hashes detect changes but do not provide a digital signature or immutable archive.

During local verification, Chrome reported the ZIP download as blocked by organization policy. The authenticated endpoint passed its export tests; browser delivery requires that policy issue to be resolved by the browser administrator. No permission workaround is included. See [verification evidence](bir-review-verification.md).

## Reviewer account setup

No real person has been activated or given new access by this release. An administrator must select the actual reviewer and authorized company before provisioning a user.

Use a clean System User with only **Orbit BIR Reviewer** as its business role and an explicit Company User Permission. Frappe grants are additive: adding Accounts Manager/System Manager or another write role would grant additional capabilities. Never give a reviewer the Administrator account.

The role can read/export the accounting review and permitted accounting records; it cannot create, edit, submit, cancel, delete, share, email or import those accounting records. Direct native query reports are intentionally unavailable to this role because those report APIs do not reliably authorize company filters before calculating totals. Use `/orbit?view=bir`, whose server checks scope and fields before running its four fixed native controllers.

NonCompany user restrictions, hidden required accounting fields and owner-only accounting grants are rejected by the review endpoint rather than yielding partial or leaked totals. Some stock vouchers remain unavailable to the reviewer because this role does not grant general inventory access. Their ledger entries remain in the report. Additional access needs its own review and tests.

## Current scope limits

- Financial reports use the company's default finance book plus unassigned entries. Additional books are flagged. The invoice register includes all posted invoices in the period and discloses that scope difference.
- Synchronous review is limited to 20,000 historical company GL rows, 2,000 invoices per invoice type and 20,000 visible-candidate attachment records per type. Oversized data is rejected, not silently truncated. The UI displays at most 100 rows per table; the export includes the entire returned report.
- Future-dated opening entries can be included by native GL/TB independently of a requested end date. The wrapper rejects that situation so it cannot silently distort an earlier review.
- Company-scoped profile editing has optimistic conflict protection and native Version tracking. The report pack is generated on demand, not a saved immutable snapshot or export-access audit register.
- The local VM is not a production service with validated off-host recovery, retention/legal holds, availability or complete manufacturing reconciliation.

## Required before claiming live BIR readiness

The real taxpayer's accountant and registration owner must establish applicable CAS/books requirements and retain the actual evidence. Software work remains for approved invoice layouts/series and correction controls, tax/withholding mappings and validated schedules, manufacturing inventory reconciliation, production/audit/retention controls and any applicable electronic-invoice integration.

Official **RMC 98-2026** distinguishes CAS acknowledgement, PTI Electronic Invoice, EIS certification and electronic sales reporting. A CSV/PDF/ZIP download does not satisfy those authorities. The current verified requirements and source links are in [BIR readiness research](research/2026-09-30-bir-readiness.md). Complete the taxpayer-specific requirements and test evidence before presenting this as a live compliant system.
