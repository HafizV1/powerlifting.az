"""Offline checks; never authorize Cloudflare or upload real credentials."""
import contextlib
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('setup', Path(__file__).parents[1] / 'scripts/configure-staging.py')
setup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(setup)


class StagingSetupTests(unittest.TestCase):
    def test_secrets_use_stdin_and_only_staging_commands(self):
        with tempfile.TemporaryDirectory() as tmp:
            key = Path(tmp) / 'fake-key.pem'
            key.write_text('FAKE PRIVATE KEY FOR MOCK ONLY')
            calls = []
            def run(args, data=None, env=None):
                calls.append((args, data))
                return '-----BEGIN PRIVATE KEY-----\nmock\n-----END PRIVATE KEY-----' if args[0] == 'openssl' else ''
            out = io.StringIO()
            with patch.object(setup.sys.stdin, 'isatty', return_value=True), \
                 patch.object(setup.sys.stderr, 'isatty', return_value=True), \
                 patch('builtins.input', return_value=''), \
                 patch.object(setup, 'hidden', side_effect=['123', 'client-id', '456', 'FAKE_CLIENT_SECRET', str(key)]), \
                 patch.object(setup, 'run', side_effect=run), contextlib.redirect_stdout(out):
                setup.main()
            worker_calls = calls[1:]
            self.assertEqual([args[3] for args, _ in worker_calls], ['deploy', 'secret', 'deploy'])
            for args, _ in worker_calls:
                self.assertEqual(args[-2:], ['--env', 'staging'])
                self.assertNotIn('FAKE_CLIENT_SECRET', ' '.join(args))
            values = json.loads(worker_calls[1][1])
            self.assertEqual(values['GITHUB_CLIENT_SECRET'], 'FAKE_CLIENT_SECRET')
            self.assertGreaterEqual(len(values['SESSION_SECRET']), 64)
            self.assertNotIn('FAKE_CLIENT_SECRET', out.getvalue())
            self.assertNotIn('BEGIN PRIVATE KEY', out.getvalue())

    def test_noninteractive_execution_refused_before_any_command(self):
        with patch.object(setup.sys.stdin, 'isatty', return_value=False), patch.object(setup, 'run') as run:
            with self.assertRaises(ValueError):
                setup.main()
            run.assert_not_called()


if __name__ == '__main__':
    unittest.main()
