"""One-time import of approved source content. Never modifies V1 HTML."""
from pathlib import Path
import json,re,hashlib
from html.parser import HTMLParser
ROOT=Path(__file__).resolve().parents[2]
class Text(HTMLParser):
 def __init__(self):super().__init__();self.parts=[]
 def handle_data(self,s):self.parts.append(s)
def text(s):
 p=Text();p.feed(s);return ''.join(p.parts).strip()
def write(kind,items):
 p=ROOT/'content/v2'/f'{kind}.json'
 if p.exists():raise RuntimeError('Refusing to overwrite existing managed content: '+str(p))
 p.write_text(json.dumps(items,ensure_ascii=False,indent=2)+'\n')
records=json.loads(re.search(r'const RECORDS=(\[.*?\]);', (ROOT/'rekordlar.html').read_text(),re.S)[1])
for r in records:r['id']='record-'+hashlib.sha256(json.dumps([r['sport'],r['gender'],r['wc'],r['move']],ensure_ascii=False).encode()).hexdigest()[:12]
write('records',records)
s=(ROOT/'xeberler.html').read_text();main=re.search(r'<main.*?</main>',s,re.S)[0]
write('news',[{'id':'news-epf-2026','title':text(re.search(r'<h2>(.*?)</h2>',main,re.S)[1]),'summary':'','body':text(re.search(r'<p>(.*?)</p>',main,re.S)[1]),'date':'','dateText':text(re.search(r'class="news-date">(.*?)</div>',main,re.S)[1]),'image':re.search(r'<img src="([^"]+)"',main)[1],'status':'published','eventName':'Yeniyetmələr və gənclər üzrə klassik pauerliftinq Avropa Çempionatı','eventDate':'3–13 dekabr 2026','eventVenue':'Kranjska Gora, Sloveniya','sourceUrl':'xeberler.html'}])
s=(ROOT/'yarislar.html').read_text();cards=re.findall(r'<article class="race-card">(.*?)</article>',s,re.S)
rows=[]
for c,dates in zip(cards,[('2026-09-12','2026-09-13'),('2026-02-28','2026-03-01'),('2025-09-06','2025-09-07')]):
 name=text(re.search(r'<h3>(.*?)</h3>',c,re.S)[1]);url=re.search(r'href="([^"]+)"[^>]*>Yarış haqqında',c)[1];detail=(ROOT/url).read_text();venue=re.search(r'<strong>Məkan: </strong>(.*?)</p>',detail,re.S)
 spans=re.findall(r'<span>(.*?)</span>',c,re.S)
 rows.append({'id':url[:-5],'name':name,'startDate':dates[0],'endDate':dates[1],'dateText':text(spans[0]).removeprefix('▣ ').strip(),'venue':text(next((x for x in spans if '●' in x), '')).removeprefix('● ').strip() or text(venue[1]) if venue else '', 'description':text(re.findall(r'<p>(.*?)</p>',detail,re.S)[-1]),'sports':['Pauerliftinq','Benç-press'] if 'Benç-press' in name else ['Pauerliftinq'],'image':re.search(r'<img[^>]*src="([^"]+)"',c)[1],'status':'published','sourceUrl':url,'badge':'KEÇİRİLİB'})
write('competitions',rows)
for kind in ['protocols','albums','recordDocuments']:write(kind,[])
print('Imported existing source only:',len(records),'records, 3 competitions, 1 news item; no results or athlete data changed')
