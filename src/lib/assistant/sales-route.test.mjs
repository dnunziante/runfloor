import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { isSalesKnowledgeCollection, conversationContext } from './workspaces.ts';
import { selectWorkspaceContext } from './workspace-context.ts';
import { selectRelevantProducts, formatProductContext } from '../rag/product-context.ts';
import { normalizeStandards } from '../rag/prompt-compiler.ts';

function route(options={}) {
 const calls=[]; let context='';
 const database={from(table){
  const query={select(){return this;},eq(key,value){calls.push([table,key,value]);return this;},in(){return this;},order(){return this;},
   maybeSingle(){return Promise.resolve({data:{location_id:'location-a'},error:null});},
   limit(){return Promise.resolve({data:options.products??[],error:null});},
   insert(value){calls.push([table,value]);return options.telemetryFailure?Promise.reject(new Error('telemetry failed')):Promise.resolve({error:null});},
   then(resolve,reject){return Promise.resolve({data:table==='knowledge_documents'?(options.documents??[]):[],error:null}).then(resolve,reject);}};
  return query;
 },rpc(_name,args){calls.push(['search',args]);return Promise.resolve({data:options.chunks??[],error:null});}};
 const dependencies={
  'next/server':{NextResponse:{json:(body,config={})=>({body,status:config.status??200})}},
  '@/lib/auth/viewer':{getViewer:async()=>options.viewer===undefined?{id:'user-a',organizationId:'tenant-a',role:'salesperson'}:options.viewer},
  '@/lib/assistant/workspaces':{isSalesKnowledgeCollection,conversationContext},
  '@/lib/assistant/workspace-context':{selectWorkspaceContext},
  '@/lib/rag/prompt-compiler':{normalizeStandards},
  '@/lib/supabase/server':{createClient:async()=>{calls.push('database');return database;}},
  '@/lib/rag/openai':{createEmbeddings:async()=>{if(options.embeddingFailure)throw new Error('private provider details');return [[0.1]];},createGroundedAnswer:async(_question,source)=>{calls.push('model');context=source;return options.answer??'General AI guidance: confirm the appointment details.';}},
  '@/lib/rag/product-context':{selectRelevantProducts,formatProductContext},
  '@/lib/rag/communication-context':{getCommunicationContext:async()=>({standards:normalizeStandards(null),examples:''}),formatCommunicationContext:()=>''},
 };
 const source=readFileSync('src/app/api/assistant/route.ts','utf8');
 const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};vm.runInNewContext(compiled,{exports,console,require:name=>{assert.ok(name in dependencies,name);return dependencies[name];}});
 return {post:(question='Help schedule a test drive')=>exports.POST({json:async()=>({question})}),calls,context:()=>context};
}
test('Sales authorization and validation precede retrieval and AI',async()=>{
 for(const [viewer,status] of [[null,401],[{organizationId:'a',demo:true},403]]){const request=route({viewer});assert.equal((await request.post()).status,status);assert.equal(request.calls.length,0);}
 const request=route();assert.equal((await request.post('')).status,400);assert.equal(request.calls.length,0);
});
test('Sales answers with general guidance when approved knowledge has no matches',async()=>{
 const request=route();const response=await request.post();assert.equal(response.status,200);assert.match(response.body.answer,/General AI guidance/);assert.equal(response.body.sources.length,0);assert.ok(request.calls.includes('model'));
});
test('Sales retrieval failures still answer without provider details or false sources',async()=>{
 const request=route({embeddingFailure:true});const response=await request.post();assert.equal(response.status,200);assert.match(request.context(),/could not be loaded/);assert.doesNotMatch(request.context(),/private provider details/);assert.equal(response.body.sources.length,0);
});
test('Sales filters unknown and management documents before invoking AI',async()=>{
 const chunks=[{document_id:'sales',document_name:'Sales SOP',content:'Confirm the appointment.',similarity:0.9},{document_id:'executive',document_name:'Executive secrets',content:'CONFIDENTIAL PROFIT',similarity:0.99},{document_id:'unknown',document_name:'Other',content:'UNKNOWN SECRET',similarity:0.99}];
 const request=route({chunks,documents:[{id:'sales',collection:'sales'},{id:'executive',collection:'management'},{id:'unknown',collection:'unknown'}],answer:'From RunFloor records: confirm the appointment [1].'});
 const response=await request.post();assert.equal(response.status,200);assert.match(request.context(),/Sales SOP/);assert.doesNotMatch(request.context(),/CONFIDENTIAL PROFIT|UNKNOWN SECRET/);assert.equal(response.body.sources.length,1);
 assert.ok(request.calls.some(call=>Array.isArray(call)&&call[0]==='search'&&call[1].match_tenant_id==='tenant-a'&&call[1].match_location_id==='location-a'));
 assert.ok(request.calls.some(call=>Array.isArray(call)&&call[0]==='products'&&call[1]==='review_status'&&call[2]==='approved'));
});
test('Sales bounds large approved documents and telemetry failure cannot erase an answer',async()=>{
 const request=route({chunks:[{document_id:'sales',document_name:'Test drive procedure',content:'Confirm appointment. '.repeat(15000),similarity:0.9}],documents:[{id:'sales',collection:'sales'}],telemetryFailure:true});
 const response=await request.post();assert.equal(response.status,200);assert.ok(request.context().length<=60000);assert.match(request.context(),/not an exhaustive/);assert.equal(response.body.sources.length,0);
});
