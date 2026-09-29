# 3. Inventory and warehouse department

Study time: about 20 minutes. This is the **most important department for our auto-parts ERP**.
Prerequisite: [00-how-netsuite-code-works.md](00-how-netsuite-code-works.md).

## What the warehouse does
It receives goods, puts them on shelves (bins), picks, packs and ships orders, moves stock between places, counts stock, and fixes errors.

## Documents and status codes
| Code | Document | Statuses seen | What it does to stock |
|---|---|---|---|
| `ItemRcpt` | Item receipt | posts (`Y`) | **+** stock in (from a PO, transfer or customer return) |
| `ItemShip` | Item fulfillment | A Picked → B Packed → C Shipped | **−** stock out (to a customer, transfer or supplier return) |
| `InvAdjst` | Inventory adjustment | posts | **±** correction, with a reason |
| `InvCount` | Inventory count | C Completed / pending approval → D Approved | ± only after approval |
| `InvTrnfr` | Inventory transfer | posts | Moves stock between locations instantly |
| `TrnfrOrd` | Transfer order | B Pending fulfillment → F Pending receipt → G Received | Moves stock with an *in-transit* period |
| `BinTrnfr` | Bin transfer | posts | Moves stock between shelves in one location |
| `BinWksht` | Bin putaway worksheet | posts | Assigns received goods to shelves |
| `InvWksht` | Inventory worksheet | posts | Changes **value** (cost), not quantity |

### Fulfillment has its own mini-lifecycle
Picked (taken off the shelf) → Packed (boxed) → Shipped (left the building). Stock is committed at pick, but the shipment is complete only at ship.

## Stock numbers per item and location
The `inventoryitemlocations` table holds one row per item per location:
| Field | Meaning |
|---|---|
| `quantityonhand` | Physically here |
| `quantitycommitted` | Promised to open orders |
| `quantityavailable` | On hand minus committed: what you can still sell |
| `quantityonorder` | Coming in on open POs |
| `reorderpoint` | When to buy more |

**Key insight:** NetSuite separates *on hand* from *available*. Our release one has no reservations, so on hand equals available. When we add reservations later, this is the model to follow.

## Item types (from `item.itemtype`)
| Code | Type | Stocked? |
|---|---|---|
| `InvtPart` | Inventory part | Yes, the main type |
| `Assembly` | Assembly / kit that is built | Yes |
| `NonInvtPart` | Non-inventory part | No |
| `Service` | Service (labour) | No |
| `OthCharge` | Other charge (freight, fees) | No |
| `Discount` | Discount line | No |
| `Group` | Item group (a bundle sold together) | Expands into its members |

## Automation in this department (SuiteApps)
| SuiteApp (prefix) | Scripts | What it does |
|---|---|---|
| WMS Mobile (`mobile`) | 106 | Handheld scanner app for receiving, picking, putaway and counting |
| Pack & Ship (`packship`, `packed`, `sl`) | 94 | Packing stations, carrier rates ("shop for rates"), labels |
| Ship Central (`shipcentral`, `shipcental`) | 4 | Package details and roles for shipping |
| Bill of lading (`bol`) | 12 | Freight documents on fulfillments |
| Lot/serial trace (`lot`, `lt`, `lsn`) | 11 | Trace which lot or serial went where |
| Auto lot numbering (`aln`) | 22 | Generates lot numbers automatically |
| Supply chain (`scm`) | 63 | Supply chain management helpers |
| Item 360 (`item360`) | 8 | Item alerts and a dashboard (low stock and similar) |

**Lesson:** barcode scanning plus pick/pack/ship is the largest automation area in the account, over 200 scripts.

## Try it (SuiteQL)
```sql
-- Items at or below their reorder point
SELECT COUNT(*) FROM inventoryitemlocations
WHERE reorderpoint IS NOT NULL AND quantityavailable <= reorderpoint;

-- How often is stock corrected, compared with received?
SELECT type, COUNT(*) FROM transaction WHERE type IN ('ItemRcpt','InvAdjst','InvCount') GROUP BY type;
```

## Quiz yourself
1. What's the difference between on hand and available?
2. A transfer order is shipped but not received. Where is the stock?
3. Which document changes cost but not quantity?
4. Why does a count need approval before it changes stock?
5. What's the difference between `InvTrnfr` and `TrnfrOrd`?

<details><summary>Answers</summary>

1. Available is on hand minus what's committed to open orders.
2. In transit, status F (Pending receipt).
3. The inventory worksheet (`InvWksht`).
4. So a miscount can't silently wipe out real stock. A manager reviews the variance first.
5. `InvTrnfr` moves stock instantly. `TrnfrOrd` is a ship-then-receive process with an in-transit period.
</details>

## What this means for our ERP
- Our immutable movement ledger covers `ItemRcpt`, `ItemShip`, `InvAdjst` and returns. Good.
- Add counts with approval as the **first post-pilot feature**. Counts are how shops catch shrinkage.
- Model `on_hand` now. Add `committed` and `available` only when reservations arrive.
- Barcode scanning is already in our counter-screen spec. A full WMS (pick, pack, ship) is out of scope.
- Keep bin labels as an attribute in release one (per the spec). Bin transfers come later.
