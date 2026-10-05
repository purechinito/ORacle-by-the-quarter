"""Local Philippine demo defaults and native tax/accounting regression checks."""
import unittest
import uuid

import frappe
from frappe.utils import today


class PhilippineDemo(unittest.TestCase):
    def setUp(self):
        frappe.set_user("Administrator")
        frappe.db.savepoint("ph_demo_test")

    def tearDown(self):
        frappe.db.rollback(save_point="ph_demo_test")
        frappe.clear_cache()

    def test_default_company_and_price_lists_keep_new_documents_in_pesos(self):
        company = frappe.defaults.get_user_default("company")
        self.assertEqual(frappe.get_cached_value("Company", company, "default_currency"), "PHP")
        self.assertEqual(frappe.get_cached_value("Company", company, "country"), "Philippines")
        for dt, field in [("Selling Settings", "selling_price_list"), ("Buying Settings", "buying_price_list")]:
            price_list = frappe.db.get_single_value(dt, field)
            self.assertEqual(frappe.db.get_value("Price List", price_list, "currency"), "PHP")

    def test_invoice_uses_php_and_separate_output_vat(self):
        from erpnext.controllers.accounts_controller import get_taxes_and_charges
        doc = frappe.get_doc({"doctype": "Sales Invoice", "company": "Orbit Philippines Demo",
            "customer": "Orbit Philippines Demo Customer", "posting_date": today(), "due_date": today(),
            "taxes_and_charges": "PH VAT 12% Sales - OPH",
            "taxes": get_taxes_and_charges("Sales Taxes and Charges Template", "PH VAT 12% Sales - OPH"),
            "items": [{"item_code": "ORBIT-PH-DEMO-BEARING", "qty": 2, "rate": 1000}]}).insert()
        self.assertEqual(doc.currency, "PHP")
        self.assertEqual(doc.price_list_currency, "PHP")
        self.assertEqual(doc.conversion_rate, 1)
        self.assertEqual(doc.net_total, 2000)
        self.assertEqual(doc.total_taxes_and_charges, 240)
        self.assertEqual(doc.grand_total, 2240)
        self.assertEqual(doc.taxes[0].account_head, "Output VAT - OPH")
        doc.submit()
        entries = frappe.get_all("GL Entry", filters={"voucher_no": doc.name, "is_cancelled": 0}, fields=["account", "debit", "credit"])
        self.assertEqual(sum(row.debit for row in entries), 2240)
        self.assertEqual(sum(row.credit for row in entries), 2240)
        self.assertEqual(sum(row.credit for row in entries if row.account == "Output VAT - OPH"), 240)
        purchase = frappe.get_doc("Purchase Taxes and Charges Template", "PH VAT 12% Purchases - OPH")
        self.assertEqual(purchase.taxes[0].account_head, "Input VAT - OPH")
        self.assertEqual(frappe.db.get_value("Account", "Input VAT - OPH", "root_type"), "Asset")

    def test_setup_is_idempotent_and_preserves_historical_amounts(self):
        from quarter_erp.philippines import setup_demo
        old = frappe.get_all("GL Entry", filters={"company": "Orbit Demo Company"},
            fields=["name", "account", "debit", "credit", "account_currency"], order_by="name")
        counts = {dt: frappe.db.count(dt) for dt in ["Company", "Account", "Item", "Customer", "Price List"]}
        setup_demo()
        self.assertEqual(counts, {dt: frappe.db.count(dt) for dt in counts})
        self.assertEqual(old, frappe.get_all("GL Entry", filters={"company": "Orbit Demo Company"},
            fields=["name", "account", "debit", "credit", "account_currency"], order_by="name"))
        if frappe.db.exists("Company", "Orbit Demo Company"):
            self.assertEqual(frappe.db.get_value("Company", "Orbit Demo Company", "default_currency"), "USD")

    def test_workspace_draft_inherits_philippine_tax_template(self):
        from quarter_erp.commands import save_sales_draft
        result = save_sales_draft(str(uuid.uuid4()), {"company": "Orbit Philippines Demo",
            "customer": "Orbit Philippines Demo Customer", "delivery_date": today(),
            "items": [{"item_code": "ORBIT-PH-DEMO-BEARING", "qty": "2", "rate": "1000", "warehouse": "Stores - OPH"}]})
        order = frappe.get_doc("Sales Order", result["name"])
        self.assertEqual(order.currency, "PHP")
        self.assertEqual(order.total_taxes_and_charges, 240)
        self.assertEqual(order.grand_total, 2240)

    def test_purchase_preserves_centavos_and_uses_input_vat(self):
        from erpnext.controllers.accounts_controller import get_taxes_and_charges
        doc = frappe.get_doc({"doctype": "Purchase Invoice", "company": "Orbit Philippines Demo",
            "supplier": "Orbit Philippines Demo Supplier", "posting_date": today(), "bill_no": "PH-TEST-CENTAVOS",
            "bill_date": today(), "taxes_and_charges": "PH VAT 12% Purchases - OPH",
            "taxes": get_taxes_and_charges("Purchase Taxes and Charges Template", "PH VAT 12% Purchases - OPH"),
            "items": [{"item_code": "ORBIT-PH-DEMO-PURCHASE-PART", "qty": 2, "rate": 100.25}]}).insert()
        self.assertEqual(doc.currency, "PHP")
        self.assertEqual(doc.disable_rounded_total, 1)
        self.assertAlmostEqual(doc.grand_total, 224.56)
        doc.submit()
        self.assertAlmostEqual(doc.outstanding_amount, 224.56)
        entries = frappe.get_all("GL Entry", filters={"voucher_no": doc.name, "is_cancelled": 0}, fields=["account", "debit", "credit"])
        self.assertAlmostEqual(sum(row.debit for row in entries), 224.56)
        self.assertAlmostEqual(sum(row.credit for row in entries), 224.56)
        self.assertAlmostEqual(sum(row.debit for row in entries if row.account == "Input VAT - OPH"), 24.06)


if __name__ == "__main__":
    frappe.init(site="frontend", sites_path=".")
    frappe.connect()
    try:
        unittest.main(verbosity=2)
    finally:
        frappe.db.rollback()
        frappe.destroy()
