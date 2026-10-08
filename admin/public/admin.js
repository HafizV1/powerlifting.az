const labels={dashboard:'İcmal',news:'Xəbərlər',competitions:'Yarışlar',protocols:'Nəticələr və protokollar',albums:'Foto qalereya',records:'Azərbaycan rekordları',recordDocuments:'Rekord sənədləri'};
const sports=['Pauerliftinq','Benç-press'];
const $=selector=>document.querySelector(selector);
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let session,state,current='dashboard',editing=null,busy=false,pendingDelete=null,noticeTimer;
const searches={},filters={};
function notify(message){clearTimeout(noticeTimer);$('#notice').textContent=message;$('#notice').classList.add('visible');noticeTimer=setTimeout(()=>$('#notice').classList.remove('visible'),7000);}
function showLogin(){for(const d of document.querySelectorAll('dialog[open]'))d.close();$('#application').hidden=true;$('#login').hidden=false;state=null;}
async function api(path,options={}){
 const headers=new Headers(options.headers||{});
 if(options.method&&options.method!=='GET')headers.set('X-CSRF-Token',session?.csrf||'');
 if(options.body&&!(options.body instanceof FormData)){headers.set('Content-Type','application/json');options.body=JSON.stringify(options.body);}
 if(options.method&&options.method!=='GET'&&state)headers.set('If-Match',options.revision||state.revision);
 const response=await fetch('/api/'+path,{...options,headers,credentials:'same-origin'});
 const result=await response.json();if(!response.ok){if(response.status===401)showLogin();throw new Error(result.error||'Sorğu uğursuz oldu.');}return result;
}
async function run(operation){
 if(busy)return;busy=true;document.body.classList.add('busy');$('#application').setAttribute('aria-busy','true');
 const buttons=[...document.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);
 try{await operation();}catch(error){if($('#editor').open)$('#form-error').textContent=error.message;notify(error.message);}finally{busy=false;document.body.classList.remove('busy');$('#application').removeAttribute('aria-busy');buttons.forEach(b=>b.disabled=false);}
}
async function load(){state=await api('content');if(!state.local&&!state.renderingEnabled)$('#mode').textContent='Məzmun saxlanılır, lakin canlı səhifələr üçün ixrac hələ aktiv deyil. Dəyişikliklər ayrıca təsdiqlənməlidir.';render();}
async function loginState(){
 session=await api('session');$('#local-login').hidden=!session.local;$('#local-description').hidden=!session.local;
 if(!session.user){showLogin();return;}
 $('#login').hidden=true;$('#application').hidden=false;$('#user').textContent=session.user.login;
 $('#mode').textContent=session.local?'Yerli sınaq rejimi: dəyişikliklər yalnız bu kompüterdə saxlanılır. Canlı sayt dəyişmir.':'Dəyişikliklər ayrıca təsdiqlənməlidir. “Yayıma hazır” məzmun canlı sayta avtomatik yerləşdirilmir.';
 await load();
}
function navigate(kind){current=kind;render();}
function render(){
 $('#navigation').innerHTML=Object.entries(labels).map(([key,label])=>`<button data-nav="${key}" class="${current===key?'active':''}" ${current===key?'aria-current="page"':''}>${label}</button>`).join('');
 $('#navigation').querySelectorAll('[data-nav]').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.nav)));
 $('#page-title').textContent=labels[current];
 if(current==='dashboard'){
  $('#view').innerHTML=`<div class="stats">${Object.keys(labels).filter(k=>k!=='dashboard').map(k=>`<button class="stat quiet" data-open="${k}"><span><strong>${state.collections[k].length}</strong>${labels[k]}</span></button>`).join('')}</div><div class="card"><h2>Təhlükəsiz iş qaydası</h2><p>Məzmunu yaradın və ya redaktə edin, ön baxışını yoxlayın, sonra təsdiqə göndərin. Canlı sayt ayrıca təsdiq olmadan dəyişmir.</p><p>Mövcud 208 idmançının bazası qorunur və bu paneldən dəyişdirilmir.</p></div><div class="card"><h2>Mövcud nəticələr</h2><p>Pauerliftinq və Benç-press nəticələri qorunur. Yeni rəsmi protokolları müvafiq yarışa və idman növünə bağlayın.</p><a href="https://powerlifting.az/neticeler.html" target="_blank" rel="noopener noreferrer">Canlı nəticələrə bax</a></div>`;
  $('#view').querySelectorAll('[data-open]').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.open)));return;
 }
 $('#view').innerHTML=`<div class="toolbar"><input id="search" type="search" placeholder="Axtar..." aria-label="${escape(labels[current])} üzrə axtarış"><select id="filter" aria-label="Məzmun filtri">${current==='records'?'<option value="">Bütün idman növləri</option>'+sports.map(x=>`<option>${x}</option>`).join(''):'<option value="">Bütün statuslar</option><option value="draft">Qaralama</option><option value="published">Yayıma hazır</option>'}</select><button id="new-item">Əlavə et</button></div><div class="list" id="list"></div>`;
 $('#search').value=searches[current]||'';$('#filter').value=filters[current]||'';
 $('#new-item').addEventListener('click',()=>openEditor(null));$('#search').addEventListener('input',renderList);$('#filter').addEventListener('change',renderList);renderList();
}
function title(item){return item.title||item.name||`${item.sport} · ${item.gender} · ${item.wc} · ${item.move}`;}
function summary(item){if(current==='records')return `${item.athlete||'—'} · ${item.record===''?'Rekord gözlənilir':item.record+' kq'} · ${item.status}`;if(current==='albums')return `${item.photos.length} şəkil`;return item.dateText||item.startDate||item.date||item.file?.name||item.sport||'';}
function renderList(){
 searches[current]=$('#search').value;filters[current]=$('#filter').value;
 const query=$('#search').value.toLocaleLowerCase('az'),filter=$('#filter').value;
 const items=state.collections[current].filter(x=>JSON.stringify(x).toLocaleLowerCase('az').includes(query)&&(!filter||(current==='records'?x.sport:x.status)===filter));
 $('#list').innerHTML=items.length?items.map(item=>`<article class="row" data-id="${escape(item.id)}"><div><h3>${escape(title(item))}</h3><p>${escape(summary(item))}</p>${current!=='records'?`<span class="badge">${item.status==='published'?'Yayıma hazır':'Qaralama'}</span>`:''}</div><div class="row-actions"><button class="quiet" data-action="preview">Ön baxış</button><button data-action="edit">Redaktə et</button>${current!=='records'?`<button class="quiet" data-action="publish">${item.status==='published'?'Yayımı dayandır':'Yayıma hazırlaşdır'}</button>`:''}${current!=='records'?'<button class="quiet" data-action="delete">Sil</button>':''}</div></article>`).join(''):'<div class="empty">Bu seçim üzrə məlumat yoxdur.</div>';
 $('#list').querySelectorAll('[data-action]').forEach(button=>button.addEventListener('click',()=>{
  const item=state.collections[current].find(x=>x.id===button.closest('[data-id]').dataset.id);
  if(button.dataset.action==='edit')openEditor(item);
  if(button.dataset.action==='preview')preview(item);
  if(button.dataset.action==='delete')confirmDelete(async()=>{await api(`content/${current}/${item.id}`,{method:'DELETE'});await load();notify('Məlumat silindi.');});
  if(button.dataset.action==='publish')run(async()=>{await api(`content/${current}/${item.id}`,{method:'PATCH',body:{status:item.status==='published'?'draft':'published'}});await load();notify('Yayım statusu saxlanıldı. Canlı sayt avtomatik dəyişmir.');});
 }));
}
const configs={
 news:[['title','Başlıq','text',true],['summary','Qısa məzmun','textarea'],['body','Xəbərin mətni','textarea',true],['date','Tarix (məlumdursa)','date'],['dateText','Tarixin görünən yazısı','text'],['eventName','Əlaqəli yarışın adı','text'],['eventDate','Yarışın tarixi','text'],['eventVenue','Yarışın məkanı','text']],
 competitions:[['name','Yarışın adı','text',true],['startDate','Başlama tarixi','date',true],['endDate','Bitmə tarixi','date',true],['dateText','Tarixin görünən yazısı (istəyə bağlı)','text'],['venue','Məkan','text'],['description','Təsvir','textarea'],['sports','İdman növləri','sports'],['badge','Yarışın görünən status yazısı','text']],
 protocols:[['title','Protokolun adı','text',true],['competitionId','Yarış','competition',true],['sport','İdman növü','sport',true],['description','Təsvir','textarea']],
 albums:[['title','Albomun adı','text',true],['competitionId','Yarış (istəyə bağlı)','competition'],['description','Təsvir','textarea']],
 records:[['sport','İdman növü','sport',true],['gender','Cins','gender',true],['wc','Çəki dərəcəsi','text',true],['move','Hərəkət','move',true],['standard','Standart (kq)','number',true],['athlete','İdmançı','text'],['record','Rekord (kq)','number'],['event','Yarış','text'],['status','Rekord statusu','recordStatus',true]],
 recordDocuments:[['title','Sənədin adı','text',true],['description','Təsvir','textarea']]
};
function field([name,label,type,required],item){
 const value=item?.[name]??'';let control;
 if(type==='textarea')control=`<textarea name="${name}" ${required?'required':''} maxlength="${name==='body'?40000:4000}">${escape(value)}</textarea>`;
 else if(type==='sports')control=`<div class="checkboxes">${sports.map(s=>`<label><input type="checkbox" name="sports" value="${s}" ${item?.sports?.includes(s)?'checked':''}>${s}</label>`).join('')}</div>`;
 else if(['competition','sport','gender','move','recordStatus'].includes(type)){
  const choices=type==='competition'?state.collections.competitions.map(x=>[x.id,x.name]):(type==='sport'?sports:type==='gender'?['Kişilər','Qadınlar']:type==='move'?['Squat','Benç-press','Deadlift','Total']:['Gözlənilir','Müvəqqəti Rekord','Rəsmi Rekord']).map(x=>[x,x]);
  control=`<select name="${name}" ${required?'required':''}>${type==='competition'?'<option value="">Seçin</option>':''}${choices.map(([key,label])=>`<option value="${escape(key)}" ${key===value?'selected':''}>${escape(label)}</option>`).join('')}</select>`;
 }else control=`<input name="${name}" type="${type}" value="${escape(value)}" ${required?'required':''} ${type==='number'?'min="0" max="3000" step="0.01"':'maxlength="4000"'}>`;
 const id=`field-${name}`;
 control=control.replace(/^(<(?:input|textarea|select))/, `$1 id="${id}"`);
 return `<div class="${type==='textarea'?'wide':''}"><label ${type!=='sports'?`for="${id}"`:''}>${label}</label>${control}</div>`;
}
function openEditor(item){
 editing={item:structuredClone(item),kind:current,revision:state.revision};$('#form-error').textContent='';$('#edit-title').textContent=item?'Redaktə et':'Yeni məlumat';
 $('#fields').innerHTML=`<div class="field-grid">${configs[current].map(f=>field(f,item)).join('')}</div>${current!=='records'?`<label>Yayım statusu<select name="status"><option value="draft" ${item?.status!=='published'?'selected':''}>Qaralama</option><option value="published" ${item?.status==='published'?'selected':''}>Yayıma hazır</option></select></label>`:''}${['news','competitions','albums','protocols','recordDocuments'].includes(current)?`<label>${current==='albums'?'Şəkillər (bir dəfəyə ən çox 20)':['news','competitions'].includes(current)?'Şəkil':'Sənəd'}<input name="files" type="file" ${current==='albums'?'multiple':''} accept="${['news','competitions','albums'].includes(current)?'image/jpeg,image/png,image/webp':'.pdf,.xlsx,.xls,.csv,.docx'}"><small>${['news','competitions','albums'].includes(current)?'Şəkillər avtomatik kiçildilir və veb üçün optimallaşdırılır.':'PDF, Excel, UTF-8 CSV və Word; hər sənəd ən çox 10 MB.'}</small></label>`:''}`;
 renderMedia(item);$('#editor').showModal();
}
function assetUrl(path){return '/api/assets?path='+encodeURIComponent(path);}
function renderMedia(item){
 const kind=editing.kind;
 if(item?.photos){
  $('#current-media').innerHTML=`<div class="media-grid">${item.photos.map(photo=>`<div class="media-card" data-photo="${photo.id}"><img src="${assetUrl(photo.path)}" alt="${escape(photo.alt)}"><label>Alternativ mətn<input data-alt value="${escape(photo.alt)}" maxlength="1000"></label><label>Şəklin izahı<input data-caption value="${escape(photo.caption)}" maxlength="1000"></label><button type="button" data-photo-save>Saxla</button><button type="button" class="quiet" data-photo-delete>Şəkli sil</button></div>`).join('')}</div>`;
  $('#current-media').querySelectorAll('[data-photo-save]').forEach(button=>button.addEventListener('click',()=>run(async()=>{
   const card=button.closest('[data-photo]');const result=await api(`content/albums/${item.id}/photos/${card.dataset.photo}`,{method:'PATCH',body:{alt:card.querySelector('[data-alt]').value,caption:card.querySelector('[data-caption]').value},revision:editing.revision});editing.revision=result.revision;await load();renderMedia(state.collections.albums.find(x=>x.id===item.id));notify('Şəkil məlumatı saxlanıldı.');
  })));
  $('#current-media').querySelectorAll('[data-photo-delete]').forEach(button=>button.addEventListener('click',()=>confirmDelete(async()=>{
   const result=await api(`content/albums/${item.id}/photos/${button.closest('[data-photo]').dataset.photo}`,{method:'DELETE',revision:editing.revision});editing.revision=result.revision;await load();renderMedia(state.collections.albums.find(x=>x.id===item.id));notify('Şəkil silindi.');
  })));
 }else if(item?.image)$('#current-media').innerHTML=`<p class="help">Mövcud şəkil yeni fayl yükləndikdə əvəzlənir.</p><img src="${assetUrl(item.image)}" alt="Mövcud şəkil" width="160">`;
 else if(item?.file)$('#current-media').innerHTML=`<p>Mövcud sənəd: <a href="${assetUrl(item.file.path)}" target="_blank" rel="noopener noreferrer">${escape(item.file.name)}</a></p>`;
 else $('#current-media').textContent='';
}
async function optimize(file){
 if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>12*1024*1024)throw new Error('JPEG, PNG və ya WebP şəkli seçin (ən çox 12 MB).');
 const bitmap=await createImageBitmap(file);if(bitmap.width*bitmap.height>25000000){bitmap.close();throw new Error('Şəklin ölçüsü çox böyükdür (ən çox 25 milyon piksel).');}
 const ratio=Math.min(1,1600/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*ratio);canvas.height=Math.round(bitmap.height*ratio);canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
 const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',.82));if(!blob||blob.type!=='image/webp')throw new Error('Bu brauzer WebP optimallaşdırmasını dəstəkləmir.');
 return new File([blob],file.name.replace(/\.[^.]+$/,'')+'.webp',{type:'image/webp'});
}
$('#edit-form').addEventListener('submit',event=>{
 event.preventDefault();run(async()=>{
  $('#form-error').textContent='';const form=new FormData(event.currentTarget),kind=editing.kind,body={};
  for(const [name,,type] of configs[kind])body[name]=type==='sports'?form.getAll(name):type==='number'?(form.get(name)===''?'':Number(form.get(name))):String(form.get(name)||'');
  if(kind!=='records')body.status=String(form.get('status'));
  if(kind==='competitions'&&editing.item&&(body.startDate!==editing.item.startDate||body.endDate!==editing.item.endDate)&&body.dateText===editing.item.dateText)body.dateText='';
  const files=form.getAll('files').filter(f=>f.size);if(files.length>20)throw new Error('Bir dəfəyə ən çox 20 şəkil seçin.');
  const prepared=[];for(const file of files){notify('Fayllar hazırlanır...');prepared.push(['news','competitions','albums'].includes(kind)?await optimize(file):file);}
  // Document records are initially drafts until a verified attachment exists.
  const requestedStatus=body.status;
  if(['protocols','recordDocuments'].includes(kind)&&prepared.length)body.status='draft';
  const result=await api('content/'+kind+(editing.item?'/'+editing.item.id:''),{method:editing.item?'PATCH':'POST',body,revision:editing.revision});
  editing.item=result.item;editing.revision=result.revision;state.revision=result.revision;
  if(prepared.length){
   const uploads=new FormData();uploads.set('kind',kind);uploads.set('id',result.item.id);for(const file of prepared)uploads.append('files',file);
   let uploaded;
   try{notify('Fayllar yüklənir...');uploaded=await api('uploads',{method:'POST',body:uploads,revision:result.revision});}catch(error){await load();renderMedia(state.collections[kind].find(x=>x.id===result.item.id));throw new Error('Mətn saxlanıldı, lakin fayl yüklənmədi: '+error.message);}
   editing.revision=uploaded.revision;state.revision=uploaded.revision;
   if(['protocols','recordDocuments'].includes(kind)&&requestedStatus==='published')await api(`content/${kind}/${result.item.id}`,{method:'PATCH',body:{status:requestedStatus},revision:uploaded.revision});
  }
  $('#editor').close();editing=null;await load();notify('Saxlanıldı. Dəyişikliklər təsdiqdən sonra yayına verilə bilər.');
 });
});
function confirmDelete(operation){pendingDelete=operation;$('#confirmation').showModal();}
$('#confirm-delete').addEventListener('click',()=>run(async()=>{const action=pendingDelete;$('#confirmation').close();pendingDelete=null;await action();}));
$('#cancel-delete').addEventListener('click',()=>{$('#confirmation').close();pendingDelete=null;});
for(const id of ['close-editor','cancel-editor'])$('#'+id).addEventListener('click',()=>{$('#editor').close();editing=null;});
function preview(item){
 const body=$('#preview-body');body.replaceChildren();
 const heading=document.createElement('h3');heading.textContent=title(item);body.append(heading);
 const detail=document.createElement('p');detail.textContent=item.body||item.description||summary(item);body.append(detail);
 for(const path of [item.image,...(item.photos||[]).map(x=>x.path)].filter(Boolean)){const img=document.createElement('img');img.src=assetUrl(path);img.alt=item.title||item.name||'';body.append(img);}
 if(item.file){const a=document.createElement('a');a.href=assetUrl(item.file.path);a.textContent=item.file.name;a.target='_blank';a.rel='noopener noreferrer';body.append(a);}
 $('#preview').showModal();
}
$('#close-preview').addEventListener('click',()=>$('#preview').close());
$('#local-login').addEventListener('click',()=>run(async()=>{await api('auth/local',{method:'POST'});await loginState();}));
$('#logout').addEventListener('click',()=>run(async()=>{await api('auth/logout',{method:'POST'});session=null;showLogin();}));
$('#refresh').addEventListener('click',()=>run(async()=>{await load();notify('Məlumat yeniləndi.');}));
$('#review').addEventListener('click',()=>run(async()=>{
 const result=await api('review',{method:'POST'});
 if(!result.url){notify(session.local?'Yerli sınaqda GitHub təsdiq sorğusu yaradılmır.':'Əvvəlcə məzmun dəyişikliyi saxlayın.');return;}
 const url=new URL(result.url);if(url.origin!=='https://github.com')throw new Error('Təsdiq ünvanı etibarsızdır.');
 const box=$('#mode');box.textContent='Dəyişikliklər təsdiqə göndərildi: ';const link=document.createElement('a');link.href=url.href;link.textContent='Təsdiq sorğusuna bax';link.target='_blank';link.rel='noopener noreferrer';link.className='review-link';box.append(link);
}));
run(loginState);
