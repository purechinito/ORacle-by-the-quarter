# 0. How NetSuite "code" works

Study time: about 20 minutes. Read this first; every department file builds on it.

## 1. Everything is a record
NetSuite stores the business as **records**. There are two families:

| Family | Examples | Think of it as |
|---|---|---|
| Entity / list records | customer, vendor, item, location, subsidiary | the nouns: who and what |
| Transaction records | sales order, invoice, purchase order, item receipt | the verbs: what happened |

All transactions share two tables:
- `transaction`: one row per document (the header), holding the document number, date, customer or vendor, and status
- `transactionline`: one row per line (item, quantity, location), plus a special `mainline = 'T'` row that mirrors the header

## 2. Transaction type codes
Every transaction has a short internal type code. Learn these; they appear everywhere.

| Code | Document | Department |
|---|---|---|
| `SalesOrd` | Sales order | Sales |
| `CashSale` | Cash sale | Sales |
| `CustInvc` | Invoice | Sales / AR |
| `CustCred` | Credit memo | Sales / AR |
| `RtnAuth` | Return authorization | Sales |
| `CashRfnd` | Cash refund | Sales |
| `PurchOrd` | Purchase order | Purchasing |
| `VendBill` | Vendor bill | Purchasing / AP |
| `VendPymt` | Bill payment | Purchasing / AP |
| `VendAuth` | Vendor return authorization | Purchasing |
| `VendCred` | Bill credit | Purchasing / AP |
| `ItemRcpt` | Item receipt (goods in) | Warehouse |
| `ItemShip` | Item fulfillment (goods out) | Warehouse |
| `InvAdjst` | Inventory adjustment | Warehouse |
| `InvCount` | Inventory count | Warehouse |
| `InvTrnfr` | Inventory transfer | Warehouse |
| `TrnfrOrd` | Transfer order | Warehouse |
| `BinTrnfr` | Bin transfer | Warehouse |
| `BinWksht` | Bin putaway worksheet | Warehouse |
| `InvWksht` | Inventory worksheet (revalue) | Warehouse / Finance |
| `ExpRept` | Expense report | Finance |
| `SysJrnl` | System journal | Finance |

## 3. Status codes are one letter
The `status` column holds a single letter. **The same letter means different things for different types.**
For example, `B` is "Pending fulfillment" on a sales order but "Paid in full" on an invoice.
To read a status as words, use `BUILTIN.DF(status)`, which returns the label ("Sales Order : Billed").

`Y` usually means "this type has no status lifecycle": the document just posts.

## 4. Documents link with "created from"
`transactionline.createdfrom` points to the parent document. That's how you follow a chain:
sales order → fulfillment → invoice, or purchase order → receipt → bill.

## 5. The script types (where "code" lives)
NetSuite automation is written in **SuiteScript** (JavaScript). Each script has a type that decides *when* it runs.
The counts are from the studied account.

| Type (as stored) | Common name | When it runs | Count |
|---|---|---|---|
| `USEREVENT` | User event | Server-side, when a record is created, edited or deleted (before load, before submit, after submit) | 172 |
| `CLIENT` | Client script | In the user's browser while they edit a form (validation, defaulting fields) | 100 |
| `SCRIPTLET` | Suitelet | A custom page or backend endpoint inside NetSuite | 353 |
| `RESTLET` | RESTlet | A custom REST API endpoint for outside systems or mobile apps | 179 |
| `SCHEDULED` | Scheduled script | On a timer, as a background job | 73 |
| `MAPREDUCE` | Map/Reduce | Large background jobs split into parallel chunks | 102 |
| `ACTION` | Workflow action | A step called from a SuiteFlow workflow | 13 |
| `PORTLET` | Portlet | A dashboard tile | 10 |
| `BUNDLEINSTALLATION` / `SDFINSTALLATION` | Installer | When a SuiteApp is installed or updated | 24 |
| `PLUGINTYPE` | Plug-in | A swappable implementation hook | 2 |
| `DATASETBUILDER` / `WORKBOOKBUILDER` | Analytics builders | Create analytics datasets and workbooks | 9 |
| `SPASERVERSCRIPT` | SPA server | Backend for single-page apps | 7 |
| `CUSTOMTOOL` | AI tool | Tools the AI connector calls. This is how Claude talks to NetSuite. | 6 |
| `TAXCALCULATION` | Tax plug-in | Calculates tax on transactions | 1 |
| `SHIPPINGPARTNERS` | Shipping plug-in | Carrier rate and label integration | 1 |

**Mental model:** user event = *rules on save*, client = *help while typing*, Suitelet = *custom screen*, RESTlet = *custom API*, scheduled or map/reduce = *background jobs*.

### Naming convention you'll see
Script IDs start with `customscript_`, followed by the SuiteApp prefix, then a type suffix:
`_ue` user event, `_cs` client, `_sl` or `_su` Suitelet, `_rl` or `_rs` RESTlet, `_ss` scheduled, `_mr` map/reduce.
A numeric prefix (for example `customscript_8859_…`) is the bundle number of the SuiteApp that installed it.

## 6. SuiteQL in five minutes
SuiteQL is NetSuite's SQL dialect (Oracle-flavoured).
```sql
-- How many of each document type and status?
SELECT type, status, COUNT(*) AS n FROM transaction GROUP BY type, status;

-- Status as words
SELECT DISTINCT type, status, BUILTIN.DF(status) AS label FROM transaction;

-- Follow document chains
SELECT p.type AS parent, t.type AS child, COUNT(DISTINCT t.id) AS n
FROM transactionline tl
JOIN transaction t ON t.id = tl.transaction
JOIN transaction p ON p.id = tl.createdfrom
GROUP BY p.type, t.type;
```
Gotchas: concatenate with `||`, no `WITH` (CTE) support, `BUILTIN.DF()` doesn't work inside `GROUP BY`, and large tables need paging.

### Results (run 2026-09-29): document chains
| Parent → child | Documents |
|---|---|
| Sales order → fulfillment | 2,205 |
| Sales order → invoice | 2,168 |
| Bill → bill payment | 1,684 |
| Purchase order → item receipt | 1,480 |
| Purchase order → bill | 1,463 |
| Sales order → return authorization | 19 |
| Sales order → purchase order (special order) | 19 |
| Transfer order → shipment / receipt | 20 / 14 |
| Return authorization → receipt / credit memo / cash refund | 10 / 4 / 1 |
| Purchase order → vendor return | 8 |
| Vendor return → shipment / bill credit | 6 / 3 |

**How to read it:** the five big rows are the business's main paths (sell, ship, bill; buy, receive, bill, pay). Everything under about 20 is an exception path. Build the main paths first and make them excellent.

## Quiz yourself
1. Which table holds one row per document, and which holds one row per line?
2. Does status `B` mean the same thing on a sales order and on an invoice?
3. A rule must block saving an order without a location. Which script type is that?
4. Nightly, 50,000 prices need updating. Which script type?
5. What does `_mr` at the end of a script ID tell you?

<details><summary>Answers</summary>

1. `transaction` holds one row per document; `transactionline` holds one row per line.
2. No. On a sales order it's "Pending fulfillment"; on an invoice it's "Paid in full".
3. A user event (before submit). A client script can add a friendly warning, but the server rule is the real guard.
4. Map/reduce.
5. It's a map/reduce script.
</details>

## What this means for our ERP
- Use **one header table and one line table per document family** with an explicit link to the parent document. This is the same idea as `createdfrom`.
- Use **readable status names** in the database, not one-letter codes that change meaning per type.
- Our "user event" equivalent is **server-side posting services**. Rules live on the server, never only in the browser (this is already in our spec).
- Our "map/reduce" equivalent is background jobs. We don't need them in release one.
