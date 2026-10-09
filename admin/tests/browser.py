"""Safe browser workflows against the loopback-only local adapter, never GitHub."""
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from PIL import Image
import json, tempfile, os, subprocess, atexit, time, urllib.request, io
URL=os.environ.get('ADMIN_TEST_URL','http://127.0.0.1:8790')
if not os.environ.get('ADMIN_TEST_URL'):
 data_dir=tempfile.mkdtemp(prefix='pl-admin-ui-store-')
 process=subprocess.Popen(['node',str(Path(__file__).resolve().parents[1]/'scripts/local-server.mjs')],env={**os.environ,'PORT':'8790','LOCAL_DATA_DIR':data_dir},stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 atexit.register(process.terminate)
 for _ in range(50):
  try:
   urllib.request.urlopen(URL+'/api/session',timeout=1).close();break
  except Exception:time.sleep(.1)
assert URL.startswith('http://127.0.0.1:'), 'This test must never target a deployed panel'
fixture=Path(tempfile.mkdtemp(prefix='pl-admin-browser-fixtures-'))
photo=fixture/'test.png';Image.new('RGB',(2400,1200),'#0788ef').save(photo)
pdf=fixture/'test.pdf';pdf.write_bytes(b'%PDF-1.7\nTest fixture only\n%%EOF')
results=[]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1200,'height':900});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 assert page.request.get(URL+'/api/content').status==401
 page.goto(URL);page.locator('#local-login').click();expect(page.locator('#application')).to_be_visible()
 assert 'pl-admin' not in page.evaluate('document.cookie')
 def nav(label):page.locator('#navigation').get_by_role('button',name=label,exact=True).click()
 def create():page.locator('#new-item').click()
 def save():page.locator('#edit-form').get_by_role('button',name='Saxla',exact=True).click();expect(page.locator('#editor')).not_to_be_visible(timeout=15000)
 def row(text):return page.locator('.row').filter(has=page.get_by_role('heading',name=text,exact=True))
 title='Brauzer sınağı <img src=x onerror=alert(1)>'
 nav('Xəbərlər');create();page.get_by_label('Başlıq',exact=True).fill(title);page.get_by_label('Xəbərin mətni',exact=True).fill('Yalnız müvəqqəti sınaq məlumatı.\n\nİkinci abzas.');page.locator('input[name="files"]').set_input_files(str(photo));save()
 item=row(title);expect(item).to_be_visible();data=page.request.get(URL+'/api/content').json();news=next(n for n in data['collections']['news'] if n['title']==title)
 assert news['image'].endswith('.webp')
 raw=page.request.get(URL+'/api/assets',params={'path':news['image']}).body();assert len(raw)<photo.stat().st_size
 assert Image.open(io.BytesIO(raw)).size==(1600,800)
 item.get_by_role('button',name='Ön baxış',exact=True).click();expect(page.locator('#preview-body h3')).to_have_text(title);assert page.locator('#preview-body h3 img').count()==0;page.locator('#close-preview').click()
 item.get_by_role('button',name='Redaktə et').click();page.get_by_label('Başlıq',exact=True).fill('Brauzer sınağı — redaktə');save();item=row('Brauzer sınağı — redaktə')
 item.get_by_role('button',name='Yayıma hazırlaşdır').click();expect(item.locator('.badge')).to_have_text('Yayıma hazır')
 item.get_by_role('button',name='Yayımı dayandır').click();expect(item.locator('.badge')).to_have_text('Qaralama')
 page.locator('#search').fill('Brauzer sınağı');assert page.locator('.row').count()==1
 results.append('News create/edit, WebP resize/upload, escaped XSS text, preview, publish/unpublish and search')
 nav('Foto qalereya');create();page.get_by_label('Albomun adı').fill('Brauzer sınaq albomu');page.locator('input[name="files"]').set_input_files([str(photo),str(photo)]);save()
 album=row('Brauzer sınaq albomu');expect(album).to_contain_text('2 şəkil');album.get_by_role('button',name='Redaktə et').click();assert page.locator('.media-card').count()==2
 card=page.locator('.media-card').first;card.locator('[data-alt]').fill('Sınaq fotosu');card.locator('[data-caption]').fill('Sınaq izahı');card.locator('[data-photo-save]').click();expect(page.locator('.media-card').first.locator('[data-caption]')).to_have_value('Sınaq izahı')
 page.locator('.media-card').first.locator('[data-photo-delete]').click();page.locator('#confirm-delete').click();expect(page.locator('.media-card')).to_have_count(1);page.locator('#cancel-editor').click()
 results.append('Bulk optimized gallery upload, caption/alt editing, photo removal')
 nav('Nəticələr və protokollar');create();page.get_by_label('Protokolun adı').fill('Brauzer sınaq protokolu');page.get_by_label('Yarış',exact=True).select_option(index=1);page.get_by_label('İdman növü',exact=True).select_option('Benç-press');page.locator('input[name="files"]').set_input_files(str(pdf));page.get_by_label('Yayım statusu').select_option('published');save();protocol=row('Brauzer sınaq protokolu');expect(protocol.locator('.badge')).to_have_text('Yayıma hazır')
 protocol.get_by_role('button',name='Ön baxış').click();link=page.locator('#preview-body a');res=page.request.get(URL+link.get_attribute('href'));assert res.status==200 and res.headers['content-type']=='application/pdf';assert res.body()==pdf.read_bytes();page.locator('#close-preview').click()
 results.append('Competition-linked Bench Press protocol upload, readiness and exact PDF download')
 nav('Yarışlar');item=page.locator('.row').first;item.get_by_role('button',name='Redaktə et').click();original=page.get_by_label('Məkan',exact=True).input_value();page.get_by_label('Məkan',exact=True).fill('Yalnız yerli sınaq məkanı');save();expect(page.locator('.row')).to_have_count(3)
 nav('Azərbaycan rekordları');page.locator('#filter').select_option('Benç-press');assert page.locator('.row').count()==16
 page.locator('#search').fill('Qadınlar');assert page.locator('.row').count()==8
 page.locator('.row').first.get_by_role('button',name='Redaktə et').click();page.get_by_label('İdmançı',exact=True).fill('Yalnız sınaq adı');page.get_by_label('Rekord (kq)',exact=True).fill('100');page.get_by_label('Yarış',exact=True).fill('Yalnız sınaq yarışı');page.get_by_label('Rekord statusu').select_option('Müvəqqəti Rekord');save();expect(page.locator('.row').first).to_contain_text('Yalnız sınaq adı')
 results.append('Competition edit and records filters/edit, category preservation')
 for width in [320,375,390,430,768]:
  page.set_viewport_size({'width':width,'height':900})
  for label in ['İcmal','Xəbərlər','Yarışlar','Nəticələr və protokollar','Foto qalereya','Azərbaycan rekordları','Rekord sənədləri']:
   nav(label);assert page.evaluate('document.documentElement.scrollWidth')<=width,(width,label)
  nav('Xəbərlər');row('Brauzer sınağı — redaktə').get_by_role('button',name='Redaktə et').click();assert page.evaluate('document.documentElement.scrollWidth')<=width;page.locator('#cancel-editor').click()
 results.append('All admin sections/editor fit 320,375,390,430,768px')
 nav('Xəbərlər');row('Brauzer sınağı — redaktə').get_by_role('button',name='Sil',exact=True).click();page.locator('#confirm-delete').click();expect(row('Brauzer sınağı — redaktə')).to_have_count(0);page.locator('#search').fill('');expect(page.locator('.row')).to_have_count(1)
 page.locator('#logout').click();expect(page.locator('#login')).to_be_visible();assert page.request.get(URL+'/api/content').status==401
 results.append('Deletion confirmation and logout revoke browser access')
 assert not errors,errors
 browser.close()
print(json.dumps({'passed':results,'javascript_errors':errors},ensure_ascii=False,indent=2))
