"""Exercise the actual local engine; no mocked server or fabricated records."""
import http.cookiejar
import json
from pathlib import Path
import unittest
import urllib.parse
import urllib.request
import urllib.error

ROOT = Path(__file__).resolve().parents[1]
BASE = "http://127.0.0.1:8080"


class RunningEngine(unittest.TestCase):
    def test_guest_cannot_read_company_records(self):
        with self.assertRaises(urllib.error.HTTPError) as failure:
            urllib.request.urlopen(BASE + "/api/resource/Company", timeout=15)
        self.assertIn(failure.exception.code, [401, 403])

    def test_login_page_is_served(self):
        with urllib.request.urlopen(BASE + "/login", timeout=15) as response:
            page = response.read().decode()
        self.assertIn("login", page.lower())
        self.assertNotIn("Traceback", page)

    def test_authenticated_company_api(self):
        secrets = {}
        for line in (ROOT / ".runtime/engine.env").read_text().splitlines():
            if "=" in line:
                key, value = line.split("=", 1)
                secrets[key] = value
        client = urllib.request.build_opener(
            urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar())
        )
        body = urllib.parse.urlencode({
            "usr": "Administrator", "pwd": secrets["ERP_ADMIN_PASSWORD"]
        }).encode()
        with client.open(BASE + "/api/method/login", body, timeout=30) as response:
            self.assertEqual(json.load(response)["message"], "Logged In")
        with client.open(BASE + "/api/method/frappe.auth.get_logged_user", timeout=15) as response:
            self.assertEqual(json.load(response)["message"], "Administrator")
        with client.open(BASE + "/api/resource/Company?limit_page_length=5", timeout=15) as response:
            self.assertIsInstance(json.load(response)["data"], list)


if __name__ == "__main__":
    unittest.main(verbosity=2)
