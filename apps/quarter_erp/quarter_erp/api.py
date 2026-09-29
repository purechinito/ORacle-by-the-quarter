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
    companies = frappe.get_list("Company", fields=["name", "default_currency"], order_by="name", limit_page_length=0)
    company_names = {item.name for item in companies}
    if not companies or (company and company not in company_names):
        frappe.throw(_("You do not have access to this company."), frappe.PermissionError)
    company = company or companies[0].name
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
        "companies": companies, "company": company,
        "section": section, "available_sections": available_sections,
        "doctype": doctype, "party_field": party_field, "date_field": date_field,
        "records": records[:PAGE_SIZE], "page": page, "has_more": has_more,
    }
