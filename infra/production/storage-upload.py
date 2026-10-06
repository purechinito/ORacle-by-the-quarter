"""Create backup objects using the VM identity, without read/list/delete access."""
import base64
import hashlib
import http.client
import json
from pathlib import Path
import sys
import urllib.parse


def file_digest(path, algorithm):
    digest = hashlib.new(algorithm, usedforsecurity=False)
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest


def access_token():
    connection = http.client.HTTPConnection('169.254.169.254', timeout=10)
    try:
        connection.request('GET', '/computeMetadata/v1/instance/service-accounts/default/token',
                           headers={'Metadata-Flavor': 'Google'})
        response = connection.getresponse()
        if response.status != 200 or response.getheader('Metadata-Flavor') != 'Google':
            raise RuntimeError('VM identity is unavailable.')
        return json.loads(response.read())['access_token']
    finally:
        connection.close()


def upload_file(path, bucket, object_name, token, connection_factory=http.client.HTTPSConnection):
    size = path.stat().st_size
    digest = file_digest(path, 'md5').digest()
    expected_md5 = base64.b64encode(digest).decode()
    query = urllib.parse.urlencode({'uploadType': 'media', 'name': object_name,
                                    'ifGenerationMatch': '0'})
    endpoint = '/upload/storage/v1/b/' + urllib.parse.quote(bucket, safe='') + '/o?' + query
    connection = connection_factory('storage.googleapis.com', timeout=300)
    try:
        with path.open('rb') as stream:
            # http.client streams this file instead of loading a backup into RAM.
            connection.request('POST', endpoint, body=stream, headers={
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/octet-stream', 'Content-Length': str(size)})
            response = connection.getresponse()
            if response.status not in (200, 201):
                # Error bodies and tokens never reach service logs.
                raise RuntimeError('Backup upload failed (HTTP ' + str(response.status) + ').')
            result = json.loads(response.read())
        if result.get('name') != object_name or int(result.get('size', -1)) != size or result.get('md5Hash') != expected_md5:
            raise RuntimeError('Uploaded backup integrity check failed.')
    finally:
        connection.close()


def main(directory, bucket):
    directory = Path(directory)
    if not bucket.startswith('gs://'):
        raise RuntimeError('Expected a Cloud Storage bucket URL.')
    bucket = bucket.removeprefix('gs://')
    manifest = directory / 'sha256.json'
    hashes = json.loads(manifest.read_text())
    for name, digest in hashes.items():
        if Path(name).name != name:
            raise RuntimeError('Invalid backup file name.')
        if file_digest(directory / name, 'sha256').hexdigest() != digest:
            raise RuntimeError('Local backup checksum mismatch.')
    # Publish the manifest last, so a partial upload has no completion marker.
    for name in [*hashes, manifest.name]:
        object_name = 'daily/' + directory.name + '/' + name
        upload_file(directory / name, bucket, object_name, access_token())
        print('Uploaded and verified: ' + object_name)


if __name__ == '__main__':
    try:
        main(*sys.argv[1:])
    except RuntimeError as error:
        raise SystemExit(str(error)) from None
    except (OSError, ValueError, http.client.HTTPException):
        raise SystemExit('Backup upload could not finish; see the backup service status.') from None
