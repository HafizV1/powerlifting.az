"""Maintainer-only asset optimization. Uses approved repository photos and original icons."""
from pathlib import Path
import base64,json
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'assets/images/hero-cards'
PHOTOS={
 'calendar':('c3b53921a1e0f402e7569f81866f7425296efacd598581ea65bc502dbcee244c.jpg',.44),
 'results':('dd4884ea2a2c17cfdaf2aa79a650a25d471fe640944525edc3743f249245c651.jpg',.55),
 'records':('965cbf5fb212eacc5132b7392c9c41e649fd2b11a32b8bf7b0eb0b8707110ff5.jpg',.40),
 'qualification':('65faf1bfee4528866e2d4be3feba0979279f72104958bb154aeea0220d6a538f.jpg',.54),
}
def uri(path):return 'data:image/'+('png' if path.suffix=='.png' else 'jpeg')+';base64,'+base64.b64encode(path.read_bytes()).decode()
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=browser.new_page()
 for name,(filename,focus) in PHOTOS.items():
  data=page.evaluate('''async({src,focus})=>{const im=new Image();im.src=src;await im.decode();const c=document.createElement('canvas');c.width=860;c.height=386;const h=im.width*386/860;const y=Math.max(0,Math.min(im.height-h,focus*im.height-h/2));c.getContext('2d').drawImage(im,0,y,im.width,h,0,0,860,386);return c.toDataURL('image/webp',.85).split(',')[1]}''',{'src':uri(ROOT/'assets/uploads/albums/kubok-2026-photos'/filename),'focus':focus})
  (OUT/(name+'.webp')).write_bytes(base64.b64decode(data))
 original=uri(ROOT/'assets/images/2713846ed7f61cbbf5ef.png')
 data=page.evaluate('''async(src)=>{const im=new Image();im.src=src;await im.decode();const c=document.createElement('canvas');c.width=1774;c.height=232;const x=c.getContext('2d');x.drawImage(im,0,0);x.fillStyle='#031724';for(const [left,w] of [[47,412],[469,412],[890,414],[1313,414]])x.fillRect(left,26,w,185);return c.toDataURL().split(',')[1]}''',original)
 (OUT/'strip.png').write_bytes(base64.b64decode(data))
 data=page.evaluate('''async(src)=>{const im=new Image();im.src=src;await im.decode();const c=document.createElement('canvas');c.width=176;c.height=44;const x=c.getContext('2d');[72,494,915,1338].forEach((left,i)=>x.drawImage(im,left,40,44,44,i*44,0,44,44));const d=x.getImageData(0,0,c.width,c.height);for(let i=0;i<d.data.length;i+=4){const [r,g,b]=d.data.slice(i,i+3);if(!(r>g&&r>b))d.data[i+3]=0;}x.putImageData(d,0,0);return c.toDataURL().split(',')[1]}''',original)
 (OUT/'icons.png').write_bytes(base64.b64decode(data))
 data=page.evaluate('''async(src)=>{const im=new Image();im.src=src;await im.decode();const c=document.createElement('canvas');c.width=32;c.height=32;const x=c.getContext('2d');x.drawImage(im,71,170,32,32,0,0,32,32);const d=x.getImageData(0,0,32,32);for(let i=0;i<d.data.length;i+=4){if(Math.max(...d.data.slice(i,i+3))<85)d.data[i+3]=0;}x.putImageData(d,0,0);return c.toDataURL().split(',')[1]}''',original)
 (OUT/'arrow.png').write_bytes(base64.b64decode(data))
 browser.close()
print(json.dumps({p.name:p.stat().st_size for p in OUT.iterdir() if p.suffix in ['.png','.webp']}))
