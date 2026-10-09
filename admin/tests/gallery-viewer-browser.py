"""Focused acceptance test for the new gallery viewer; pass candidate base URL."""
import sys
from playwright.sync_api import sync_playwright
base=sys.argv[1].rstrip('/')+'/'
expected_count=int(sys.argv[2]) if len(sys.argv)>2 else 19
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    for width in (390,1440):
        page=browser.new_page(viewport={'width':width,'height':900})
        page.goto(base+'qalereya.html')
        page.wait_for_load_state('networkidle')
        first=page.locator('[data-gallery-photo]').first
        count=page.locator('[data-gallery-photo]').count()
        assert count==expected_count
        first.locator('img').click()
        dialog=page.locator('.pl-gallery-dialog')
        assert dialog.is_visible()
        assert page.locator('[data-gallery-count]').inner_text()==f'1 / {count}'
        image=dialog.locator('img')
        assert image.get_attribute('src')==first.evaluate('(x)=>x.href')
        assert image.evaluate('(x)=>x.complete && x.naturalWidth>0')
        page.locator('[data-gallery-next]').click()
        assert page.locator('[data-gallery-count]').inner_text()==f'2 / {count}'
        page.keyboard.press('ArrowLeft')
        assert page.locator('[data-gallery-count]').inner_text()==f'1 / {count}'
        page.keyboard.press('Escape')
        assert not dialog.is_visible()
        assert first.evaluate('(x)=>document.activeElement===x')
        page.keyboard.press('Enter')
        assert dialog.is_visible()
        page.locator('[data-gallery-close]').click()
        assert not dialog.is_visible()
        page.wait_for_function("document.body.style.overflow !== 'hidden'")
        assert not page.evaluate('document.documentElement.scrollWidth>innerWidth')
        print(f'{width}px: photo click, next/previous, Escape, keyboard open, close, focus return and no overflow passed')
        page.close()
    browser.close()
