"""Exercise production startup without Docker or access to an ERP site."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest


ERPCTL = Path(__file__).resolve().parents[1] / 'infra/production/erpctl'

# Docker is the external boundary. Model the distinct native Bench side
# effects: enable-scheduler changes the database flag; scheduler resume clears
# the configuration pause. Starting services does not change either flag.
FAKE_DOCKER = '''
import json
from pathlib import Path
import sys

state_path = Path('engine-state.json')
state = json.loads(state_path.read_text())
args = sys.argv[1:]
prefix = ['compose', 'run', '--rm', '-T', '--no-deps', '--entrypoint',
          'bench', 'create-site', '--site', 'erp.example.test']
if args == ['compose', 'up', '-d']:
    state['services_started'] = True
    state['scheduler_eligible_at_start'] = (
        not state['maintenance_mode']
        and state['enable_scheduler']
        and not state['pause_scheduler']
    )
elif args[:len(prefix)] == prefix:
    command = args[len(prefix):]
    if command == ['set-maintenance-mode', 'off']:
        state['maintenance_mode'] = False
    elif command == ['enable-scheduler']:
        state['enable_scheduler'] = True
    elif command == ['scheduler', 'resume']:
        if state['resume_fails']:
            sys.exit(47)
        state['pause_scheduler'] = False
    else:
        raise SystemExit('Unexpected Bench command: ' + repr(command))
else:
    raise SystemExit('Unexpected Docker command: ' + repr(args))
state_path.write_text(json.dumps(state))
'''


class ProductionStartTests(unittest.TestCase):
    def run_start(self, resume_fails=False):
        with tempfile.TemporaryDirectory() as directory:
            deployment = Path(directory)
            shutil.copyfile(ERPCTL, deployment / 'erpctl')
            (deployment / '.env').write_text('ERP_SITE=erp.example.test\n')
            state_path = deployment / 'engine-state.json'
            state_path.write_text(json.dumps({
                'maintenance_mode': True,
                'enable_scheduler': False,
                'pause_scheduler': True,
                'resume_fails': resume_fails,
                'services_started': False,
                'scheduler_eligible_at_start': False,
            }))
            bin_directory = deployment / 'bin'
            bin_directory.mkdir()
            docker = bin_directory / 'docker'
            docker.write_text('#!' + sys.executable + '\n' + FAKE_DOCKER)
            docker.chmod(0o700)
            result = subprocess.run(
                [sys.executable, str(deployment / 'erpctl'), 'start'],
                env={**os.environ, 'PATH': str(bin_directory) + os.pathsep + os.environ.get('PATH', '')},
                text=True, capture_output=True,
            )
            return result, json.loads(state_path.read_text())

    def test_start_makes_restored_site_scheduler_eligible_before_services_start(self):
        # Omitting resume, using the wrong site/command, or resuming after up
        # must fail: restored mail jobs would otherwise remain paused.
        result, state = self.run_start()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue(state['services_started'])
        self.assertTrue(state['scheduler_eligible_at_start'])

    def test_start_aborts_before_services_start_when_scheduler_resume_fails(self):
        # Ignoring a native Bench failure must not expose a half-started stack.
        result, state = self.run_start(resume_fails=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse(state['maintenance_mode'])
        self.assertTrue(state['enable_scheduler'])
        self.assertFalse(state['services_started'])
        self.assertTrue(state['pause_scheduler'])


if __name__ == '__main__':
    unittest.main()
