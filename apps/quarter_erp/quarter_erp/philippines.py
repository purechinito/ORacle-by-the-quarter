"""Explicit, repeatable setup for the local Philippine demonstration company.

Creates synthetic masters and defaults, never rewrites a ledger or invents
registered taxpayer identities. Run explicitly through scripts/setup-demo.
"""
import json

import frappe

COMPANY = "Orbit Philippines Demo"
ABBR = "OPH"
SELLING = "PH Standard Selling"
BUYING = "PH Standard Buying"


def _account(label, parent, account_type):
    name = f"{label} - {ABBR}"
    if not frappe.db.exists("Account", name):
        frappe.get_doc({"doctype": "Account", "account_name": label, "company": COMPANY,
            "parent_account": f"{parent} - {ABBR}", "account_type": account_type,
            "account_currency": "PHP", "is_group": 0}).insert()
    return name


def _price_list(name, selling):
    if not frappe.db.exists("Price List", name):
        frappe.get_doc({"doctype": "Price List", "price_list_name": name,
            "currency": "PHP", "selling": int(selling), "buying": int(not selling), "enabled": 1}).insert()
    existing = frappe.get_doc("Price List", name)
    if existing.currency != "PHP" or not existing.enabled:
        frappe.throw(f"Review the existing {name} price list before enabling the Philippine demo.")


def _tax_template(doctype, title, account):
    name = f"{title} - {ABBR}"
    if not frappe.db.exists(doctype, name):
        row = {"charge_type": "On Net Total", "account_head": account,
            "description": "VAT 12% — taxable domestic demo transaction", "rate": 12,
            "included_in_print_rate": 0}
        if doctype.startswith("Purchase"):
            row.update({"category": "Total", "add_deduct_tax": "Add"})
        frappe.get_doc({"doctype": doctype, "title": title, "company": COMPANY,
            "is_default": 1, "taxes": [row]}).insert()
    # The engine's generic country template does not distinguish input/output
    # VAT accounts. Retain it for reference but remove it from new selections.
    generic = f"Philippines Tax - {ABBR}"
    if frappe.db.exists(doctype, generic):
        doc = frappe.get_doc(doctype, generic)
        if not doc.disabled:
            doc.disabled = 1
            doc.is_default = 0
            doc.save()
    return name


def setup_demo():
    frappe.only_for("System Manager")
    if not frappe.db.exists("Company", COMPANY):
        frappe.get_doc({"doctype": "Company", "company_name": COMPANY, "abbr": ABBR,
            "country": "Philippines", "default_currency": "PHP",
            "chart_of_accounts": "Standard", "create_chart_of_accounts_based_on": "Standard Template"}).insert()
    company = frappe.get_doc("Company", COMPANY)
    if (company.country, company.default_currency, company.abbr) != ("Philippines", "PHP", ABBR):
        frappe.throw("The Philippine demo name is already used by a different ledger. No currency was changed.")

    bank = _account("Operating Bank", "Bank Accounts", "Bank")
    output_vat = _account("Output VAT", "Duties and Taxes", "Tax")
    input_vat = _account("Input VAT", "Tax Assets", "Tax")
    if not company.default_bank_account:
        company.default_bank_account = bank
        company.save()
    _price_list(SELLING, True)
    _price_list(BUYING, False)
    sales_tax = _tax_template("Sales Taxes and Charges Template", "PH VAT 12% Sales", output_vat)
    purchase_tax = _tax_template("Purchase Taxes and Charges Template", "PH VAT 12% Purchases", input_vat)

    for doctype, field, name, parent_field, parent in [
        ("Customer Group", "customer_group_name", "Philippine Demo Buyers", "parent_customer_group", "All Customer Groups"),
        ("Supplier Group", "supplier_group_name", "Philippine Demo Suppliers", "parent_supplier_group", "All Supplier Groups"),
        ("Item Group", "item_group_name", "Philippine Demo Parts", "parent_item_group", "All Item Groups"),
        ("Territory", "territory_name", "Philippine Demo Region", "parent_territory", "All Territories"),
    ]:
        if not frappe.db.exists(doctype, name):
            frappe.get_doc({"doctype": doctype, field: name, parent_field: parent, "is_group": 0}).insert()

    for doctype, name, values in [
        ("Customer", "Orbit Philippines Demo Customer", {"customer_name": "Orbit Philippines Demo Customer",
            "customer_type": "Company", "customer_group": "Philippine Demo Buyers", "territory": "Philippine Demo Region",
            "default_currency": "PHP", "default_price_list": SELLING}),
        ("Supplier", "Orbit Philippines Demo Supplier", {"supplier_name": "Orbit Philippines Demo Supplier",
            "supplier_type": "Company", "supplier_group": "Philippine Demo Suppliers",
            "default_currency": "PHP", "default_price_list": BUYING}),
    ]:
        if not frappe.db.exists(doctype, name):
            frappe.get_doc({"doctype": doctype, **values}).insert()
    for code, label, rate, selling in [
        ("ORBIT-PH-DEMO-BEARING", "Demo finished bearing kit", 1000, True),
        ("ORBIT-PH-DEMO-PURCHASE-PART", "Demo manufacturing component", 500, False),
    ]:
        if not frappe.db.exists("Item", code):
            frappe.get_doc({"doctype": "Item", "item_code": code, "item_name": label,
                "description": "Synthetic Philippine demo item. No real taxpayer or migrated balance.",
                "item_group": "Philippine Demo Parts", "stock_uom": "Nos", "is_stock_item": 1,
                "item_defaults": [{"company": COMPANY, "default_warehouse": f"Stores - {ABBR}"}]}).insert()
        price_list = SELLING if selling else BUYING
        if not frappe.db.exists("Item Price", {"item_code": code, "price_list": price_list}):
            frappe.get_doc({"doctype": "Item Price", "item_code": code, "price_list": price_list,
                "currency": "PHP", "price_list_rate": rate}).insert()

    for doctype, values in [
        ("Global Defaults", {"default_company": COMPANY, "default_currency": "PHP", "country": "Philippines", "disable_rounded_total": 1}),
        ("System Settings", {"country": "Philippines", "time_zone": "Asia/Manila", "date_format": "yyyy-mm-dd"}),
        ("Selling Settings", {"selling_price_list": SELLING}),
        ("Buying Settings", {"buying_price_list": BUYING}),
        ("Stock Settings", {"default_warehouse": f"Stores - {ABBR}"}),
    ]:
        settings = frappe.get_single(doctype)
        settings.update(values)
        settings.save()
    # Replace only this operator's explicit defaults; do not alter other users'
    # company assignments or grant any new permissions.
    for key, value in {"company": COMPANY, "currency": "PHP", "country": "Philippines"}.items():
        frappe.defaults.set_user_default(key, value)
    from quarter_erp.philippines_views import set_current_user_defaults
    set_current_user_defaults(COMPANY)
    # These standard workspace cards otherwise sum different company currencies.
    # Keep their company dynamic so every operator sees their chosen ledger.
    for name in ("Total Sales Amount", "Sales Orders Count"):
        if frappe.db.exists("Number Card", name):
            card = frappe.get_doc("Number Card", name)
            if card.document_type != "Sales Order":
                continue
            filters = frappe.parse_json(card.dynamic_filters_json) or []
            filters = [row for row in filters if not (len(row) >= 2 and row[0] == "Sales Order" and row[1] == "company")]
            filters.append(["Sales Order", "company", "=", 'frappe.defaults.get_user_default("Company")'])
            card.dynamic_filters_json = json.dumps(filters)
            if name == "Total Sales Amount" and card.aggregate_function_based_on == "base_rounded_total":
                card.aggregate_function_based_on = "base_grand_total"
            card.save()
    frappe.clear_cache()
    return {"company": COMPANY, "currency": "PHP", "sales_tax": sales_tax,
            "purchase_tax": purchase_tax, "synthetic_demo": True}
