import {test} from 'node:test';
import assert from 'node:assert/strict';
import {allowedOperation,prepareMutation} from '../scripts/codex-content.mjs';
test('automation cannot mutate main, merge, force-push or open non-draft PRs',()=>{
 for(const [path,method,body] of [['git/refs/heads/main','PATCH',{force:false}],['pulls/2/merge','PUT',{}],['git/refs/heads/v2%2Fcontent-production','PATCH',{force:true}],['pulls','POST',{base:'main',draft:false,head:'v2/release-production-123'}]])assert.equal(allowedOperation(path,method,body),false);
 assert.equal(allowedOperation('pulls','POST',{base:'main',draft:true,head:'v2/release-production-123'}),true);
});
test('missing existing competition cannot create an album',async()=>{
 const store={load:async()=>({collections:{albums:[],competitions:[]}})};
 await assert.rejects(prepareMutation(store,{kind:'albums',id:'cup-photos',fields:{title:'Cup',competitionId:'kubok-2026-haqqinda'}}),/Yarış tapılmadı/);
});
test('album binds existing competition without changing competition data',async()=>{
 const competitions=[{id:'kubok-2026-haqqinda',name:'Original'}],state={collections:{albums:[],competitions}};
 const store={load:async()=>structuredClone(state)};
 const result=await prepareMutation(store,{kind:'albums',id:'kubok-2026-photos',fields:{title:'Cup',competitionId:competitions[0].id},reviewReady:true});
 assert.deepEqual(result.state.collections.competitions,competitions);assert.equal(result.item.status,'published');assert.equal(result.item.competitionId,competitions[0].id);
});
