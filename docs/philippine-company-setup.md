# Philippine VAT companies and bookkeeping scope

User clarification, 2026-09-30: this application is for Philippine operations, with **five registered companies**, **VAT registration**, Cebu branch/RDO context, and a bookkeeper who prepares transaction-to-company assignments. These are user-supplied requirements; the individual Certificates of Registration have not been inspected.

## Confirmed product direction

- Present Philippine companies in the BIR workspace. Use the actual book currency; PHP is the intended setup for the new Philippine entities. Never relabel historical amounts or change a posted demonstration ledger to pesos.
- Keep a distinct native Company and taxpayer profile for each actual legal entity. Record each company's registered identity, TIN, registered address and fiscal year; distinguish branches and their branch codes/RDO scope from separate corporations.
- Record VAT registration per entity from the supplied registration documents. User-confirmed group context is not proof that an individual native record has already been configured or verified.
- Let the authorized bookkeeper prepare the company assignment from the invoice/transaction evidence before posting. Wrong or ambiguous entity, shared cost and intercompany cases require review and appropriate documented accounting treatment; existing posted/linked transactions are not freely movable between companies.
- Use VAT invoices as the sales-document concept, and keep payment receipts and supporting documents as separate evidence types.

## Accounting integrity

This system may become the complete accounting system or a reporting component reconciled to another complete accounting system. That source-of-truth choice remains unanswered. A reporting component must reconcile its imported population, adjustments and reported totals to the authoritative records.

Do not introduce an elective “show to BIR” flag, an alternate ledger containing only selected sales, or receipt-based removal of otherwise reportable transactions. Missing documents remain visible as exceptions for the accountant's tax-treatment decision. Statutory outputs may have lawful scope filters, but those filters and reconciliations must be explicit.

## Information needed to provision actual companies

For each of the five entities: registered legal name and desired unique ERP abbreviation, COR details, TIN/branch code entered privately in the app, registered address, exact RDO code, fiscal year end, and the bookkeeper's permitted companies. Confirm whether Cebu refers to each entity's registered office, a branch, or both. “Cebu” alone does not identify an RDO.

Also establish the authoritative accounting source, opening/migration cut-off, invoice authorities and series, tax/withholding responsibilities, and whether any transactions are intercompany. The source-of-truth choice and exact legal entities must be resolved before implementing the assignment/intake workflow.

## Implemented now versus pending

The default `/orbit` home opens Philippine VAT accounting. Explicit operational section/record routes and the migration route remain available. The BIR company selector uses native permission-filtered Philippine companies. When none are available it shows setup instructions for the five VAT-registered entities, an authorized manager's native Company setup link, and a refresh action. The generic accounting engine and historical diagnostic endpoints retain their existing complete-company permission checks and truthful readiness warnings; the selector is not a new security boundary.

No placeholder legal entities, registered TINs, RDOs, company currencies, new users or taxpayer approvals are created by this localization. Native Company creation has downstream accounting/master-data effects and is deferred until actual identities are supplied. The transaction-assignment/intake workflow, entity-specific VAT configuration and reconciled reporting-source connection are pending.

## Source checks for this clarification

- [RR 7-2024, section 6](https://bir-cdn.bir.gov.ph/BIR/pdf/RR%20No.%207-%202024.pdf) specifies registered seller identity and TIN/branch information for invoices. Evidence-based company assignment is an engineering control derived from that identity requirement.
- [RMO 9-2021, sections III–V](https://bir-cdn.bir.gov.ph/local/pdf/RMO%20No.%209-2021.pdf) covers accounting components/report generators, requires affiliated companies to register separately even when sharing software/server infrastructure, and requires declarations concerning the absence of sales/income suppression facilities. A reporting-only label does not by itself settle registration obligations.
- The [official BIR registration RDO list](https://eafs.bir.gov.ph/eafs/registration.xhtml) distinguishes 80 Mandaue City, 81 Cebu City North, 82 Cebu City South and 83 Talisay Cebu. These are examples of why the exact COR jurisdiction is required, not recommendations of an RDO for these companies.
