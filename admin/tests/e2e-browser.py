"""Actual UI runner + backend with controlled GitHub mock; NOT live OAuth proof."""
from pathlib import Path
import os, subprocess, tempfile, time, json
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory(prefix='pl-e2e-browser-') as tmp:
    key=Path(tmp)/'key.pem';cert=Path(tmp)/'cert.pem'
    subprocess.run(['openssl','req','-x509','-newkey','rsa:2048','-nodes','-keyout',str(key),'-out',str(cert),'-days','1','-subj','/CN=localhost'],check=True,capture_output=True)
    env=dict(os.environ,TEST_TLS_KEY=str(key),TEST_TLS_CERT=str(cert))
    log=open(Path(tmp)/'server.log','w+')
    server=subprocess.Popen(['node',str(root/'tests/e2e-browser-server.mjs')],env=env,stdout=log,stderr=log)
    try:
        time.sleep(2)
        if server.poll() is not None:
            log.seek(0);raise AssertionError(log.read())
        with sync_playwright() as p:
            browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
            context=browser.new_context(ignore_https_errors=True)
            page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
            page.goto('https://127.0.0.1:8792/__test-auth')
            page.locator('#start').click()
            page.wait_for_function("() => document.querySelector('#start').disabled===false",timeout=180000)
            status=page.locator('#status').inner_text()
            assert status.startswith('Bütün sınaqlar keçdi'),status+' '+page.locator('#results').inner_text()
            report=context.request.get('https://127.0.0.1:8792/__test-result').json()
            assert len(report['prs'])==1 and report['prs'][0]['state']=='closed',report
            assert 'Cleanup: COMPLETE' in report['prs'][0]['body'],report
            assert report['prs'][0]['body'].count(': PASS')==13,report
            assert not any(ref.startswith('v2/content-e2e-') for ref in report['refs']),report
            assert report['ordinary']=='seed' and report['main']=='production',report
            assert not errors,errors
            print(json.dumps({'controlled_ui_e2e':'PASS','workflow_steps':13,'cleanup':'PASS','ordinary_staging_and_main':'UNCHANGED','javascript_errors':errors}))
            browser.close()
    finally:
        server.terminate();server.wait(timeout=10)
