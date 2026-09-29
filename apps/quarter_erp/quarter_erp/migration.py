"""Read-only migration preparation. No endpoint in this module imports records."""
import frappe
from datetime import datetime, timezone
from frappe.sessions import get_csrf_token

from quarter_erp.api import require_user
from quarter_erp.migration_core import (
    MAX_BYTES, MAX_ROWS, SCHEMAS, MigrationError, add_issue, profile_csv,
    schema_for, update_counts, validate_csv,
)


def is_manager():
    return frappe.session.user == "Administrator" or "System Manager" in frappe.get_roles()


def permitted_kind(kind):
    doctype = SCHEMAS[kind]["doctype"]
    return all(frappe.has_permission(doctype, ptype=action) for action in ("read", "create", "import"))


def authorize(company=None, kind=None):
    require_user()
    if not is_manager():
        frappe.throw("A system manager must prepare migration data.", frappe.PermissionError)
    if kind is not None:
        if not isinstance(company, str) or not company.strip() or len(company) > 140:
            frappe.throw("Choose a single company by its exact name.")
        try:
            schema_for(kind)
        except MigrationError as error:
            frappe.throw(str(error))
        if not permitted_kind(kind):
            frappe.throw("You need read, create and import access for this record type.", frappe.PermissionError)
    if company is not None and not frappe.get_list("Company", filters={"name":company}, pluck="name", limit=1):
        frappe.throw("You do not have access to this company.", frappe.PermissionError)


@frappe.whitelist(methods=["GET"])
def options():
    authorize()
    return {"kinds": {kind:schema for kind,schema in SCHEMAS.items() if permitted_kind(kind)},
            "companies": frappe.get_list("Company", fields=["name"], order_by="name", limit_page_length=0),
            "max_bytes": MAX_BYTES, "max_rows":MAX_ROWS, "csrf_token":get_csrf_token()}


@frappe.whitelist(methods=["POST"])
def profile(company, kind, content):
    authorize(company, kind)
    try:
        return profile_csv(content, kind)
    except MigrationError as error:
        frappe.throw(str(error))


def visible_values(doctype, fieldname, values):
    """Exact bounded, permission-filtered queries; do not disclose hidden matches."""
    if not frappe.has_permission(doctype, "read"):
        return set()
    values = sorted({v for v in values if v})
    found = set()
    for start in range(0, len(values), 200):
        records = frappe.get_list(doctype, filters={fieldname:["in",values[start:start+200]]},
                                  fields=[fieldname], distinct=True, limit_page_length=0)
        found.update(str(row[fieldname]).casefold() for row in records)
    return found


@frappe.whitelist(methods=["POST"])
def preview(company, kind, content, mapping):
    authorize(company, kind)
    try:
        if isinstance(mapping, str):
            mapping = frappe.parse_json(mapping)
        result = validate_csv(content, kind, mapping)
    except (MigrationError, ValueError, TypeError) as error:
        # Surface known validation messages, never the CSV itself.
        frappe.throw(str(error) if isinstance(error, MigrationError) else "The mapping could not be read.")
    schema = SCHEMAS[kind]
    for spec in schema["fields"]:
        if not spec.get("reference"):
            continue
        key = spec["key"]
        found = visible_values(spec["reference"], "name", [row["values"][key] for row in result["rows"]])
        for row in result["rows"]:
            if row["values"][key] and row["values"][key].casefold() not in found:
                add_issue(result, row["row"], key, "reference_unavailable", "This reference is unavailable or not permitted. Check its exact name and your access.")
    identity = schema["identity"]
    found = visible_values(schema["doctype"], identity, [row["values"][identity] for row in result["rows"]])
    for row in result["rows"]:
        if row["values"][identity].casefold() in found:
            add_issue(result, row["row"], identity, "existing_target", "A visible record already uses this value. Review whether it should be linked or updated.")
    update_counts(result)
    result["sample"] = result.pop("rows")[:10]
    result.pop("_invalid")
    result["company"] = company
    result["preview_only"] = True
    result["checked_at"] = datetime.now(timezone.utc).isoformat()
    result["limitations"] = [
        "Preview only: no records were imported or saved. Native import validation is still required.",
        "Customers, suppliers and items are shared masters in this ERP site. Company is the migration context.",
        "Existing-record checks include only records you may read; hidden collisions may be detected during import.",
        "Unmapped columns are excluded from this preview. Resolve them before planning the import.",
    ]
    return result
