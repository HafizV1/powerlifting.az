#!/usr/bin/env python3
"""Run only on the owner's trusted terminal after Wrangler login.

Secrets stay in process memory and Wrangler stdin; no secret files are created.
Never run this script in chat, an agent tool, CI logs or a recorded terminal.
"""
import getpass
import json
import os
from pathlib import Path
import secrets
import subprocess
import sys
import tomllib

ADMIN = Path(__file__).resolve().parents[1]
URL = 'https://powerlifting-admin-v2-staging.powerlifting-aze-482.workers.dev'
WRANGLER = ['npx', '--yes', 'wrangler@4.148.0']


def hidden(label):
    value = getpass.getpass(label).strip()
    if not value:
        raise ValueError('A required value is missing.')
    return value


def run(args, data=None, env=None):
    # Capture output: authentication failures must not accidentally print secrets.
    result = subprocess.run(args, cwd=ADMIN, input=data, text=True,
                            capture_output=True, env=env)
    if result.returncode:
        raise RuntimeError('Setup command failed. No captured output was printed. '
                           'Check account authorization/configuration securely.')
    return result.stdout


def main():
    if not sys.stdin.isatty() or not sys.stderr.isatty():
        raise ValueError('Use an interactive, private terminal; piped prompts are refused.')
    staging = tomllib.loads((ADMIN / 'wrangler.toml').read_text())['env']['staging']
    expected = {'PUBLIC_ORIGIN': URL, 'ADMIN_USER_IDS': '335450583',
                'STAGING_ONLY': 'true', 'GITHUB_REPOSITORY': 'HafizV1/powerlifting-v1-preview',
                'BASE_BRANCH': 'v2/staging-base', 'DATA_BRANCH': 'v2/content-staging',
                'ENABLE_V1_EXPORT': 'false'}
    if staging['name'] != 'powerlifting-admin-v2-staging' or staging['vars'] != expected:
        raise ValueError('Staging configuration changed; review before deployment.')
    if not staging.get('workers_dev') or staging.get('routes') or staging.get('route'):
        raise ValueError('Only the isolated workers.dev staging URL is allowed.')
    print('Staging only: preview repository, no production deployment. Secrets are hidden.')
    env = dict(os.environ, WRANGLER_SEND_METRICS='false')
    # Optional account selection is local to this process, never committed.
    account = input('Cloudflare Account ID (Enter if only one account): ').strip()
    if account:
        if len(account) != 32 or any(c not in '0123456789abcdef' for c in account.lower()):
            raise ValueError('Cloudflare Account ID must be 32 hexadecimal characters.')
        env['CLOUDFLARE_ACCOUNT_ID'] = account
    values = {}
    for name in ['GITHUB_APP_ID', 'GITHUB_CLIENT_ID', 'GITHUB_INSTALLATION_ID']:
        values[name] = hidden(name + ': ')
    if not values['GITHUB_APP_ID'].isdigit() or not values['GITHUB_INSTALLATION_ID'].isdigit():
        raise ValueError('App and installation IDs must be numeric.')
    values['GITHUB_CLIENT_SECRET'] = hidden('Client secret: ')
    key_path = Path(hidden('Downloaded private-key file path: ')).expanduser().resolve()
    if key_path.is_relative_to(ADMIN.parent):
        raise ValueError('Keep private keys outside the Git checkout.')
    pem = key_path.read_text()
    # GitHub's PKCS1 and PKCS8 RSA PEM keys both become PKCS8 in memory.
    converted = run(['openssl', 'pkcs8', '-topk8', '-nocrypt'], pem, env)
    if not converted.startswith('-----BEGIN PRIVATE KEY-----'):
        raise ValueError('Expected an unencrypted RSA PEM private key.')
    values['GITHUB_APP_PRIVATE_KEY'] = converted
    values['SESSION_SECRET'] = secrets.token_urlsafe(48)
    # Create the named Worker first so secret bulk never needs an interactive
    # create-worker prompt on its JSON stdin. Without credentials login is denied.
    run(WRANGLER + ['deploy', '--env', 'staging'], env=env)
    # No argv secrets, persistent JSON files, shell history values or logged output.
    run(WRANGLER + ['secret', 'bulk', '--env', 'staging'], json.dumps(values), env)
    print('Encrypted staging credentials uploaded.')
    run(WRANGLER + ['deploy', '--env', 'staging'], env=env)
    print('Staging deployment command succeeded. Open ' + URL)
    print('Real login/upload verification is still required; see docs/staging.md.')


if __name__ == '__main__':
    try:
        main()
    except (Exception, KeyboardInterrupt):
        # Never print exception details, traceback, credential values or tool output.
        print('Setup stopped. Check authorization, IDs and local key format securely. '
              'No credentials were printed. Do not paste them into chat.', file=sys.stderr)
        sys.exit(1)
