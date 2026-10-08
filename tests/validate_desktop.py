"""Compare local V11 baseline (port 8003) against current site (port 8001)."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json
root=Path(__file__).resolve().parents[1]; names=sorted(p.name for p in root.glob('*.html') if p.name!='idmanchilar.html');report=[]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=b.new_page()
 for width in [1024,1440,1920]:
  page.set_viewport_size({'width':width,'height':1000})
  for name in names:
   shots=[]
   for port in [8003,8001]:
    page.goto(f'http://127.0.0.1:{port}/{name}');page.evaluate('document.fonts.ready');page.evaluate('Promise.all([...document.images].map(i=>i.decode().catch(()=>{})))');shots.append(page.screenshot(full_page=True,animations='disabled'))
   assert shots[0]==shots[1],(width,name)
   report.append({'width':width,'page':name,'identical':True})
  print('Desktop identical:',width,flush=True)
 Path('/tmp/desktop-mobile-redesign-validation.json').write_text(json.dumps(report,indent=2));b.close()
