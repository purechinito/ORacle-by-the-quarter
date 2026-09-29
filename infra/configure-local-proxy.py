"""Adapt the pinned upstream proxy for the explicitly loopback-only local site.

Socket.IO uses Origin as the URL for its server-side authentication callback.
Validate the real browser origin before supplying a reachable internal URL;
never replace Origin without checking it first.
"""
from pathlib import Path

path = Path('/templates/nginx/frappe.conf.template')
source = path.read_text()
start = source.index('\tlocation /socket.io {')
end = source.index('\n\t}', start) + len('\n\t}')
original = source[start:end]
old_origin = 'proxy_set_header Origin $proxy_x_forwarded_proto://${FRAPPE_SITE_NAME_HEADER};'
old_host = 'proxy_set_header Host $host;'
if original.count(old_origin) != 1 or original.count(old_host) != 1:
    raise RuntimeError('Upstream socket proxy changed; review rather than apply an unverified patch')
updated = original.replace('\tlocation /socket.io {', '\tlocation /socket.io {\n\t\tif ($orbit_local_origin = 0) { return 403; }')
updated = updated.replace(old_origin, 'proxy_set_header Origin http://frontend:8080;')
updated = updated.replace(old_host, 'proxy_set_header Host frontend:8080;')
origin_map = '''# Same-origin browser polling may omit Origin. Fetch Metadata is browser-owned.
map "$http_host|$http_sec_fetch_site" $orbit_same_origin_poll {
    default 0;
    "127.0.0.1:8080|same-origin" 1;
    "localhost:8080|same-origin" 1;
}

# Only the two supported local browser origins can open realtime connections.
map $http_origin $orbit_local_origin {
    default 0;
    "" $orbit_same_origin_poll;
    "http://127.0.0.1:8080" 1;
    "http://localhost:8080" 1;
}

'''
path.write_text(origin_map + source[:start] + updated + source[end:])
