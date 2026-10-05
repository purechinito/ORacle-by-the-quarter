"""Editable native view preferences for the operator enabling the PH demo.

These filters are presentation defaults, never access restrictions. They do not
change transaction data, permissions, shared dashboards or other users' views.
"""
import json

import frappe
from frappe.desk.doctype.dashboard_settings.dashboard_settings import save_chart_config
from frappe.model.utils.user_settings import get, save

LIST_DOCTYPES = ("Sales Invoice", "Purchase Invoice", "Sales Order", "Purchase Order",
    "Delivery Note", "Purchase Receipt", "Payment Entry", "Journal Entry", "Stock Entry")
SELLING_CHARTS = ("Sales Order Trends", "Top Customers", "Sales Order Analysis", "Item-wise Annual Sales")
LEGACY_COMPANY = "Orbit Demo Company"


def set_current_user_defaults(company):
    frappe.only_for("System Manager")
    doc = frappe.get_doc("Company", company)
    doc.check_permission("read")
    if doc.country != "Philippines" or doc.default_currency != "PHP":
        frappe.throw("Philippine demo views require a Philippines company with PHP books.")

    user = frappe.session.user
    for doctype in LIST_DOCTYPES:
        settings = frappe.parse_json(get(doctype)) or {}
        view = settings.get("List") or {}
        filters = view.get("filters") or []
        filters = [row for row in filters if not (
            isinstance(row, (list, tuple)) and len(row) >= 4
            and row[0] == doctype and row[1] == "company")]
        filters.append([doctype, "company", "=", company])
        view["filters"] = filters
        settings["List"] = view
        save(doctype, json.dumps(settings))
        # Native save updates Redis only. Persist just this operator's native
        # row; sync_user_settings() would also flush unrelated users' settings.
        data = get(doctype)
        frappe.db.multisql({
            "mariadb": """INSERT INTO `__UserSettings` (`user`, `doctype`, `data`)
                VALUES (%s, %s, %s) ON DUPLICATE KEY UPDATE `data`=%s""",
            "postgres": """INSERT INTO "__UserSettings" ("user", "doctype", "data")
                VALUES (%s, %s, %s) ON CONFLICT ("user", "doctype") DO UPDATE SET "data"=%s""",
        }, (user, doctype, data, data))

    if frappe.db.exists("Dashboard Settings", user):
        dashboard = frappe.get_doc("Dashboard Settings", user)
        config = frappe.parse_json(dashboard.chart_config) or {}
        for name in SELLING_CHARTS:
            filters = (config.get(name) or {}).get("filters")
            if isinstance(filters, dict) and filters.get("company") == LEGACY_COMPANY:
                filters["company"] = company
                save_chart_config(reset=0, config={"filters": filters}, chart_name=name)
    return {"user": user, "company": company, "list_doctypes": list(LIST_DOCTYPES)}
