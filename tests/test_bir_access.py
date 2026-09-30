"""Native reviewer and taxpayer-profile boundaries; fixtures are rolled back."""
import unittest

import frappe
from frappe.utils import add_days, nowdate


class BIRAccess(unittest.TestCase):
    company = "Orbit Demo Company"
    role = "Orbit BIR Reviewer"

    def setUp(self):
        frappe.set_user("Administrator")
        frappe.db.savepoint("bir_access")
        from quarter_erp.bir_setup import ensure_bir_role

        ensure_bir_role()

    def tearDown(self):
        frappe.set_user("Administrator")
        frappe.db.rollback(save_point="bir_access")
        frappe.clear_cache()

    def reviewer(self):
        user = frappe.get_doc({
            "doctype": "User", "email": "bir-reviewer-test@example.invalid",
            "first_name": "Synthetic reviewer", "send_welcome_email": 0,
            "user_type": "System User", "roles": [{"role": self.role}],
        }).insert()
        frappe.get_doc({
            "doctype": "User Permission", "user": user.name, "allow": "Company",
            "for_value": self.company, "apply_to_all_doctypes": 1,
        }).insert()
        return user.name

    def profile(self, **values):
        doc = frappe.get_doc({"doctype": "Orbit Taxpayer Profile", "company": self.company})
        doc.update(values)
        return doc

    def test_setup_is_idempotent_and_preserves_existing_report_roles(self):
        from quarter_erp.bir_setup import ensure_bir_role
        from frappe.core.doctype.custom_role.custom_role import get_custom_allowed_roles

        before = frappe.db.count("Custom DocPerm", {"role": self.role})
        report = frappe.get_doc("Report", "General Ledger")
        # Model a stale app grant without editing the standard report definition.
        report.append("roles", {"role": self.role}).db_insert()
        existing_native = {row.role for row in report.roles} - {self.role}
        existing = set(get_custom_allowed_roles("report", "General Ledger")) - {self.role}
        ensure_bir_role()
        self.assertEqual(frappe.db.count("Custom DocPerm", {"role": self.role}), before)
        self.assertEqual(set(get_custom_allowed_roles("report", "General Ledger")), existing)
        self.assertEqual({row.role for row in frappe.get_doc("Report", "General Ledger").roles}, existing_native)
        self.assertIn("Accounts Manager", existing_native)
        for name in ("General Ledger", "Trial Balance", "Balance Sheet", "Profit and Loss Statement"):
            self.assertNotIn(self.role, get_custom_allowed_roles("report", name))
            self.assertNotIn(self.role, {row.role for row in frappe.get_doc("Report", name).roles})
        ensure_bir_role()
        self.assertEqual(frappe.db.count("Custom DocPerm", {"role": self.role}), before)
        self.assertTrue(frappe.has_permission("Sales Invoice", "write"))

    def test_clean_reviewer_reads_native_records_but_cannot_mutate_them(self):
        user = self.reviewer()
        frappe.set_user(user)
        invoice = frappe.get_doc("Sales Invoice", "ACC-SINV-2026-00001")
        invoice.check_permission("read")
        self.assertEqual(frappe.get_list("Company", pluck="name"), [self.company])
        for doctype in ("Company", "Account", "GL Entry", "Fiscal Year", "Finance Book",
                        "Sales Invoice", "Purchase Invoice", "Payment Entry", "Journal Entry",
                        "Orbit Taxpayer Profile"):
            self.assertTrue(frappe.has_permission(doctype, "read"), doctype)
            for action in ("create", "write", "submit", "cancel", "delete", "share", "email", "import"):
                self.assertFalse(frappe.has_permission(doctype, action), (doctype, action))
        with self.assertRaises(frappe.PermissionError):
            frappe.copy_doc(invoice).insert()
        with self.assertRaises(frappe.PermissionError):
            invoice.save()
        with self.assertRaises(frappe.PermissionError):
            invoice.cancel()

    def test_reviewer_must_use_company_authorized_wrapper_for_native_reports(self):
        from frappe.desk.query_report import get_report_doc, run

        other = frappe.get_doc({"doctype": "Company", "company_name": "BIR Report Other",
                               "abbr": "BRO", "default_currency": "PHP", "country": "Philippines"}).insert()
        frappe.set_user(self.reviewer())
        self.assertEqual(frappe.get_list("Company", pluck="name"), [self.company])
        filters = {
            "General Ledger": {"from_date": "2026-01-01", "to_date": "2026-09-30"},
            "Trial Balance": {"fiscal_year": "2026", "from_date": "2026-01-01", "to_date": "2026-09-30"},
            "Balance Sheet": {"filter_based_on": "Date Range", "period_start_date": "2026-01-01",
                              "period_end_date": "2026-09-30", "periodicity": "Yearly", "accumulated_values": 1},
            "Profit and Loss Statement": {"filter_based_on": "Date Range", "period_start_date": "2026-01-01",
                                         "period_end_date": "2026-09-30", "periodicity": "Yearly", "accumulated_values": 0},
        }
        for report, report_filters in filters.items():
            with self.subTest(report=report, boundary="get_report_doc"), self.assertRaises(frappe.PermissionError):
                get_report_doc(report)
            for company in (self.company, other.name):
                with self.subTest(report=report, company=company), self.assertRaises(frappe.PermissionError):
                    run(report, filters={"company": company, "include_default_book_entries": 1,
                                         **report_filters}, ignore_prepared_report=True,
                        are_default_filters=False)

    def test_company_scope_applies_to_native_profile_list_and_document(self):
        other = frappe.get_doc({"doctype": "Company", "company_name": "BIR Scope Other",
                               "abbr": "BSO", "default_currency": "PHP", "country": "Philippines"}).insert()
        self.profile().insert()
        other_profile = self.profile(company=other.name).insert()
        frappe.set_user(self.reviewer())
        self.assertEqual(frappe.get_list("Orbit Taxpayer Profile", pluck="name"), [self.company])
        with self.assertRaises(frappe.PermissionError):
            frappe.get_doc("Orbit Taxpayer Profile", other_profile.name).check_permission("read")

    def test_profile_is_unknown_by_default_and_reviewer_cannot_save(self):
        profile = self.profile().insert()
        self.assertEqual(profile.name, self.company)
        self.assertEqual(profile.vat_status, "Unconfirmed")
        self.assertFalse(profile.tin)
        self.assertFalse(profile.cas_reference)
        frappe.set_user(self.reviewer())
        profile.check_permission("read")
        profile.legal_name = "Unauthorized change"
        with self.assertRaises(frappe.PermissionError):
            profile.save()

    def test_profile_tracks_changes_and_accepts_valid_registration_formats(self):
        profile = self.profile(tin="123456789", branch_code="00000", rdo_code="039",
                               fiscal_year_end="12-31", accountant_name="Test accountant",
                               accountant_review_date=nowdate()).insert()
        profile.registration_notes = "Synthetic review note"
        profile.save()
        versions = frappe.get_all("Version", filters={"ref_doctype": profile.doctype,
                                  "docname": profile.name}, fields=["data"])
        self.assertTrue(any("Synthetic review note" in row.data for row in versions))

    def test_profile_accepts_alphanumeric_rdo_codes(self):
        profile = self.profile(rdo_code="17A").insert()
        self.assertEqual(profile.rdo_code, "17A")
        profile.rdo_code = "25B"
        profile.save()
        self.assertEqual(frappe.get_doc(profile.doctype, profile.name).rdo_code, "25B")

    def test_invalid_profile_formats_are_rejected_by_native_document_validation(self):
        for fields in ({"tin": "123"}, {"tin": "123-456-789"}, {"branch_code": "12"},
                       {"rdo_code": "AB1"}, {"rdo_code": "12"}, {"fiscal_year_end": "2026-12-31"},
                       {"fiscal_year_end": "02-30"}, {"vat_status": "Tax exempt"},
                       {"accountant_review_date": nowdate()},
                       {"accountant_name": "Test", "accountant_review_date": add_days(nowdate(), 1)}):
            with self.subTest(fields=fields), self.assertRaises(frappe.ValidationError):
                self.profile(**fields).insert()


if __name__ == "__main__":
    frappe.init(site="frontend")
    frappe.connect()
    try:
        unittest.main(verbosity=2)
    finally:
        frappe.db.rollback()
        frappe.destroy()
