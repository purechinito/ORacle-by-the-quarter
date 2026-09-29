# Philippine manufacturing expansion: evidence and decisions

Research date: 2026-09-29. This is a discovery report, not a certification, completed migration, or completed source-account audit.

## Confirmed direction

The user wants a manufacturing ERP with easier migration, detailed access auditing, workflows that identify people and small steps, Philippine accounting, selectable AI providers, reliability, and better UX. Files and chat history belong in this application; users choose the AI provider. VAT registration, legal entities, branches, current production ERP, manufacturing method and operational volumes are not yet supplied.

Internal management reports and statutory outputs must reconcile to the same complete accounting records. Transactions awaiting receipts/invoices remain recorded with evidence status and reviewed tax treatment. Internal production movements may need stock/job documents rather than sales invoices; absence of a receipt is not by itself proof of wrongdoing or proof of a tax deduction. No mode should suppress real sales, fabricate support, or maintain a misleading government ledger.

## Current implementation audit

Reviewed `api.py`, `commands.py`, `tests/test_workspace.py`, `tests/test_draft_commands.py`, `infra/compose.yaml`, `scripts/erp`, and existing verification notes. No tests were rerun for this documentation-only review.

| Finding | Evidence | Implication |
| --- | --- | --- |
| Four custom record views and sales draft creation exist | Workspace API and commands | Extend existing document controllers; do not introduce another posting engine |
| Authorization is based on the signed-in Frappe user | `require_user`, `get_list`, `has_permission`, `check_permission` | NetSuite active-role equivalence has not been implemented |
| Field filtering is applied before detail projection | `transaction` calls `apply_fieldlevel_read_permissions` | Useful baseline; not exhaustive field/export/AI access verification |
| Negative tests cover guests, unprivileged users, invalid companies and hidden invoice relationships | Workspace tests | Missing real two-company matrix, revocation, all 83 roles and direct-route parity |
| Sales command has atomic retry receipts | `commands.py` | Pattern can support resumable import; does not prove import idempotence yet |
| Backup copies database and files onto the same host | `scripts/erp` | Need off-host retention and isolated restore proof |
| Services share one local VM | Compose/runtime documentation | Development installation is not highly available production hosting |

## Source-account audit result

On 2026-09-29, the existing NetSuite Chrome tab was located and a read-only snapshot attempted. Browser policy again denied access because of a saved site permission. No alternate browser, API, or indirect access was used to evade it. Thus all 83 detailed role reviews remain pending. Existing evidence establishes 50 custom and 33 standard role definitions, 55 employee records, and one observed identity with five role assignments; it does not establish the full login population.

Mechanical review of the saved checklist confirmed 83 unique role IDs and 18 detail layers per role: **1,494 pending detail cells, zero completed detail cells**. This is a count of checklist coverage, not 1,494 proven permission defects. The new workflow CSV contains 30 unique proposed steps with all actual person assignments explicitly unconfirmed.

### Detailed access model research

Oracle distinguishes permission to a record type from restrictions on particular records. Creation and later visibility may differ. An audit must evaluate actions separately rather than assuming a single ordered permission flag proves all behavior. [Oracle permissions and restrictions](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_3781107123.html)

Where enabled, employee global permissions override conflicting current-role permissions even when lower; Administrator is an exception. Capture the feature setting and employee overrides, not just role lists. [Oracle global permissions](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_N326630.html)

SDF supports custom-role definitions but excludes subsidiaries, forms, searches and dashboards from the supported role fields/sublists. These need supplementary UI evidence. SDF is not a complete permission export or executable ERPNext configuration. [Oracle custom roles as XML](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_4731154857.html)

Role review must include Transactions, Reports, Lists, Setup, custom-record access and unsupported permissions. A catalog entry is not effective-access evidence. [Oracle role review](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_N326209.html)

Audit each existing checklist row across its 18 layers. Record role/source ID, identity assignment, permission key/category/level, restriction predicate, subsidiary scope, field/form access, global override, authentication/integration context, evidence location/time and confidence. Actual named assignees remain unknown until evidence exists; workflow templates use job functions meanwhile.

Effective-access test cases must include allowed and forbidden read/create/edit/approve/cancel/export actions, own/other employee, allowed/other subsidiary, restricted field, report/search, file, API, queued job and AI tool. Log expected result, actual result and reason. Unknown is not pass. Read-only inspection cannot establish successful write enforcement; execute write tests in an authorized isolated test environment.

## Migration research

NetSuite's Full CSV Export explicitly does not export all data. List exports depend on selected views. Preserve IDs as text to avoid spreadsheet precision loss. Combine manifests, record/line exports, relationships, metadata and files, and reconcile against source totals. [Oracle CSV export](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_N464443.html)

ERPNext already provides CSV/Excel templates, validation, import logs and child-row import. This supports a guided wrapper, but source-to-target semantics and full-history migration remain custom work. Native import should not be mistaken for an automatic complete ERP migration. [ERPNext Data Import](https://docs.frappe.io/erpnext/data-import)

Recommend master data plus reconciled opening balances/open documents for the first cutover, with complete source history preserved in a permission-controlled archive. Offer full historical replay as a separate mode requiring equivalent posting validation. Never combine historical postings and overlapping opening balances. This recommendation does not discard the user's full-history requirement: every source record must be accounted for as operational, archived, unsupported, or excluded with a documented reason.

## Philippine requirements register

These are engineering requirements derived from the sources below. Applicability and current filing details must be confirmed for the actual taxpayer before release with its Philippine accountant/RDO. The training account is US edition; reproducing it alone does not establish Philippine compliance.

| Area | Product requirement | Verification before production |
| --- | --- | --- |
| Taxpayer profile | Legal name, TIN/branch code as text, registered address, RDO, VAT status, fiscal calendar, tax registrations, CAS registration evidence | Match registration documents; do not assume VAT status |
| Invoicing | Versioned invoice layouts and numbering; distinguish invoice from payment acknowledgement; retain original issued document and adjustments | Test required fields and applicable registered series against approved setup |
| VAT | Effective-dated tax categories, taxable/exempt/zero-rated distinctions, recoverability and supporting evidence; separate accounting recognition from input-credit eligibility | Accountant-approved examples, mixed lines, discounts, returns and imports |
| Withholding | Applicable ATC/category, rate/effective date, payee status, calculation basis, certificates and tax-payable reconciliation | Determine actual withholding-agent obligations and forms; no single universal rate |
| Books and CAS | Exportable journal/ledger/subledgers, source traceability, system documentation, registration/change history | Confirm CAS/CBA registration process and required outputs |
| Manufacturing | Raw material/WIP/finished-goods valuation, labor/overhead allocation, scrap/rework, subcontracting, physical count variances | Reconcile quantities, valuation, WIP and GL by period |
| Reporting | Candidate outputs: 2550Q, 0619-E, 1601-EQ, 1604-E, 2307, SLSP/QAP/SAWT where applicable | Scope each output to registration and current schema; validate before claiming support |
| Record retention | Configurable legal retention and holds for records, supporting files and original invoice versions | Review current applicable periods and outstanding proceedings; no automatic deletion policy assumed |
| Electronic invoicing | Separate invoice generation, delivery, BIR reporting and acknowledgement states; versioned connector and durable outbox | Confirm coverage, permits/certification, current schemas and outage instructions |

### Primary sources and what was established

- [BIR RR 7-2024](https://bir-cdn.bir.gov.ph/BIR/pdf/RR%20No.%207-%202024.pdf): invoice and supplementary-document distinctions, invoicing/registration/recordkeeping requirements. Use with subsequent amendments, not its original transition dates alone.
- [BIR RMC 77-2024](https://bir-cdn.bir.gov.ph/BIR/pdf/RMC%20No.%2077-2024.pdf): invoicing clarifications, including missing-information implications for input tax. The app must not automatically treat an undocumented expense as eligible input VAT.
- [BIR RMO 9-2021](https://bir-cdn.bir.gov.ph/local/pdf/RMO%20No.%209-2021.pdf): CAS/CBA registration procedures and supporting requirements. Software features alone do not establish taxpayer registration.
- [BIR RR 26-2025 digest](https://bir-cdn.bir.gov.ph/BIR/pdf/RR%20No.%2026-2025%20Digest.pdf): December 31, 2026 issuance deadline for specified covered taxpayers; electronic sales reporting is treated separately. Do not label all manufacturers covered solely by industry.
- [BIR EIS portal](https://eis.bir.gov.ph/): official service/advisory entry point; service availability and delivery acknowledgement must be handled explicitly.

A September 24, 2026 [P&A Grant Thornton alert](https://www.grantthornton.com.ph/technical-alerts/tax-alert/2026/bir-issues-guidelines-on-electronic-invoicing-retains-31-dec-2026-deadline/) reports RMC 98-2026 and additional permit/certification and operational requirements. The official full circular was not retrieved in this pass (the BIR listing exposed only a loading shell). Treat this as an urgent verification item before finalizing the e-invoice adapter, not a verified implementation specification. No BIR accreditation, registration or filing has been performed.

## AI and reliability decisions

App-owned, permission-controlled files/chat/history; separate provider adapters with declared capability support. Provider switching is a new request with visible destination and permitted context, not an invisible resend of business data. External processing remains external even when local history is app-owned. No provider credentials in browser code, logs, or Git. Exact providers/models and credentials remain unconfigured.

Production acceptance needs measured latency, isolation, reconciliation, backup restoration, queue recovery and deployment rollback. Proposed targets belong in the design; none is an achieved SLA. The previous 36 integration checks remain narrow evidence, not a production reliability certificate.
