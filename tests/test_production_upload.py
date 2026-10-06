import base64
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
import urllib.parse

spec = importlib.util.spec_from_file_location('storage_upload', Path(__file__).resolve().parents[1] / 'infra/production/storage-upload.py')
upload = importlib.util.module_from_spec(spec)
spec.loader.exec_module(upload)


class UploadTests(unittest.TestCase):
    def test_create_only_stream_and_integrity(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'backup.sql.gz'
            content = b'private backup bytes'
            path.write_bytes(content)
            calls = []
            class Connection:
                def __init__(self, host, timeout):
                    self.closed = False
                    self.assert_host = host
                def request(self, method, endpoint, body, headers):
                    calls.append((method, endpoint, body.read(), headers))
                def getresponse(self):
                    response = io.BytesIO(json.dumps({'name': 'daily/set/backup.sql.gz', 'size': str(len(content)), 'md5Hash': base64.b64encode(hashlib.md5(content).digest()).decode()}).encode())
                    response.status = 200
                    return response
                def close(self):
                    self.closed = True
            upload.upload_file(path, 'private-bucket', 'daily/set/backup.sql.gz', 'test-secret', Connection)
            self.assertEqual(len(calls), 1)
            method, endpoint, data, headers = calls[0]
            self.assertEqual(method, 'POST')
            self.assertEqual(urllib.parse.parse_qs(endpoint.split('?')[1])['ifGenerationMatch'], ['0'])
            self.assertEqual(data, content)
            self.assertEqual(headers['Content-Length'], str(len(content)))

    def test_existing_object_fails_without_read_or_overwrite(self):
        class Connection:
            def __init__(self, *args, **kwargs): pass
            def request(self, method, *args, **kwargs):
                if method != 'POST': raise AssertionError('Unexpected read')
            def getresponse(self):
                response = io.BytesIO(b'private error body')
                response.status = 412
                return response
            def close(self): pass
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'backup'
            path.write_bytes(b'bytes')
            with self.assertRaisesRegex(RuntimeError, r'^Backup upload failed \(HTTP 412\)\.$'):
                upload.upload_file(path, 'bucket', 'daily/existing', 'secret', Connection)

    def test_checksum_mismatch_fails(self):
        class Connection:
            def __init__(self, *args, **kwargs): pass
            def request(self, *args, **kwargs): pass
            def getresponse(self):
                response = io.BytesIO(b'{"name":"daily/backup","size":"5","md5Hash":"wrong"}')
                response.status = 200
                return response
            def close(self): pass
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'backup'
            path.write_bytes(b'bytes')
            with self.assertRaisesRegex(RuntimeError, 'integrity check failed'):
                upload.upload_file(path, 'bucket', 'daily/backup', 'secret', Connection)


if __name__ == '__main__':
    unittest.main()
