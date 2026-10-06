"""Keep realtime session validation on the private network after edge checks."""
from pathlib import Path

template = Path('/templates/nginx/frappe.conf.template')
text = template.read_text()
old_origin = 'proxy_set_header Origin $proxy_x_forwarded_proto://${FRAPPE_SITE_NAME_HEADER};'
old_host = 'proxy_set_header Host $host;'
start = text.index('\tlocation /socket.io {')
end = text.index('\n\tlocation / {', start)
block = text[start:end]
if block.count(old_origin) != 1 or block.count(old_host) != 1:
    raise SystemExit('Upstream realtime proxy changed; review its template before building.')
block = block.replace(old_origin, 'proxy_set_header Origin http://frontend:8080;')
block = block.replace(old_host, 'proxy_set_header Host frontend:8080;')
template.write_text(text[:start] + block + text[end:])
