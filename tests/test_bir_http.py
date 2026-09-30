"""Real HTTP login, review download and profile CSRF boundaries."""
import io
import json
import unittest
import urllib.error
import urllib.parse
import urllib.request
import zipfile
import runtime_smoke


class BIRHTTP(unittest.TestCase):
    def setUp(self):
        self.client=runtime_smoke.RunningEngine().signed_in_client()
        self.path=runtime_smoke.BASE+'/api/method/quarter_erp.bir.'
        self.params=urllib.parse.urlencode({'company':'Orbit Demo Company','from_date':'2026-01-01','to_date':'2026-12-31','fiscal_year':'2026'})

    def test_authenticated_review_and_complete_download(self):
        with self.client.open(self.path+'options',timeout=15) as response:
            options=json.load(response)['message']
        self.assertTrue(options['can_configure'])
        self.assertTrue(options['csrf_token'])
        with self.client.open(self.path+'review?'+self.params,timeout=30) as response:
            review=json.load(response)['message']
        self.assertEqual(len(review['reports']),4)
        with self.client.open(self.path+'export_pack?'+self.params,timeout=30) as response:
            self.assertIn('attachment',response.headers.get('Content-Disposition',''))
            content=response.read()
        with zipfile.ZipFile(io.BytesIO(content)) as archive:
            self.assertIn('manifest.json',archive.namelist())
            self.assertEqual(json.loads(archive.read('review.json'))['summary'],review['summary'])

    def test_profile_rejects_missing_csrf_and_get_and_preserves_login_view(self):
        body=json.dumps({'company':'Orbit Demo Company','values':{'legal_name':'Must not save'}}).encode()
        with self.assertRaises(urllib.error.HTTPError) as failure:
            self.client.open(urllib.request.Request(self.path+'save_profile',data=body,headers={'Content-Type':'application/json'}),timeout=15)
        self.assertEqual(failure.exception.code,400)
        with self.assertRaises(urllib.error.HTTPError) as failure:
            self.client.open(self.path+'save_profile',timeout=15)
        self.assertIn(failure.exception.code,(403,405))
        with urllib.request.urlopen(runtime_smoke.BASE+'/orbit?view=bir',timeout=15) as response:
            self.assertEqual(urllib.parse.parse_qs(urllib.parse.urlsplit(response.url).query).get('redirect-to'),['/orbit?view=bir'])


if __name__=='__main__': unittest.main(verbosity=2)
