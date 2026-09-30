"""Taxpayer-provided registration facts, never a certification of compliance."""
from datetime import date
import re

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import getdate, nowdate


class OrbitTaxpayerProfile(Document):
    def validate(self):
        if not isinstance(self.company, str) or not self.company.strip():
            frappe.throw(_("A company is required."))
        previous = self.get_doc_before_save()
        if previous and previous.company != self.company:
            frappe.throw(_("A taxpayer profile cannot be moved to another company."))

        for field, pattern, message in (
            ("tin", r"[0-9]{9}", "TIN must contain exactly nine digits without separators."),
            ("branch_code", r"(?:[0-9]{3}|[0-9]{5})", "Branch code must contain three or five digits."),
            ("rdo_code", r"[0-9]{2}[0-9A-Z]", "RDO code must contain two digits followed by a digit or uppercase letter, such as 039 or 17A."),
        ):
            value = self.get(field)
            if value and (not isinstance(value, str) or not re.fullmatch(pattern, value)):
                frappe.throw(_(message))

        if self.fiscal_year_end:
            value = self.fiscal_year_end
            if not isinstance(value, str) or not re.fullmatch(r"[0-9]{2}-[0-9]{2}", value):
                frappe.throw(_("Fiscal year end must be a valid MM-DD date."))
            try:
                date.fromisoformat("2000-" + value)
            except ValueError:
                frappe.throw(_("Fiscal year end must be a valid MM-DD date."))

        if self.vat_status not in ("Unconfirmed", "VAT", "Non-VAT"):
            frappe.throw(_("Choose Unconfirmed, VAT, or Non-VAT for VAT status."))

        if self.accountant_review_date:
            value = self.accountant_review_date
            if isinstance(value, date):
                value = value.isoformat()
            if not isinstance(value, str) or not re.fullmatch(r"[0-9]{4}-[0-9]{2}-[0-9]{2}", value):
                frappe.throw(_("Accountant review date must be a valid YYYY-MM-DD date."))
            try:
                reviewed = date.fromisoformat(value)
            except ValueError:
                frappe.throw(_("Accountant review date must be a valid YYYY-MM-DD date."))
            if reviewed > getdate(nowdate()):
                frappe.throw(_("Accountant review date cannot be in the future."))
            if not isinstance(self.accountant_name, str) or not self.accountant_name.strip():
                frappe.throw(_("Record the accountant's name with the review date."))
