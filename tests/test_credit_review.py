"""Customer credit review uses actual posted allocations; all fixtures roll back."""
import unittest
import uuid

import frappe
from frappe.utils import add_days, today


class CreditReview(unittest.TestCase):
    company = "Orbit Philippines Demo"

    def setUp(self):
        frappe.set_user("Administrator")
        frappe.db.savepoint("credit_review_test")
        self.customer = frappe.get_doc({"doctype": "Customer", "customer_name": "Credit review " + uuid.uuid4().hex[:10],
            "customer_type": "Company", "customer_group": "Philippine Demo Buyers",
            "territory": "Philippine Demo Region", "default_currency": "PHP"}).insert().name

    def tearDown(self):
        frappe.set_user("Administrator")
        frappe.db.rollback(save_point="credit_review_test")
        frappe.clear_cache()

    def order(self, rate=200, submit=False):
        from erpnext.controllers.accounts_controller import get_taxes_and_charges
        doc = frappe.get_doc({"doctype": "Sales Order", "company": self.company, "customer": self.customer,
            "delivery_date": today(), "taxes_and_charges": "PH VAT 12% Sales - OPH",
            "taxes": get_taxes_and_charges("Sales Taxes and Charges Template", "PH VAT 12% Sales - OPH"),
            "items": [{"item_code": "ORBIT-PH-DEMO-BEARING", "qty": 1, "rate": rate,
                       "warehouse": "Stores - OPH", "delivery_date": today()}]}).insert()
        if submit:
            doc.submit()
        return doc

    def invoice(self, rate=1000, future=False, split=False, currency=None):
        from erpnext.controllers.accounts_controller import get_taxes_and_charges
        doc = frappe.get_doc({"doctype": "Sales Invoice", "company": self.company, "customer": self.customer,
            "posting_date": add_days(today(), -20), "set_posting_time": 1,
            "due_date": add_days(today(), 10 if future else -10),
            "taxes_and_charges": "PH VAT 12% Sales - OPH",
            "taxes": get_taxes_and_charges("Sales Taxes and Charges Template", "PH VAT 12% Sales - OPH"),
            "items": [{"item_code": "ORBIT-PH-DEMO-BEARING", "qty": 1, "rate": rate}]})
        if currency:
            doc.currency = currency
            doc.conversion_rate = 56
            doc.debit_to = frappe.get_doc({"doctype": "Account", "account_name": "Credit review USD " + uuid.uuid4().hex[:8],
                "company": self.company, "account_currency": currency, "account_type": "Receivable",
                "parent_account": frappe.db.get_value("Account", "Debtors - OPH", "parent_account")}).insert().name
        if split:
            doc.set("payment_schedule", [
                {"due_date": add_days(today(), -10), "invoice_portion": 50},
                {"due_date": add_days(today(), 10), "invoice_portion": 50},
            ])
        doc.insert()
        doc.submit()
        return doc

    def payment(self, invoice, amount):
        from erpnext.accounts.doctype.payment_entry.payment_entry import get_payment_entry
        outstanding = frappe.db.get_value("Sales Invoice", invoice.name, "outstanding_amount")
        payment = get_payment_entry("Sales Invoice", invoice.name, party_amount=min(amount, outstanding), bank_amount=amount,
                                    bank_account="Operating Bank - OPH")
        payment.paid_amount = payment.received_amount = amount
        payment.reference_no = "CREDIT-REVIEW-TEST"
        payment.reference_date = today()
        for reference in payment.references:
            reference.allocated_amount = min(amount, outstanding)
        payment.insert()
        payment.submit()
        return payment

    def review(self, order):
        from quarter_erp.credit import review
        return review(order.name, self.company)

    def test_partial_payment_overdue_and_existing_order_change_projected_exposure(self):
        invoice = self.invoice()
        self.payment(invoice, 400)
        existing = self.order(500, submit=True)
        order = self.order()
        customer = frappe.get_doc("Customer", self.customer)
        customer.append("credit_limits", {"company": self.company, "credit_limit": 1300})
        customer.save()
        result = self.review(order)
        self.assertEqual(result["currency"], "PHP")
        self.assertAlmostEqual(result["unpaid_invoices"], 720)
        self.assertAlmostEqual(result["overdue"], 720)
        self.assertAlmostEqual(result["other_orders"], 560)
        self.assertAlmostEqual(result["this_order"], 224)
        self.assertAlmostEqual(result["projected_exposure"], 1504)
        self.assertAlmostEqual(result["over_limit"], 204)
        self.assertEqual(result["invoices"][0]["name"], invoice.name)
        self.assertEqual(result["invoices"][0]["days_overdue"], 10)
        self.assertEqual(result["orders"][0]["name"], existing.name)
        self.assertEqual(frappe.db.get_value("Sales Order", order.name, "docstatus"), 0)

    def test_paid_invoice_is_not_unpaid_and_unallocated_payment_is_a_credit(self):
        invoice = self.invoice()
        self.payment(invoice, 1220)
        result = self.review(self.order())
        self.assertEqual(result["invoices"], [])
        self.assertAlmostEqual(result["unpaid_invoices"], 0)
        self.assertAlmostEqual(result["available_credits"], 100)
        self.assertAlmostEqual(result["ledger_balance"], -100)
        self.assertAlmostEqual(result["projected_exposure"], 124)
        self.assertTrue(result["credits"])

    def test_submitted_order_is_counted_once_and_no_limit_is_not_zero_credit(self):
        order = self.order(submit=True)
        result = self.review(order)
        self.assertAlmostEqual(result["projected_exposure"], 224)
        self.assertEqual(result["other_orders"], 0)
        self.assertIsNone(result["credit_limit"])
        self.assertIsNone(result["remaining_credit"])

    def test_future_due_invoice_is_unpaid_but_not_overdue(self):
        self.invoice(future=True)
        result = self.review(self.order())
        self.assertAlmostEqual(result["unpaid_invoices"], 1120)
        self.assertEqual(result["overdue"], 0)
        self.assertEqual(result["invoices"][0]["days_overdue"], 0)

    def test_only_due_instalment_is_overdue_after_partial_payment(self):
        invoice = self.invoice(future=True, split=True)
        self.payment(invoice, 400)
        result = self.review(self.order())
        self.assertAlmostEqual(result["unpaid_invoices"], 720)
        self.assertAlmostEqual(result["overdue"], 160)
        self.assertEqual(result["invoices"][0]["days_overdue"], 0)

    def test_foreign_invoice_uses_booked_company_amount_not_current_exchange_rate(self):
        self.invoice(rate=10, currency="USD")
        result = self.review(self.order())
        self.assertAlmostEqual(result["unpaid_invoices"], 627.2)
        self.assertAlmostEqual(result["projected_exposure"], 851.2)
        self.assertEqual(result["currency"], "PHP")
        self.assertEqual(result["invoices"][0]["original_currency"], "USD")
        self.assertAlmostEqual(result["invoices"][0]["original_total"], 11.2)

    def manager(self):
        user = frappe.get_doc({"doctype": "User", "email": uuid.uuid4().hex + "@example.invalid",
            "first_name": "Credit review test", "send_welcome_email": 0,
            "roles": [{"role": role} for role in ("Accounts Manager", "Sales Manager", "Stock User")]}).insert()
        frappe.get_doc({"doctype": "User Permission", "user": user.name, "allow": "Company",
            "for_value": self.company, "apply_to_all_doctypes": 1}).insert()
        return user.name

    def test_restricted_accounting_field_cannot_leak_through_credit_totals(self):
        order = self.order()
        user = self.manager()
        frappe.get_doc({"doctype": "Property Setter", "doctype_or_field": "DocField", "doc_type": "Sales Invoice",
            "field_name": "base_grand_total", "property": "permlevel", "property_type": "Int", "value": "9"}).insert()
        frappe.clear_cache(doctype="Sales Invoice")
        frappe.set_user(user)
        with self.assertRaises(frappe.PermissionError):
            self.review(order)

    def test_record_restricted_reviewer_cannot_receive_complete_company_totals(self):
        order = self.order()
        user = self.manager()
        frappe.get_doc({"doctype": "User Permission", "user": user, "allow": "Customer",
            "for_value": self.customer, "apply_to_all_doctypes": 1}).insert()
        frappe.set_user(user)
        with self.assertRaises(frappe.PermissionError):
            self.review(order)

    def test_hidden_instalment_amount_cannot_leak_as_overdue_total(self):
        order = self.order()
        user = self.manager()
        frappe.get_doc({"doctype": "Property Setter", "doctype_or_field": "DocField", "doc_type": "Payment Schedule",
            "field_name": "base_payment_amount", "property": "permlevel", "property_type": "Int", "value": "9"}).insert()
        frappe.clear_cache(doctype="Payment Schedule")
        frappe.set_user(user)
        with self.assertRaises(frappe.PermissionError):
            self.review(order)

    def test_cancelled_invoice_has_no_credit_exposure(self):
        invoice = self.invoice()
        invoice.cancel()
        result = self.review(self.order())
        self.assertEqual(result["invoices"], [])
        self.assertEqual(result["ledger_balance"], 0)

    def test_company_and_accounting_permissions_are_required(self):
        from quarter_erp.credit import review
        order = self.order()
        for role in ("Sales User", "Accounts Manager"):
            frappe.set_user("Administrator")
            user = frappe.get_doc({"doctype": "User", "email": uuid.uuid4().hex + "@example.invalid",
                "first_name": "Credit review test", "send_welcome_email": 0,
                "roles": [{"role": role}, {"role": "Sales Manager"}, {"role": "Stock User"}] if role == "Accounts Manager" else [{"role": role}]}).insert()
            frappe.get_doc({"doctype": "User Permission", "user": user.name, "allow": "Company",
                "for_value": self.company, "apply_to_all_doctypes": 1}).insert()
            frappe.set_user(user.name)
            if role == "Sales User":
                with self.assertRaises(frappe.PermissionError):
                    review(order.name, self.company)
            else:
                self.assertEqual(review(order.name, self.company)["order"], order.name)
                with self.assertRaises(frappe.PermissionError):
                    review(order.name, "Orbit Demo Company")
        frappe.set_user("Guest")
        with self.assertRaises(frappe.PermissionError):
            review(order.name, self.company)


if __name__ == "__main__":
    frappe.init(site="frontend", sites_path=".")
    frappe.connect()
    try:
        unittest.main(verbosity=2)
    finally:
        frappe.db.rollback()
        frappe.destroy()
