"""Use real HTTP sessions and concurrent requests; clean up only this test's drafts."""
from concurrent.futures import ThreadPoolExecutor
from datetime import date
import hashlib
import json
import sys
import unittest
import urllib.error
import urllib.parse
import urllib.request
import uuid

import runtime_smoke

BASE = runtime_smoke.BASE


class CommandHTTP(unittest.TestCase):
    def session(self):
        client = runtime_smoke.RunningEngine().signed_in_client()
        with client.open(BASE + "/api/method/quarter_erp.commands.session_context", timeout=15) as response:
            token = json.load(response)["message"]["csrf_token"]
        return client, token

    def request(self, session, method, path, payload=None, token=True):
        client, csrf = session
        headers = {"Content-Type":"application/json"}
        if token:
            headers["X-Frappe-CSRF-Token"] = csrf
        request = urllib.request.Request(BASE+path, method=method, headers=headers,
                                         data=json.dumps(payload).encode() if payload is not None else None)
        try:
            with client.open(request, timeout=30) as response:
                return json.load(response)
        except urllib.error.HTTPError as error:
            if error.code >= 500:
                print(json.loads(error.read()).get("exc", "Server request failed"), file=sys.stderr)
            raise

    def test_concurrent_retries_create_one_draft(self):
        sessions = [self.session(), self.session()]
        key = str(uuid.uuid4())
        company = "Orbit Demo Company"
        payload = {"command_key":key,"payload":{"company":company,"customer":"Orbit Demo Customer","delivery_date":str(date.today()),
                  "items":[{"item_code":"ORBIT-DEMO-BEARING","qty":"2","rate":"25","warehouse":"Stores - ODC"}]}}
        names = set()
        command = hashlib.sha256(json.dumps(["Administrator",company,key]).encode()).hexdigest()
        try:
            with ThreadPoolExecutor(max_workers=2) as executor:
                pending = [executor.submit(self.request, session, "POST", "/api/method/quarter_erp.commands.save_sales_draft", payload) for session in sessions]
                results, failures = [], []
                for future in pending:
                    try:
                        result = future.result()["message"]
                        names.add(result["name"])
                        results.append(result)
                    except Exception as error:
                        failures.append(error)
                if failures:
                    raise failures[0]
            self.assertEqual(results[0], results[1])
            self.assertEqual(len(names), 1)
            document = self.request(sessions[0], "GET", "/api/resource/Sales%20Order/"+urllib.parse.quote(results[0]["name"]))["data"]
            self.assertEqual(document["docstatus"], 0)
            self.assertEqual(document["grand_total"], 50)
        finally:
            for name in names:
                self.request(sessions[0], "DELETE", "/api/resource/Sales%20Order/"+urllib.parse.quote(name))
            if names:
                self.request(sessions[0], "DELETE", "/api/resource/Orbit%20Command/"+command)

    def test_write_requires_csrf_and_post_method(self):
        session = self.session()
        with self.assertRaises(urllib.error.HTTPError) as failure:
            self.request(session,"POST","/api/method/quarter_erp.commands.save_sales_draft",{},token=False)
        self.assertEqual(failure.exception.code,400)
        with self.assertRaises(urllib.error.HTTPError) as failure:
            self.request(session,"GET","/api/method/quarter_erp.commands.save_sales_draft")
        self.assertIn(failure.exception.code,[403,405])


if __name__ == "__main__":
    unittest.main(verbosity=2)
