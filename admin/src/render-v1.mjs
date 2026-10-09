import {galleryViewer} from './gallery-viewer.mjs';
// Explicit review/export adapter. Never writes the repository or deploys anything.
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const published=items=>items.filter(x=>x.status==='published');
const paragraphs=text=>String(text||'').split(/\n\s*\n/).filter(Boolean).map(p=>'<p>'+esc(p).replaceAll('\n','<br>')+'</p>').join('');
const date=competition=>competition.dateText||`${competition.startDate} – ${competition.endDate}`;
const docs=items=>items.filter(x=>x.file).map(x=>`<p><a href="${esc(x.file.path)}" download>${esc(x.title)}</a>${x.description?' — '+esc(x.description):''}</p>`).join('');
function replaceMain(source,html){if(!/<main\b[^>]*>[\s\S]*?<\/main>/.test(source))throw new Error('Source main not found');return source.replace(/<main\b[^>]*>[\s\S]*?<\/main>/,()=>html);}
export function renderV1(base,collections){
 const outputs={};
 const news=published(collections.news).map(x=>`<article class="news-card">${x.image?`<div class="news-image"><img src="${esc(x.image)}" alt="${esc(x.title)}"></div>`:''}<div class="news-copy"><div class="news-date">${esc(x.dateText||x.date)}</div><h2>${esc(x.title)}</h2>${x.summary?'<p>'+esc(x.summary)+'</p>':''}${paragraphs(x.body)}${x.eventName||x.eventDate||x.eventVenue?`<div class="event-meta">${[['Yarış',x.eventName],['Tarix',x.eventDate],['Yer',x.eventVenue]].filter(([,v])=>v).map(([k,v])=>`<div><b>${k}:</b> ${esc(v)}</div>`).join('')}</div>`:''}</div></article>`).join('');
 outputs['xeberler.html']=replaceMain(base['xeberler.html'],`<main class="news-main"><div class="wrap">${news}</div></main>`);
 const competitions=published(collections.competitions).map(x=>`<article class="race-card">${x.image?`<div class="race-poster"><img src="${esc(x.image)}" alt="${esc(x.name)}"></div>`:''}<div class="race-info"><div class="race-top"><h3>${esc(x.name)}</h3>${x.badge?`<span class="badge">${esc(x.badge)}</span>`:''}</div><div class="rmeta"><span>▣ ${esc(date(x))}</span>${x.venue?'<span>● '+esc(x.venue)+'</span>':''}<span>🏆 ${x.sports.map(esc).join(' · ')}</span></div><div class="race-actions"><a class="primary" href="neticeler.html">Nəticələr və protokollar →</a><a class="secondary" href="${esc(x.sourceUrl||'yaris-'+x.id+'.html')}">Yarış haqqında</a></div></div></article>`).join('');
 const toolbar=base['yarislar.html'].match(/<div class="race-toolbar">[\s\S]*?<\/div><\/div>/)?.[0]||'';
 outputs['yarislar.html']=replaceMain(base['yarislar.html'],`<main class="content"><div class="wrap">${toolbar}<div class="race-list">${competitions}</div></div></main>`);
 const records=collections.records.map(({id,...row})=>row);
 if(!/const RECORDS=\[[\s\S]*?\];/.test(base['rekordlar.html']))throw new Error('Records source not found');
 outputs['rekordlar.html']=base['rekordlar.html'].replace(/const RECORDS=\[[\s\S]*?\];/,()=>`const RECORDS=${JSON.stringify(records).replaceAll('<','\\u003c')};`);
 const protocols=published(collections.protocols);
 const sections=['Pauerliftinq','Benç-press'].map(s=>{const items=protocols.filter(x=>x.sport===s);return items.length?`<section class="wrap"><h2>${s} — protokollar</h2>${docs(items)}</section>`:'';}).join('');
 outputs['neticeler.html']=base['neticeler.html'].replace(/(<main\b[^>]*>)/,match=>match+sections);
 const recordDocs=docs(published(collections.recordDocuments));
 if(recordDocs)outputs['rekord-qaydalari.html']=base['rekord-qaydalari.html'].replace('</main>',`<section class="wrap"><h2>Rekord sənədləri</h2>${recordDocs}</section></main>`);
 const albums=published(collections.albums);
 const gallery=albums.map(x=>`<section><h2>${esc(x.title)}</h2>${paragraphs(x.description)}<div class="cards">${x.photos.map(p=>`<figure class="card"><a class="pl-gallery-photo" data-gallery-photo href="${esc(p.path)}" aria-label="${esc(p.alt || 'Fotoşəkli böyüt')}" aria-haspopup="dialog"><img src="${esc(p.path)}" alt="${esc(p.alt)}" width="100%"></a><figcaption>${esc(p.caption)}</figcaption></figure>`).join('')}</div></section>`).join('');
 outputs['qalereya.html']=replaceMain(base['xeberler.html'],`<main class="content"><div class="wrap">${gallery}</div></main>${galleryViewer}`).replace(/<title>.*?<\/title>/,'<title>Foto qalereya | Azərbaycan Pauerliftinq Bölməsi</title>');
 for(const x of published(collections.competitions)){
  const album=albums.filter(a=>a.competitionId===x.id);
  const files=docs(protocols.filter(p=>p.competitionId===x.id));
  const html=`<main class="content"><div class="wrap"><h1>${esc(x.name)}</h1><p><strong>Tarix: </strong>${esc(date(x))}</p><p><strong>Məkan: </strong>${esc(x.venue)}</p><p><strong>İdman növü: </strong>${x.sports.map(esc).join(' · ')}</p>${x.image?`<img src="${esc(x.image)}" alt="${esc(x.name)}" style="max-width:420px;width:100%;height:auto;border-radius:8px">`:''}${paragraphs(x.description)}${files}${album.length?'<p><a href="qalereya.html">Foto qalereya</a></p>':''}<a href="neticeler.html">Nəticələr və protokollar →</a></div></main>`;
  const filename=x.sourceUrl||'yaris-'+x.id+'.html';
  outputs[filename]=replaceMain(base[filename]||base['cempionat-2026-haqqinda.html'],html);
 }
 return outputs;
}
