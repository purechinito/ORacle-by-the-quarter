"""Read-only customer credit review, using the native accounting ledger.

No approval, posting, credit override or role grant is performed here. A partial
accounting view must never be presented as a complete customer credit position.
"""
from collections import defaultdict

import frappe
from frappe.permissions import get_role_permissions, get_user_permissions
from frappe.utils import flt, getdate, now_datetime, today

from quarter_erp.api import require_user

MAX_ROWS = 20000


def _deny():
    frappe.throw("Complete customer accounting access is required for this company. Restricted balances cannot be used for a credit decision.", frappe.PermissionError)


def _fields(doctype, fields):
    meta = frappe.get_meta(doctype)
    if not frappe.has_permission(doctype, "read") or "read" in get_role_permissions(meta).get("if_owner", {}):
        _deny()
    if frappe.session.user != "Administrator":
        levels = set(meta.get_permlevel_access(permission_type="read", user=frappe.session.user))
        if any(not meta.get_field(field) or meta.get_field(field).permlevel not in levels
               for field in fields if field not in {"name", "owner", "docstatus", "modified"}):
            _deny()


def _rows(doctype, filters, fields):
    _fields(doctype, fields)
    meta = frappe.get_meta(doctype)
    columns = [field for field in fields if not meta.get_field(field) or meta.get_field(field).fieldtype not in ("Table", "Table MultiSelect")]
    rows = frappe.get_list(doctype, filters=filters, fields=columns, order_by="name", limit_page_length=MAX_ROWS + 1)
    if len(rows) > MAX_ROWS:
        frappe.throw("This customer exceeds the interactive review limit. Use the full accounting reports.")
    if len(rows) != frappe.db.count(doctype, filters):
        _deny()
    return rows


def _child_fields(doctype, parenttype, fields):
    if frappe.session.user == "Administrator":
        return
    permitted = frappe.get_meta(doctype).get_permitted_fieldnames(parenttype=parenttype,
        user=frappe.session.user, permission_type="read")
    if any(field not in permitted for field in fields):
        _deny()


def _document(doctype, name, fields, filters=None):
    _fields(doctype, fields)
    if not frappe.get_list(doctype, filters={"name": name, **(filters or {})}, pluck="name", limit=1):
        _deny()
    doc = frappe.get_doc(doctype, name)
    doc.check_permission("read")
    return doc


@frappe.whitelist(methods=["GET"])
def review(name, company):
    require_user()
    if not all(isinstance(value, str) and 0 < len(value) <= 140 for value in (name, company)):
        frappe.throw("Choose a saved sales order and its company.")
    restrictions = get_user_permissions(frappe.session.user)
    if frappe.session.user != "Administrator" and any(values for key, values in restrictions.items() if key != "Company"):
        _deny()
    company_doc = _document("Company", company, ["default_currency", "credit_limit"])
    order = _document("Sales Order", name,
        ["company", "customer", "base_grand_total", "per_billed", "status", "docstatus", "owner"], {"company": company})
    customer = _document("Customer", order.customer,
        ["customer_name", "customer_group", "credit_limits", "payment_terms", "disabled", "is_frozen"])
    _document("Customer Group", customer.customer_group, ["credit_limits"])
    for parent in ("Customer", "Customer Group"):
        _child_fields("Customer Credit Limit", parent, ["company", "credit_limit", "bypass_credit_limit_check"])
    _child_fields("Payment Schedule", "Sales Invoice", ["due_date", "base_payment_amount"])
    _child_fields("Delivery Note Item", "Delivery Note", ["amount", "against_sales_order", "against_sales_invoice"])
    _child_fields("Sales Invoice Item", "Sales Invoice", ["amount", "dn_detail"])
    scope = {"company": company, "customer": customer.name}
    invoices = _rows("Sales Invoice", {**scope, "docstatus": 1},
        ["name", "posting_date", "due_date", "currency", "grand_total", "base_grand_total", "payment_schedule"])
    orders = _rows("Sales Order", {**scope, "docstatus": 1, "per_billed": ["<", 100], "status": ["!=", "Closed"]},
        ["name", "transaction_date", "base_grand_total", "per_billed"])
    # The native credit calculation also includes standalone unbilled deliveries.
    _rows("Delivery Note", {**scope, "docstatus": 1}, ["name", "base_net_total", "base_grand_total", "items"])
    ledger_scope = {"company": company, "party_type": "Customer", "party": customer.name}
    gl = _rows("GL Entry", {**ledger_scope, "is_cancelled": 0},
        ["name", "debit", "credit", "voucher_type", "voucher_no"])
    ledger = _rows("Payment Ledger Entry", {**ledger_scope, "delinked": 0, "account_type": "Receivable"},
        ["name", "amount", "against_voucher_type", "against_voucher_no", "voucher_type", "voucher_no"])
    # A ledger permission alone must not reveal a source document hidden by a
    # custom permission hook. Fail closed rather than silently omit its balance.
    sources = defaultdict(set)
    for row in [*gl, *ledger]:
        sources[row.voucher_type].add(row.voucher_no)
        if row.get("against_voucher_type") and row.get("against_voucher_no"):
            sources[row.against_voucher_type].add(row.against_voucher_no)
    for doctype, names in sources.items():
        visible = _rows(doctype, {"name": ["in", sorted(names)]}, ["name"])
        if len(visible) != len(names):
            _deny()

    from erpnext.selling.doctype.customer.customer import (
        get_credit_limit, get_customer_outstanding, get_overdue_portion, get_past_due_payable_amounts,
    )
    balances = defaultdict(float)
    for row in ledger:
        balances[(row.against_voucher_type, row.against_voucher_no)] += flt(row.amount)
    past_due = get_past_due_payable_amounts([row.name for row in invoices]) if invoices else {}
    open_invoices = []
    for row in invoices:
        outstanding = flt(balances[("Sales Invoice", row.name)], 2)
        if outstanding <= 0:
            continue
        row.outstanding = outstanding
        overdue = flt(get_overdue_portion(row, past_due.get(row.name)), 2)
        open_invoices.append({"name": row.name, "posting_date": str(row.posting_date),
            "due_date": str(row.due_date) if row.due_date else None,
            "original_currency": row.currency, "original_total": row.grand_total,
            "invoice_total": row.base_grand_total, "outstanding": outstanding, "overdue": overdue,
            "days_overdue": max((getdate(today()) - getdate(row.due_date)).days, 0) if row.due_date else 0})
    open_invoices.sort(key=lambda row: (row["due_date"] or "9999-12-31", row["name"]))
    credits = [{"doctype": dt, "name": number, "amount": flt(-amount, 2)}
               for (dt, number), amount in balances.items() if flt(amount, 2) < 0]
    open_orders = [{"name": row.name, "date": str(row.transaction_date),
                    "unbilled": flt(row.base_grand_total * (100 - row.per_billed) / 100, 2)}
                   for row in orders if row.name != order.name]
    ledger_balance = flt(sum(flt(row.debit) - flt(row.credit) for row in gl), 2)
    all_orders = sum(flt(row.base_grand_total) * (100 - flt(row.per_billed)) / 100 for row in orders)
    native_exposure = get_customer_outstanding(customer.name, company)
    unbilled_deliveries = flt(native_exposure - ledger_balance - all_orders, 2)
    this_order = flt(order.base_grand_total, 2) if order.docstatus == 0 else next(
        (flt(row.base_grand_total * (100 - row.per_billed) / 100, 2) for row in orders if row.name == order.name), 0)
    other_orders = flt(sum(row["unbilled"] for row in open_orders), 2)
    projected = flt(ledger_balance + other_orders + unbilled_deliveries + this_order, 2)
    limit = get_credit_limit(customer.name, company) or None
    overdue = flt(sum(row["overdue"] for row in open_invoices), 2)
    bypass = next((bool(row.bypass_credit_limit_check) for row in customer.credit_limits if row.company == company), False)
    warnings = []
    if customer.disabled or customer.is_frozen:
        warnings.append("This customer is disabled or frozen. Resolve the customer restriction before proceeding.")
    if overdue:
        warnings.append("There are overdue invoices. Review collection status before approving this order.")
    if limit is None:
        warnings.append("No credit limit is configured. This is not confirmation of available credit.")
    elif projected > limit:
        warnings.append("Including this order exceeds the configured credit limit.")
    if bypass:
        warnings.append("The customer is configured to bypass the native sales-order credit check.")
    adjustment = flt(ledger_balance - sum(balances.values()), 2)
    if adjustment:
        warnings.append("Other ledger adjustments affect the posted balance. Review the customer ledger.")
    return {"order": order.name, "company": company, "customer": customer.name,
        "customer_name": customer.customer_name, "currency": company_doc.default_currency,
        "checked_at": str(now_datetime()), "prepared_by": order.owner, "order_modified": str(order.modified),
        "docstatus": order.docstatus, "payment_terms": customer.payment_terms,
        "can_submit": bool(order.docstatus == 0 and frappe.has_permission("Sales Order", "submit", doc=order)),
        "credit_limit": limit, "ledger_balance": ledger_balance, "unpaid_invoices": flt(sum(row["outstanding"] for row in open_invoices), 2),
        "overdue": overdue, "available_credits": flt(sum(row["amount"] for row in credits), 2),
        "other_orders": other_orders, "unbilled_deliveries": unbilled_deliveries, "this_order": this_order,
        "projected_exposure": projected, "remaining_credit": flt(limit - projected, 2) if limit is not None else None,
        "over_limit": flt(max(projected - limit, 0), 2) if limit is not None else None,
        "ledger_adjustments": adjustment, "invoices": open_invoices, "credits": credits, "orders": open_orders,
        "warnings": warnings}
