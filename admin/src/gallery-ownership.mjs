import {cleanId,fail} from './validation.mjs';
export const galleryPath=id=>'fotoqalereya-'+cleanId(id)+'.html';
// Fail closed: an album has one immutable competition; assets belong to that album.
export function assertGalleryOwnership(collections){
 const seen=new Set(),ids=new Set();
 for(const a of collections.albums||[]){
  cleanId(a.id);cleanId(a.competitionId);
  if(ids.has(a.id)||!collections.competitions?.some(c=>c.id===a.competitionId))fail('Fotoqalereyanın yarış əlaqəsi etibarsızdır.');
  ids.add(a.id);
  for(const p of a.photos||[]){
   if(!p.path?.startsWith('assets/uploads/albums/'+a.id+'/')||!/^assets\/uploads\/albums\/[a-z0-9-]+\/[a-z0-9-]+\.(jpg|png|webp)$/.test(p.path)||seen.has(p.path))fail('Şəkil başqa alboma aid ola bilməz və ya təkrarlanır.');
   seen.add(p.path);
  }
 }
}
