"""Install a dedicated accounting reader without activating any user accounts."""
import frappe
from frappe.permissions import setup_custom_perms

REVIEWER_ROLE = "Orbit BIR Reviewer"
ACCOUNTING_DOCTYPES = (
    "Company", "Account", "GL Entry", "Fiscal Year", "Finance Book",
    "Sales Invoice", "Purchase Invoice", "Payment Entry", "Journal Entry",
)
REVIEW_REPORTS = ("General Ledger", "Trial Balance", "Balance Sheet", "Profit and Loss Statement")
READ_RIGHTS = {"read", "select", "report", "export", "print"}
PERMISSION_RIGHTS = (
    "read", "select", "report", "export", "print", "write", "create", "delete",
    "submit", "cancel", "amend", "share", "email", "import",
)


def ensure_bir_role():
    """Idempotent migration hook; changes only this app's explicit role grants.

    Frappe roles are additive: assign this role to a clean, company-scoped user.
    Existing users and other roles are never edited. File access is delegated to
    native attachment authorization; this role receives no blanket File grant.
    Native reports are intentionally unavailable to this role: their optional
    client-provided company filters are insufficient as an authorization boundary.
    The company-authorized review endpoint supplies the four accounting reports.
    """
    if frappe.db.exists("Role", REVIEWER_ROLE):
        role = frappe.get_doc("Role", REVIEWER_ROLE)
    else:
        role = frappe.get_doc({"doctype": "Role", "role_name": REVIEWER_ROLE})
    settings = {"desk_access": 1, "is_custom": 1, "home_page": "/orbit?view=bir"}
    if role.is_new() or any(role.get(key) != value for key, value in settings.items()):
        role.update(settings)
        role.save(ignore_permissions=True)

    for doctype in ACCOUNTING_DOCTYPES:
        setup_custom_perms(doctype)
        names = frappe.get_all("Custom DocPerm", filters={"parent": doctype,
                               "role": REVIEWER_ROLE}, pluck="name")
        if names:
            permissions = [frappe.get_doc("Custom DocPerm", name) for name in names]
        else:
            permissions = [frappe.get_doc({"doctype": "Custom DocPerm", "parent": doctype,
                                          "parenttype": "DocType", "parentfield": "permissions",
                                          "role": REVIEWER_ROLE, "permlevel": 0, "if_owner": 0})]
        for permission in permissions:
            # Only a level-zero, unrestricted read row can enable this workspace.
            values = {right: int(right in READ_RIGHTS and not permission.permlevel)
                      for right in PERMISSION_RIGHTS}
            values["if_owner"] = 0
            if permission.is_new() or any(permission.get(key) != value for key, value in values.items()):
                permission.update(values)
                permission.save(ignore_permissions=True)
        frappe.clear_cache(doctype=doctype)

    for report_name in REVIEW_REPORTS:
        native_roles = {row.role for row in frappe.get_doc("Report", report_name).roles}
        if REVIEWER_ROLE in native_roles:
            if not native_roles - {REVIEWER_ROLE}:
                frappe.throw("Restore an accountant role on " + report_name
                             + " before removing its last allowed role.")
            # Standard reports cannot be saved outside developer mode. Remove only
            # this app's stale role child; keep the native definition and other roles.
            frappe.db.delete("Has Role", {"parenttype": "Report", "parent": report_name,
                                          "parentfield": "roles", "role": REVIEWER_ROLE})
            frappe.clear_document_cache("Report", report_name)
        for custom_name in frappe.get_all("Custom Role", filters={"report": report_name}, pluck="name"):
            custom = frappe.get_doc("Custom Role", custom_name)
            if any(row.role == REVIEWER_ROLE for row in custom.roles):
                # Empty Custom Role lists fall back to the native report roles.
                custom.set("roles", [row for row in custom.roles if row.role != REVIEWER_ROLE])
                custom.save(ignore_permissions=True)
