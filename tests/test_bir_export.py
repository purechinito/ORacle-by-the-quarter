"""Review packs preserve accounting data and neutralize spreadsheet instructions."""
import csv
import hashlib
import io
import json
import unittest
import zipfile
from decimal import Decimal


class BIRExport(unittest.TestCase):
    def fixture(self):
        return {"company":"Sample Manufacturing", "currency":"PHP", "from_date":"2026-01-01",
                "to_date":"2026-12-31", "generated_at":"2026-09-30T00:00:00+00:00", "actor":"reviewer",
                "profile":{"tin":"000000001"}, "checks":[{"id":"cas","status":"blocked"}],
                "summary":{"gl_debit":"120.00","gl_credit":"120.00"}, "invoices":[],
                "reports":[{"id":"general_ledger","title":"General Ledger","columns":[
                    {"fieldname":"account","label":"Account"},{"fieldname":"debit","label":"Debit"}],
                    "rows":[{"account":"=HYPERLINK(\"example\")","debit":Decimal('-12.50')},
                            {"account":"<b>Total</b>","debit":Decimal('120.00')},{}]}]}

    def test_pack_includes_full_reports_profile_and_hashes(self):
        from quarter_erp.bir_export import pack_review
        with zipfile.ZipFile(io.BytesIO(pack_review(self.fixture()))) as archive:
            manifest=json.loads(archive.read('manifest.json'))
            self.assertEqual(manifest['purpose'],'Accounting review draft — not a BIR filing')
            self.assertEqual(manifest['company'],'Sample Manufacturing')
            for entry in manifest['files']:
                data=archive.read(entry['name'])
                self.assertEqual(entry['sha256'],hashlib.sha256(data).hexdigest())
                self.assertEqual(entry['bytes'],len(data))
            review=json.loads(archive.read('review.json'))
            self.assertEqual(review['profile']['tin'],'000000001')
            self.assertEqual(len(review['reports'][0]['rows']),3)
            self.assertIn('not a BIR filing',archive.read('README.txt').decode())

    def test_csv_formulas_in_text_are_inert_but_negative_amounts_are_numeric(self):
        from quarter_erp.bir_export import pack_review
        data=self.fixture()
        data['reports'][0]['rows'] += [{"account":"  +cmd","debit":0},{"account":"@SUM(A1)","debit":1}]
        with zipfile.ZipFile(io.BytesIO(pack_review(data))) as archive:
            rows=list(csv.reader(io.StringIO(archive.read('general_ledger.csv').decode('utf-8-sig'))))
        self.assertEqual(rows[1][0],"'=HYPERLINK(\"example\")")
        self.assertEqual(rows[1][1],'-12.50')
        self.assertEqual(rows[2][0],'<b>Total</b>')
        self.assertTrue(rows[4][0].startswith("'"))
        self.assertTrue(rows[5][0].startswith("'"))

    def test_business_text_is_not_treated_as_html(self):
        from quarter_erp.bir_export import pack_review
        data=self.fixture()
        data['reports'][0]['rows']=[{'account':'Steel <Grade A> &amp; fittings','debit':1}]
        with zipfile.ZipFile(io.BytesIO(pack_review(data))) as archive:
            rows=list(csv.reader(io.StringIO(archive.read('general_ledger.csv').decode('utf-8-sig'))))
        self.assertEqual(rows[1][0],'Steel <Grade A> &amp; fittings')


if __name__=='__main__': unittest.main()
