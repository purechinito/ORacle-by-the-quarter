# Philippine operation

This business uses Philippine pesos only. Settings, posting validation and database constraints enforce PHP; users cannot select another currency. Prices, costs, totals, tender and change display as ₱1,234.50. Catalog imports use plain peso numbers such as 1234.50. Stock exports use the file name stock-php.csv and keep the numeric price column compatible with catalog imports. No exchange-rate conversion is performed.

All visible business dates and date filters use Asia/Manila (UTC+08:00), independent of the cashier device timezone. A day's report runs from Philippine midnight through the start of the next Philippine day. Original database timestamps remain intact.

VAT registration and applicable treatment/rate remain unconfirmed until the shop configures them. The pilot provides a single shop-level VAT calculation; it does not infer registration, calculate percentage tax or cover mixed VAT/exempt transactions.

The printable sales summary remains an operational document. Philippine invoicing setup requires separate work: BIR's EOPT regulations define invoice requirements and distinguish supplementary payment documents. See [BIR Revenue Regulations 7-2024](https://bir-cdn.bir.gov.ph/BIR/pdf/RR%20No.%207-%202024.pdf). This localization makes no claim of BIR registration or invoice compliance.

Migration 006 preserves money integrity: incompatible currency settings or posted snapshots stop the upgrade rather than receive a peso label. Backups must match the schema, and restored settings/posted sales must satisfy the same peso constraints.
