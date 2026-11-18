import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {isFreeSolo,effectivePlanKey,freeAllowsPath,planPaid} from './policy.ts';
test('Free is permanent and cannot gain paid access from a role, dates, or an access exception',()=>{
 const free={plan_key:'sales_solo_free',status:'active',paid_start:'2020-01-01',paid_until:'2099-01-01',access_override_until:'2099-01-01'};
 assert.equal(isFreeSolo(free),true);assert.equal(planPaid(free),false);assert.equal(effectivePlanKey(free),'sales_solo_free');
 for(const path of ['/products','/comparisons','/admin/settings','/billing'])assert.equal(freeAllowsPath(path),true);
 for(const path of ['/assistant','/messages','/quote-calculator','/operations','/executive','/api/opal','/admin/settings/roles','/admin/products'])assert.equal(freeAllowsPath(path),false);
 const paid={...free,plan_key:'sales_solo',access_override_until:null};assert.equal(planPaid(paid),true);assert.equal(isFreeSolo(paid),false);assert.equal(isFreeSolo({...paid,status:'canceled'}),true);
});
test('Free background document processing stops before parsing, storage, or embeddings',async()=>{
 for(const result of [{data:false,error:null},{data:null,error:{message:'unavailable'}}]){
  let calls=0;const fail=()=>{calls++;throw Error('Costly work reached');};const deps={'server-only':{},'@/lib/supabase/admin':{createAdminClient:()=>({rpc:async(name,args)=>{assert.equal(name,'solo_document_processing_access');assert.equal(args.target_org,'org');return result;},from:fail})},'@/lib/rag/openai':{createEmbeddings:fail},'@/lib/rag/chunking':{extractDocumentPages:fail,makeKnowledgeChunks:fail}};
  const exports={};vm.runInNewContext(ts.transpileModule(readFileSync('src/lib/rag/process-document.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>{assert.ok(n in deps,n);return deps[n]}});
  assert.equal((await exports.processKnowledgeDocument({organizationId:'org'})).indexed,false);assert.equal(calls,0);
 }
});

test('self-service profile action ignores forged user and role fields',async()=>{
 const calls=[];const deps={'@/lib/supabase/server':{createClient:async()=>({auth:{getUser:async()=>({data:{user:{id:'self'}}}),updateUser:async value=>{calls.push(['password',value]);return{error:null}}},from:()=>({update:value=>({eq:async(key,id)=>{calls.push(['profile',value,key,id]);return{error:null}}})})})},'next/cache':{revalidatePath:()=>{}}};
 const exports={};vm.runInNewContext(ts.transpileModule(readFileSync('src/app/admin/settings/own-profile-actions.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>{assert.ok(n in deps,n);return deps[n]}});
 const form=new FormData();form.set('name','Test Owner');form.set('password','test-password-strong-123');form.set('userId','other-user');form.set('role','platform_owner');form.set('locationId','other-location');
 const result=await exports.saveOwnProfile({},form);assert.ok(result.success);assert.equal(calls[1][3],'self');assert.equal(calls[1][1].full_name,'Test Owner');assert.deepEqual(Object.keys(calls[0][1]),['password']);assert.deepEqual(Object.keys(calls[1][1]),['full_name']);
});
