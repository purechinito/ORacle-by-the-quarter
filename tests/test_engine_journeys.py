"""Run inside the ERPNext container with the frontend site initialized."""
from decimal import Decimal
import unittest

import frappe

COMPANY = "Orbit Demo Company"
MARKER = "ORBIT-DEMO-SALES-001"


class DemoSalesJourney(unittest.TestCase):
    def test_partial_fulfillment_paid_invoice_and_balanced_ledger(self):
        name = frappe.db.get_value("Sales Order", {"company": COMPANY, "po_no": MARKER}, "name")
        self.assertIsNotNone(name, "The persisted demo sales journey does not exist yet")
        order = frappe.get_doc("Sales Order", name)
        self.assertEqual(order.docstatus, 1)
        self.assertEqual(Decimal(str(order.per_delivered)), Decimal("40"))
        self.assertEqual(Decimal(str(order.per_billed)), Decimal("40"))
        invoice_name = frappe.db.get_value("Sales Invoice Item", {"sales_order": name}, "parent")
        self.assertIsNotNone(invoice_name)
        invoice = frappe.get_doc("Sales Invoice", invoice_name)
        self.assertEqual(invoice.docstatus, 1)
        self.assertEqual(Decimal(str(invoice.grand_total)), Decimal("100"))
        self.assertEqual(Decimal(str(invoice.outstanding_amount)), Decimal("0"))
        payments = frappe.get_all("Payment Entry Reference", filters={
            "reference_doctype": "Sales Invoice", "reference_name": invoice_name, "docstatus": 1,
        }, pluck="parent")
        self.assertEqual(len(payments), 1)
        for doctype, document in [("Sales Invoice", invoice_name), ("Payment Entry", payments[0])]:
            entries = frappe.get_all("GL Entry", filters={
                "voucher_type": doctype, "voucher_no": document, "is_cancelled": 0,
            }, fields=["debit", "credit", "company"])
            self.assertGreaterEqual(len(entries), 2)
            self.assertEqual({entry.company for entry in entries}, {COMPANY})
            balance = sum(Decimal(str(entry.debit)) - Decimal(str(entry.credit)) for entry in entries)
            self.assertEqual(balance, Decimal("0"))
        quantity = frappe.db.get_value("Bin", {
            "item_code": "ORBIT-DEMO-BEARING", "warehouse": "Stores - ODC",
        }, "actual_qty")
        self.assertEqual(Decimal(str(quantity)), Decimal("96"))


class DemoPurchaseJourney(unittest.TestCase):
    def setUp(self):
        frappe.db.savepoint("purchase_validation")

    def tearDown(self):
        # Exception cases exercise real controllers without changing retained fixtures.
        frappe.db.rollback(save_point="purchase_validation")

    def purchase_order(self):
        name = frappe.db.get_value("Purchase Order", {
            "company": COMPANY, "supplier": "Orbit Demo Supplier", "title": "ORBIT-DEMO-PURCHASE-001",
        }, "name")
        self.assertIsNotNone(name)
        return name

    def test_over_receipt_is_rejected_without_stock_posting(self):
        from erpnext.buying.doctype.purchase_order.purchase_order import make_purchase_receipt
        from erpnext.controllers.status_updater import OverAllowanceError
        receipt = make_purchase_receipt(self.purchase_order())
        # Eight already received; another twenty-one exceeds the twenty ordered.
        receipt.items[0].qty = 21
        receipt.items[0].received_qty = 21
        with self.assertRaises(OverAllowanceError):
            receipt.insert()
            receipt.submit()
        entries = frappe.get_all("Stock Ledger Entry", filters={"voucher_no": receipt.name}, pluck="name")
        self.assertEqual(entries, [])

    def test_supplier_return_reverses_stock_and_balances_ledger(self):
        from erpnext.stock.doctype.purchase_receipt.purchase_receipt import make_purchase_return
        original = frappe.db.get_value("Purchase Receipt Item", {
            "purchase_order": self.purchase_order(), "docstatus": 1,
        }, "parent")
        returned = make_purchase_return(original)
        returned.items[0].qty = -2
        returned.items[0].received_qty = -2
        returned.insert()
        returned.submit()
        self.assertEqual(returned.return_against, original)
        quantity = frappe.db.get_value("Bin", {"item_code": "ORBIT-DEMO-PURCHASE-PART", "warehouse": "Stores - ODC"}, "actual_qty")
        self.assertEqual(Decimal(str(quantity)), Decimal("6"))
        entries = frappe.get_all("GL Entry", filters={"voucher_type": "Purchase Receipt", "voucher_no": returned.name, "is_cancelled": 0}, fields=["debit", "credit", "company"])
        self.assertGreaterEqual(len(entries), 2)
        self.assertEqual({entry.company for entry in entries}, {COMPANY})
        self.assertEqual(sum(Decimal(str(entry.debit)) - Decimal(str(entry.credit)) for entry in entries), Decimal("0"))

    def test_partial_receipt_paid_bill_and_stock(self):
        name = frappe.db.get_value("Purchase Order", {
            "company": COMPANY, "supplier": "Orbit Demo Supplier", "title": "ORBIT-DEMO-PURCHASE-001",
        }, "name")
        self.assertIsNotNone(name, "The persisted demo purchasing journey does not exist yet")
        order = frappe.get_doc("Purchase Order", name)
        self.assertEqual(order.docstatus, 1)
        self.assertEqual(Decimal(str(order.per_received)), Decimal("40"))
        self.assertEqual(Decimal(str(order.per_billed)), Decimal("40"))
        receipts = frappe.get_all("Purchase Receipt Item", filters={"purchase_order": name, "docstatus": 1}, pluck="parent")
        self.assertEqual(len(receipts), 1)
        bills = frappe.get_all("Purchase Invoice Item", filters={"purchase_order": name, "docstatus": 1}, pluck="parent")
        self.assertEqual(len(bills), 1)
        bill = frappe.get_doc("Purchase Invoice", bills[0])
        self.assertEqual(bill.items[0].purchase_receipt, receipts[0])
        self.assertEqual(Decimal(str(bill.grand_total)), Decimal("96"))
        self.assertEqual(Decimal(str(bill.outstanding_amount)), Decimal("0"))
        payments = frappe.get_all("Payment Entry Reference", filters={
            "reference_doctype": "Purchase Invoice", "reference_name": bill.name, "docstatus": 1,
        }, pluck="parent")
        self.assertEqual(len(payments), 1)
        payment = frappe.get_doc("Payment Entry", payments[0])
        self.assertEqual(payment.payment_type, "Pay")
        self.assertEqual(payment.party, "Orbit Demo Supplier")
        for doctype, document in [("Purchase Receipt", receipts[0]), ("Purchase Invoice", bill.name), ("Payment Entry", payment.name)]:
            entries = frappe.get_all("GL Entry", filters={"voucher_type": doctype, "voucher_no": document, "is_cancelled": 0}, fields=["debit", "credit", "company"])
            self.assertGreaterEqual(len(entries), 2)
            self.assertEqual({entry.company for entry in entries}, {COMPANY})
            self.assertEqual(sum(Decimal(str(entry.debit)) - Decimal(str(entry.credit)) for entry in entries), Decimal("0"))
        quantity = frappe.db.get_value("Bin", {"item_code": "ORBIT-DEMO-PURCHASE-PART", "warehouse": "Stores - ODC"}, "actual_qty")
        self.assertEqual(Decimal(str(quantity)), Decimal("8"))


if __name__ == "__main__":
    frappe.init(site="frontend", sites_path=".")
    frappe.connect()
    frappe.set_user("Administrator")
    try:
        unittest.main(verbosity=2)
    finally:
        frappe.destroy()
