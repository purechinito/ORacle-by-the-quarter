"""Portable accounting review packages. No document posting or tax filing."""
import csv
import hashlib
import io
import json
import zipfile
from datetime import date, datetime
from decimal import Decimal


def text_cell(value):
    if value is None:
        return ''
    if not isinstance(value,str):
        return value.isoformat() if isinstance(value,(date,datetime)) else value
    if value.lstrip().startswith(('=','+','-','@')) or value.startswith(('\t','\r','\n')):
        value="'"+value
    return value


def csv_bytes(columns, rows):
    buffer=io.StringIO(newline='')
    writer=csv.writer(buffer)
    writer.writerow([text_cell(c.get('label',c['fieldname'])) for c in columns])
    for row in rows:
        writer.writerow([text_cell(row.get(c['fieldname'])) for c in columns])
    return buffer.getvalue().encode('utf-8-sig')


def json_default(value):
    if isinstance(value,(date,datetime)):
        return value.isoformat()
    if isinstance(value,Decimal):
        return str(value)
    raise TypeError(type(value).__name__)


def pack_review(review):
    def encoded(value):
        return json.dumps(value,ensure_ascii=False,indent=2,default=json_default).encode()
    files={'review.json':encoded(review)}
    for report in review['reports']:
        # IDs are owned by the server's fixed report allowlist, never user input.
        files[report['id']+'.csv']=csv_bytes(report['columns'],report['rows'])
    invoice_keys=['doctype','name','posting_date','party','currency','grand_total','base_grand_total','tax_total','bill_no','bill_date','attachment_count']
    files['invoice_register.csv']=csv_bytes([{'fieldname':k,'label':k} for k in invoice_keys],review['invoices'])
    files['readiness_checks.csv']=csv_bytes([{'fieldname':k,'label':k} for k in ('id','title','status','detail')],review['checks'])
    files['README.txt']=(
        'Accounting review draft — not a BIR filing\n\n'
        'This package contains native ERPNext reports and the supplied taxpayer profile. '
        'It does not establish CAS registration, valid invoice issuance, PTI, EIS certification, or BIR acceptance. '
        'All unresolved checks in review.json/readiness_checks.csv remain open.\n\n'
        'Review exact company, period, base currency and finance-book scope in review.json. '
        'Native report totals, separator rows and messages are retained. Balance Sheet is as of period end; '
        'Profit and Loss uses the selected interval. Amounts are not converted to Philippine pesos. '
        'Attachment presence is not proof of invoice validity or input-VAT eligibility. '
        'No ledger entry has been changed by generating this package.\n\n'
        'CSV text that could execute a spreadsheet formula is prefixed with an apostrophe; numeric amounts retain their signs. '
        'manifest.json hashes every other file for change detection, not a digital signature or tamper-proof archive. '
        'Keep the package private and retain registered books, source evidence and issued invoice originals under your retention policy.\n'
    ).encode()
    manifest={key:review.get(key) for key in ('company','currency','from_date','to_date','fiscal_year','finance_book_scope','generated_at','actor')}
    manifest.update({'purpose':'Accounting review draft — not a BIR filing','format_version':1,
        'files':[{'name':name,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()} for name,data in files.items()]})
    files['manifest.json']=encoded(manifest)
    output=io.BytesIO()
    with zipfile.ZipFile(output,'w',compression=zipfile.ZIP_DEFLATED) as archive:
        for name,data in files.items(): archive.writestr(name,data)
    return output.getvalue()
