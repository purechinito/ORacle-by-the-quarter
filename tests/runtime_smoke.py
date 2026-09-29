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
    def signed_in_client(self):
        values = dict(line.split("=", 1) for line in (ROOT / ".runtime/engine.env").read_text().splitlines() if "=" in line)
        client = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
        body = urllib.parse.urlencode({"usr": "Administrator", "pwd": values["ERP_ADMIN_PASSWORD"]}).encode()
        with client.open(BASE + "/api/method/login", body, timeout=30) as response:
            self.assertEqual(json.load(response)["message"], "Logged In")
        return client

    def realtime_connect(self, client, origin=BASE, fetch_site=None):
        url = BASE + "/socket.io/?EIO=4&transport=polling"
        def request(url, body=None):
            headers = {"Content-Type": "text/plain;charset=UTF-8"}
            if origin is not None:
                headers["Origin"] = origin
            if fetch_site:
                headers["Sec-Fetch-Site"] = fetch_site
            req = urllib.request.Request(url, data=body, headers=headers)
            with client.open(req, timeout=10) as response:
                return response.read().decode()
        opened = request(url)
        self.assertTrue(opened.startswith("0"), "Engine.IO transport did not open")
        sid = json.loads(opened[1:])["sid"]
        session_url = url + "&sid=" + urllib.parse.quote(sid)
        try:
            request(session_url, b"40/frontend,")
            return request(session_url)
        finally:
            request(session_url, b"1")

    def test_realtime_accepts_authenticated_local_session(self):
        packet = self.realtime_connect(self.signed_in_client())
        self.assertTrue(packet.startswith("40/frontend,"), "Realtime namespace rejected the authenticated local session: " + packet)

    def test_realtime_rejects_unrelated_origin(self):
        with self.assertRaises(urllib.error.HTTPError) as failure:
            self.realtime_connect(self.signed_in_client(), origin="https://unrelated.example.invalid")
        self.assertEqual(failure.exception.code, 403)

    def test_realtime_rejects_missing_session(self):
        packet = self.realtime_connect(urllib.request.build_opener())
        self.assertTrue(packet.startswith("44/frontend,"), "An unauthenticated namespace must be rejected")

    def test_realtime_accepts_same_origin_browser_polling_without_origin_header(self):
        packet = self.realtime_connect(self.signed_in_client(), origin=None, fetch_site="same-origin")
        self.assertTrue(packet.startswith("40/frontend,"))

    def test_realtime_rejects_requests_without_origin_evidence(self):
        with self.assertRaises(urllib.error.HTTPError) as failure:
            self.realtime_connect(self.signed_in_client(), origin=None)
        self.assertEqual(failure.exception.code, 403)

    def test_guest_workspace_is_denied_and_page_redirects_to_login(self):
        with self.assertRaises(urllib.error.HTTPError) as failure:
            urllib.request.urlopen(BASE + "/api/method/quarter_erp.api.workspace", timeout=15)
        self.assertIn(failure.exception.code, [401, 403])
        with urllib.request.urlopen(BASE + "/orbit", timeout=15) as response:
            self.assertIn("/login", response.url)

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
        client = self.signed_in_client()
        with client.open(BASE + "/api/method/frappe.auth.get_logged_user", timeout=15) as response:
            self.assertEqual(json.load(response)["message"], "Administrator")
        with client.open(BASE + "/api/resource/Company?limit_page_length=5", timeout=15) as response:
            self.assertIsInstance(json.load(response)["data"], list)
        with client.open(BASE + "/api/method/quarter_erp.api.workspace?section=purchasing", timeout=15) as response:
            workspace = json.load(response)["message"]
            self.assertEqual(workspace["company"], "Orbit Demo Company")
            self.assertTrue(any(row["name"] == "PUR-ORD-2026-00001" for row in workspace["records"]))


if __name__ == "__main__":
    unittest.main(verbosity=2)
