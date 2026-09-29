# NetSuite workflow study

Date: 2026-09-29
Status: Reference study. Nothing here is implemented code.

## Why this exists
We are building our own auto-parts ERP (see `../superpowers/specs/2026-09-28-auto-supply-erp-design.md`).
Before building each module, we study how a working ERP moves documents through a business,
then re-express those flows in our own words, rules and data model.

## What was studied
A NetSuite account connected through the NetSuite AI connector, queried read-only with SuiteQL on 2026-09-29.
Only structural facts were collected: document types, status values, which document is created from which,
aggregate counts and average days between steps.

## What is deliberately NOT in this repository
This repository is public. Following the design spec's data-boundary rule, it contains:
- no customer, vendor, employee or item names
- no amounts, prices, costs, account numbers or record IDs
- no screenshots, scripts, SuiteScript code, saved-search definitions or other Oracle assets
- no credentials or account identifiers

Counts are rounded context for "how common is this path", not business data.

## Documents
1. [workflows.md](workflows.md) — the observed flows: order-to-cash, procure-to-pay, returns, inventory control.
2. [clone-map.md](clone-map.md) — what we copy into our ERP now, what we defer, and the rules and tests each flow adds.

## Method (repeatable)
1. List transaction types and statuses: `SELECT type, status, COUNT(*) FROM transaction GROUP BY type, status`.
2. Resolve status labels with `BUILTIN.DF(status)`.
3. Map document chains through `transactionline.createdfrom`.
4. Measure average days between linked documents (header lines only).
5. Write the flow in plain language, then translate it into our own module rules. Never copy vendor code or configuration.
