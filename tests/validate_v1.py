"""Run against the approved V1 site served locally on port 8001.
Requires Python playwright and Chromium at /usr/bin/chromium.
"""
from pathlib import Path
import json, hashlib
from playwright.sync_api import sync_playwright
baseline=json.loads((Path(__file__).parent/'v1-baseline.json').read_text())
report={'interactions':[]}
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 page=browser.new_page(); errors=[]; page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://127.0.0.1:8001/idmancilar.html')
 athletes=page.evaluate('ATH'); assert len(athletes)==208
 assert hashlib.sha256(json.dumps(athletes,ensure_ascii=False,sort_keys=True).encode()).hexdigest()==baseline['athlete_sha256']
 assert page.locator('.ath-row').count()==208
 for athlete in athletes:
  page.locator('#aq').fill(athlete['name'])
  expected=[a for a in athletes if athlete['name'].lower() in a['name'].lower()]
  assert page.locator('.ath-row').count()==len(expected)
 page.locator('#aq').fill(''); page.locator('#ag').select_option('Qadınlar')
 assert page.locator('.ath-row').count()==sum(a['gender']=='Qadınlar' for a in athletes)
 page.locator('#ag').select_option(''); page.locator('#as').select_option('Benç-press')
 assert page.locator('.ath-row').count()==sum('Benç-press' in a['sports'] for a in athletes)
 page.locator('#as').select_option(''); page.locator('.ath-btn').first.click(); assert 'open' in page.locator('.ath-row').first.get_attribute('class')
 page.locator('#aq').fill('NO_MATCH_TEST_123'); assert page.locator('.ath-empty').count()==1
 report['interactions'].append('All 208 profiles match source data exactly; all 208 name searches, gender/sport filters, results expansion and empty search passed')
 page.goto('http://127.0.0.1:8001/idmanchilar.html'); page.wait_for_url('**/idmancilar.html'); assert page.locator('.ath-row').count()==208
 report['interactions'].append('Legacy athlete-page redirect passed')
 page.goto('http://127.0.0.1:8001/bolme.html')
 for target in ['rehberlik','fealiyyet','milli','haqqinda']:
  page.locator(f'.stab[data-target="{target}"]').click(); assert page.locator(f'#{target}').is_visible()
 report['interactions'].append('All four department tabs passed')
 page.goto('http://127.0.0.1:8001/dereceler.html'); page.locator('.sport[data-v="Benç-press"]').click(); page.locator('.gender[data-v="Qadınlar"]').click(); assert page.locator('#body tr').count()==9
 page.locator('#weightTab').click(); page.locator('.wgender[data-v="Qadınlar"]').click(); assert page.locator('#weightBody tr').count()==9
 page.locator('#degreeTab').click(); assert page.locator('#degreeSection').is_visible()
 report['interactions'].append('Degree sport/gender filters and weight-category tabs passed')
 page.goto('http://127.0.0.1:8001/hakimlik.html')
 for target in ['beynelxalq','milli']:
  page.locator(f'.jtab[data-target="{target}"]').click()
 report['interactions'].append('Refereeing tab clicks passed')
 assert not errors,errors
 report['javascript_errors']=errors
 browser.close()
print(json.dumps(report,indent=2))
