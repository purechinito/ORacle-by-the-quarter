"""Real HTTP/CSRF contract for read-only migration preview."""
import json
import unittest
import urllib.error
import urllib.parse
import urllib.request
import runtime_smoke


class MigrationHTTP(unittest.TestCase):
    def setUp(self):
        self.client = runtime_smoke.RunningEngine().signed_in_client()
        self.path = runtime_smoke.BASE + '/api/method/quarter_erp.migration.'
        with self.client.open(self.path+'options', timeout=15) as response:
            self.options = json.load(response)['message']

    def post(self, method, body, token=True):
        headers = {'Content-Type':'application/json'}
        if token:
            headers['X-Frappe-CSRF-Token'] = self.options['csrf_token']
        with self.client.open(urllib.request.Request(self.path+method, data=json.dumps(body).encode(), headers=headers), timeout=30) as response:
            return json.load(response)['message']

    def test_options_profile_preview_and_method_controls(self):
        self.assertEqual(set(self.options['kinds']), {'customers','suppliers','items'})
        body = {'company':'Orbit Demo Company', 'kind':'customers', 'content':'source_id,customer_name,customer_group,territory\n000101,HTTP Migration Example,All Customer Groups,All Territories'}
        profile = self.post('profile',body)
        result = self.post('preview',{**body,'mapping':profile['mapping']})
        self.assertEqual(result['valid_count'],1)
        self.assertTrue(result['preview_only'])
        self.assertEqual(result['sample'][0]['values']['source_id'],'000101')
        with self.assertRaises(urllib.error.HTTPError) as failure:
            self.post('preview',{**body,'mapping':profile['mapping']},token=False)
        self.assertEqual(failure.exception.code,400)
        with self.assertRaises(urllib.error.HTTPError) as failure:
            self.client.open(self.path+'preview',timeout=15)
        self.assertIn(failure.exception.code,(403,405))

    def test_guest_redirect_preserves_migration_view(self):
        with urllib.request.urlopen(runtime_smoke.BASE+'/orbit?view=migration',timeout=15) as response:
            query=urllib.parse.parse_qs(urllib.parse.urlsplit(response.url).query)
            self.assertEqual(query.get('redirect-to'),['/orbit?view=migration'])


if __name__ == '__main__':
    unittest.main(verbosity=2)
