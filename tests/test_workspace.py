"""Real permission tests, executed inside the ERP site with rollback."""
import unittest
from unittest.mock import patch
import frappe


class WorkspaceAccess(unittest.TestCase):
    def setUp(self):
        frappe.set_user("Administrator")
        frappe.db.savepoint("workspace_tests")

    def tearDown(self):
        frappe.set_user("Administrator")
        frappe.db.rollback(save_point="workspace_tests")
        frappe.clear_cache()

    def company(self, name, abbr, country="Philippines", currency="PHP"):
        return frappe.get_doc({"doctype": "Company", "company_name": name, "abbr": abbr,
                               "country": country, "default_currency": currency}).insert()

    def sales_user(self, email, company):
        user = frappe.get_doc({"doctype": "User", "email": email,
                              "first_name": "Workspace Company Test", "send_welcome_email": 0,
                              "user_type": "System User", "roles": [{"role": "Sales User"}]}).insert()
        frappe.get_doc({"doctype": "User Permission", "user": user.name, "allow": "Company",
                        "for_value": company, "apply_to_all_doctypes": 1}).insert()
        return user.name

    def test_default_prefers_philippine_peso_company_over_alphabetically_first_us_company(self):
        from quarter_erp.api import workspace

        legacy = self.company("AAA Workspace US Test", "AWUS", "United States", "USD")
        self.company("Workspace Cebu Peso Test", "WCPT")
        preferred = frappe.get_list("Company", filters={"country": "Philippines", "default_currency": "PHP"},
                                    pluck="name", order_by="name", limit_page_length=0)
        self.assertLess(legacy.name, preferred[0])
        # Only the configured global preference is substituted; company/record permissions remain native.
        with patch("frappe.defaults.get_global_default", return_value=None):
            result = workspace(section="sales")
        self.assertEqual(result["company"], preferred[0])
        self.assertEqual([row.name for row in result["companies"]], preferred)
        self.assertTrue(all(row.country == "Philippines" and row.default_currency == "PHP"
                            for row in result["companies"]))
        self.assertEqual(frappe.db.get_value("Company", legacy.name, "default_currency"), "USD")

    def test_authorized_philippine_global_company_is_preferred(self):
        from quarter_erp.api import workspace

        self.company("AAA Workspace Cebu First", "AWCF")
        preferred = self.company("ZZZ Workspace Cebu Preferred", "ZWCP")
        with patch("frappe.defaults.get_global_default", return_value=preferred.name):
            result = workspace(section="sales")
        self.assertEqual(result["company"], preferred.name)

    def test_explicit_legacy_company_preserves_original_currency_and_values(self):
        from quarter_erp.api import transaction, workspace

        self.company("Workspace Cebu Legacy Test", "WCLT")
        result = workspace(company="Orbit Demo Company", section="sales")
        selected = next(row for row in result["companies"] if row.name == "Orbit Demo Company")
        self.assertEqual(selected.default_currency, "USD")
        self.assertEqual(selected.country, "United States")
        self.assertTrue(all(row.name == selected.name or (row.country == "Philippines" and row.default_currency == "PHP")
                            for row in result["companies"]))
        order = next(row for row in result["records"] if row.name == "SAL-ORD-2026-00001")
        self.assertEqual((order.currency, order.grand_total), ("USD", 250))
        detail = transaction("sales", order.name, selected.name)
        self.assertEqual((detail["document"]["currency"], detail["document"]["grand_total"]), ("USD", 250))

    def test_global_default_and_explicit_legacy_reads_keep_company_permissions(self):
        from quarter_erp.api import workspace

        visible = self.company("Workspace Cebu Visible", "WCV")
        hidden = self.company("Workspace Cebu Hidden", "WCH")
        frappe.set_user(self.sales_user("workspace-ph-scope@example.invalid", visible.name))
        with patch("frappe.defaults.get_global_default", return_value=hidden.name):
            result = workspace(section="sales")
        self.assertEqual(result["company"], visible.name)
        self.assertEqual([row.name for row in result["companies"]], [visible.name])
        for company in (hidden.name, "Orbit Demo Company"):
            with self.subTest(company=company), self.assertRaises(frappe.PermissionError):
                workspace(company=company, section="sales")

    def test_legacy_only_account_keeps_authorized_fallback(self):
        from quarter_erp.api import workspace

        hidden = self.company("Workspace Cebu Fallback Test", "WCFT")
        frappe.set_user(self.sales_user("workspace-legacy-scope@example.invalid", "Orbit Demo Company"))
        with patch("frappe.defaults.get_global_default", return_value=hidden.name):
            result = workspace(section="sales")
        self.assertEqual(result["company"], "Orbit Demo Company")
        self.assertEqual([row.name for row in result["companies"]], ["Orbit Demo Company"])
        self.assertTrue(all(row.currency == "USD" for row in result["records"]))

    def test_admin_reads_actual_company_and_sales(self):
        from quarter_erp.api import workspace
        result = workspace(company="Orbit Demo Company", section="sales")
        self.assertEqual(result["company"], "Orbit Demo Company")
        self.assertTrue(any(row["name"] == "SAL-ORD-2026-00001" for row in result["records"]))
        self.assertEqual(result["user"]["name"], "Administrator")

    def test_guest_is_denied(self):
        from quarter_erp.api import workspace
        frappe.set_user("Guest")
        with self.assertRaises(frappe.PermissionError):
            workspace(company="Orbit Demo Company")

    def test_invalid_company_cannot_leak_records(self):
        from quarter_erp.api import workspace
        with self.assertRaises(frappe.PermissionError):
            workspace(company="Not an authorized company")

    def test_employee_without_sales_access_is_denied(self):
        from quarter_erp.api import workspace
        user = frappe.get_doc({"doctype": "User", "email": "workspace-denied@example.invalid",
                              "first_name": "Permission Test", "send_welcome_email": 0,
                              "user_type": "System User", "roles": [{"role": "Employee"}]}).insert()
        frappe.set_user(user.name)
        with self.assertRaises(frappe.PermissionError):
            workspace(company="Orbit Demo Company", section="sales")

    def test_search_and_pagination_are_bounded(self):
        from quarter_erp.api import workspace
        result = workspace(company="Orbit Demo Company", section="sales", search="no-matching-document")
        self.assertEqual(result["records"], [])
        with self.assertRaises(frappe.ValidationError):
            workspace(company="Orbit Demo Company", section="User")
        with self.assertRaises(frappe.ValidationError):
            workspace(company="Orbit Demo Company", page=-1)
        self.assertEqual(workspace(company="Orbit Demo Company", search="%")['records'], [])

    def test_pages_have_no_overlap_and_filters_use_real_balances(self):
        from quarter_erp.api import workspace
        source = frappe.get_doc("Sales Order", "SAL-ORD-2026-00001")
        for index in range(21):
            draft = frappe.copy_doc(source)
            draft.docstatus = 0
            draft.po_no = f"WORKSPACE-PAGINATION-TEST-{index}"
            draft.insert()
        first = workspace(company="Orbit Demo Company", section="sales", page=0)
        second = workspace(company="Orbit Demo Company", section="sales", page=1)
        self.assertEqual(len(first["records"]), 20)
        self.assertTrue(first["has_more"])
        self.assertTrue(second["records"])
        self.assertFalse({row.name for row in first["records"]} & {row.name for row in second["records"]})
        invoices = workspace(company="Orbit Demo Company", section="receivables", open_only="1")
        self.assertEqual(invoices["records"], [])

    def test_sales_detail_preserves_partial_quantities_and_actual_links(self):
        from quarter_erp.api import transaction
        result = transaction("sales", "SAL-ORD-2026-00001", "Orbit Demo Company")
        self.assertEqual(result["document"]["grand_total"], 250)
        self.assertEqual(result["items"][0]["qty"], 10)
        self.assertEqual(result["items"][0]["delivered_qty"], 4)
        groups = {group["doctype"]: group for group in result["related"]}
        self.assertEqual(groups["Delivery Note"]["records"][0].name, "MAT-DN-2026-00001")
        self.assertEqual(groups["Sales Invoice"]["records"][0].name, "ACC-SINV-2026-00001")

    def test_invoice_detail_links_to_order_and_payment(self):
        from quarter_erp.api import transaction
        result = transaction("receivables", "ACC-SINV-2026-00001", "Orbit Demo Company")
        self.assertEqual(result["document"]["outstanding_amount"], 0)
        groups = {group["doctype"]: group for group in result["related"]}
        self.assertEqual(groups["Sales Order"]["records"][0].name, "SAL-ORD-2026-00001")
        self.assertEqual(groups["Payment Entry"]["records"][0].name, "ACC-PAY-2026-00001")

    def test_purchase_details_link_receipts_bills_and_payments(self):
        from quarter_erp.api import transaction
        result = transaction("purchasing", "PUR-ORD-2026-00001", "Orbit Demo Company")
        groups = {group["doctype"]: group for group in result["related"]}
        self.assertEqual(groups["Purchase Receipt"]["records"][0].name, "MAT-PRE-2026-00001")
        self.assertEqual(groups["Purchase Invoice"]["records"][0].name, "ACC-PINV-2026-00001")
        invoice = transaction("payables", "ACC-PINV-2026-00001", "Orbit Demo Company")
        payment = next(group for group in invoice["related"] if group["doctype"] == "Payment Entry")
        self.assertEqual(payment["records"][0].name, "ACC-PAY-2026-00002")

    def test_detail_denies_guest_invalid_company_and_unassigned_user(self):
        from quarter_erp.api import transaction
        with self.assertRaises(frappe.PermissionError):
            transaction("sales", "SAL-ORD-2026-00001", "Other company")
        frappe.set_user("Guest")
        with self.assertRaises(frappe.PermissionError):
            transaction("sales", "SAL-ORD-2026-00001", "Orbit Demo Company")

        frappe.set_user("Administrator")
        user = frappe.get_doc({"doctype": "User", "email": "detail-denied@example.invalid",
                              "first_name": "Detail Denied", "send_welcome_email": 0,
                              "user_type": "System User", "roles": [{"role": "Employee"}]}).insert()
        frappe.set_user(user.name)
        with self.assertRaises(frappe.PermissionError):
            transaction("sales", "SAL-ORD-2026-00001", "Orbit Demo Company")

    def test_sales_reader_does_not_receive_restricted_invoice_links(self):
        from quarter_erp.api import transaction
        user = frappe.get_doc({"doctype": "User", "email": "detail-sales@example.invalid",
                              "first_name": "Sales Reader", "send_welcome_email": 0,
                              "user_type": "System User", "roles": [{"role": "Sales User"}]}).insert()
        frappe.set_user(user.name)
        result = transaction("sales", "SAL-ORD-2026-00001", "Orbit Demo Company")
        self.assertEqual(result["document"]["name"], "SAL-ORD-2026-00001")
        invoices = next(group for group in result["related"] if group["doctype"] == "Sales Invoice")
        self.assertEqual(invoices["access"], "restricted")
        self.assertEqual(invoices["records"], [])



if __name__ == "__main__":
    frappe.init(site="frontend", sites_path=".")
    frappe.connect()
    try:
        unittest.main(verbosity=2)
    finally:
        frappe.db.rollback()
        frappe.destroy()
