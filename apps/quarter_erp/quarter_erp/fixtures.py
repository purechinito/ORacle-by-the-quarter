"""Idempotent synthetic records for the explicitly named local demo company.

Uses ERPNext controllers and their validations. It does not import private
NetSuite data, send money, or grant access to any real employee.
"""
import json

import frappe
from frappe.utils import today

COMPANY = "Orbit Philippines Demo"
LEGACY_COMPANY = "Orbit Demo Company"
ORDER_MARKER = "ORBIT-PH-DEMO-SALES-001"
ITEM = "ORBIT-PH-DEMO-BEARING"
WAREHOUSE = "Stores - OPH"


def _demo_company(company_name):
    if company_name not in (COMPANY, LEGACY_COMPANY):
        raise ValueError("This development fixture only operates on the explicitly named synthetic demo companies")
    company = frappe.get_doc("Company", company_name)
    company.check_permission("write")
    if not company.default_currency:
        raise ValueError("The demo company must have a configured currency")
    if company_name == COMPANY and (company.country != "Philippines" or company.default_currency != "PHP"):
        raise ValueError("Orbit Philippines Demo must already be configured for Philippines and PHP")
    return company


def _company_taxes(doctype, company_name):
    """Server-created demo orders need the same explicit tax rows as the native form."""
    from erpnext.controllers.accounts_controller import get_taxes_and_charges

    template = frappe.db.get_value(doctype, {
        "company": company_name, "is_default": 1, "disabled": 0,
    }, "name")
    if not template:
        raise ValueError(f"Configure a default {doctype} for the Philippine demo before seeding transactions")
    taxes = get_taxes_and_charges(doctype, template)
    if not taxes:
        raise ValueError(f"The Philippine demo tax template {template} has no tax rows")
    return {"taxes_and_charges": template, "taxes": taxes}


def seed_demo(company_name: str = COMPANY):
    company = _demo_company(company_name)
    philippine_demo = company_name == COMPANY
    warehouse = WAREHOUSE if philippine_demo else f"Stores - {company.abbr}"
    item = ITEM if philippine_demo else "ORBIT-DEMO-BEARING"
    prefix = "ORBIT-PH-DEMO" if philippine_demo else "ORBIT-DEMO"
    order_marker = ORDER_MARKER if philippine_demo else "ORBIT-DEMO-SALES-001"
    price_list = "PH Standard Selling" if company.default_currency == "PHP" else "Standard Selling"
    for doctype, name_field, name, parent_field, parent in [
        ("Customer Group", "customer_group_name", "Orbit Demo Buyers", "parent_customer_group", "All Customer Groups"),
        ("Territory", "territory_name", "Orbit Demo Region", "parent_territory", "All Territories"),
        ("Item Group", "item_group_name", "Orbit Demo Parts", "parent_item_group", "All Item Groups"),
    ]:
        if not frappe.db.exists(doctype, name):
            frappe.get_doc({"doctype": doctype, name_field: name, parent_field: parent, "is_group": 0}).insert()
    customer = "Orbit Philippines Demo Customer" if philippine_demo else "Orbit Demo Customer"
    if not frappe.db.exists("Customer", customer):
        frappe.get_doc({
            "doctype": "Customer", "customer_name": customer,
            "customer_type": "Company", "customer_group": "Orbit Demo Buyers",
            "territory": "Orbit Demo Region",
        }).insert()
    if not frappe.db.exists("Item", item):
        frappe.get_doc({
            "doctype": "Item", "item_code": item, "item_name": "Precision bearing kit",
            "description": "Synthetic demo inventory item; not migrated account data.",
            "item_group": "Orbit Demo Parts", "stock_uom": "Nos", "is_stock_item": 1,
            "valuation_rate": 12, "standard_rate": 25,
            "item_defaults": [{"company": company_name, "default_warehouse": warehouse}],
        }).insert()

    opening_name = frappe.db.get_value("Stock Entry", {
        "company": company_name, "remarks": f"{prefix}-OPENING-STOCK", "docstatus": 1,
    }, "name")
    if not opening_name:
        from erpnext.stock.doctype.stock_entry.stock_entry_utils import make_stock_entry
        opening = make_stock_entry(item_code=item, qty=100, to_warehouse=warehouse,
                                   company=company_name, rate=12, do_not_save=True)
        opening.remarks = f"{prefix}-OPENING-STOCK"
        opening.insert()
        opening.submit()
        opening_name = opening.name

    order_name = frappe.db.get_value("Sales Order", {
        "company": company_name, "po_no": order_marker,
    }, "name")
    if not order_name:
        order = frappe.get_doc({
            "doctype": "Sales Order", "company": company_name, "customer": customer,
            "transaction_date": today(), "delivery_date": today(), "po_no": order_marker,
            "currency": company.default_currency, "selling_price_list": price_list,
            **(_company_taxes("Sales Taxes and Charges Template", company_name) if philippine_demo else {}),
            "items": [{"item_code": item, "qty": 10, "rate": 25,
                       "warehouse": warehouse, "delivery_date": today()}],
        }).insert()
        order.submit()
        order_name = order.name

    delivery_name = frappe.db.get_value("Delivery Note Item", {
        "against_sales_order": order_name, "docstatus": 1,
    }, "parent")
    if not delivery_name:
        from erpnext.selling.doctype.sales_order.sales_order import make_delivery_note
        delivery = make_delivery_note(order_name)
        delivery.items[0].qty = 4
        delivery.items[0].warehouse = warehouse
        delivery.insert()
        delivery.submit()
        delivery_name = delivery.name

    invoice_name = frappe.db.get_value("Sales Invoice Item", {
        "sales_order": order_name, "docstatus": 1,
    }, "parent")
    if not invoice_name:
        from erpnext.stock.doctype.delivery_note.delivery_note import make_sales_invoice
        invoice = make_sales_invoice(delivery_name)
        invoice.insert()
        invoice.submit()
        invoice_name = invoice.name

    payment_name = frappe.db.get_value("Payment Entry Reference", {
        "reference_doctype": "Sales Invoice", "reference_name": invoice_name, "docstatus": 1,
    }, "parent")
    if not payment_name:
        from erpnext.accounts.doctype.payment_entry.payment_entry import get_payment_entry
        payment = get_payment_entry("Sales Invoice", invoice_name,
                                    bank_account=company.default_bank_account)
        payment.reference_no = f"{prefix}-PAYMENT-001"
        payment.reference_date = today()
        payment.insert()
        payment.submit()
        payment_name = payment.name

    return {"company": company_name, "customer": customer, "item": item,
            "opening_stock": opening_name, "sales_order": order_name,
            "delivery_note": delivery_name, "sales_invoice": invoice_name,
            "payment_entry": payment_name}


def seed_purchasing(company_name: str = COMPANY):
    """One partial purchasing cycle, using a separate item from the sales fixture."""
    company = _demo_company(company_name)
    philippine_demo = company_name == COMPANY
    warehouse = WAREHOUSE if philippine_demo else f"Stores - {company.abbr}"
    supplier = "Orbit Philippines Demo Supplier" if philippine_demo else "Orbit Demo Supplier"
    prefix = "ORBIT-PH-DEMO" if philippine_demo else "ORBIT-DEMO"
    item = f"{prefix}-PURCHASE-PART"
    marker = f"{prefix}-PURCHASE-001"
    price_list = "PH Standard Buying" if company.default_currency == "PHP" else "Standard Buying"
    if not frappe.db.exists("Supplier Group", "Orbit Demo Suppliers"):
        frappe.get_doc({"doctype": "Supplier Group", "supplier_group_name": "Orbit Demo Suppliers",
                        "parent_supplier_group": "All Supplier Groups", "is_group": 0}).insert()
    if not frappe.db.exists("Supplier", supplier):
        frappe.get_doc({"doctype": "Supplier", "supplier_name": supplier,
                        "supplier_type": "Company", "supplier_group": "Orbit Demo Suppliers"}).insert()
    if not frappe.db.exists("Item", item):
        frappe.get_doc({"doctype": "Item", "item_code": item, "item_name": "Demo purchased component",
                        "item_group": "Orbit Demo Parts", "stock_uom": "Nos", "is_stock_item": 1,
                        "item_defaults": [{"company": company_name, "default_warehouse": warehouse}]}).insert()
    order_name = frappe.db.get_value("Purchase Order", {
        "company": company_name, "supplier": supplier, "title": marker,
    }, "name")
    if not order_name:
        order = frappe.get_doc({"doctype": "Purchase Order", "company": company_name,
            "supplier": supplier, "title": marker, "transaction_date": today(), "schedule_date": today(),
            "currency": company.default_currency, "buying_price_list": price_list,
            **(_company_taxes("Purchase Taxes and Charges Template", company_name) if philippine_demo else {}),
            "items": [{"item_code": item, "qty": 20, "rate": 12, "warehouse": warehouse,
                       "schedule_date": today()}]}).insert()
        order.submit()
        order_name = order.name
    receipt_name = frappe.db.get_value("Purchase Receipt Item", {"purchase_order": order_name, "docstatus": 1}, "parent")
    if not receipt_name:
        from erpnext.buying.doctype.purchase_order.purchase_order import make_purchase_receipt
        receipt = make_purchase_receipt(order_name)
        receipt.items[0].qty = 8
        receipt.items[0].received_qty = 8
        receipt.items[0].warehouse = warehouse
        receipt.insert()
        receipt.submit()
        receipt_name = receipt.name
    invoice_name = frappe.db.get_value("Purchase Invoice Item", {"purchase_order": order_name, "docstatus": 1}, "parent")
    if not invoice_name:
        from erpnext.stock.doctype.purchase_receipt.purchase_receipt import make_purchase_invoice
        invoice = make_purchase_invoice(receipt_name)
        invoice.bill_no = f"{prefix}-SUPPLIER-BILL-001"
        invoice.bill_date = today()
        invoice.insert()
        invoice.submit()
        invoice_name = invoice.name
    payment_name = frappe.db.get_value("Payment Entry Reference", {
        "reference_doctype": "Purchase Invoice", "reference_name": invoice_name, "docstatus": 1,
    }, "parent")
    if not payment_name:
        from erpnext.accounts.doctype.payment_entry.payment_entry import get_payment_entry
        payment = get_payment_entry("Purchase Invoice", invoice_name, bank_account=company.default_bank_account)
        payment.reference_no = f"{prefix}-SUPPLIER-PAYMENT-001"
        payment.reference_date = today()
        payment.insert()
        payment.submit()
        payment_name = payment.name
    return {"supplier": supplier, "purchase_order": order_name, "purchase_receipt": receipt_name,
            "purchase_invoice": invoice_name, "supplier_payment": payment_name}


if __name__ == "__main__":
    frappe.init(site="frontend", sites_path=".")
    frappe.connect()
    frappe.set_user("Administrator")
    try:
        result = seed_demo()
        result.update(seed_purchasing())
        frappe.db.commit()
        print(json.dumps(result, indent=2))
    except Exception:
        frappe.db.rollback()
        raise
    finally:
        frappe.destroy()
