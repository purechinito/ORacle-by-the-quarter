"""Authenticated Philippine accounting preparation; no government filing or posting."""
from datetime import date, datetime, timezone
from decimal import Decimal
import hmac
import re

import frappe
from frappe.desk.query_report import generate_report_result, run as run_report
from frappe.permissions import get_role_permissions, get_user_permissions
from frappe.sessions import get_csrf_token

from quarter_erp.api import require_user
from quarter_erp.bir_export import pack_review

PROFILE='Orbit Taxpayer Profile'
PROFILE_FIELDS=('legal_name','tin','branch_code','registered_address','rdo_code','vat_status',
    'fiscal_year_end','cas_reference','books_reference','invoice_series','accountant_name',
    'accountant_review_date','registration_notes')
REPORTS=(('general_ledger','General Ledger'),('trial_balance','Trial Balance'),
    ('balance_sheet','Balance Sheet'),('profit_and_loss','Profit and Loss Statement'))
MAX_LEDGER=20000
MAX_INVOICES=2000


def can_configure():
    return frappe.session.user=='Administrator' or bool({'System Manager','Accounts Manager'} & set(frappe.get_roles()))


def authorize(company=None, exporting=False):
    require_user()
    if not ({'System Manager','Accounts Manager','Orbit BIR Reviewer'} & set(frappe.get_roles())) and frappe.session.user!='Administrator':
        frappe.throw('An authorized accounting or review role is required.',frappe.PermissionError)
    # Native reports compute totals before filtering individual rows. Partial account
    # access cannot safely be treated as a complete company report.
    restrictions=get_user_permissions(frappe.session.user)
    if frappe.session.user!='Administrator' and any(values for key,values in restrictions.items() if key!='Company'):
        frappe.throw('Company-wide review requires an account with company restrictions only. Other record restrictions cannot produce complete accounting reports.',frappe.PermissionError)
    for doctype in ('Company','Account','GL Entry','Sales Invoice','Purchase Invoice',PROFILE):
        meta=frappe.get_meta(doctype)
        perms=get_role_permissions(meta)
        actions=['read']+(['report'] if doctype=='GL Entry' else [])+(['export'] if exporting else [])
        if any(not frappe.has_permission(doctype,ptype=action) or action in perms.get('if_owner',{}) for action in actions):
            frappe.throw('Complete accounting read/export permissions are required for this review.',frappe.PermissionError)
        if frappe.session.user!='Administrator':
            permitted=set(meta.get_permitted_fieldnames(user=frappe.session.user,permission_type='read'))
            used_fields={
                'Company':('country','default_currency','default_finance_book'),
                'Sales Invoice':('posting_date','customer_name','currency','grand_total','base_grand_total','base_total_taxes_and_charges'),
                'Purchase Invoice':('posting_date','supplier_name','currency','grand_total','base_grand_total','base_total_taxes_and_charges','bill_no','bill_date'),
                PROFILE:PROFILE_FIELDS,
            }.get(doctype,meta.get_fieldnames_with_value())
            if any(field not in permitted for field in used_fields):
                frappe.throw('Field restrictions prevent a complete accounting review. Use a company-scoped account with full accounting field visibility.',frappe.PermissionError)
    if company is None:
        return
    if not isinstance(company,str) or not company.strip() or len(company)>140:
        frappe.throw('Choose one company by its exact name.')
    if not frappe.get_list('Company',filters={'name':company},pluck='name',limit=1):
        frappe.throw('This company is unavailable to your account.',frappe.PermissionError)


@frappe.whitelist(methods=['GET'])
def options():
    authorize()
    return {'user':frappe.session.user,'companies':frappe.get_list('Company',fields=['name','default_currency','country'],order_by='name',limit_page_length=0),
        'fiscal_years':frappe.get_list('Fiscal Year',filters={'disabled':0},fields=['name','year_start_date','year_end_date'],order_by='year_start_date desc',limit_page_length=100),
        'can_configure':can_configure(),'csrf_token':get_csrf_token()}


def exact_date(value,label):
    if not isinstance(value,str) or not re.fullmatch(r'\d{4}-\d{2}-\d{2}',value):
        frappe.throw(label+' must use YYYY-MM-DD.')
    try: return date.fromisoformat(value)
    except ValueError: frappe.throw(label+' is not a valid date.')


def period(company,from_date,to_date,fiscal_year):
    if not isinstance(company,str) or not company.strip():
        frappe.throw('Choose one company by its exact name.')
    authorize(company)
    start=exact_date(from_date,'Start date');end=exact_date(to_date,'End date')
    if not isinstance(fiscal_year,str) or not fiscal_year or len(fiscal_year)>140:
        frappe.throw('Choose a fiscal year.')
    if not frappe.get_list('Fiscal Year',filters={'name':fiscal_year,'disabled':0},pluck='name',limit=1):
        frappe.throw('Choose an available fiscal year.')
    year=frappe.get_doc('Fiscal Year',fiscal_year)
    if start>end or start<year.year_start_date or end>year.year_end_date:
        frappe.throw('Choose an ordered date range wholly inside the selected fiscal year. Dates will not be silently adjusted.')
    if year.companies and company not in [r.company for r in year.companies]:
        frappe.throw('This fiscal year does not apply to the selected company.')
    return start,end


def profile_for(company):
    if not frappe.db.exists(PROFILE,company): return None
    doc=frappe.get_doc(PROFILE,company);doc.check_permission('read');doc.apply_fieldlevel_read_permissions()
    return {**{key:doc.get(key) for key in ('name',*PROFILE_FIELDS)},'modified':str(doc.modified)}


@frappe.whitelist(methods=['POST'])
def save_profile(company,values,expected_modified=None):
    if not isinstance(company,str) or not company.strip(): frappe.throw('Choose a company.')
    authorize(company)
    # Frappe skips its global CSRF check before a session token exists. This
    # session-only configuration API requires the token even on the first write.
    if getattr(frappe.local,'request',None):
        token=get_csrf_token()
        supplied=frappe.get_request_header('X-Frappe-CSRF-Token') or ''
        if not hmac.compare_digest(token,supplied):
            frappe.throw('Reload the review workspace before saving the profile.',frappe.CSRFTokenError)
    if not can_configure(): frappe.throw('Only an authorized accounting manager can configure this profile.',frappe.PermissionError)
    if isinstance(values,str):
        try: values=frappe.parse_json(values)
        except (ValueError,TypeError): frappe.throw('The profile could not be read.')
    if not isinstance(values,dict) or set(values)-set(PROFILE_FIELDS): frappe.throw('The profile contains unsupported fields.')
    for key,value in values.items():
        if not isinstance(value,str) or len(value)>(4000 if key in ('registered_address','registration_notes') else 140):
            frappe.throw('Profile fields must be bounded text values.')
    # Serialize creation as well as subsequent edits for this exact company.
    frappe.db.sql('select name from tabCompany where name=%s for update',(company,))
    exists=frappe.db.exists(PROFILE,company)
    if exists:
        doc=frappe.get_doc(PROFILE,company,for_update=True)
        if not isinstance(expected_modified,str) or expected_modified!=str(doc.modified):
            frappe.throw('This profile changed. Reload it before saving your changes.',frappe.TimestampMismatchError)
    else:
        if expected_modified: frappe.throw('The profile changed. Reload before saving.',frappe.TimestampMismatchError)
        doc=frappe.get_doc({'doctype':PROFILE,'company':company,'vat_status':'Unconfirmed'})
    doc.update({key:value.strip() for key,value in values.items()})
    doc.save()
    return profile_for(company)


def report_filters(company,from_date,to_date,fiscal_year,book):
    common={'company':company,'finance_book':book,'include_default_book_entries':1}
    financial={**common,'from_fiscal_year':fiscal_year,'to_fiscal_year':fiscal_year,
        'filter_based_on':'Date Range','period_start_date':from_date,'period_end_date':to_date,
        'periodicity':'Yearly','presentation_currency':None}
    return {
        'general_ledger':{**common,'from_date':from_date,'to_date':to_date,'categorize_by':'',
            'include_dimensions':0,'show_cancelled_entries':0,'show_remarks':1},
        'trial_balance':{**common,'fiscal_year':fiscal_year,'from_date':from_date,'to_date':to_date,
            'show_zero_values':0,'show_net_values':0,'show_group_accounts':1,'with_period_closing_entry_for_current_period':1,
            'with_period_closing_entry_for_opening':1},
        'balance_sheet':{**financial,'accumulated_values':1},
        'profit_and_loss':{**financial,'accumulated_values':0},
    }


def invoice_register(company,start,end):
    invoices=[]
    for dt,party in (('Sales Invoice','customer_name'),('Purchase Invoice','supplier_name')):
        filters={'company':company,'docstatus':1,'posting_date':['between',[start,end]]}
        fields=['name','posting_date',party,'currency','grand_total','base_grand_total','base_total_taxes_and_charges']
        if dt=='Purchase Invoice': fields+=['bill_no','bill_date']
        rows=frappe.get_list(dt,filters=filters,fields=fields,order_by='posting_date,name',limit_page_length=MAX_INVOICES+1)
        # An account with complete company scope must not obtain an apparently
        # complete register if a custom permission hook filtered some records.
        if len(rows)>MAX_INVOICES or frappe.db.count(dt,filters)!=len(rows):
            frappe.throw('The invoice register exceeds the limit or has restricted rows. Use a shorter period or a complete company review account.')
        names={row.name for row in rows}
        counts={name:0 for name in names}
        if names:
            files=frappe.get_all('File',filters={'attached_to_doctype':dt,'attached_to_name':['in',list(names)],'is_folder':0},fields=['name','attached_to_name'],limit_page_length=MAX_INVOICES*10+1)
            if len(files)>MAX_INVOICES*10: frappe.throw('Too many attachments for synchronous review. Use a shorter period.')
            for file in files:
                if frappe.has_permission('File','read',doc=frappe.get_doc('File',file.name)):
                    counts[file.attached_to_name]+=1
        for row in rows:
            invoices.append({'doctype':dt,'name':row.name,'posting_date':row.posting_date,'party':row[party],
                'currency':row.currency,'grand_total':row.grand_total,'base_grand_total':row.base_grand_total,
                'tax_total':row.base_total_taxes_and_charges,'attachment_count':counts[row.name],
                'bill_no':row.get('bill_no'),'bill_date':row.get('bill_date')})
    return invoices


def readiness(profile,company,summary):
    profile=profile or {}
    missing=[key.replace('_',' ') for key in ('legal_name','tin','branch_code','registered_address','rdo_code','fiscal_year_end') if not profile.get(key)]
    if profile.get('vat_status') not in ('VAT','Non-VAT'): missing.append('confirmed VAT status')
    checks=[]
    def add(id,title,status,detail): checks.append({'id':id,'title':title,'status':status,'detail':detail})
    add('taxpayer','Taxpayer registration profile','blocked' if missing else 'review',
        'Still needed: '+', '.join(missing) if missing else 'Profile supplied. Match it against the actual Certificate of Registration and branch scope.')
    add('jurisdiction','Philippine company and peso books','checked' if company.country=='Philippines' and company.default_currency=='PHP' else 'blocked',
        f'Current ledger: {company.country} / {company.default_currency}. Existing posted currency is not converted. Confirm the actual Philippine entity and approved book currency.')
    add('cas','CAS registration evidence','review' if profile.get('cas_reference') else 'blocked',
        'Recorded reference: '+profile['cas_reference']+'. Verify the authentic AC/legacy PTU and this system version.' if profile.get('cas_reference') else 'Record the applicable CAS Acknowledgement Certificate or legacy authority; prepare Annex B, sworn statement and system specification.')
    add('books','Registered books and ORUS','review' if profile.get('books_reference') else 'blocked',
        'Verify books registration, covered period, ORUS QR evidence and transmittal. '+(profile.get('books_reference') or 'No registration reference supplied.'))
    add('ledger','Selected-period ledger balance','checked' if abs(Decimal(summary['gl_difference']))<Decimal('0.005') else 'blocked',
        'Debits less credits: '+summary['gl_difference']+' '+company.default_currency+'. Balance alone does not prove correct accounting or complete migration.')
    add('evidence','Invoice support and tax eligibility','review',
        f"{summary['missing_evidence_count']} posted invoices have no visible attachments. Attachment counts do not establish invoice validity; review supplier invoice details and input-VAT treatment.")
    add('invoicing','Invoice series, layout and corrections','review',
        'Validate registered series, required seller/buyer fields, VAT classifications and immutable issued originals with linked corrections. '+('Series noted: '+profile['invoice_series'] if profile.get('invoice_series') else 'No series recorded.'))
    add('electronic','Electronic invoice applicability and authorities','review',
        'Determine RMC 98-2026 / RR 26-2025 coverage. PTI precedes electronic issuance; applicable EIS certification and sales reporting are separate. No certified adapter is connected.')
    add('taxes','VAT, withholding and tax schedules','review','Confirm registration, tax mappings, ATCs, current forms and accountant-reviewed examples. These reports are not 2550Q/2307/SLSP or other validated filing files.')
    add('manufacturing','Inventory, WIP and finished-goods reconciliation','review','Reconcile stock valuation, production costs and GL; validate the applicable BIR inventory-list format. Not established by this financial pack.')
    add('accountant','Accountant review','review' if profile.get('accountant_name') and profile.get('accountant_review_date') else 'blocked',
        'Recorded reviewer: '+profile.get('accountant_name','')+'. Retain signed acceptance for the actual setup and data.' if profile.get('accountant_name') else 'Assign an accountant and document review of the actual taxpayer, data, books and invoices.')
    add('operations','Retention, audit history and production recovery','review','This local development service has no verified production restore/SLA. Keep issued originals, action history and legal holds; validate backup restoration and the CAS technical checklist.')
    return checks


@frappe.whitelist(methods=['GET'])
def review(company,from_date,to_date,fiscal_year):
    start,end=period(company,from_date,to_date,fiscal_year)
    company_doc=frappe.get_doc('Company',company)
    account_filters={'company':company}
    if len(frappe.get_list('Account',filters=account_filters,pluck='name',limit_page_length=MAX_LEDGER+1))!=frappe.db.count('Account',account_filters):
        frappe.throw('Your account restrictions cannot produce complete company reports.',frappe.PermissionError)
    book=company_doc.default_finance_book or None
    # Native GL/TB include opening balances independently of the report end date.
    # Do not let a future opening entry escape the preflight range or silently
    # appear in an earlier review snapshot.
    if frappe.db.exists('GL Entry',{'company':company,'is_cancelled':0,'is_opening':'Yes','posting_date':['>',end]}):
        frappe.throw('Opening entries exist after the requested period end. Resolve their dating or select a period including them before preparing this review.')
    filters={'company':company,'is_cancelled':0,'posting_date':['<=',end]}
    # Count all company books before native reports can load unbounded history.
    if frappe.db.count('GL Entry',filters)>MAX_LEDGER:
        frappe.throw('Company history exceeds 20,000 ledger rows. An asynchronous report job is required; no truncated pack was generated.')
    rows=frappe.get_list('GL Entry',filters=filters,fields=['name','posting_date','debit','credit','finance_book'],limit_page_length=MAX_LEDGER+1)
    if len(rows)!=frappe.db.count('GL Entry',filters):
        frappe.throw('Your record restrictions cannot produce complete company reports.',frappe.PermissionError)
    booked=[r for r in rows if not r.finance_book or r.finance_book==book]
    current=[r for r in booked if r.posting_date>=start]
    debit=sum((Decimal(str(r.debit)) for r in current),Decimal(0))
    credit=sum((Decimal(str(r.credit)) for r in current),Decimal(0))
    reports=[];all_filters=report_filters(company,from_date,to_date,fiscal_year,book)
    for id,title in REPORTS:
        if 'Orbit BIR Reviewer' in frappe.get_roles():
            # The dedicated reviewer deliberately has NO native Report roles:
            # that API accepts filters whose company isn't authorized by its
            # standard metadata. Execute only these fixed native controllers,
            # after this endpoint's complete-company authorization and bounds.
            report=frappe.get_doc('Report',title)
            if report.is_standard!='Yes' or report.report_type!='Script Report' or report.disabled:
                frappe.throw('A required native accounting report was changed or disabled.')
            output=generate_report_result(report,filters=frappe._dict(all_filters[id]),user=frappe.session.user)
        else:
            output=run_report(title,filters=frappe._dict(all_filters[id]),ignore_prepared_report=True,are_default_filters=False)
        if output.get('prepared_report') or output.get('result') is None:
            frappe.throw('The accounting report is not available yet. Retry after checking native report access.')
        data=output['result']
        if len(data)>MAX_LEDGER+1000: frappe.throw('The report exceeds the synchronous limit. No truncated pack was generated.')
        reports.append({'id':id,'title':title,'columns':output['columns'],'rows':data,
            'message':output.get('message'),'report_summary':output.get('report_summary'),'filters':all_filters[id]})
    invoices=invoice_register(company,start,end)
    summary={'gl_debit':str(debit),'gl_credit':str(credit),'gl_difference':str(debit-credit),
        'invoice_count':len(invoices),'missing_evidence_count':sum(not r['attachment_count'] for r in invoices)}
    profile=profile_for(company)
    checks=readiness(profile,company_doc,summary)
    if len(booked)!=len(rows):
        checks.append({'id':'other_books','title':'Additional finance books','status':'review',
            'detail':'Entries in other finance books exist and are excluded. Confirm the statutory book selection before relying on this pack.'})
    return {'company':company,'currency':company_doc.default_currency,'country':company_doc.country,
        'from_date':from_date,'to_date':to_date,'fiscal_year':fiscal_year,
        'finance_book_scope':(book or 'No named default finance book')+' + entries without a finance book; invoice register includes all posted invoices in the period.',
        'generated_at':datetime.now(timezone.utc).isoformat(),'actor':frappe.session.user,'profile':profile,
        'checks':checks,'summary':summary,'reports':reports,'invoices':invoices}


@frappe.whitelist(methods=['GET'])
def export_pack(company,from_date,to_date,fiscal_year):
    if not isinstance(company,str) or not company.strip(): frappe.throw('Choose a company.')
    authorize(company,exporting=True)
    result=review(company,from_date,to_date,fiscal_year)
    frappe.local.response.filename='orbit-accounting-review-'+from_date+'-'+to_date+'.zip'
    frappe.local.response.filecontent=pack_review(result)
    frappe.local.response.type='download'
    frappe.local.response.display_content_as='attachment'
    frappe.local.response.content_type='application/zip'
