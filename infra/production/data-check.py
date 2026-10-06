"""Read-only migration fingerprints; run inside the ERP's Python environment."""
import hashlib
import json
import os
from pathlib import Path
import sys

import frappe

site = sys.argv[1]
os.chdir('/home/frappe/frappe-bench/sites')
frappe.init(site=site, sites_path='.')
frappe.connect()
try:
    tables = ['Company', 'Customer', 'Supplier', 'Item', 'Item Default',
              'Item Price', 'Note', 'Data Import', 'File', 'User', 'Has Role',
              'User Permission', 'Role', 'Custom DocPerm', 'Sales Order',
              'Sales Order Item', 'Sales Invoice', 'Sales Invoice Item',
              'Delivery Note', 'Payment Entry', 'GL Entry', 'Stock Ledger Entry']
    result = {'tables': {}, 'private_files': {}}
    for table in tables:
        rows = frappe.db.sql(f'SELECT * FROM `tab{table}` ORDER BY name', as_dict=True)
        if table == 'User':
            # Active sessions update these while the source remains in use.
            for row in rows:
                for key in ['last_active', 'last_login', 'last_ip']:
                    row.pop(key, None)
        payload = json.dumps(rows, sort_keys=True, default=str, ensure_ascii=False).encode()
        result['tables'][table] = {'count': len(rows), 'sha256': hashlib.sha256(payload).hexdigest()}
    # Password hashes never leave this process; only a combined fingerprint does.
    rows = frappe.db.sql('SELECT * FROM `__Auth` ORDER BY doctype,name,fieldname', as_dict=True)
    result['authentication_sha256'] = hashlib.sha256(json.dumps(rows, sort_keys=True, default=str).encode()).hexdigest()
    for path in sorted(Path(site, 'private/files').rglob('*')):
        if path.is_file():
            result['private_files'][str(path.relative_to(Path(site)))] = hashlib.sha256(path.read_bytes()).hexdigest()
    print(json.dumps(result, sort_keys=True, indent=2))
finally:
    frappe.destroy()
