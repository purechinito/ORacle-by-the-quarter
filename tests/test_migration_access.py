"""Preview authorization and no-write checks against the actual Frappe site."""
import unittest
import frappe


class MigrationAccess(unittest.TestCase):
    company = "Orbit Demo Company"
    mapping = {"source_id":"ID", "customer_name":"Name", "customer_group":"Group", "territory":"Territory"}

    def setUp(self):
        frappe.set_user("Administrator")
        frappe.db.savepoint("migration_tests")

    def tearDown(self):
        frappe.set_user("Administrator")
        frappe.db.rollback(save_point="migration_tests")

    def test_options_and_valid_preview_write_nothing(self):
        from quarter_erp.migration import preview
        before = {dt:frappe.db.count(dt) for dt in ("Customer", "Supplier", "Item", "File", "Data Import", "GL Entry", "Stock Ledger Entry")}
        result = preview(self.company, "customers", 'ID,Name,Group,Territory\n0001,Migration Example,All Customer Groups,All Territories', self.mapping)
        self.assertEqual(result["invalid_count"], 0)
        self.assertEqual(result["sample"][0]["values"]["source_id"], "0001")
        self.assertNotIn("_invalid", result)
        self.assertNotIn("rows", result)
        after = {dt:frappe.db.count(dt) for dt in before}
        self.assertEqual(before, after)

    def test_guest_and_nonmanager_denied(self):
        from quarter_erp.migration import options, profile, preview
        user = frappe.get_doc({"doctype":"User", "email":"migration-denied@example.invalid", "first_name":"Preview denied", "send_welcome_email":0, "user_type":"System User", "roles":[{"role":"Employee"}]}).insert()
        for actor in ("Guest", user.name):
            frappe.set_user(actor)
            for call in (lambda:options(), lambda:profile(self.company,"customers","ID\n1"), lambda:preview(self.company,"customers","ID\n1",{})):
                with self.assertRaises(frappe.PermissionError):
                    call()

    def test_invalid_company_and_type_rejected(self):
        from quarter_erp.migration import profile
        with self.assertRaises(frappe.PermissionError):
            profile("Unknown company", "customers", "ID\n1")
        with self.assertRaises(frappe.ValidationError):
            profile(self.company, "User", "ID\n1")

    def test_company_cannot_be_empty_or_a_query_operator(self):
        from quarter_erp.migration import profile
        for company in (None, "", ["!=", ""], {"name":self.company}):
            with self.subTest(company=company), self.assertRaises(frappe.ValidationError):
                profile(company, "customers", "source_id\n1")

    def test_missing_references_and_existing_target_are_blocking(self):
        from quarter_erp.migration import preview
        content = 'ID,Name,Group,Territory\n1,New Name,Unavailable group,All Territories\n2,Orbit Demo Customer,All Customer Groups,All Territories'
        result = preview(self.company, "customers", content, self.mapping)
        self.assertEqual(result["invalid_count"], 2)
        self.assertEqual({i["code"] for i in result["issues"]}, {"reference_unavailable", "existing_target"})

    def test_counts_not_limited_by_report_size(self):
        from quarter_erp.migration import preview
        content = 'ID,Name,Group,Territory\n'+'\n'.join(f'{i},Migration {i},Missing group,All Territories' for i in range(250))
        result = preview(self.company, "customers", content, self.mapping)
        self.assertEqual(result["invalid_count"], 250)
        self.assertEqual(len(result["issues"]), 200)
        self.assertTrue(result["issues_truncated"])

    def test_hidden_reference_is_not_disclosed(self):
        from quarter_erp.migration import preview
        user = frappe.get_doc({"doctype":"User", "email":"migration-scope@example.invalid", "first_name":"Scoped manager", "send_welcome_email":0, "user_type":"System User", "roles":[{"role":"System Manager"},{"role":"Sales Master Manager"}]}).insert()
        # A real user restriction must remain effective even for migration preview.
        allowed = frappe.get_doc({"doctype":"Territory", "territory_name":"Migration Allowed", "parent_territory":"All Territories"}).insert()
        frappe.get_doc({"doctype":"User Permission", "user":user.name, "allow":"Territory", "for_value":allowed.name, "apply_to_all_doctypes":1}).insert()
        frappe.set_user(user.name)
        result = preview(self.company,"customers",'ID,Name,Group,Territory\n1,New Name,All Customer Groups,All Territories',self.mapping)
        self.assertTrue(any(i["field"]=="territory" and i["code"]=="reference_unavailable" for i in result["issues"]))


if __name__ == '__main__':
    frappe.init(site="frontend")
    frappe.connect()
    try:
        unittest.main()
    finally:
        frappe.db.rollback()
        frappe.destroy()
