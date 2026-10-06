# Guided staff pilot and order fulfillment design

Date: 6 October 2026 (Asia/Manila).
Status: proposed design for owner review; no staff links or new workflow have been activated.

## Intended outcome

Staff receive a personal password-setup link from the owner, choose their own
password, and land on a page that shows their next permitted task. Contextual
guidance identifies the first useful click and work requiring attention without
revealing another department's finances. Marean enters the customer order;
Winnie approves it; exactly one of Mingla, LA or Talisay accepts and prepares
the entire order; Marean arranges shipping and records the carrier reference.

The owner wants to start filling genuine data and testing immediately. Preserve
existing real records and the working hosted ERP. Data preparation and draft
entry can precede full operational activation. Do not populate production with
synthetic customers, employees, transactions, prices, balances or stock.

## Confirmed scope and baseline

- Six named staff: Marean (Logistics), Jen (Inventory), Jera (AR), Lovely (AP),
  Ann Ann (Finance/bookkeeping) and Winnie (Owner/admin). The real email roster
  is held privately under `.runtime/department-access-2026-10-06/`, outside Git.
- Ann Ann can access both AR and AP, including bookkeeping and company assignment.
- AP cannot access AR finances; AR cannot access AP finances. Operational
  handoffs share only the data necessary to do the receiving person's task.
- One plant handles the entire customer order. Multi-plant allocation is excluded.
- NGOSIOK MARKETING is the provisional company for the migrated order intake.
  Physical plant selection does not change the selling legal company.
- The owner distributes first-login links personally. Outgoing SMTP is not a
  prerequisite; no staff messages are sent by the implementation.
- The live read on 6 October found 170 disabled items, one Customer, zero Item
  Prices, Suppliers, Sales Orders, invoices, Delivery Notes, payments and Workflow
  records. Only Administrator, Guest and the existing purchasing account exist.
- The 42 imported shipping guides remain private intake Notes. They are not
  operational Sales Orders. Preserve source identity when completing migration.
- The native Item list's default active-item filter hides all 170 disabled items;
  the first-data guide must explain how to clear that filter and review each code.
- Existing features provide authorized transaction reads, draft Sales Order
  saving and read-only customer credit review. They do not enforce the requested
  owner approval, plant claim, contextual guide or setup-link generation.

## 1. Account setup and distribution

Create individual System Users with clean department profiles, using the supplied
roster. Do not create shared plant or department passwords. Keep the existing
Administrator and purchasing account unchanged; audit that existing account
separately before treating it as part of the new restricted rollout.

Owner-only staff administration displays name, department, scope and onboarding
state: Prepared, Ready to invite, Invited, Password set, Active or Disabled.
An account becomes Ready to invite only after its effective access passes the
release checks. A disabled or not-yet-ready account must not get an actionable
invitation.

Generate password-setup links using the installed Frappe password-reset mechanism
after verifying its behavior. Require single use, 24-hour validity, invalidation
when reissued and rejection for disabled accounts. Allow the owner to reissue a
link in one action. The setup page asks the employee to choose and confirm a
password; successful setup leads to their role home page. Future password changes
use the authenticated native account mechanism.

The owner copies each link from an authenticated, owner-only screen. Do not put
link tokens in Git, screenshots, analytics, ordinary audit-event payloads or shared
staff instructions. Do not expose a shared spreadsheet of usable links. Log the
issuing actor and recipient account without the token. Distribution itself is
manual and is not reported as delivered merely because a link was generated.

## 2. Roles and effective access

| Profile | Permitted work | Boundary |
|---|---|---|
| Logistics | Customer delivery/contact projection, real draft orders, approval requests, preparation status, shipping records and confirmed dispatch | No AR/AP ledgers, customer debt, credit override, self-approval or invoice/payment/journal posting |
| Inventory | Verify items/units/locations, record stock evidence, review receiving and preparation discrepancies | No AR/AP balances; consequential stock adjustments remain controlled |
| AR | Customer master/invoice preparation, authorized customer invoice balances and collection follow-up | No supplier/AP finances; no shared Payment Entry, Journal Entry or general-ledger screens in this pilot |
| AP | Supplier/bill preparation, purchase/receiving evidence and authorized supplier bill balances | No customer/AR finances; no shared payment or general-ledger screens in this pilot |
| Finance Controller | Both AR/AP, company assignment, reconciliation and native bookkeeping/posting | No staff/security administration or independent order approval |
| Owner/admin | Business oversight, full customer credit review, order decisions, staff/link administration | Owner actions are explicit, attributable and version-checked |
| Plant Admin | Accept approved available orders, prepare own plant's orders, packing/readiness and authorized warehouse quantities | No financial ledgers, credit details, commercial amendments or access to another plant's preparation records |

Ordinary department staff initially receive NGOSIOK MARKETING scope. Finance and
owner access the real configured companies. Plant access is further restricted
by the real plant/company/warehouse mapping. Profiles cannot silently add broad
Accounts User, Accounts Manager, Sales User or Stock User grants to restricted
staff. All effective roles and document shares participate in the audit.

Protect document reads/writes and every exposed helper used by the staff portal.
The known invoice-mapping, balance and attachment-metadata gaps must be closed
before restricted accounts are activated. Do not assume menu visibility or native
DocType permission alone protects all whitelisted ERP helper methods. Reject
unreviewed native financial RPC, generic document-method and API routes for
restricted pilot users; explicitly allow only reviewed entry points needed for
their portal and account functions. Cover REST versions, legacy command forms,
batch routes, exports and private-file downloads. Finance/owner native functions
retain their explicit authorization checks.

Identify restricted pilot accounts with an explicit server-managed profile marker.
Enforce the reviewed route allowlist after resolving the authenticated identity;
browser navigation, a hidden menu or a client-supplied role flag is insufficient.

Operational projections omit prices, credit limits, unpaid balances and bank
details unless the viewer's profile needs them. File lists, searches, attachment
metadata, previews and downloads must honor the same parent-document scope.
Revocation applies to open sessions and action retries; a displayed button or an
old action response does not confer continuing permission.

Source photographs can contain several orders on one page. Restricted staff see
only their authorized order projection; access to a single order must not grant
access to an unredacted batch photograph containing other records. Keep raw batch
sources restricted to separately authorized owner/Finance review.

## 3. Guidance and attention indicators

Each role lands on **Today**, with one **Your next step** card and its permitted
queues. The server computes available actions, counts, prerequisites and current
owner under effective permissions. Counts must not reveal restricted records.

Use these separate signals:

| Signal | Meaning | Behavior |
|---|---|---|
| Start here | First-use help | Highlights one useful button or missing field; does not imply a pending business task |
| Red dot + Action needed + count | Work this user can address now | Appears on the relevant queue/action; count comes from authorized records |
| Waiting for Winnie / Waiting for plant / Waiting for Finance | Another person owns the next step | Neutral status; names the responsible role without exposing their private work |
| Completed | Required action actually succeeded | Removes the action indicator; leaves the event in the timeline |

For a new form, guide required fields in order and explain invalid input next to
the field. After a confirmed draft save, guide **Send for approval** only when its
server prerequisites are met. For unresolved outcome/retry, show **Confirm previous
save**; never suggest creating another order. A guide cannot submit or approve
on the user's behalf.

Hints use visible text, keyboard-operable controls and screen-reader labels. Do
not rely on color alone, flash dots or force a tour over active data entry. Support
Help me, dismiss and resume. Dismissing a tutorial cannot dismiss actual business
work or bypass a prerequisite. Present the same guide on desktop and a phone.

Role examples:

- Marean: Complete draft → Send for approval → wait for owner/plant → Book shipment.
- Winnie: Review order and credit → Approve, Hold or Return for correction.
- Jen: Confirm item unit/location or resolve an actual stock discrepancy.
- Jera: Complete authorized customer/invoice data and review real customer balances.
- Lovely: Complete authorized supplier/bill data and missing receiving evidence.
- Ann Ann: Resolve company, price, tax or accounting-evidence requirements.
- Plant Admin: Available approved orders → Accept order → Prepare → Mark ready.

## 4. Authoritative order approval

Marean can save incomplete intake without fabricating a price, stock location or
company assignment. Keep intake separate until the mandatory native Sales Order
fields, including a genuine Customer and Company, are known. Use the confirmed
provisional NGOSIOK MARKETING company for native migrated drafts until Finance
reviews it. Missing prices remain visibly unverified intake requirements and must
not silently become approved zero-price lines.

Before sending for approval, require the real customer, confirmed item codes/UOM,
quantities, verified PHP prices and tax treatment, delivery details and company.
The existing simple draft API requires a warehouse; remove that requirement for
unallocated orders because the plant is chosen later. Do not substitute a guessed
warehouse.

Link every migrated order to a completed intake source reference and enforce one
logical order/amendment chain per reference. Repeated migration or save attempts
recover the existing mapping rather than creating another independent order.
Native cancellation/amendment preserves that canonical mapping and every prior
document version. Preserve the source evidence and record any correction without
silently replacing it.

Keep Draft, Awaiting approval, Approved, Held, Returned and Cancelled order states
distinct from fulfillment and transport states. Only Winnie's owner role can make
the commercial approval decision. A saved credit panel is not an approval.

Approval records actor, timestamp and the exact commercial version approved.
Changes to customer, company, items, quantities, prices, tax treatment, terms or
delivery commitment invalidate the earlier approval and require a controlled
revision. Plant allocation and routine packing progress do not rewrite the
approved commercial version. Protect native Desk, REST and direct workflow-field
changes as well as the new buttons; no preparer can bypass approval using Submit.

If an approved order is already claimed or preparing, a commercial revision holds
fulfillment and dispatch. Preserve previous preparation and reservations until
the owner reconciles them and approves the new version. Correct already posted
documents through native reversal/amendment procedures, never by rewriting them.

Recompute customer exposure at the decision point and detect concurrent approval
or balance changes. Preserve the existing complete-credit permission checks.
Unimported balances are unknown, not proof of no debt. Proposed pilot credit policy:
overdue or over-limit orders go on hold; do not introduce an implicit credit
override. The owner reviews this policy with the written design and can choose a
recorded-exception policy before its implementation.

Finance must confirm the completeness and reconciliation of opening/customer
balance evidence. Missing or unreconciled evidence shows **Credit data incomplete**
and holds credit approval; a numeric zero cannot clear that prerequisite.

## 5. Whole-order plant claim and preparation

Create a real Plant record with company/warehouse mappings. Create plant staff
only when actual representatives and emails are supplied. Known plant names alone
are not identities, legal entities, verified warehouses or stock balances.

Approved, eligible orders appear in the shared Available queue. Show operational
customer/destination, items/quantities, requested date and priority. A plant accepts
the entire order and gives an expected ready date. Store the assignment separately
from the commercial Sales Order and enforce one active assignment per order.

Claims use a database transaction, a unique order assignment and version checks.
Two simultaneous claims yield one winner. A losing plant sees that the order was
already taken. Retries recover the same claim rather than making another task.

The claiming plant records Preparing, shortage/quality exceptions and Ready.
Ready requires actual prepared quantities, cartons/weight where applicable and a
pickup-ready time. Stock available and production requirements remain separate:
claiming or marking Ready cannot invent or deduct stock. Existing stock reservation,
pick lists and manufacturing controllers remain authoritative where applicable.

Only the owner initially reassigns an order, with a reason and reconciliation of
the previous plant's reservations/prepared goods. A timer cannot silently reopen
an accepted order. Start with full-order preparation and dispatch; partial dispatch
requires an explicit exception policy before enabling it. Never split one order
between plants in this release.

## 6. Shipping and dispatch

Marean may record an early transport reservation against the expected ready date.
Finalize the shipment using confirmed actual goods, packing quantities/weight,
origin, consignee/destination and transport schedule. Store the carrier booking
reference and uploaded carrier-issued bill of lading/waybill separately from the
operational Delivery Note. Carrier API integration and automatic issuance of
transport documents are excluded from this pilot.

Preparing a booking does not deduct stock or prove delivery. Marean's Logistics
role confirms actual handover after the plant has marked the full order Ready.
That server-authorized dispatch action creates/submits the native Delivery Note
through ERPNext's controllers, linked to the approved order and responsible
warehouse. Jen resolves inventory discrepancies; marking Ready is not dispatch.
Validate available stock, unit conversions and legal-company/warehouse consistency.
If a supplying warehouse belongs to another legal company, require Finance to
resolve the appropriate native intercompany documents; never relabel its stock.
Missing prerequisite data prevents dispatch and names the responsible role.

Record delivery evidence independently of booking/dispatch. Invoice and payment
posting remain native finance functions with confirmed company/tax inputs. This
workflow does not certify BIR registration, issue fictitious invoices or submit
tax returns.

## 7. Release and test gates

1. On isolated test data, verify single-use setup links, 24-hour expiration,
   reissue/revocation, disabled accounts, unauthorized link generation, password
   change and correct role landing. Do not use production staff passwords in tests.
2. Test every profile's allowed work and denied opposite department/company access
   through lists, detail, direct URLs, helper APIs, document methods, search, reports,
   print/export and private attachment metadata/downloads. Include stacked roles,
   document shares, guessed IDs and revocation during an open session.
3. Test incomplete/disabled items, missing prices/tax/UOM, unallocated draft orders,
   duplicate save/retry, native submission bypass, self-approval, stale versions,
   commercial amendments and concurrent credit decisions.
4. Test simultaneous plant claims, repeated claims, unauthorized plant/warehouse
   choices, preparation quantity mismatch, shortages, cancellation, reassignment
   after preparation and missing dispatch prerequisites.
5. Test accessible next-step help, accurate permission-scoped action counts,
   waiting states, dismiss/resume and failure/recovery without duplicate actions.
6. Run the project integration suite against an isolated engine, the frontend build
   and browser journeys on desktop/phone. Do not run mutating test fixtures against
   the hosted production books or the frozen cutover recovery copy.
7. Back up production before rollout; deploy without business fixtures. Verify real
   data counts/files and unchanged existing accounts. Activate only the six real
   department users whose access passes; add real plant users after their mappings
   are verified. Generate links privately only after this verification.

The existing Google Cloud hosting and PHP 3,000/month planning target remain in
scope. This release adds no paid mail or carrier service, new server, public test
database or security permission to third-party infrastructure.

## Separate deliverables and remaining real inputs

Deliver in order: (1) permission hardening, six-person onboarding and data-entry
guide; (2) authoritative Winnie approval; (3) real plant assignment/preparation;
(4) transport and controlled dispatch. Unimplemented stages must not be shown as
working controls or action dots. The first deliverable lets staff fill genuine
masters and drafts before the full plant dispatch journey is released.

Plant representatives' names/emails and each plant's real company/warehouse mapping
are required before the plant stage. Confirmed item units/packaging conversions,
approved prices and tax mode, customer details, stock evidence and opening AR/AP
documents are real-data inputs, not values the implementation can guess.

## References

- Current app: `web/src/main.tsx`, `web/src/SalesDraft.tsx`,
  `quarter_erp/api.py`, `quarter_erp/commands.py`, `quarter_erp/credit.py`.
- Current read-only evidence: `.runtime/department-access-2026-10-06/testing-readiness.json`.
- [ERPNext users](https://docs.frappe.io/erpnext/adding-users).
- [ERPNext workflow](https://docs.frappe.io/erpnext/workflows).
- [ERPNext reservation](https://docs.frappe.io/erpnext/stock-reservation).
- [ERPNext Delivery Note](https://docs.frappe.io/erpnext/delivery-note).
