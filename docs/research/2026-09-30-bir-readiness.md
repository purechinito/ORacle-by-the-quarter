# BIR readiness requirements for Orbit manufacturing

Verified on 2026-09-30 against official BIR publications. This is an engineering requirements register, not a taxpayer registration, certification, legal opinion, or proof that the present application meets these requirements. It updates the 2026-09-29 discovery report: the official **RMC 98-2026** has now been retrieved and read.

## What “ready” must mean

Distinguish three statuses in the product: **prepared for accounting review**, **documents submitted**, and **registration/authority evidenced**. A checklist completion percentage, preview export, installed ERP, or polished demonstration cannot establish the third status. Store the authority's actual document, scope, reference, date, and verified-by identity rather than generating an approval number.

Use one complete accounting record set. Internal manufacturing movements and transactions awaiting supporting documents remain visible and reconcile to statutory outputs. A missing invoice is a documentation/tax-treatment exception; it must not become a mechanism for suppressing sales or producing a misleading second ledger. This is the product's integrity constraint.

## Verified rules and required artifacts

| Priority | Verified requirement | Engineering artifact / acceptance gate |
| --- | --- | --- |
| P0 | CAS/CBA registration replaces the old general CAS PTU process. RMC 5-2021 removes Form 1900 for this registration, provides an Acknowledgement Certificate after complete documents, and removes mandatory pre-use demonstration while retaining post-evaluation. Major financial-system enhancements require fresh registration; old valid PTUs have specific exceptions. [RMC 5-2021](https://bir-cdn.bir.gov.ph/local/pdf/RMC%20No.%205-2021.pdf) | Registration register for the actual taxpayer and system version; head-office/branch scope; AC or legacy PTU evidence; release history with financial-impact assessment. Never display “BIR approved” based only on software installation. |
| P0 | The current published CAS service requires the applicable sworn/joint statement and system specification (Annex C/C-1 or E), sample invoices/accountable forms, sample books/reports, printed activity log, signed functional/technical checklist (Annex B), plus licensing/representative documents where applicable. [BIR 2026 Citizen's Charter, RDO service 22, p.66 onward](https://bir-cdn.bir.gov.ph/BIR/pdf/BIR%20Citizen%27s%20Charter%20%282026%20Edition%29v2.pdf) | A versioned registration dossier containing those artifacts. Annex B must be evaluated item by item with tests and evidence; this research does **not** assert the current app passes Annex B. Store authentic signed statements privately. |
| P0 | RMO 9-2021 covers full systems and components, including inventory, payroll, journals, ledgers and middleware. Its Standard Audit File definition rejects PDF as the audit-data file. It distinguishes CAS from CBA where invoices are manually issued. Registration jurisdiction and branch arrangements matter. [RMO 9-2021, III–V](https://bir-cdn.bir.gov.ph/local/pdf/RMO%20No.%209-2021.pdf) | Document actual modules, data flows and invoice mode. Produce machine-readable transaction/book data alongside human-readable reports; a CSV review export is not automatically a validated SAF. Confirm the applicable SAF schema before naming an export “BIR SAF”. |
| P0 | Books registration uses ORUS. Computerized books are registered annually within 30 days after taxable-year end or closure, whichever is earlier, subject to authorized extension. Its QR stamp accompanies the transmittal letter describing the USB contents. [RMC 3-2023](https://bir-cdn.bir.gov.ph/local/pdf/RMC%20No.%203-2023.pdf) | Fiscal-year closing packet: book names, covered dates, volumes, record counts, files, transmittal draft, AC reference, ORUS receipt/QR evidence and filing date. Registration is an external action, not completed by downloading this packet. |
| P0 | Invoice details include seller registered identity, VAT status, TIN/branch code, registered address, invoice label, date, serial, quantity, unit cost, description, total and separately stated VAT; buyer fields have transaction-specific rules. Records generally require five-year preservation measured from the relevant filing deadline or late filing, with longer preservation for unresolved material disputes/refund cases. [RR 7-2024, §§4,6](https://bir-cdn.bir.gov.ph/BIR/pdf/RR%20No.%207-%202024.pdf) | Accountant-verified invoice layout and registered series; keep identifiers as text. Retention configuration must account for filing dates and legal holds; do not schedule unconditional deletion five years after transaction date. |
| P0 | Invoices evidence goods/services sales; payment receipts are supplementary. VAT sellers invoice every sale regardless of amount. Mixed-sale invoices distinguish taxable, exempt and zero-rated values. Input-VAT evidence must include sales/VAT amounts, both parties' registered names/TINs, description and date; missing other details does not produce the same input-credit consequence. [RMC 77-2024](https://bir-cdn.bir.gov.ph/BIR/pdf/RMC%20No.%2077-2024%20Digest.pdf) | Separate sale, billing, payment and adjustment events. Validate invoice completeness and tax eligibility separately. Preserve unsupported costs and mark input-VAT treatment for review rather than treating all attachments as qualifying invoices. |
| P1 | RMC 8-2023 changes inventory-list submissions and associated schedules to soft copies on labeled DVD-R/USB plus the prescribed notarized certification. Annex A is the manufacturing/merchandising format for the covered tangible-asset-rich taxpayers. [RMC 8-2023](https://bir-cdn.bir.gov.ph/local/pdf/RMC%20No.%208-2023.pdf) | Inventory/WIP/finished-goods reconciliation, period-end stock counts, costing method and warehouse scope. Map the applicable official Annex A columns and certification before claiming a submission-ready inventory export. Confirm taxpayer applicability and deadline with its accountant. |

## Electronic invoicing: verified September 2026 change

[RR 26-2025](https://bir-cdn.bir.gov.ph/BIR/pdf/RR%20No.%2026-2025%20Digest.pdf) sets 31 December 2026 for specified e-commerce, LTS, large-taxpayer and CAS/CBA/invoicing-software categories. Exporter, incentive and POS coverage has conditional provisions; being a manufacturer alone does not decide applicability.

[RMC 98-2026, issued 22 September 2026, III–IV](https://bir-cdn.bir.gov.ph/BIR/pdf/RMC%20No.%2098-2026%20redacted.pdf) is now primary-source verified:

- Covered non-micro taxpayers retain that deadline. Coverage reaches the taxpayer's head office and branches.
- Obtain a **PTI Electronic Invoice before issuance**; CAS AC does not substitute. System/branch scope and material system changes affect the PTI.
- Structured invoices require electronic buyer delivery and extractable data convertible to the BIR format; current EIS uses JSON. Office-document files or paper printouts alone do not establish electronic invoicing.
- Obtain **EIS certification within six months of PTI**. Sales-reporting obligations and PTT remain separate, subject to BIR implementing direction.
- Preserve issued e-invoices unchanged. Reference the original in corrections: credit note for decreases; new invoice for increases.
- During downtime issue BIR-authorized manual invoices; after restoration replace with corresponding electronic invoices referencing manual numbers.

Implementation gate: treat the adapter as disabled/unverified until official schema tests, authority evidence and taxpayer scope are complete. Keep issuance, buyer delivery, certification and BIR transmission statuses separate. Build a durable retry/outbox and reconciliation process without double-posting downtime replacements. These are engineering recommendations, not a claim of EIS certification. Detailed PTI application rules, ESP rules and adjustment procedures require the further issuances described in the circular. Technical materials are at the [official EIS certification portal](https://eis-cert.bir.gov.ph).

## Unknown taxpayer applicability — retain as unknown

The user has supplied “manufacturing”, not a verified registration profile. Obtain the real legal entity, COR, TIN/branch codes, RDO/LT jurisdiction, VAT/non-VAT status, EOPT size classification, fiscal year, branches, existing AC/PTU, invoice series/authority, e-commerce/export/incentive activities, withholding obligations, actual chart of accounts, currencies, opening balances and accountant owner. Do not fill these from the US NetSuite training account or synthetic demo company.

Tax returns and attachments must be selected from that verified profile. This research does not validate specific 2550Q, 1601-EQ, 2307, SLSP, QAP or SAWT generation, filing connectors, zero-rating eligibility, withholding rates or an excise-tax manufacturing regime. Those require separate taxpayer-specific configuration and current form/schema tests.

## Proposed delivery and evidence order

These are product recommendations informed by the rules above, not additional statutory mandates:

1. **Review workspace:** clear company/period/currency, restricted reviewer access, truthful readiness statuses, journal/ledger/trial-balance drill-down and export with scope and truncation warnings. Reviewer access is an ERP control, not a BIR-mandated account type.
2. **Registration evidence:** verified profile, dossier checklist and private supporting files with owners, review dates and unresolved gaps. No fabricated certifications or automatic government-submission claims.
3. **Accounting proof:** exercise purchase → receipt → raw material → production/WIP → finished goods → delivery → invoice → payment → return, reconciling stock and subledgers to GL. Include missing-document review, tax adjustments and period locks.
4. **Invoice and audit proof:** actual registered-series controls, original/adjustment links, action/actor/time history, export-access tests and no-write reviewer tests. UI read-only styling alone is insufficient.
5. **Operational proof:** restore a separate backup, reconcile restored balances/files, test authorization revocation and company isolation, demonstrate retry recovery, and retain signed accountant acceptance for the real data and reports.
6. **External milestones:** obtain authentic registration/ORUS/PTI/EIS evidence as applicable. A live demonstration can show the workspace and its gaps now; claim production BIR readiness only when the relevant evidence and tests exist.

Research retrieval note: the web reader failed on the newest circular's URL; the official seven-page PDF was retrieved directly from the BIR CDN and text-extracted. RR 7-2024's scanned preservation and invoice pages were visually inspected. No taxpayer filing, credential exchange, registration or external submission occurred during this research.
