"""The credit review is an authenticated, read-only HTTP boundary."""
import json
import unittest
import urllib.error
import urllib.parse
import urllib.request

import runtime_smoke

BASE = runtime_smoke.BASE


class CreditHTTP(unittest.TestCase):
    path = "/api/method/quarter_erp.credit.review?" + urllib.parse.urlencode({
        "name": "SAL-ORD-2026-00001", "company": "Orbit Demo Company"})

    def test_credit_review_is_authenticated_and_read_only(self):
        client = runtime_smoke.RunningEngine().signed_in_client()
        record = BASE + "/api/resource/Sales%20Order/SAL-ORD-2026-00001"
        with client.open(record, timeout=15) as response:
            before = json.load(response)["data"]
        with client.open(BASE + self.path, timeout=15) as response:
            result = json.load(response)["message"]
        self.assertEqual(result["order"], before["name"])
        self.assertEqual(result["company"], before["company"])
        self.assertEqual(result["currency"], "USD")
        self.assertIn("projected_exposure", result)
        with client.open(record, timeout=15) as response:
            after = json.load(response)["data"]
        self.assertEqual((after["modified"], after["docstatus"]), (before["modified"], before["docstatus"]))

    def test_guest_cannot_read_balances(self):
        with self.assertRaises(urllib.error.HTTPError) as failure:
            urllib.request.urlopen(BASE + self.path, timeout=15)
        self.assertIn(failure.exception.code, (401, 403))


if __name__ == "__main__":
    unittest.main(verbosity=2)
