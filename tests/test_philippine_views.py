"""Native preference defaults stay scoped to the operator and preserve history."""
import json
import unittest

import frappe
from frappe.model.utils.user_settings import get, save


class PhilippineViews(unittest.TestCase):
    company = "Orbit Philippines Demo"
    actor = "ph-view-operator@example.invalid"
    other = "ph-view-other@example.invalid"
    doctypes = ("Sales Invoice", "Purchase Invoice", "Sales Order", "Purchase Order",
        "Delivery Note", "Purchase Receipt", "Payment Entry", "Journal Entry", "Stock Entry")

    def setUp(self):
        frappe.set_user("Administrator")
        frappe.db.savepoint("ph_view_test")
        for email in (self.actor, self.other):
            frappe.get_doc({"doctype": "User", "email": email, "first_name": "View Test",
                "send_welcome_email": 0, "user_type": "System User",
                "roles": [{"role": "System Manager"}]}).insert()
        frappe.set_user(self.actor)

    def tearDown(self):
        frappe.set_user("Administrator")
        frappe.db.rollback(save_point="ph_view_test")
        for email in (self.actor, self.other):
            for doctype in self.doctypes:
                frappe.cache.hdel("_user_settings", f"{doctype}::{email}")
            frappe.clear_cache(user=email)

    def test_lists_change_only_operator_company_filter_and_persist(self):
        from quarter_erp.philippines_views import set_current_user_defaults
        old = {"List": {"filters": [["Sales Invoice", "status", "=", "Paid"],
            ["Sales Invoice", "company", "=", "Orbit Demo Company"]],
            "sort_by": "posting_date", "sort_order": "asc"}, "last_view": "Report"}
        save("Sales Invoice", json.dumps(old))
        frappe.set_user(self.other)
        save("Sales Invoice", json.dumps(old))
        frappe.set_user(self.actor)
        set_current_user_defaults(self.company)
        result = json.loads(get("Sales Invoice"))
        self.assertEqual(result["List"]["filters"], [["Sales Invoice", "status", "=", "Paid"],
            ["Sales Invoice", "company", "=", self.company]])
        self.assertEqual(result["List"]["sort_by"], "posting_date")
        self.assertEqual(result["List"]["sort_order"], "asc")
        self.assertEqual(result["last_view"], "Report")
        persisted = frappe.db.sql("SELECT data FROM `__UserSettings` WHERE user=%s AND doctype=%s",
            (self.actor, "Sales Invoice"))[0][0]
        self.assertEqual(json.loads(persisted), result)
        for doctype in self.doctypes:
            self.assertIn([doctype, "company", "=", self.company], json.loads(get(doctype))["List"]["filters"])
        frappe.set_user(self.other)
        self.assertEqual(json.loads(get("Sales Invoice")), old)
        self.assertFalse(frappe.db.sql("SELECT data FROM `__UserSettings` WHERE user=%s", (self.other,)))

    def test_only_legacy_company_in_operator_standard_charts_changes(self):
        from quarter_erp.philippines_views import set_current_user_defaults
        original = {"Sales Order Trends": {"filters": {"company": "Orbit Demo Company", "period": "Monthly"}, "height": 99},
            "Top Customers": {"filters": {"company": "Explicit other company", "period": "Yearly"}},
            "Unrelated custom chart": {"filters": {"company": "Orbit Demo Company"}}}
        frappe.set_user("Administrator")
        for email in (self.actor, self.other):
            frappe.get_doc({"doctype": "Dashboard Settings", "user": email,
                "chart_config": json.dumps(original)}).insert(set_name=email)
        frappe.set_user(self.actor)
        set_current_user_defaults(self.company)
        result = json.loads(frappe.db.get_value("Dashboard Settings", self.actor, "chart_config"))
        self.assertEqual(result["Sales Order Trends"]["filters"], {"company": self.company, "period": "Monthly"})
        self.assertEqual(result["Sales Order Trends"]["height"], 99)
        self.assertEqual(result["Top Customers"], original["Top Customers"])
        self.assertEqual(result["Unrelated custom chart"], original["Unrelated custom chart"])
        self.assertEqual(json.loads(frappe.db.get_value("Dashboard Settings", self.other, "chart_config")), original)
        set_current_user_defaults(self.company)
        self.assertEqual(json.loads(frappe.db.get_value("Dashboard Settings", self.actor, "chart_config")), result)

    def test_guest_cannot_change_preferences(self):
        from quarter_erp.philippines_views import set_current_user_defaults
        frappe.set_user("Guest")
        with self.assertRaises(frappe.PermissionError):
            set_current_user_defaults(self.company)


if __name__ == "__main__":
    frappe.init(site="frontend", sites_path=".")
    frappe.connect()
    try:
        unittest.main(verbosity=2)
    finally:
        frappe.db.rollback()
        frappe.destroy()
