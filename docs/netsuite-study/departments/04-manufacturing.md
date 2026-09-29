# 4. Manufacturing department

Study time: about 10 minutes. **Out of scope for our first release.** Study it for awareness only.

## What manufacturing does
It builds finished goods (assemblies) from components, using a recipe (the bill of materials), and tracks what the build really cost.

## Key concepts
| Concept | Meaning |
|---|---|
| Assembly item (`Assembly`) | An item built from other items. The studied account has some alongside its inventory parts. |
| Bill of materials (BOM) | The recipe: which components, and how many of each |
| Work order | An instruction to build N units. **None were found** in the studied account, so assemblies exist but aren't actively built. |
| Assembly build | Consumes components (−) and produces the assembly (+) |
| Engineering change order (ECO) | A controlled change to a BOM |
| Costed BOM | A roll-up of component costs, giving the expected cost |
| Cost variance | Actual build cost minus expected cost |

## Automation in this department (SuiteApps)
| SuiteApp (prefix) | Scripts | What it does |
|---|---|---|
| Manufacturing Mobile (`mfgmob`, `mfgmobile`) | 117 | Shop-floor tablet app: production reporting, scrap, badges, serial numbers |
| Engineering change (`eco`, `ecodetails`) | 4 | ECO records and bulk processing |
| Costed BOM (`cb`, `bom`, `costed`, `costedbom`) | 6 | Calculates and exports expected costs |
| Cost variance (`cva`, `cost`, `cv`, `csv`) | 7 | Work-order cost variance analysis |

## Quiz yourself
1. What is a bill of materials?
2. What two stock movements does an assembly build make?
3. What is cost variance?

<details><summary>Answers</summary>

1. The recipe: which components, and how many, make one assembly.
2. Components go out (−) and the finished assembly comes in (+).
3. The actual cost of a build minus its expected cost.
</details>

## What this means for our ERP
- Manufacturing is explicitly **outside release one** (per the spec).
- One idea could matter soon: **kits**. If the shop sells bundles (for example a brake job kit), model that as an item group that expands into parts at sale time. No manufacturing is needed.
