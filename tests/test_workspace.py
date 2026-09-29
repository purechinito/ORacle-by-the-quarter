"""Real permission tests, executed inside the ERP site with rollback."""
import unittest
import frappe


class WorkspaceAccess(unittest.TestCase):
    def setUp(self):
        frappe.set_user("Administrator")
        frappe.db.savepoint("workspace_tests")

    def tearDown(self):
        frappe.set_user("Administrator")
        frappe.db.rollback(save_point="workspace_tests")

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


if __name__ == "__main__":
    frappe.init(site="frontend", sites_path=".")
    frappe.connect()
    try:
        unittest.main(verbosity=2)
    finally:
        frappe.db.rollback()
        frappe.destroy()
