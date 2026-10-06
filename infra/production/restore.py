"""Restore only a newly initialized destination; never overwrite an active site."""
import json
import os
from pathlib import Path
import pwd
import shutil
import subprocess
import tempfile

site = os.environ['ERP_SITE']
root = Path('/home/frappe/frappe-bench')
site_path = root / 'sites' / site
if not (site_path / '.fresh-install').is_file():
    raise SystemExit('Destination is not a fresh installation. Refusing to replace its data.')
source = Path('/restore')
databases = list(source.glob('*-database.sql.gz'))
configs = list(source.glob('*-site_config_backup.json'))
public = list(source.glob('*-files.tar'))
private = list(source.glob('*-private-files.tar'))
# The public-file glob also matches the private-file suffix.
public = [p for p in public if not p.name.endswith('-private-files.tar')]
if any(len(paths) != 1 for paths in [databases, configs, public, private]):
    raise SystemExit('Expected one matched database/config/public/private backup set.')
prefix = databases[0].name.removesuffix('-database.sql.gz')
if not all(p.name.startswith(prefix + '-') for p in [configs[0], public[0], private[0]]):
    raise SystemExit('Backup set timestamps or sites do not match.')

# Host backups remain mode 0600 in a mode 0700 folder. Root copies them into
# the site volume, then drops privileges before running any Frappe operation.
# This works with both rootful production Docker and the rootless local test.
if os.getuid() == 0:
    identity = pwd.getpwnam('frappe')
    staging = Path(tempfile.mkdtemp(prefix='restore-', dir=site_path / 'private'))
    os.chown(staging, identity.pw_uid, identity.pw_gid)
    for paths in [databases, configs, public, private]:
        original = paths[0]
        destination = staging / original.name
        shutil.copyfile(original, destination)
        destination.chmod(0o600)
        os.chown(destination, identity.pw_uid, identity.pw_gid)
        paths[0] = destination
    os.setgroups([])
    os.setgid(identity.pw_gid)
    os.setuid(identity.pw_uid)

os.chdir(root)
def bench(*args):
    try:
        subprocess.run(['bench', '--site', site, *args], check=True)
    except subprocess.CalledProcessError as error:
        # Do not expose the root password from restore's process arguments.
        raise SystemExit('ERP restore step failed (exit ' + str(error.returncode) + ').') from None

bench('set-maintenance-mode', 'on')
bench('disable-scheduler')
bench('restore', str(databases[0]), '--db-root-username', 'root',
      '--db-root-password', os.environ['DB_PASSWORD'],
      '--with-public-files', str(public[0]), '--with-private-files', str(private[0]))
config_path = site_path / 'site_config.json'
config = json.loads(config_path.read_text())
old = json.loads(configs[0].read_text())
if old.get('encryption_key'):
    config['encryption_key'] = old['encryption_key']
config.update(host_name='https://' + site, maintenance_mode=1, pause_scheduler=1)
config_path.write_text(json.dumps(config, indent=2) + '\n')
config_path.chmod(0o600)
bench('migrate', '--skip-search-index')
bench('clear-cache')
(site_path / '.fresh-install').unlink()
if 'staging' in locals():
    shutil.rmtree(staging)
print('Restored data and encryption key. Maintenance mode remains on until verification.')
