"""Session-scoped reads. All document queries retain Frappe permission filters."""
import frappe
from frappe import _
from frappe.utils import cint

SECTIONS = {
    "sales": ("Sales Order", "customer_name", "delivery_date"),
    "purchasing": ("Purchase Order", "supplier_name", "schedule_date"),
    "receivables": ("Sales Invoice", "customer_name", "due_date"),
    "payables": ("Purchase Invoice", "supplier_name", "due_date"),
}
PAGE_SIZE = 20


def require_user():
    user = frappe.session.user
    if user == "Guest" or frappe.get_cached_value("User", user, "user_type") != "System User":
        frappe.throw(_("Sign in with a company account to continue."), frappe.PermissionError)
    return user


@frappe.whitelist(methods=["GET"])
def workspace(company=None, section="sales", search="", page=0, open_only="0"):
    user = require_user()
    if section not in SECTIONS:
        frappe.throw(_("Unknown workspace section."))
    page = cint(page)
    if page < 0 or page > 10000:
        frappe.throw(_("Invalid page."))
    companies = frappe.get_list("Company", fields=["name", "default_currency", "country"], order_by="name", limit_page_length=0)
    company_names = {item.name for item in companies}
    if not companies or (company and company not in company_names):
        frappe.throw(_("You do not have access to this company."), frappe.PermissionError)
    # Prefer the Philippine peso workspace without changing historical record currency
    # or expanding the companies the current user is allowed to read.
    preferred = [item for item in companies if item.country == "Philippines" and item.default_currency == "PHP"]
    choices = list(preferred or companies)
    if company:
        if company not in {item.name for item in choices}:
            choices.append(next(item for item in companies if item.name == company))
    else:
        global_company = frappe.defaults.get_global_default("company")
        company = global_company if global_company in {item.name for item in preferred} else choices[0].name
    doctype, party_field, date_field = SECTIONS[section]
    if not frappe.has_permission(doctype, "read"):
        frappe.throw(_("You do not have access to these records."), frappe.PermissionError)
    available_sections = [key for key, value in SECTIONS.items() if frappe.has_permission(value[0], "read")]
    filters = {"company": company}
    if cint(open_only):
        filters["docstatus"] = ["!=", 2]
        if section in ("sales", "purchasing"):
            filters["status"] = ["not in", ["Completed", "Closed", "Cancelled"]]
        else:
            filters["outstanding_amount"] = [">", 0]
    query = str(search or "").strip()[:120]
    or_filters = None
    if query:
        # Escape SQL LIKE wildcards; a search for '%' must not match all records.
        pattern = "%" + query.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"
        or_filters = [["name", "like", pattern], [party_field, "like", pattern]]
    fields = ["name", party_field, date_field, "status", "docstatus", "currency", "grand_total", "modified"]
    if section in ("receivables", "payables"):
        fields.append("outstanding_amount")
    else:
        fields.extend(["per_billed", "per_delivered" if section == "sales" else "per_received"])
    records = frappe.get_list(doctype, filters=filters, or_filters=or_filters, fields=fields,
                              order_by="modified desc, name desc", start=page * PAGE_SIZE,
                              limit_page_length=PAGE_SIZE + 1)
    has_more = len(records) > PAGE_SIZE
    return {
        "user": {"name": user, "full_name": frappe.get_cached_value("User", user, "full_name")},
        "companies": choices, "company": company,
        "section": section, "available_sections": available_sections,
        "can_create_sales": frappe.has_permission("Sales Order", "create"),
        "can_prepare_migration": user == "Administrator" or "System Manager" in frappe.get_roles(),
        "can_review_accounting": user == "Administrator" or bool({"System Manager", "Accounts Manager", "Orbit BIR Reviewer"} & set(frappe.get_roles())),
        "doctype": doctype, "party_field": party_field, "date_field": date_field,
        "records": records[:PAGE_SIZE], "page": page, "has_more": has_more,
    }


def related_group(doctype, company, filters):
    """Query parent documents so native role/user restrictions apply to every link."""
    group = {"doctype": doctype, "records": [], "has_more": False, "access": "available"}
    if not frappe.has_permission(doctype, "read"):
        group["access"] = "restricted"
        return group
    try:
        rows = frappe.get_list(
            doctype, filters=[[doctype, "company", "=", company], *filters],
            fields=["name", "status", "docstatus", "modified"],
            distinct=True, order_by="modified desc, name desc", limit=51,
        )
    except frappe.PermissionError:
        group["access"] = "restricted"
        return group
    group["records"] = rows[:50]
    group["has_more"] = len(rows) > 50
    return group


@frappe.whitelist(methods=["GET"])
def transaction(section, name, company):
    require_user()
    if section not in SECTIONS:
        frappe.throw(_("Unknown workspace section."))
    if not frappe.get_list("Company", filters={"name": company}, pluck="name", limit=1):
        frappe.throw(_("You do not have access to this company."), frappe.PermissionError)
    doctype, party_field, date_field = SECTIONS[section]
    # Authorize using the same filtered list path before loading child rows.
    visible = frappe.get_list(doctype, filters={"name": name, "company": company}, pluck="name", limit=1)
    if not visible:
        frappe.throw(_("This record is unavailable in your current company and permissions."), frappe.PermissionError)
    doc = frappe.get_doc(doctype, name)
    doc.check_permission("read")
    doc.apply_fieldlevel_read_permissions()
    header_fields = ["name", "company", party_field, date_field, "status", "docstatus", "currency",
                     "transaction_date", "posting_date", "modified", "net_total", "discount_amount",
                     "total_taxes_and_charges", "grand_total", "rounding_adjustment", "rounded_total",
                     "disable_rounded_total", "outstanding_amount", "per_billed", "per_delivered", "per_received"]
    item_fields = ["name", "idx", "item_code", "item_name", "qty", "uom", "rate", "amount", "net_amount",
                   "warehouse", "delivery_date", "schedule_date", "delivered_qty", "received_qty", "billed_amt"]
    items = doc.get("items") or []
    document = {field: doc.get(field) for field in header_fields if field in doc.__dict__}
    related = []
    if section == "sales":
        related.append(related_group("Delivery Note", company, [["Delivery Note Item", "against_sales_order", "=", name]]))
        related.append(related_group("Sales Invoice", company, [["Sales Invoice Item", "sales_order", "=", name]]))
    elif section == "purchasing":
        related.append(related_group("Purchase Receipt", company, [["Purchase Receipt Item", "purchase_order", "=", name]]))
        related.append(related_group("Purchase Invoice", company, [["Purchase Invoice Item", "purchase_order", "=", name]]))
    else:
        mappings = [("Sales Order", "sales_order"), ("Delivery Note", "delivery_note")] if section == "receivables" else [("Purchase Order", "purchase_order"), ("Purchase Receipt", "purchase_receipt")]
        for target_type, link_field in mappings:
            names = sorted({item.get(link_field) for item in items if item.get(link_field)})
            related.append(related_group(target_type, company, [["name", "in", names or [""]]]))
        related.append(related_group("Payment Entry", company, [
            ["Payment Entry Reference", "reference_doctype", "=", doctype],
            ["Payment Entry Reference", "reference_name", "=", name],
        ]))
    return {"doctype": doctype, "section": section, "party_field": party_field, "date_field": date_field,
            "document": document, "items": [{field: item.get(field) for field in item_fields if field in item.__dict__} for item in items],
            "related": related}
