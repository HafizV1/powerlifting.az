// Fixed viewer markup/script: user content is carried only in escaped anchor attributes.
export const galleryViewer = `<style>
.pl-gallery-photo{display:block;cursor:zoom-in}
.pl-gallery-dialog{width:100vw;max-width:none;height:100dvh;max-height:none;box-sizing:border-box;margin:0;padding:16px;border:0;background:#081b28;color:#fff}
.pl-gallery-dialog[open]{display:grid;grid-template-rows:auto minmax(0,1fr) auto;gap:12px}
.pl-gallery-dialog::backdrop{background:#081b28}
.pl-gallery-dialog .pl-gallery-bar{display:flex;justify-content:space-between;align-items:center;gap:12px}
.pl-gallery-dialog button{min-width:44px;min-height:44px;padding:8px 14px;background:transparent;color:inherit;border:1px solid #ffffff80;border-radius:8px;font:inherit;cursor:pointer}
.pl-gallery-dialog button:focus-visible{outline:3px solid #55b8ff;outline-offset:3px}
.pl-gallery-dialog .pl-gallery-full{width:100%;height:100%;min-height:0;object-fit:contain}
.pl-gallery-dialog .pl-gallery-controls{display:flex;justify-content:center;align-items:center;gap:16px}
</style>
<dialog class="pl-gallery-dialog" aria-label="Fotoşəklin böyük görünüşü"><div class="pl-gallery-bar"><span>Fotoqalereya</span><button type="button" data-gallery-close aria-label="Böyük görünüşü bağla">Bağla ✕</button></div><img class="pl-gallery-full" alt=""><div class="pl-gallery-controls"><button type="button" data-gallery-prev aria-label="Əvvəlki şəkil">←</button><span data-gallery-count aria-live="polite"></span><button type="button" data-gallery-next aria-label="Növbəti şəkil">→</button></div></dialog>
<script>(()=>{
const links=[...document.querySelectorAll('[data-gallery-photo]')],dialog=document.querySelector('.pl-gallery-dialog');
if(!dialog||typeof dialog.showModal!=='function')return;
const image=dialog.querySelector('img'),count=dialog.querySelector('[data-gallery-count]');let index=0,trigger,overflow;
function show(i){index=(i+links.length)%links.length;image.src=links[index].href;image.alt=links[index].querySelector('img').alt;count.textContent=(index+1)+' / '+links.length;}
links.forEach((link,i)=>link.addEventListener('click',e=>{if(e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;e.preventDefault();trigger=link;show(i);overflow=document.body.style.overflow;document.body.style.overflow='hidden';dialog.showModal();dialog.querySelector('[data-gallery-close]').focus();}));
dialog.querySelector('[data-gallery-close]').addEventListener('click',()=>dialog.close());
dialog.querySelector('[data-gallery-prev]').addEventListener('click',()=>show(index-1));
dialog.querySelector('[data-gallery-next]').addEventListener('click',()=>show(index+1));
dialog.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();show(index+(e.key==='ArrowLeft'?-1:1));}});
dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});
dialog.addEventListener('close',()=>{document.body.style.overflow=overflow;image.removeAttribute('src');trigger?.focus();});
})();</script>`;
