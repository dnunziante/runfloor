import assert from 'node:assert/strict';
import {readFile,writeFile,unlink} from 'node:fs/promises';
const base=process.argv[2]||'http://localhost:3101';if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw Error('Preview smoke tests are local only');
async function post(route,body,origin=base){const r=await fetch(base+route,{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)});return {status:r.status,body:await r.json()};}
const file='.opal-preview/articles.json';let backup;try{backup=await readFile(file,'utf8');}catch{}
try{
 const answer=await post('/api/opal',{question:'How do AI credits work?',page:'/help?private=secret',workspace:'opal-preview'});assert.equal(answer.status,200);assert.equal(answer.body.sources[0].slug,'ai-credits');assert.equal(answer.body.inputTokens,undefined);
 assert.equal((await post('/api/opal',{question:'How do credits work?',workspace:'another-workspace'})).status,409);
 assert.equal((await post('/api/opal',{question:'How do credits work?',workspace:'opal-preview'},'https://foreign.example')).status,403);
 const unsupported=await post('/api/opal',{question:'Which employees are behind on their sales targets?',workspace:'opal-preview'});assert.equal(unsupported.body.mode,'unsupported');assert.equal(unsupported.body.sources.length,0);
 assert.equal((await fetch(base+'/help/create-an-action-plan')).status,404);
 const articles=JSON.parse(await readFile('src/lib/opal/seed.json','utf8'));const original=articles.find(a=>a.slug==='ai-credits');
 assert.equal((await post('/api/opal/admin',{...original,verified:false,status:'published'})).status,400);
 assert.equal((await post('/api/opal/admin',{...original,body:'Smoke test draft only',status:'draft'})).status,200);
 const html=await (await fetch(base+'/help/ai-credits')).text();assert.ok(html.includes('pending reservations'));assert.ok(!html.includes('Smoke test draft only'));
 assert.equal((await post('/api/opal/feedback',{slug:'ai-credits',helpful:false})).status,200);
 console.log('PASS: guide answer, safe response, workspace mismatch, foreign origin, unsupported business query, draft 404, publish guard, draft isolation, feedback persistence.');
}finally{if(backup!==undefined)await writeFile(file,backup);else await unlink(file).catch(()=>{});}
