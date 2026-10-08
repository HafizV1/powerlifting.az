"""Browser checks for the mobile-only V1 layout.
Serve the repository on port 8001; requires Python Playwright and system Chromium.
"""
from pathlib import Path
import hashlib
import json
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
BASELINE = json.loads((ROOT / 'tests/v1-baseline.json').read_text())
WIDTHS = [320, 375, 390, 430, 768]
PAGES = sorted(p.name for p in ROOT.glob('*.html') if p.name != 'idmanchilar.html')

def fits(page, width):
    assert page.evaluate('document.documentElement.scrollWidth') <= width

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page = browser.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    for width in WIDTHS:
        page.set_viewport_size({'width': width, 'height': 900})
        for name in PAGES:
            page.goto(f'http://127.0.0.1:8001/{name}')
            fits(page, width)
            if name == 'index.html':
                for selector, expected in [('.meta', '16px'), ('.newsbody small', '14px'), ('.fbrand small', '12px'), ('.flinks', '15px'), ('.copy', '14px')]:
                    assert page.locator(selector).first.evaluate('(e)=>getComputedStyle(e).fontSize') == expected
            if name == 'xeberler.html':
                assert page.locator('.news-date').evaluate('(e)=>getComputedStyle(e).fontSize') == '14px'
            toggle = page.locator('.mobile-menu-toggle')
            assert toggle.is_visible()
            assert not page.locator('.nav').is_visible()
            toggle.click()
            assert toggle.get_attribute('aria-expanded') == 'true'
            for button in page.locator('.mobile-submenu-toggle').all():
                button.click()
                assert button.get_attribute('aria-expanded') == 'true'
                target = button.get_attribute('aria-controls')
                assert page.locator('#' + target).is_visible()
            assert page.locator('.nav a').evaluate_all('(links)=>links.every(a=>a.getClientRects().length>0)')
            assert page.locator('.drop a').evaluate_all('(links)=>links.every(a=>a.getBoundingClientRect().height>=44)')
            fits(page, width)
            # The open menu traps focus, and Escape returns it to the opener.
            toggle.focus()
            page.keyboard.press('Shift+Tab')
            assert page.locator('.nav a').last.evaluate('(a)=>a===document.activeElement')
            page.keyboard.press('Tab')
            assert toggle.evaluate('(b)=>b===document.activeElement')
            page.keyboard.press('Escape')
            assert not page.locator('.nav').is_visible()
            assert toggle.get_attribute('aria-expanded') == 'false'
            assert toggle.evaluate('(b)=>b===document.activeElement')
            toggle.click()
            toggle.click()
            assert not page.locator('.nav').is_visible()

        page.goto('http://127.0.0.1:8001/idmancilar.html')
        athletes = page.evaluate('ATH')
        assert len(athletes) == 208
        digest = hashlib.sha256(json.dumps(athletes, ensure_ascii=False, sort_keys=True).encode()).hexdigest()
        assert digest == BASELINE['athlete_sha256']
        for athlete in athletes:
            page.locator('#aq').fill(athlete['name'])
            count = page.evaluate('ATH.filter(a=>a.name.toLocaleLowerCase("az").includes(document.querySelector("#aq").value.trim().toLocaleLowerCase("az"))).length')
            assert page.locator('.ath-row').count() == count
        page.locator('#aq').fill('')
        for index, athlete in enumerate(athletes):
            row = page.locator('.ath-row').nth(index)
            row.locator('.ath-btn').click()
            assert row.locator('tbody tr').count() == len(athlete['results'])
            row.locator('.ath-btn').click()
        page.locator('#ag').select_option('Qadınlar')
        assert page.locator('.ath-row').count() == sum(a['gender'] == 'Qadınlar' for a in athletes)
        page.locator('#ag').select_option('')
        page.locator('#as').select_option('Benç-press')
        assert page.locator('.ath-row').count() == sum('Benç-press' in a['sports'] for a in athletes)
        page.locator('#aq').fill('NO_MATCH_123')
        assert page.locator('.ath-empty').is_visible()
        fits(page, width)
        page.goto('http://127.0.0.1:8001/idmanchilar.html')
        page.wait_for_url('**/idmancilar.html')
        assert page.locator('.ath-row').count() == 208

        page.goto('http://127.0.0.1:8001/neticeler.html')
        assert page.locator('#tbody tr').count() > 0
        for sport in ['Pauerliftinq', 'Benç-press']:
            page.locator(f'[data-sport="{sport}"]').click()
            for control in ['year', 'competition', 'gender', 'age', 'wc']:
                values = page.locator(f'#{control} option').evaluate_all('(opts)=>opts.map(o=>o.value)')
                for value in values:
                    page.locator('#' + control).select_option(value)
                    assert page.locator('#tbody tr').count() > 0
                    fits(page, width)
                if values:
                    page.locator('#' + control).select_option(values[0])
            region = page.locator('.table-scroll')
            assert region.evaluate('(e)=>e.scrollWidth>e.clientWidth')
            region.evaluate('(e)=>e.scrollLeft=100')
            assert region.evaluate('(e)=>e.scrollLeft') > 0
        page.locator('#search').fill('NO_MATCH_123')
        assert page.locator('.empty-state').is_visible()

        for name, target in [('rekordlar.html', '#tbody'), ('rekord-standartlari.html', '#stdBody')]:
            page.goto('http://127.0.0.1:8001/' + name)
            for sport in ['Pauerliftinq', 'Benç-press']:
                page.locator(f'[data-sport="{sport}"]').click()
                for gender in ['Kişilər', 'Qadınlar']:
                    page.locator(f'[data-gender="{gender}"]').click()
                    assert page.locator(target + ' tr').count() > 0
                    if name == 'rekordlar.html':
                        for weight in page.locator('#weight option').evaluate_all('(opts)=>opts.map(o=>o.value)'):
                            page.locator('#weight').select_option(weight)
                            assert page.locator('#tbody tr').count() > 0
                    fits(page, width)
        page.goto('http://127.0.0.1:8001/dereceler.html')
        page.locator('.sport[data-v="Benç-press"]').click()
        page.locator('.gender[data-v="Qadınlar"]').click()
        assert page.locator('#body tr').count() == 9
        page.locator('#weightTab').click()
        page.locator('.wgender[data-v="Qadınlar"]').click()
        assert page.locator('#weightBody tr').count() == 9
        page.locator('#degreeTab').click()
        assert page.locator('#degreeSection').is_visible()
        fits(page, width)
        page.goto('http://127.0.0.1:8001/bolme.html')
        for target in ['rehberlik', 'fealiyyet', 'milli', 'haqqinda']:
            page.locator(f'.stab[data-target="{target}"]').click()
            assert page.locator('#' + target).is_visible()
        page.goto('http://127.0.0.1:8001/hakimlik.html')
        for target in ['beynelxalq', 'milli']:
            page.locator(f'.jtab[data-target="{target}"]').click()
            assert page.locator('#' + target).is_visible()
        print(f'PASS {width}px: all pages, menu keyboard/touch, 208 searches/results, filters and tables', flush=True)
    assert not errors, errors
    browser.close()
print('PASS: no JavaScript runtime errors')
