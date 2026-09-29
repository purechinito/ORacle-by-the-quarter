# Implementation readiness: NetSuite comparison and pilot gate

Date: 2026-09-29
Audience: owner and management (for example Sherwin) deciding when the shop can start a supervised pilot.

## Bottom line
- **The app is ready for a supervised pilot with sample data.** The full shop day was run in a real browser, with three separate staff logins, and every step passed (details below).
- **It is not yet ready for real sales.** Three decisions only the business can make are still open: tax setup, receipts and hosting. See [What only the business can decide](#what-only-the-business-can-decide).
- Compared with NetSuite, the app covers the **counter-shop core**: catalog, stock, purchasing, counter sales, returns, customers and suppliers, staff roles, and daily reports. It deliberately leaves out enterprise modules such as receivables, payables, multi-location, manufacturing and tax filing. Those are listed below in build order.

## How this was checked (2026-09-29)
| Check | Result |
|---|---|
| Automated API and database tests | **74 passed**, including two new regression checks added today that failed before their fixes |
| Typecheck and production build | Pass |
| Browser walkthrough (`tests/e2e/pilot-loop.spec.ts`), headless Chromium at 1280×720 | **5 of 5 passed** (see the list below) |
| NetSuite reference | The connected NetSuite account, read-only. It appears to be a **demo account**: generic subsidiaries, IT-hardware items, demo preload tools. So it shows how an ERP works, not this business's own numbers. |

The browser walkthrough covers these steps from `docs/PILOT.md`:
1. The manager sets up the shop (name, VAT treatment) and creates a counter account and a stock-clerk account.
2. The manager creates and submits a purchase order for 10 units. The **stock clerk** receives 4, then 6. The order closes, a further receipt is impossible, stock rises by exactly 10, and the clerk never sees unit costs.
3. The **counter** cashier scans a part number and presses Enter, sells with cash, and the receipt shows the correct change. Cashiers can't record returns.
4. **Last-unit race:** two people try to sell the same remaining stock at the same moment. Exactly one sale posts. The other cashier keeps the cart and sees a stock message beside the checkout button.
5. The manager records one restockable and one damaged return. Only the restockable unit goes back into sellable stock.
6. Counter and stock accounts calling privileged endpoints directly (staff list, finance, stock changes) are refused by the server.

### Problems found and fixed today
| Problem | Impact | Fix |
|---|---|---|
| The Finance page failed to load accounting periods (server error 500) | Managers couldn't see or close periods | Fixed the ambiguous sort in the query. A regression test now lists periods. |
| On a normal laptop screen (720 px tall), the sidebar cut off **Activity log, Settings and Sign out** with no way to scroll | Owners couldn't reach Settings to configure VAT, a hard blocker | The sidebar now scrolls and uses tighter spacing on short screens |
| A failed checkout (for example, stock sold by someone else) showed its message at the top of the page, out of view | The cashier would think the button did nothing | The message now appears beside the Complete sale button, and the test checks it's on screen |
| No signal when parts have **no reorder point** (the NetSuite study found only 2 of 723 item-locations had one) | A low-stock count can look fine while the setup is simply missing | The overview now says "N parts have no reorder point set" |

### Still not verified
- A real barcode scanner (the test types the code and presses Enter, which is how most USB scanners behave), receipt printers, phones and tablets, and screen readers.
- Real catalog data, and a backup restored onto a separate server.

## NetSuite roles vs our roles
The NetSuite account defines 14 job-function roles. The connector acts as a single integration role, so per-role permission details weren't readable. The mapping below is based on what each job does.

| NetSuite role | Our role today | Notes |
|---|---|---|
| Administrator, CEO, CFO, Controller | **Manager** | One manager role covers configuration, staff, costs, adjustments, overrides and the manual ledger |
| Sales Representative, Customer Service, Sales Manager | **Counter** (Sales Manager is closer to Manager) | Cashiers see only their own sales |
| Inventory Manager, Warehouse Manager | **Stock** for receiving; **Manager** for adjustments | Stock clerks receive goods without seeing costs |
| Purchasing Manager | **Manager** | Only managers create, submit and cancel purchase orders |
| A/R Analyst, A/P Analyst, Accounting Analyst | none yet | Receivables and payables aren't built. See gaps 4 and 5. |
| Project Manager | none | Out of scope |

**Gap:** there's no separation between the person who prepares a document and the person who approves it (maker/checker). NetSuite uses separate approval states for purchase orders, bills, returns and counts. For a small shop with one owner-manager, three roles are enough for the pilot. Add approval separation before hiring separate purchasing or accounting staff (row M13.3 in `FULL-ERP-COVERAGE.md`).

## Department comparison
| NetSuite department | NetSuite capability | Our app | Needed for pilot? |
|---|---|---|---|
| Sales | Cash sale (sale, stock and payment in one step) | ✅ Counter sale with tender and change | Yes, done |
| Sales | Returns: authorization → receipt → credit or refund | ✅ One posted return linked to the sale, with restock/damaged and refund status | Yes, done |
| Sales | Sales orders, partial fulfillment, invoices, customer credit | ❌ Not built | No, unless customers buy on account (see decisions) |
| Sales | Special order (sales order creates a purchase order) | ❌ Not built | No |
| Purchasing | Purchase order → partial receipts | ✅ | Yes, done |
| Purchasing | PO approval, vendor bills, three-way match, payments | ❌ Only managers submit; no bills or payables | No |
| Purchasing | Vendor returns and credits | ❌ | No |
| Inventory | Immutable movement ledger, adjustments with reasons | ✅ | Yes, done |
| Inventory | Opening stock import | ✅ Preview first, once per part | Yes, done |
| Inventory | Physical counts with approval | ❌ Adjustments only | Recommended soon after the pilot |
| Inventory | Multi-location, transfers, bins | ⚠️ One location; bin is a label | No |
| Inventory | On hand vs committed vs available | ⚠️ On hand only (no reservations) | No |
| Inventory | Lot and serial tracking | ❌ | No |
| Manufacturing | Assemblies, work orders, BOM | ❌ Out of scope | No |
| Finance | General ledger | ⚠️ Manual journals, periods, trial balance only; sales don't post to the ledger | No, keep the current bookkeeping during the pilot |
| Finance | Bank payments, bank reconciliation | ❌ | No |
| Finance | Tax engine and filing | ⚠️ One shop-level VAT mode and rate, snapshotted per sale | Needs the tax decision |
| Finance | Cash drawer / deposits | ❌ No end-of-day cash count | Recommended soon after the pilot |
| Reporting | Standard reports and saved searches | ⚠️ Daily sales, payments, returns, stock, low stock, outstanding POs, CSV export | Yes, sufficient |
| Admin | Roles and permissions | ⚠️ Three fixed roles, enforced by the server | Yes, sufficient for the pilot |
| Admin | Audit trail | ✅ Activity log of posted actions and sensitive changes | Yes |

## Recommended build order after the pilot starts
Ranked by value for an auto-parts counter shop, using what the NetSuite study showed is common:
1. **End-of-day cash drawer count**: expected cash against counted cash, with the difference recorded. This is the counter-shop version of NetSuite's "cash sale → deposited".
2. **Physical stock counts with manager approval**: how shrinkage gets caught. NetSuite runs counts as count → approve → adjust.
3. **Reorder-point setup help**: bulk-set reorder points by category and flag parts without one during import.
4. **Customer accounts (receivables)**: only if the shop sells on credit (invoice now, pay later). In NetSuite this is the sales order → invoice → payment chain.
5. **Supplier bills and payables** with a three-way match (order, receipt, bill).
6. **Approval separation** (maker/checker) for purchasing and adjustments.
7. Special orders, supplier returns, multi-location transfers.

## What only the business can decide
These block **real** sales, not the sample-data pilot. The app deliberately refuses to guess them.
1. **Business identity and tax registration:** registered name and TIN. Is the business VAT-registered? If so, are prices VAT-inclusive or VAT-exclusive, and at what rate?
2. **Receipts:** the app prints an *operational* sales receipt, not a BIR-registered official receipt or sales invoice. In the Philippines, issuing official invoices from a computerized system generally requires BIR registration or accreditation of that system. **During the pilot, keep issuing official receipts the way the shop does today.** Confirm the requirements with the shop's accountant before relying on the app for this.
3. **Credit customers:** does anyone buy on account? If so, receivables move up the build order.
4. **Hosting and backups:** where the app runs (a shop PC or a cloud server with PostgreSQL), who operates it, how long backups are kept, and a restore test onto a separate database. Note that a static Vercel deploy can't run the app: it needs a Node server and a database. Login throttling is per IP address, currently 10 logins per minute. If the app is hosted online, every device in the shop shares one public address, which is fine for a small team.
5. **Catalog data source:** where real part numbers, barcodes and fitment come from, and who is responsible for their accuracy.

## Pilot plan (suggested)
| Week | Goal | Exit check |
|---|---|---|
| 1 | Sample data only. Owner, one cashier and one stock clerk run the checklist in `docs/PILOT.md` on the shop's real devices, scanner and printer. | Every checklist row passes; problems are logged as issues |
| 2 | Import a real subset (about 200 fast-moving parts) with an opening-stock count. Run alongside the current system for **stock only**. | Stock in the app matches a physical spot-check of 20 parts |
| 3–4 | Record real counter sales in parallel with the current receipting. Reconcile daily. | Daily totals match the current system; no unexplained stock differences |
| Then | Decide on cutover with the accountant | Tax, receipt and backup decisions are signed off |

Pre-planned pivots:
- If the scanner doesn't send Enter after each code, configure the scanner's suffix setting. The app already handles Enter.
- If daily reconciliation fails, pause the parallel run, compare the movement ledger with the day's receipts, and fix the process before continuing. A failed day is data, not a reason to abandon the pilot.
- If a credit customer shows up during the pilot, record the sale as "External payment recorded" and track the balance outside the app until receivables are built.
