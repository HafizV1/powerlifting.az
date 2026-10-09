import {fail} from './validation.mjs';
export const TEST_ID=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
export function testScope(request,env){
 const url=new URL(request.url),id=request.headers.get('X-Staging-Test-Run')||(url.pathname==='/api/assets'?url.searchParams.get('stagingTest'):null);
 if(!id)return {env,id:null};
 if(!TEST_ID.test(id)||env.STAGING_ONLY!=='true'||env.GITHUB_REPOSITORY!=='HafizV1/powerlifting-v1-preview'||env.BASE_BRANCH!=='v2/staging-base'||env.ENABLE_V1_EXPORT!=='false'||env.LOCAL_STORE)fail('İzolə olunmuş staging sınağına icazə verilmir.',403);
 return {env:{...env,DATA_BRANCH:'v2/content-e2e-'+id},id};
}
export const TEST_STEPS=['news-create','news-edit','news-image','news-status','validation','competition','protocol-powerlifting','protocol-bench','albums','records','documents','review','preservation'];
export function reportText(id,results,cleaned){
 if(!Array.isArray(results)||results.length>TEST_STEPS.length||results.some(r=>!TEST_STEPS.includes(r.name)||typeof r.passed!=='boolean'||Object.keys(r).some(k=>!['name','passed'].includes(k))))fail('Sınaq hesabatı etibarsızdır.');
 return '# STAGING E2E\n\nRun: `'+id+'`\n\n'+results.map(r=>'- '+r.name+': '+(r.passed?'PASS':'FAIL')).join('\n')+'\n\nCleanup: '+(cleaned?'COMPLETE':'PENDING')+'\n\nPreview-only temporary content. No merge, public rendering or production changes. Test diff/history stays in this closed PR for review.\n';
}
