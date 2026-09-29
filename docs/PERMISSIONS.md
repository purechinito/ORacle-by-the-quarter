# Current access boundaries

These are the implemented three-role boundaries for the current release. A configurable resource/action permission system, location grants, company segregation and maker/approver separation remain required work.

| Capability | Manager | Counter | Stock |
|---|---|---|---|
| Catalog, availability, fitment and stock history | Read | Read | Read |
| Maintain catalog/import/opening/adjustments | Yes | No | No |
| Counter sales and returns | All sales | Own sales | No |
| Price overrides with reason | Yes | No | No |
| Customers | Maintain all fields | Read public fields; create basic customer | No |
| Suppliers | Maintain all fields | No | Read public fields |
| Party TIN, notes, terms and credit limit | Yes | No | No |
| Purchase drafts/submit/cancel | Yes | No | No |
| Purchase receiving/history | Yes, including cost | No | Yes, costs excluded |
| Sales/payment/return report totals and source rows | All | Own sales and linked records | No; null fields and empty source list |
| Current inventory report | Yes | Yes | Yes |
| Outstanding purchase count | Yes | No | Yes |
| Stock CSV export | Yes | No | No |
| Manual ledger, periods and financial reports | Yes | No | No |
| Staff administration, private audit and settings changes | Yes | No | No |

Authorization is enforced by API handlers rather than navigation alone. Sale detail, relationship history, report totals and report source rows use the same ownership boundary. Return counts follow the original sale owner even when a manager recorded the return. The report's date range applies to posted-sale dates and return-record dates respectively; current stock is not a historical inventory valuation report.

Staff deactivation, role changes and password resets invalidate sessions. Concurrent administration cannot disable or demote the last manager, and users cannot remove their own managerial access. Reasons and structured administrative changes are audited without passwords or session secrets.

The current roles do not provide branch access control, approval separation or company boundaries. Do not represent them as a complete enterprise permissions editor.
