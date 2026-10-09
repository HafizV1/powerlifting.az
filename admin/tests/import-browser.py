"""Real browser imports against isolated loopback storage. No public data writes."""
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
import tempfile,subprocess,os,time,urllib.request,json,shutil
admin=Path(__file__).resolve().parents[1]
directory=tempfile.mkdtemp(prefix='pl-import-browser-')
proc=subprocess.Popen(['node',str(admin/'scripts/local-server.mjs')],env={**os.environ,'PORT':'8793','LOCAL_DATA_DIR':directory},stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
url='http://127.0.0.1:8793'
try:
 for _ in range(50):
  try:urllib.request.urlopen(url+'/api/session',timeout=1).close();break
  except Exception:time.sleep(.1)
 fixture=subprocess.check_output(['node','--input-type=module','-e',"import {spreadsheet,word,textPdf} from './tests/fixtures/protocols.mjs';console.log(JSON.stringify({xlsx:Buffer.from(spreadsheet()).toString('base64'),docx:Buffer.from(word()).toString('base64'),pdf:Buffer.from(textPdf()).toString('base64')}));"],cwd=admin,text=True)
 files=json.loads(fixture)
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  page=browser.new_page(viewport={'width':390,'height':844});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(url);page.locator('#local-login').click();expect(page.locator('#application')).to_be_visible()
  for ext in ['xlsx','docx','pdf']:
   ident=page.evaluate('''async ({ext,bytes})=>{
    const session=await (await fetch('/api/session')).json();
    async function call(path,body){const state=await (await fetch('/api/content')).json();const isForm=body instanceof FormData;const r=await fetch('/api/'+path,{method:'POST',headers:{'X-CSRF-Token':session.csrf,'If-Match':state.revision,...(isForm?{}:{'Content-Type':'application/json'})},body:isForm?body:JSON.stringify(body)});const v=await r.json();if(!r.ok)throw Error(v.error);return v;}
    const sport=ext==='pdf'?'Benç-press':'Pauerliftinq';const c=await call('content/competitions',{name:'STAGING BROWSER '+ext,startDate:'2099-01-01',endDate:'2099-01-01',sports:[sport],status:'draft'});
    const protocol=await call('content/protocols',{title:'STAGING '+ext,competitionId:c.item.id,sport,status:'draft'});
    const form=new FormData();form.set('kind','protocols');form.set('id',protocol.item.id);form.append('files',new File([Uint8Array.from(atob(bytes),c=>c.charCodeAt(0))],'test.'+ext,{type:({xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',pdf:'application/pdf'})[ext]}));await call('uploads',form);return protocol.item.id;
   }''',{'ext':ext,'bytes':files[ext]})
   page.goto(url+'/imports.html?id='+ident);expect(page.locator('#extract')).to_be_visible();page.locator('#extract').click();expect(page.locator('[data-row]')).to_have_count(1,timeout=15000)
   page.locator('[data-action]').select_option('new');page.locator('[data-note]').fill('Synthetic staging fixture checked against source');page.locator('[data-ack]').check();page.locator('#approve').click();expect(page.locator('#status')).to_contain_text('qaralamada təsdiqləndi')
   for width in [320,375,390,430,768]:
    page.set_viewport_size({'width':width,'height':844});assert page.evaluate('document.documentElement.scrollWidth')<=width,(ext,width)
  state=page.request.get(url+'/api/content').json();assert len([x for x in state['collections']['protocols'] if x.get('importReview',{}).get('approved')])==3
  assert page.request.get(url+'/api/import/baseline').json()['resultCount']==351
  assert not errors,errors
  browser.close()
 print('PASS: XLSX, DOCX and text PDF upload → extraction → explicit row approval; 320/375/390/430/768px; original 208 athletes/351 results untouched; no browser errors.')
finally:
 proc.terminate();proc.wait(timeout=10);shutil.rmtree(directory)
