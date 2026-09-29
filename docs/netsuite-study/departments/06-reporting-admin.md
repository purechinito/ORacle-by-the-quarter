# 6. Reporting and administration

Study time: about 10 minutes.

## Reporting
| Tool | Count in account | What it is |
|---|---|---|
| Standard reports | 186 | Built-in financial and operational reports (P&L, aging, back orders, sales orders pending fulfillment, forecast versus quota) |
| Saved searches | 679 | Saved filtered lists, most installed by SuiteApps |
| Analytics datasets and workbooks | 9 builders | Pivot-style analysis (for example sales tax by state) |
| Dashboards / portlets | 10 portlets | Tiles on a user's home page |
| "360" dashboards | Item 360, Cash 360, Benchmark 360 | Packaged dashboards for stock, cash and benchmarking |

### Reports worth studying for our ERP
- **Sales orders pending fulfillment**: what's promised but not shipped
- **Inventory back order report**: what's wanted but out of stock
- **Inventory activity detail**: every movement for an item, like our movements report
- **A/R and A/P aging**: overdue balances (later releases)

## Administration
| SuiteApp (prefix) | Scripts | What it does |
|---|---|---|
| Application Performance Management (`nsapm`) | 79 | Monitors script and page performance |
| Data deletion and record tools (`de`, `record`, `rpf`, `item`) | about 30 | Bulk delete, mass update, role-preferred forms. **Dangerous power tools.** |
| Backup manager (`backup`) and data wizard (`fmt`) | 4 | Data export and import helpers |
| Navigation and subsidiary navigator (`nav`, `snav`) | 17 | Menus and portlets per role |
| Employee directory and org browser (`ed`, `ob`) | 10 | People directory and org chart |
| Print templates (`print`, `sample`) | 34 | Document printing (invoices, labels) |
| File drag and drop (`dad`) | 12 | Upload files onto records |
| AI connector tools (`custtoolset_ns_…`) | 6 | Record, search, report and SuiteQL tools. **This is how Claude connects.** |
| AI Companion (`atlas`) | 8 | AI prompt library and role mapping |

## Roles and permissions
NetSuite gives each user a **role**, which is a set of permissions. The AI connector acts with the connected user's role. That's why some tables (for example `employee` and `workflow`) weren't visible in this study.

## Quiz yourself
1. What's the difference between a report and a saved search?
2. Why are data-deletion tools dangerous?
3. Why couldn't the study see the `employee` table?

<details><summary>Answers</summary>

1. A report is a fixed built-in layout, often financial. A saved search is a filtered list anyone can build and save.
2. They bypass the normal document rules. You can destroy history with no reversal trail.
3. The connected role doesn't have permission for it.
</details>

## What this means for our ERP
- Our reports list (daily sales, stock on hand, low stock, outstanding POs, movements, returns) matches the reports NetSuite users rely on most. Keep it small.
- **Never** build a "bulk delete posted documents" tool. Corrections are reversals (already in the spec).
- Enforce role permissions on every request, including exports (already in the spec). NetSuite's connector shows why: whatever a role can reach, an integration can reach too.
