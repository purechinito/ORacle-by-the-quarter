import frappe
from urllib.parse import urlencode

no_cache = 1


def get_context(context):
    context.no_cache = 1
    # Login remains the engine's authenticated session and CSRF implementation.
    if frappe.session.user == "Guest":
        query = urlencode({key: frappe.form_dict[key] for key in ("section", "company", "record", "view") if frappe.form_dict.get(key)})
        destination = "/orbit" + ("?" + query if query else "")
        frappe.local.flags.redirect_location = "/login?" + urlencode({"redirect-to": destination})
        raise frappe.Redirect
