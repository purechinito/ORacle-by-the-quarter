"""Exercise native draft controllers and the atomic retry boundary."""
import unittest
import uuid
import frappe
from frappe.utils import today, add_days, getdate


class DraftCommands(unittest.TestCase):
    def setUp(self):
        frappe.set_user("Administrator")
        frappe.db.savepoint("draft_command_test")
        self.key = str(uuid.uuid4())
        self.payload = {"company":"Orbit Demo Company", "customer":"Orbit Demo Customer", "delivery_date":today(),
                        "items":[{"item_code":"ORBIT-DEMO-BEARING", "qty":"2", "rate":"25", "warehouse":"Stores - ODC"}]}

    def tearDown(self):
        frappe.set_user("Administrator")
        frappe.db.rollback(save_point="draft_command_test")

    def test_create_retry_and_changed_request_conflict(self):
        from quarter_erp.commands import save_sales_draft
        first = save_sales_draft(self.key, self.payload)
        again = save_sales_draft(self.key, self.payload)
        self.assertEqual(first, again)
        doc = frappe.get_doc("Sales Order", first["name"])
        self.assertEqual(doc.docstatus, 0)
        self.assertEqual(doc.grand_total, 50)
        self.assertEqual(frappe.db.count("Orbit Command", {"result_json":["like", "%"+doc.name+"%"]}), 1)
        self.payload["items"][0]["qty"] = "3"
        with self.assertRaises(frappe.ValidationError):
            save_sales_draft(self.key, self.payload)
        self.assertEqual(frappe.get_doc("Sales Order", doc.name).grand_total, 50)

    def test_draft_link_search_is_scoped_and_literal(self):
        from quarter_erp.commands import sales_draft_links
        company = self.payload["company"]
        self.assertIn("Orbit Demo Customer", sales_draft_links(company, "customer", "Orbit")["names"])
        self.assertIn("ORBIT-DEMO-BEARING", sales_draft_links(company, "item", "BEARING")["names"])
        self.assertIn("Stores - ODC", sales_draft_links(company, "warehouse", "Stores")["names"])
        self.assertEqual(sales_draft_links(company, "item", "%")["names"], [])
        with self.assertRaises(frappe.PermissionError):
            sales_draft_links("Unavailable company", "item", "")
        with self.assertRaises(frappe.ValidationError):
            sales_draft_links(company, "User", "")
        frappe.set_user("Guest")
        with self.assertRaises(frappe.PermissionError):
            sales_draft_links(company, "customer", "")

    def test_update_preserves_line_identity_and_rejects_stale_version(self):
        from quarter_erp.commands import save_sales_draft
        first = save_sales_draft(self.key, self.payload)
        original = frappe.get_doc("Sales Order", first["name"])
        self.payload["items"][0]["name"] = original.items[0].name
        self.payload["items"][0]["qty"] = "3"
        second = save_sales_draft(str(uuid.uuid4()), self.payload, name=original.name, expected_modified=first["modified"])
        updated = frappe.get_doc("Sales Order", original.name)
        self.assertEqual(updated.grand_total, 75)
        self.assertEqual(updated.items[0].name, original.items[0].name)
        self.assertNotEqual(second["modified"], first["modified"])
        with self.assertRaises(frappe.TimestampMismatchError):
            save_sales_draft(str(uuid.uuid4()), self.payload, name=original.name, expected_modified=first["modified"])

    def test_append_line_to_existing_draft(self):
        from quarter_erp.commands import save_sales_draft
        created = save_sales_draft(self.key, self.payload)
        doc = frappe.get_doc("Sales Order", created["name"])
        self.payload["items"][0]["name"] = doc.items[0].name
        self.payload["items"].append({"item_code":"ORBIT-DEMO-BEARING", "qty":"2", "rate":"25", "warehouse":"Stores - ODC"})
        save_sales_draft(str(uuid.uuid4()), self.payload, name=doc.name, expected_modified=created["modified"])
        updated = frappe.get_doc("Sales Order", doc.name)
        self.assertEqual(len(updated.items), 2)
        self.assertEqual(updated.grand_total, 100)

    def test_submitted_order_cannot_be_changed(self):
        from quarter_erp.commands import save_sales_draft
        order = frappe.get_doc("Sales Order", "SAL-ORD-2026-00001")
        with self.assertRaises(frappe.ValidationError):
            save_sales_draft(self.key, self.payload, name=order.name, expected_modified=str(order.modified))
        self.assertEqual(frappe.get_doc("Sales Order", order.name).grand_total, 250)

    def test_quantity_edit_preserves_line_description_and_individual_schedule(self):
        from quarter_erp.commands import save_sales_draft
        self.payload["items"].append(dict(self.payload["items"][0]))
        created = save_sales_draft(self.key, self.payload)
        doc = frappe.get_doc("Sales Order", created["name"])
        doc.items[0].description = "Keep this custom line description"
        doc.items[1].delivery_date = getdate(add_days(today(), 2))
        doc.save()
        self.payload["delivery_date"] = str(doc.delivery_date)
        for request, row in zip(self.payload["items"], doc.items):
            request["name"] = row.name
        self.payload["items"][0]["qty"] = "3"
        save_sales_draft(str(uuid.uuid4()), self.payload, name=doc.name, expected_modified=str(doc.modified))
        updated = frappe.get_doc("Sales Order", doc.name)
        self.assertEqual(updated.items[0].description, "Keep this custom line description")
        self.assertEqual(str(updated.items[0].delivery_date), today())
        self.assertEqual(str(updated.items[1].delivery_date), add_days(today(), 2))

    def test_bad_input_has_no_receipt_and_no_order(self):
        from quarter_erp.commands import save_sales_draft
        before = frappe.db.count("Sales Order")
        before_receipts = frappe.db.count("Orbit Command")
        for value in ["NaN", "Infinity", "-1", True, "1e-999999999", "9" * 100]:
            self.payload["items"][0]["qty"] = value
            with self.assertRaises(frappe.ValidationError):
                save_sales_draft(self.key, self.payload)
        self.assertEqual(frappe.db.count("Sales Order"), before)
        self.assertEqual(frappe.db.count("Orbit Command"), before_receipts)

    def test_guest_and_employee_cannot_create(self):
        from quarter_erp.commands import save_sales_draft
        frappe.set_user("Guest")
        with self.assertRaises(frappe.PermissionError):
            save_sales_draft(self.key, self.payload)

        frappe.set_user("Administrator")
        user = frappe.get_doc({"doctype":"User", "email":"draft-denied@example.invalid", "first_name":"Draft Denied", "send_welcome_email":0, "user_type":"System User", "roles":[{"role":"Employee"}]}).insert()
        frappe.set_user(user.name)
        with self.assertRaises(frappe.PermissionError):
            save_sales_draft(self.key, self.payload)

    def test_native_validation_rolls_back_receipt_and_allows_corrected_retry(self):
        from quarter_erp.commands import save_sales_draft
        before_orders = frappe.db.count("Sales Order")
        before_receipts = frappe.db.count("Orbit Command")
        self.payload["delivery_date"] = "2000-01-01"
        with self.assertRaises(frappe.ValidationError):
            save_sales_draft(self.key, self.payload)
        self.assertEqual(frappe.db.count("Sales Order"), before_orders)
        self.assertEqual(frappe.db.count("Orbit Command"), before_receipts)
        self.payload["delivery_date"] = today()
        result = save_sales_draft(self.key, self.payload)
        self.assertEqual(frappe.get_doc("Sales Order", result["name"]).grand_total, 50)



if __name__ == "__main__":
    frappe.init(site="frontend", sites_path=".")
    frappe.connect()
    try:
        unittest.main(verbosity=2)
    finally:
        frappe.db.rollback()
        frappe.destroy()
