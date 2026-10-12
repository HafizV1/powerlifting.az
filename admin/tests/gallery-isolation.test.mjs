import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {renderV1} from '../src/render-v1.mjs';import {validate,KINDS} from '../src/validation.mjs';import {assertGalleryOwnership,galleryPath} from '../src/gallery-ownership.mjs';import {prepareRelease} from '../src/release.mjs';
const root=new URL('../../',import.meta.url);const base=Object.fromEntries(fs.readdirSync(root).filter(n=>n.endsWith('.html')).map(n=>[n,fs.readFileSync(new URL(n,root),'utf8')]));const collections=Object.fromEntries(KINDS.map(k=>[k,JSON.parse(fs.readFileSync(new URL('content/v2/'+k+'.json',root)))]));
test('2025 and 2026 pages contain exactly their original photo assignments and viewers',()=>{
 const out=renderV1(base,collections);assert.equal((out['qalereya.html'].match(/data-gallery-photo/g)||[]).length,0);
 for(const a of collections.albums){const html=out[galleryPath(a.competitionId)];for(const p of a.photos)assert.ok(html.includes(p.path));for(const other of collections.albums.filter(b=>b.competitionId!==a.competitionId))for(const p of other.photos)assert.ok(!html.includes(p.path));assert.ok(html.includes('loading="lazy"'));assert.ok(!out[a.competitionId+'.html'].includes('Fotoqalereya →'));}
});
test('missing competition, reassignment, foreign assets and duplicate photos fail closed',()=>{
 assert.throws(()=>validate('albums',{title:'Test'}, {},collections));const a=collections.albums[0];assert.throws(()=>validate('albums',{competitionId:collections.albums[1].competitionId},a,collections));
 for(const mutate of [c=>c.albums[0].competitionId='missing',c=>c.albums[0].photos.push(c.albums[1].photos[0]),c=>c.albums[0].photos.push(c.albums[0].photos[0])]){const c=structuredClone(collections);mutate(c);assert.throws(()=>assertGalleryOwnership(c));}
});
test('future release and album removal keep gallery isolation without fallback',async()=>{
 const c=structuredClone(collections);c.albums[0].photos.reverse();const r=await prepareRelease({pages:base,previous:collections,collections:c,sourceRevision:'a'.repeat(40),contentRevision:'b'.repeat(40)});assert.ok(r.output[galleryPath(c.albums[0].competitionId)]);assert.ok(!r.output['index.html']);assert.ok(!r.output['idmancilar.html']);
 c.albums[0].status='draft';const out=renderV1(base,c);assert.ok(!out[galleryPath(c.albums[0].competitionId)].includes(c.albums[1].photos[0].path));assert.ok(!out[galleryPath(c.albums[0].competitionId)].includes('data-gallery-photo href='));
});
