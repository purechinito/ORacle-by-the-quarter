# Familiar sales and logistics documents

Reviewed: 6 October 2026, Asia/Manila.
Status: reference findings for design review. No new form, print format,
transaction import or staff account was activated during this review.

## Purpose and scope

The owner supplied eleven photographs to help staff recognize their existing
sales and logistics work in the ERP. Use the familiar labels and section order
while retaining separate document identities, verified quantities and native
accounting controls. These are layout/workflow references, not an instruction to
post their historical transactions or infer hidden prices.

The first staff rollout remains account access and guided master/draft entry.
Invoice printing, stuffing and carrier-document changes are later deliverables;
their unfinished controls must not appear as working actions in the first guide.

## Familiar screen and print structure

| Section | Familiar fields and labels |
|---|---|
| Customer Information | Customer, location/address, Deliver/Ship to, Special Instruction |
| Order Specific | Ship Date, Shipping Co., Vessel, Voyage No., Bill No., Van No., Seal No., Transfer No., PO No., Delivery Ref. |
| Commercial references | Invoice Date, Invoice No., Sales Order #, Agent, Type, Term, Discount Rate, Discount Amt, Freight Amount |
| Items | Itemcode/Code, Type, Description, Unit, Units/Packing, No. of Packs, Shipping Quantity, Quantity Total, Price/Unit Price, Discount, Amount |
| Totals | Gross, Net, Total, Grand Total, with actual native currency and confirmed tax treatment |
| Handoff | Issued By, Prepared By, Checked By, Released By, Posted By, Delivered By, Received goods in GOOD ORDER and CONDITION By |

The legacy entry screen also has With Sales Order?, Warehouse, Stock Transfer
Reference, shipping-line selection, Received By and keyboard shortcuts for adding
rows/saving. Preserve recognizable wording, but do not copy a dense desktop form
unchanged onto a phone. Guide the relevant fields in order and show advanced
shipping detail only when needed.

The current simplified ERP draft has customer, delivery date, item, warehouse,
quantity and PHP rate. The current record overview has generic line totals and
linked records. Neither implements the photographed packing columns, shipping
header, stuffing report or familiar sign-off print footer.

## Keep the document classes distinct

| Document | Purpose and recognizable information |
|---|---|
| Customer order intake | Original message/evidence, requested items/container, shipping service, payment/terms, customer-order and submission timestamps, submitted by |
| Sales order/commercial invoice | Customer, approved commercial quantities/rates, seller/company, terms, totals and document references |
| Warehouse shipping guide | Guide No./Date, Shipping Lines, Destination, Sales Order No., Customer, Remarks, VAN CARGO/LOOSE CARGO, Code/Description/Quantity/Unit |
| Transfer slip CN/UN | Customer/location, SOA/SIN, voyage/BL, van/seal, packs/pieces/total, undelivered pieces and responsible-person sign-offs |
| Stuffing report | Customer/address, shipping/trucking, vessel/truck, voyage, BL, van/seal, SO/TS, container type, layer/level loading tally and checking evidence |
| Carrier booking | Carrier booking reference, optional BL reference, vessel/voyage, origin/destination, shipper/consignee, transport unit, weight, CBM, declared value and carrier charges |
| Carrier-issued Bill of Lading | Carrier's distinct BL references/serial, cargo and departure details, freight settlement and issued-document evidence |

The photos do not establish whether the legacy commercial print is a registered
tax invoice, an internal commercial copy or a delivery copy. Review its purpose,
seller registration, invoice authority/numbering and tax presentation before
using it as the statutory invoice layout. Visual familiarity is not evidence of
BIR registration or certification. Preserve the existing accounting/reconciliation
requirements; do not introduce selective sales suppression.

## Quantities, packing and money

- Keep stock UOM, commercial quantity, shipping quantity, package count and
  pieces-per-package separately identifiable. Confirm conversion direction and
  pricing basis with staff before any field changes stock or invoice amounts.
- Visible units include PCS, SACK, BAGS, CTN and BDL. Product descriptions such as
  30 × 1 or 5 × 1 are evidence to review, not authoritative conversion rules.
- A requested 20-foot container or a loading tally does not establish item
  quantities. Transport units, CBM and weight are distinct from stock UOM.
- Carrier declared value is not established as sales revenue, selling price or
  freight. Keep freight base, VAT, stamps, administration and other carrier
  charges distinct from the customer invoice and its tax calculation.
- Preserve intentional price/total redactions. Do not use another image to
  reconstruct the masked commercial values. A bare number in a customer chat
  has no confirmed currency, pricing unit, current approval or tax treatment.
- CREDIT and CWO coexist on one photographed entry screen. Do not derive payment
  status, due dates or ledger balances from Type alone.
- Support/promotional goods such as umbrellas are explicit fulfillment evidence;
  they are not automatically priced sales lines or invisible stock movements.

## Preparation and sign-offs

The stuffing report includes container type (10/20/40-foot variants, truck or
other), layer and level loading positions, totals per item, card/PPR reference,
time, checker and stuffer confirmation. Its checklist covers product availability,
labeling, packing and condition; van/truck cleanliness, dryness, pests and repair;
and personnel readiness. Keep each observed check attributable to its actual actor
and time. A historical printed name does not identify a new user account.

Different roles need different views of the same handoff. A plant/warehouse copy
can present authorized quantities and packing without AR/AP ledgers or commercial
prices. Commercial invoice amounts remain available only to roles whose approved
work requires them. A redacted physical copy does not establish a new permission
policy without the owner's decision.

## Inputs to resolve before the relevant release

1. Meaning of CN/UN, SOA/SIN, Type, Term and transfer prefixes.
2. Authoritative per-item stock units, packaging conversions and pricing basis.
3. Commercial versus quantity-only print audiences and actual sign-off authority.
4. Whether one shipment combines orders, or one plant dispatches one order in
   several shipments. One carrier document references completion of an earlier
   shipment; one plant per order does not imply one shipment per order.
5. Which legacy references remain external reference fields and which native or
   registered document series the new ERP issues.
6. Registered invoice purpose/layout and company-specific tax presentation.

Do not block the first staff data-entry release on later carrier integrations or
stuffing features. Keep uncertain data visible for the responsible person's review.

## Source index

Source originals remain in the owner's Downloads folder and outside this repository.
HEIC viewing copies are private under `.runtime/document-context-2026-10-06/`.

- IMG_1515.HEIC: legacy Sales Invoice Entry Form.
- IMG_1519.HEIC: handwritten order intake with customer-message evidence.
- IMG_1523.HEIC: stuffing report and preparation checklist.
- 1790730717837455.JPG: legacy commercial print preview.
- 1790730066161546.JPG: commercial print with intentionally masked prices/totals.
- 1790731886228029.JPG: batch warehouse shipping guides.
- 1790731466507393.JPG: single warehouse shipping guide.
- 1790737557841315.JPG: transfer slips CN and UN.
- 1790736387739434.JPG and 1790736293129436.JPG: carrier Bills of Lading.
- 1790736213254201.JPG: carrier booking confirmation.
