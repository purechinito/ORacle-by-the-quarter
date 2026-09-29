# NetSuite study library, by department

Date: 2026-09-29
Source: read-only study of a connected NetSuite account (SuiteQL metadata queries).
Purpose: small, focused study notes. Read one department per sitting.

## Start here
| # | File | What you learn | Time |
|---|---|---|---|
| 0 | [00-how-netsuite-code-works.md](00-how-netsuite-code-works.md) | Records, transactions, status codes, the 12 script types, SuiteQL | 20 min |
| 1 | [01-sales.md](01-sales.md) | Selling, invoicing, customer returns | 15 min |
| 2 | [02-purchasing.md](02-purchasing.md) | Buying, supplier bills, paying suppliers | 15 min |
| 3 | [03-inventory-warehouse.md](03-inventory-warehouse.md) | Stock, receiving, shipping, bins, counts | 20 min |
| 4 | [04-manufacturing.md](04-manufacturing.md) | Assemblies, bills of materials, costing | 10 min |
| 5 | [05-finance-tax.md](05-finance-tax.md) | Bank payments, tax engine, expenses, cash | 15 min |
| 6 | [06-reporting-admin.md](06-reporting-admin.md) | Reports, searches, dashboards, admin tools | 10 min |

Every file ends with **Quiz yourself** and **What this means for our ERP**.

## Important finding: there is no in-house code to copy
The account has **1,052 scripts**. All of them come from Oracle-supplied SuiteApps (bundles), demo-account utilities, or the AI connector itself:
- 958 are owned by the system (owner `-5`)
- the rest are two demo/utility packages (auto lot numbering, "AI Companion", drag-and-drop files, account preload)
- **none** are custom business logic written for this company

The connector exposes script *metadata* (ID, name, type), not source code. The source is Oracle's proprietary code anyway, so it is not copied here. These notes teach **what each piece of automation does and why**, so we can design our own.

## Public-repo boundary
This repository is public. The notes contain standard NetSuite codes (also documented in Oracle's public help), aggregate counts and our own explanations. They contain no customer, vendor, employee or item names, no amounts, no record IDs, no script source and no credentials.
