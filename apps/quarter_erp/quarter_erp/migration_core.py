"""Bounded, non-persisting CSV inspection. No Frappe or database dependency."""
import csv
import hashlib
import io
import json
from collections import defaultdict

MAX_BYTES = 2 * 1024 * 1024
MAX_ROWS = 5000
MAX_COLUMNS = 64
MAX_CELL = 4096
MAX_ISSUES = 200


class MigrationError(ValueError):
    pass


def field(key, label, required=False, **extra):
    return {"key": key, "label": label, "required": required, "max_length": 140, **extra}


SCHEMAS = {
    "customers": {"label": "Customers", "doctype": "Customer", "identity": "customer_name", "fields": [
        field("source_id", "Source ID", True), field("customer_name", "Customer name", True),
        field("customer_type", "Customer type", default="Company", choices=["Company", "Individual", "Partnership"]),
        field("customer_group", "Customer group", True, reference="Customer Group"),
        field("territory", "Territory", True, reference="Territory"), field("tax_id", "Tax ID"),
    ]},
    "suppliers": {"label": "Suppliers", "doctype": "Supplier", "identity": "supplier_name", "fields": [
        field("source_id", "Source ID", True), field("supplier_name", "Supplier name", True),
        field("supplier_type", "Supplier type", default="Company", choices=["Company", "Individual", "Partnership"]),
        field("supplier_group", "Supplier group", True, reference="Supplier Group"), field("tax_id", "Tax ID"),
    ]},
    "items": {"label": "Items", "doctype": "Item", "identity": "item_code", "fields": [
        field("source_id", "Source ID", True), field("item_code", "Item code", True),
        field("item_name", "Item name", True), field("item_group", "Item group", True, reference="Item Group"),
        field("stock_uom", "Stock unit", True, reference="UOM"),
        field("is_stock_item", "Track inventory", default="1", boolean=True),
    ]},
}


def schema_for(kind):
    if not isinstance(kind, str) or kind not in SCHEMAS:
        raise MigrationError("Choose customers, suppliers or items.")
    return SCHEMAS[kind]


def parse_csv(content):
    if not isinstance(content, str) or not content or len(content) > MAX_BYTES:
        raise MigrationError("Choose a non-empty UTF-8 CSV file up to 2 MiB.")
    try:
        if len(content.encode("utf-8")) > MAX_BYTES or "\x00" in content:
            raise MigrationError("Choose a UTF-8 CSV file up to 2 MiB without binary content.")
        reader = csv.reader(io.StringIO(content.lstrip("\ufeff"), newline=""), strict=True)
        headers = next(reader)
        headers = [value.strip() for value in headers]
        if not 1 <= len(headers) <= MAX_COLUMNS or any(not h or len(h) > MAX_CELL for h in headers):
            raise MigrationError("Use 1–64 named columns. Every column needs a header.")
        if len({h.casefold() for h in headers}) != len(headers):
            raise MigrationError("Column headers must be unique, including capitalization differences.")
        rows = []
        for record_number, row in enumerate(reader, 2):
            if not row:
                continue
            if len(row) != len(headers):
                raise MigrationError(f"CSV record {record_number} has {len(row)} columns; expected {len(headers)}.")
            if any(len(value) > MAX_CELL for value in row):
                raise MigrationError(f"CSV record {record_number} has a cell longer than 4,096 characters.")
            rows.append((record_number, row))
            if len(rows) > MAX_ROWS:
                raise MigrationError("Split this file into batches of up to 5,000 records.")
        if not rows:
            raise MigrationError("The CSV needs at least one data record below the header.")
        return headers, rows
    except (csv.Error, StopIteration, UnicodeError) as error:
        raise MigrationError("The CSV could not be read. Use UTF-8, comma-separated columns and balanced quotes.") from error


def fingerprint(content, kind, mapping):
    return hashlib.sha256(json.dumps([kind, content, mapping], sort_keys=True, ensure_ascii=True).encode()).hexdigest()


def profile_csv(content, kind):
    schema = schema_for(kind)
    headers, rows = parse_csv(content)
    normalized = defaultdict(list)
    for header in headers:
        normalized[header.casefold().replace(" ", "_")].append(header)
    mapping = {}
    for spec in schema["fields"]:
        # Exact target field names only. Ambiguous generic headings stay unassigned.
        if len(normalized[spec["key"]]) == 1:
            mapping[spec["key"]] = normalized[spec["key"]][0]
    return {"headers": headers, "row_count": len(rows), "sample": [r[1] for r in rows[:5]],
            "mapping": mapping, "fingerprint": fingerprint(content, kind, mapping)}


def add_issue(result, row, field_key, code, message):
    result["issue_count"] += 1
    result["_invalid"].add(row)
    if len(result["issues"]) < MAX_ISSUES:
        result["issues"].append({"row": row, "field": field_key, "code": code, "message": message})


def update_counts(result):
    result["invalid_count"] = len(result["_invalid"])
    result["valid_count"] = result["row_count"] - result["invalid_count"]
    result["issues_truncated"] = result["issue_count"] > len(result["issues"])
    return result


def validate_csv(content, kind, mapping):
    schema = schema_for(kind)
    headers, source_rows = parse_csv(content)
    keys = {f["key"] for f in schema["fields"]}
    if not isinstance(mapping, dict) or any(key not in keys for key in mapping):
        raise MigrationError("The mapping contains an unsupported target field.")
    if any(not isinstance(value, str) or value not in headers for value in mapping.values()):
        raise MigrationError("Each mapped field must refer to a column in this CSV.")
    if len(set(mapping.values())) != len(mapping):
        raise MigrationError("Map each source column once. Do not reuse an ID as another field.")
    missing = [f["label"] for f in schema["fields"] if f["required"] and f["key"] not in mapping]
    if missing:
        raise MigrationError("Map the required fields: " + ", ".join(missing) + ".")
    indexes = {key: headers.index(value) for key, value in mapping.items()}
    result = {"kind": kind, "row_count": len(source_rows), "rows": [], "issues": [], "issue_count": 0,
              "_invalid": set(), "unmapped_columns": [h for h in headers if h not in mapping.values()],
              "fingerprint": fingerprint(content, kind, mapping), "mapping": mapping}
    groups = {key: defaultdict(list) for key in ("source_id", schema["identity"])}
    for row_number, values in source_rows:
        mapped = {}
        for spec in schema["fields"]:
            key = spec["key"]
            value = values[indexes[key]].strip() if key in indexes else spec.get("default", "")
            mapped[key] = value
            if not value and spec["required"]:
                add_issue(result, row_number, key, "required", f"{spec['label']} is required.")
            if len(value) > spec["max_length"]:
                add_issue(result, row_number, key, "too_long", f"{spec['label']} exceeds {spec['max_length']} characters.")
            if value and "choices" in spec and value not in spec["choices"]:
                add_issue(result, row_number, key, "invalid_choice", "Choose " + ", ".join(spec["choices"]) + ".")
            if spec.get("boolean"):
                boolean = {"1":"1", "yes":"1", "true":"1", "0":"0", "no":"0", "false":"0"}.get(value.casefold())
                if boolean is None:
                    add_issue(result, row_number, key, "invalid_boolean", "Use 1/0, yes/no or true/false.")
                else:
                    mapped[key] = boolean
        result["rows"].append({"row": row_number, "values": mapped})
        for key, group in groups.items():
            if mapped[key]:
                group[mapped[key].casefold()].append(row_number)
    for key, group in groups.items():
        for duplicate_rows in group.values():
            if len(duplicate_rows) > 1:
                for row in duplicate_rows:
                    code = "duplicate_source_id" if key == "source_id" else "duplicate_target"
                    add_issue(result, row, key, code, "This value repeats within the file. Resolve it before import.")
    return update_counts(result)
