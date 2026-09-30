"""Company-wide accounting review, profile and report pack against the real site."""
import io
import json
import unittest
import zipfile
from decimal import Decimal
import frappe


class BIRReview(unittest.TestCase):
    company='Orbit Demo Company'
    args={'company':company,'from_date':'2026-01-01','to_date':'2026-12-31','fiscal_year':'2026'}

    def setUp(self):
        frappe.set_user('Administrator')
        frappe.db.savepoint('bir_review_tests')
        # Profile tests start empty without permanently removing saved UI data.
        frappe.db.delete('Orbit Taxpayer Profile', {'company':self.company})

    def tearDown(self):
        frappe.set_user('Administrator')
        frappe.db.rollback(save_point='bir_review_tests')
        frappe.clear_cache(doctype='GL Entry')

    def reviewer(self,email='bir-test@example.invalid'):
        user=frappe.get_doc({'doctype':'User','email':email,'first_name':'BIR Test','send_welcome_email':0,
            'user_type':'System User','roles':[{'role':'Orbit BIR Reviewer'}]}).insert()
        frappe.get_doc({'doctype':'User Permission','user':user.name,'allow':'Company',
            'for_value':self.company,'apply_to_all_doctypes':1}).insert()
        return user.name

    def test_real_reports_balance_and_do_not_write_accounting(self):
        from quarter_erp.bir import review
        before={dt:frappe.db.count(dt) for dt in ('GL Entry','Sales Invoice','Purchase Invoice','Stock Ledger Entry')}
        result=review(**self.args)
        self.assertEqual({r['id'] for r in result['reports']},{'general_ledger','trial_balance','balance_sheet','profit_and_loss'})
        self.assertEqual(Decimal(result['summary']['gl_difference']),0)
        self.assertGreater(Decimal(result['summary']['gl_debit']),0)
        self.assertTrue(all(r['rows'] for r in result['reports']))
        tb=next(r for r in result['reports'] if r['id']=='trial_balance')
        totals=[r for r in tb['rows'] if str(r.get('account_name','')).strip("'")=='Total']
        self.assertTrue(totals)
        self.assertAlmostEqual(float(totals[-1]['debit']),float(totals[-1]['credit']),places=2)
        self.assertEqual(before,{dt:frappe.db.count(dt) for dt in before})
        checks={c['id']:c for c in result['checks']}
        self.assertEqual(checks['taxpayer']['status'],'blocked')
        self.assertEqual(checks['jurisdiction']['status'],'blocked')
        self.assertEqual(checks['invoicing']['status'],'review')

    def test_invalid_company_and_dates_rejected(self):
        from quarter_erp.bir import review
        for company in ('',None,['!=',''],{'name':self.company}):
            with self.subTest(company=company),self.assertRaises(frappe.ValidationError):
                review(**{**self.args,'company':company})
        with self.assertRaises(frappe.PermissionError):
            review(**{**self.args,'company':'Unavailable'})
        for changes in ({'from_date':'2025-12-31'},{'to_date':'2027-01-01'},
                        {'from_date':'2026-03-01','to_date':'2026-02-01'}, {'to_date':['!=','']},
                        {'fiscal_year':{'name':'2026'}}):
            with self.subTest(changes=changes),self.assertRaises(frappe.ValidationError):
                review(**{**self.args,**changes})

    def test_scoped_reviewer_reads_but_cannot_configure(self):
        from quarter_erp.bir import review,save_profile
        actor=self.reviewer()
        frappe.set_user(actor)
        result=review(**self.args)
        self.assertEqual(result['company'],self.company)
        with self.assertRaises(frappe.PermissionError):
            save_profile(self.company,{'legal_name':'Forbidden'},None)
        with self.assertRaises(frappe.PermissionError):
            review(**{**self.args,'company':'Another company'})

    def test_restricted_account_cannot_obtain_unfiltered_totals(self):
        from quarter_erp.bir import review
        actor=self.reviewer('bir-restricted@example.invalid')
        account=frappe.get_all('Account',filters={'company':self.company,'is_group':0},pluck='name',limit=1)[0]
        frappe.get_doc({'doctype':'User Permission','user':actor,'allow':'Account','for_value':account,'apply_to_all_doctypes':1}).insert()
        frappe.set_user(actor)
        with self.assertRaises(frappe.PermissionError): review(**self.args)

    def test_profile_is_tracked_and_stale_overwrite_rejected(self):
        from quarter_erp.bir import save_profile
        first=save_profile(self.company,{'legal_name':'Synthetic Manufacturing','vat_status':'Unconfirmed','tin':'000000001'},None)
        second=save_profile(self.company,{'legal_name':'Synthetic Manufacturing revised'},first['modified'])
        self.assertEqual(second['tin'],'000000001')
        self.assertGreater(frappe.db.count('Version',{'ref_doctype':'Orbit Taxpayer Profile','docname':self.company}),0)
        with self.assertRaises(frappe.TimestampMismatchError):
            save_profile(self.company,{'legal_name':'Stale'},first['modified'])
        with self.assertRaises(frappe.ValidationError):
            save_profile(self.company,{'company':'Spoofed company'},second['modified'])

    def test_export_pack_is_complete_and_identifies_draft(self):
        from quarter_erp.bir import export_pack
        export_pack(**self.args)
        with zipfile.ZipFile(io.BytesIO(frappe.local.response.filecontent)) as archive:
            manifest=json.loads(archive.read('manifest.json'))
            data=json.loads(archive.read('review.json'))
            self.assertIn('not a BIR filing',manifest['purpose'])
            self.assertEqual(len(data['reports']),4)
            self.assertIn('trial_balance.csv',archive.namelist())
            self.assertEqual(manifest['actor'],'Administrator')

    def test_guest_and_employee_denied(self):
        from quarter_erp.bir import review
        user=frappe.get_doc({'doctype':'User','email':'bir-denied@example.invalid','first_name':'Denied',
            'user_type':'System User','send_welcome_email':0,'roles':[{'role':'Employee'}]}).insert()
        for actor in ('Guest',user.name):
            frappe.set_user(actor)
            with self.assertRaises(frappe.PermissionError): review(**self.args)

    def test_future_opening_entry_cannot_silently_enter_a_shorter_period(self):
        from quarter_erp.bir import review
        debit=frappe.get_all('Account',filters={'company':self.company,'is_group':0,'account_type':'Cash'},pluck='name',limit=1)[0]
        credit=frappe.get_all('Account',filters={'company':self.company,'is_group':0,'root_type':'Equity'},pluck='name',limit=1)[0]
        doc=frappe.get_doc({'doctype':'Journal Entry','company':self.company,'voucher_type':'Opening Entry',
            'posting_date':'2026-12-31','is_opening':'Yes','accounts':[
                {'account':debit,'debit_in_account_currency':100},
                {'account':credit,'credit_in_account_currency':100}]}).insert()
        doc.submit()
        with self.assertRaises(frappe.ValidationError):
            review(**{**self.args,'to_date':'2026-11-30'})

    def test_hidden_report_source_field_is_not_disclosed(self):
        from quarter_erp.bir import review
        from frappe.custom.doctype.property_setter.property_setter import make_property_setter
        actor=self.reviewer('bir-field-restricted@example.invalid')
        make_property_setter('GL Entry','remarks','permlevel',1,'Int')
        frappe.clear_cache(doctype='GL Entry')
        frappe.set_user(actor)
        with self.assertRaises(frappe.PermissionError): review(**self.args)


if __name__=='__main__':
    frappe.init(site='frontend');frappe.connect()
    try: unittest.main()
    finally: frappe.db.rollback();frappe.destroy()
