# 5. Finance and tax department

Study time: about 15 minutes. Most of this is **outside release one**, but you need the vocabulary.

## What finance does
It records the money side of every transaction (the general ledger), collects from customers (AR), pays suppliers (AP), reconciles the bank, handles tax, and approves expenses.

## Documents and status codes
### Expense report: `ExpRept`
| Code | Status |
|---|---|
| B | Pending supervisor approval |
| C | Pending accounting approval |
| I | Paid in full |

This is a two-level approval: the manager first, then accounting.

### System journal: `SysJrnl`
An automatic ledger entry created by the system (for example revaluations). It posts with no lifecycle.

### AR and AP documents
Covered in [01-sales.md](01-sales.md) (invoice, credit memo, refund) and [02-purchasing.md](02-purchasing.md) (bill, payment, bill credit).

## Key concepts
| Concept | Meaning |
|---|---|
| Subsidiary | A legal company. The account has several, plus a consolidated view. |
| Elimination subsidiary | A special entity that cancels out transactions between the group's own companies |
| Accounting period | A month or quarter; closing it locks postings |
| Nexus | A tax jurisdiction where the business must collect tax |
| AR / AP aging | How overdue customer or supplier balances are, in 30/60/90-day buckets |

## Automation in this department (SuiteApps)
| SuiteApp (prefix) | Scripts | What it does |
|---|---|---|
| SuiteTax engine (`ste`) | 65 | Tax calculation, nexus and entity tax setup, OSS (EU one-stop shop) |
| Tax reporting (`str`, `ctr`, `usr`, `vat`) | about 60 | Tax returns, filing authorization, VAT drill-down, US sales-tax analytics |
| Electronic bank payments | over 130 | See [02-purchasing.md](02-purchasing.md) |
| Cash 360 (`cash360`) | 17 | Cash-flow dashboard and order lead-time calculation |

**Lesson:** tax is a whole product. The account needs over 120 scripts just for tax calculation and reporting.

## Quiz yourself
1. Why does an expense report have two approval states?
2. What does an elimination subsidiary do?
3. What is nexus?

<details><summary>Answers</summary>

1. The manager confirms the expense was real; accounting confirms it's coded correctly and allowed by policy.
2. It removes transactions between the group's own companies so consolidated totals aren't double-counted.
3. A jurisdiction where the business has to collect and file tax.
</details>

## What this means for our ERP
- Release one excludes the full general ledger, tax filing and payment collection (per the spec). This study confirms that was the right call: each is a large product on its own.
- We **do** need: a configured currency, a tax mode (inclusive, exclusive or none) and a rate, snapshotted on each sale line (already in plan task 5).
- Later, accounting integration (export to a dedicated accounting tool) beats building our own ledger.
