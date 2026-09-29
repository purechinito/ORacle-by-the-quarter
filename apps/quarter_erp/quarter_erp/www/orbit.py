import frappe

no_cache = 1


def get_context(context):
    context.no_cache = 1
    # Login remains the engine's authenticated session and CSRF implementation.
    if frappe.session.user == "Guest":
        frappe.local.flags.redirect_location = "/login?redirect-to=%2Forbit"
        raise frappe.Redirect
