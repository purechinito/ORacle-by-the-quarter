"""Validated draft commands with a transaction-local, user-scoped retry receipt.

Business documents always pass normal permissions and ERPNext controllers.
Only the internal receipt is inserted directly; its primary-key lock serializes
identical retries in the same MariaDB transaction as the business write.
"""
import hashlib
import json
import re
import uuid
from decimal import Decimal, InvalidOperation

import frappe
from frappe.utils import get_datetime, getdate, now_datetime, today
from quarter_erp.api import require_user


def number(value, positive=False):
    try:
        if isinstance(value, bool):
            raise ValueError()
        raw = str(value)
        if len(raw) > 64:
            raise ValueError()
        parsed = Decimal(raw)
        if not parsed.is_finite() or parsed < 0 or (positive and parsed == 0) or parsed > Decimal("1e12"):
            raise ValueError()
        if parsed and parsed.adjusted() < -12:
            raise ValueError()
        return format(parsed.normalize(), "f")
    except (InvalidOperation, ValueError):
        frappe.throw("Enter a finite positive quantity and a non-negative rate within the supported range.")


def visible_link(doctype, name, extra=None):
    if not isinstance(name, str) or not frappe.get_list(doctype, filters={"name":name, **(extra or {})}, pluck="name", limit=1):
        frappe.throw("A selected record is not available with your current permissions.", frappe.PermissionError)


def normalize(payload):
    payload = frappe.parse_json(payload) if isinstance(payload, str) else payload
    if not isinstance(payload, dict) or set(payload) - {"company", "customer", "delivery_date", "items"}:
        frappe.throw("Unsupported draft fields.")
    if not isinstance(payload.get("items"), list) or not 1 <= len(payload["items"]) <= 200:
        frappe.throw("A workspace draft must contain between 1 and 200 lines. Larger documents can use the full ERP.")
    try:
        if not payload.get("delivery_date"):
            raise ValueError()
        delivery_date = str(getdate(payload["delivery_date"]))
    except Exception:
        frappe.throw("Enter a valid delivery date.")
    items = []
    for row in payload["items"]:
        if not isinstance(row, dict) or set(row) - {"name", "item_code", "qty", "rate", "warehouse"}:
            frappe.throw("Unsupported item fields.")
        if row.get("name") is not None and not isinstance(row["name"], str):
            frappe.throw("Invalid item line identifier.")
        items.append({"name":row.get("name"), "item_code":row.get("item_code"),
                      "qty":number(row.get("qty"), positive=True), "rate":number(row.get("rate")),
                      "warehouse":row.get("warehouse")})
    return {"company":payload.get("company"), "customer":payload.get("customer"),
            "delivery_date":delivery_date, "items":items}


@frappe.whitelist(methods=["GET"])
def session_context():
    require_user()
    from frappe.sessions import get_csrf_token
    return {"csrf_token":get_csrf_token()}


@frappe.whitelist(methods=["GET"])
def sales_draft_links(company, kind, search=""):
    require_user()
    visible_link("Company", company)
    if not frappe.has_permission("Sales Order", "create"):
        frappe.throw("You cannot create sales orders.", frappe.PermissionError)
    choices = {
        "customer": ("Customer", {"disabled":0}),
        "item": ("Item", {"disabled":0, "is_sales_item":1}),
        "warehouse": ("Warehouse", {"company":company, "disabled":0, "is_group":0}),
    }
    if kind not in choices:
        frappe.throw("Unknown sales draft field.")
    doctype, filters = choices[kind]
    query = str(search or "").strip()[:120]
    if query:
        filters["name"] = ["like", "%" + query.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"]
    names = frappe.get_list(doctype, filters=filters, pluck="name", order_by="name", limit=21)
    return {"names":names[:20], "has_more":len(names)>20, "today":today(),
            "currency":frappe.get_cached_value("Company", company, "default_currency")}


@frappe.whitelist(methods=["POST"])
def save_sales_draft(command_key, payload, name=None, expected_modified=None):
    # MariaDB snapshot conflicts can invalidate the complete transaction. Only
    # the HTTP command boundary owns that transaction and may replay it.
    for attempt in range(3):
        try:
            return _save_sales_draft(command_key, payload, name, expected_modified)
        except frappe.QueryDeadlockError:
            if not getattr(frappe.local, "request", None):
                raise
            frappe.db.rollback()
            if attempt == 2:
                raise RetryCommandError("The record is busy. Retry this same command without changing its key.")


class RetryCommandError(frappe.ValidationError):
    http_status_code = 409


def _save_sales_draft(command_key, payload, name=None, expected_modified=None):
    actor = require_user()
    if not isinstance(command_key, str) or not re.fullmatch(r"[A-Za-z0-9_-]{20,128}", command_key):
        frappe.throw("A valid command key is required.")
    payload = normalize(payload)
    company = payload["company"]
    visible_link("Company", company)
    if not frappe.has_permission("Sales Order", "write" if name else "create"):
        frappe.throw("You cannot save sales orders.", frappe.PermissionError)
    visible_link("Customer", payload["customer"])
    for row in payload["items"]:
        visible_link("Item", row["item_code"], {"disabled":0, "is_sales_item":1})
        visible_link("Warehouse", row["warehouse"], {"company":company, "is_group":0, "disabled":0})
    if name:
        visible_link("Sales Order", name, {"company":company})
        frappe.get_doc("Sales Order", name).check_permission("write")
        if not expected_modified:
            frappe.throw("The saved document version is required.")
        try:
            expected_modified = str(get_datetime(expected_modified))
        except Exception:
            frappe.throw("The saved document version is invalid.")
    command_name = hashlib.sha256(json.dumps([actor, company, command_key]).encode()).hexdigest()
    request_hash = hashlib.sha256(json.dumps(["save_sales_draft", payload, name, expected_modified], sort_keys=True).encode()).hexdigest()
    savepoint = "orbit_" + uuid.uuid4().hex
    frappe.db.savepoint(savepoint)
    try:
        now = now_datetime()
        frappe.db.sql("""INSERT INTO `tabOrbit Command`
            (name, owner, creation, modified, modified_by, docstatus, idx, actor, company, request_hash)
            VALUES (%s,%s,%s,%s,%s,0,0,%s,%s,%s)
            ON DUPLICATE KEY UPDATE name=name""", (command_name, actor, now, now, actor, actor, company, request_hash))
        receipt = frappe.db.sql("SELECT request_hash, result_json FROM `tabOrbit Command` WHERE name=%s FOR UPDATE", command_name, as_dict=True)[0]
        if receipt.request_hash != request_hash:
            frappe.throw("This command key was already used for different changes. Reload before trying again.")
        if receipt.result_json:
            result = json.loads(receipt.result_json)
            replayed = frappe.get_doc("Sales Order", result["name"])
            replayed.check_permission("read")
            if replayed.company != company:
                frappe.throw("The saved order no longer belongs to this company.", frappe.PermissionError)
            return result
        if name:
            doc = frappe.get_doc("Sales Order", name, for_update=True)
            doc.check_permission("write")
            if doc.company != company:
                frappe.throw("The order belongs to another company.", frappe.PermissionError)
            if doc.docstatus != 0:
                frappe.throw("Only draft orders can be edited here.")
            if get_datetime(doc.modified) != get_datetime(expected_modified):
                frappe.throw("This order changed after you opened it. Reload before saving.", frappe.TimestampMismatchError)
            if doc.customer != payload["customer"]:
                frappe.throw("Change the customer in the full ERP so its terms and addresses are recalculated.")
            if getdate(doc.delivery_date) != getdate(payload["delivery_date"]):
                frappe.throw("Change existing delivery schedules in the full ERP.")
        else:
            doc = frappe.get_doc({"doctype":"Sales Order", "company":company, "order_type":"Sales",
                                  "currency":frappe.get_cached_value("Company", company, "default_currency")})
        doc.customer = payload["customer"]
        doc.delivery_date = getdate(payload["delivery_date"])
        existing = {row.name:row for row in doc.get("items") or []}
        seen = set()
        rows = []
        for values in payload["items"]:
            row_id = values["name"]
            if row_id and (row_id not in existing or row_id in seen):
                frappe.throw("An item line does not belong to this order or is repeated.")
            if row_id and existing[row_id].item_code != values["item_code"]:
                frappe.throw("Remove the old line and add a new line when changing its item.")
            row = existing[row_id].as_dict() if row_id else {}
            if row_id:
                seen.add(row_id)
            row.update({"item_code":values["item_code"], "qty":float(values["qty"]), "rate":float(values["rate"]),
                        "warehouse":values["warehouse"]})
            row["delivery_date"] = getdate(row.get("delivery_date") or payload["delivery_date"])
            rows.append(row)
        doc.set("items", rows)
        if name:
            doc.save()
        else:
            doc.insert()
        result = {"doctype":"Sales Order", "name":doc.name, "modified":str(doc.modified)}
        frappe.db.sql("UPDATE `tabOrbit Command` SET result_json=%s WHERE name=%s", (json.dumps(result), command_name))
        return result
    except frappe.QueryDeadlockError:
        # InnoDB may have already rolled back and removed the savepoint.
        raise
    except Exception:
        frappe.db.rollback(save_point=savepoint)
        raise
