export const KINDS=['news','competitions','protocols','albums','records','recordDocuments'];
export const SPORTS=['Pauerliftinq','Benç-press'];
export class Problem extends Error { constructor(status,message){super(message);this.status=status;} }
export const fail=(message,status=400)=>{throw new Problem(status,message);};
export function cleanId(id){if(!/^[a-z0-9-]{1,80}$/.test(id))fail('Məlumat identifikatoru etibarsızdır.');return id;}
const fields={
 news:['title','summary','body','date','dateText','image','status','eventName','eventDate','eventVenue','sourceUrl'],
 competitions:['name','startDate','endDate','dateText','venue','description','sports','image','status','sourceUrl','badge'],
 protocols:['title','competitionId','sport','description','status'],
 albums:['title','competitionId','description','status'],
 records:['sport','gender','wc','move','standard','athlete','record','event','status'],
 recordDocuments:['title','description','status']
};
function date(value){if(value&&!/^\d{4}-\d{2}-\d{2}$/.test(value))fail('Tarix YYYY-MM-DD formatında olmalıdır.');if(value&&(isNaN(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value))fail('Tarix düzgün deyil.');}
export function validate(kind,input,old={},collections={}) {
 if(!KINDS.includes(kind))fail('Bölmə tapılmadı.',404);
 if(!input||typeof input!=='object'||Array.isArray(input))fail('Məlumat obyekti tələb olunur.');
 const output={...old};
 for(const [name,value] of Object.entries(input)){
  if(!fields[kind].includes(name))fail('Naməlum və ya dəyişdirilə bilməyən sahə: '+name);
  if(name==='sports'){
   if(!Array.isArray(value)||!value.length||value.length>2||value.some(x=>!SPORTS.includes(x)))fail('İdman növünü seçin.');output[name]=[...new Set(value)];continue;
  }
  if(['standard','record'].includes(name)){
   if(value!==''&&(typeof value!=='number'||!Number.isFinite(value)||value<0||value>3000))fail('Rekord və standart müsbət rəqəm olmalıdır.');output[name]=value;continue;
  }
  if(typeof value!=='string'||value.length>(name==='body'?40000:4000))fail('Mətn etibarsızdır və ya çox uzundur.');
  output[name]=value.trim();
 }
 const title=kind==='competitions'?'name':'title';
 if(kind!=='records'&&(!output[title]||output[title].length>250))fail('Başlıq tələb olunur (ən çox 250 simvol).');
 for(const name of ['date','startDate','endDate'])if(name in output)date(output[name]);
 if(kind==='news'&&!output.body)fail('Xəbərin mətnini daxil edin.');
 if(kind==='competitions'){
  if(!output.startDate||!output.endDate)fail('Başlama və bitmə tarixlərini daxil edin.');
  if(old.startDate&&(output.startDate!==old.startDate||output.endDate!==old.endDate)&&output.dateText===old.dateText)output.dateText='';
  if(output.startDate>output.endDate)fail('Bitmə tarixi başlama tarixindən əvvəl ola bilməz.');
  if(!output.sports?.length)fail('İdman növünü seçin.');
 }
 for(const name of ['image','sourceUrl']){
  if(name in input&&output[name]&&output[name]!==old[name])fail('Şəkil və mənbə ünvanı yalnız təhlükəsiz fayl yükləməsi vasitəsilə dəyişdirilə bilər.');
 }
 if(['protocols','albums'].includes(kind)&&output.competitionId&&!collections.competitions?.some(x=>x.id===output.competitionId))fail('Yarış tapılmadı.');
 if(kind==='protocols'&&(!output.competitionId||!SPORTS.includes(output.sport)))fail('Yarış və idman növünü seçin.');
 if(kind==='records'){
  if(!SPORTS.includes(output.sport)||!['Kişilər','Qadınlar'].includes(output.gender)||!output.wc||!['Squat','Benç-press','Deadlift','Total'].includes(output.move))fail('Rekord kateqoriyasını düzgün seçin.');
  if(output.sport==='Benç-press'&&output.move!=='Benç-press')fail('Benç-press üçün hərəkət uyğun deyil.');
  if(typeof output.standard!=='number'||!Number.isFinite(output.standard))fail('Standart tələb olunur.');
  if(output.record!==''&&output.record!=null&&(!output.athlete||!output.event))fail('Rekord üçün idmançı və yarış məlumatını daxil edin.');
  if(collections.records?.some(x=>x.id!==old.id&&['sport','gender','wc','move'].every(k=>x[k]===output[k])))fail('Bu rekord kateqoriyası artıq mövcuddur.');
  if(!['Gözlənilir','Müvəqqəti Rekord','Rəsmi Rekord'].includes(output.status))fail('Rekord statusu düzgün deyil.');
 }else{
  output.status??='draft';if(!['draft','published'].includes(output.status))fail('Yayım statusu düzgün deyil.');
  if(['protocols','recordDocuments'].includes(kind)&&output.status==='published'&&!old.file)fail('Yayıma hazırlamaq üçün əvvəlcə sənəd yükləyin.');
 }
 if(kind==='albums')output.photos=old.photos||[];
 return output;
}
export function checkFile(file,kind){
 if(!file||typeof file.arrayBuffer!=='function'||!file.size)fail('Fayl seçin.');
 const image=['news','competitions','albums'].includes(kind);
 if(file.size>(image?3:10)*1024*1024)fail(image?'Şəkil ən çox 3 MB ola bilər.':'Sənəd ən çox 10 MB ola bilər.');
 const ext=file.name.split('.').pop().toLowerCase();
 const types=image?{webp:'image/webp',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg'}:{pdf:'application/pdf',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',xls:'application/vnd.ms-excel',csv:'text/csv',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'};
 if(!types[ext]||(file.type&&file.type!==types[ext]&&!(ext==='csv'&&file.type==='application/vnd.ms-excel')))fail('Fayl növü dəstəklənmir. SVG və HTML qəbul edilmir.');
 return {ext:ext==='jpeg'?'jpg':ext,mime:types[ext],image};
}
export function checkSignature(bytes,ext){
 const ascii=new TextDecoder('latin1').decode(bytes.slice(0,16));
 const valid=ext==='png'?bytes[0]===137&&ascii.slice(1,4)==='PNG':ext==='jpg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:ext==='webp'?ascii.startsWith('RIFF')&&ascii.slice(8,12)==='WEBP':ext==='pdf'?ascii.startsWith('%PDF-'):['xlsx','docx'].includes(ext)?bytes[0]===80&&bytes[1]===75&&bytes[2]===3&&bytes[3]===4:ext==='xls'?bytes.slice(0,8).every((b,i)=>b===[208,207,17,224,161,177,26,225][i]):ext==='csv'?!bytes.includes(0)&&!/^\s*</.test(new TextDecoder().decode(bytes)):false;
 if(!valid)fail('Fayl məzmunu onun növünə uyğun deyil.');
 if(ext==='csv'){try{new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{fail('CSV UTF-8 kodlaşdırmasında olmalıdır.');}}
}
