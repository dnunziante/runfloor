import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import * as policy from './policy.ts';
test('shared catalog cache never skips caller authorization or falls back to private tenant data',async()=>{
 let viewer={id:'a',organizationId:'org-a',plan:{plan_key:'sales_solo_free',status:'free'}};let deny=false,reads=0,gates=0;
 const row={id:'10000000-0000-4000-8000-000000000001',name:'Approved reference',family_name:'RVs',model:'Model',model_year:2026,model_variant:'',manufacturer:'Reference',specifications:{},description:'Public template record',base_price_cents:1000,range_text:'',seats_text:'',powertrain_text:'',product_type:'our_product',product_category:'Travel Trailer',sort_order:0};
 const memo=new Map();const deps={'server-only':{},'next/cache':{unstable_cache:fn=>async key=>{if(!memo.has(key))memo.set(key,await fn(key));return memo.get(key);}},react:{cache:fn=>fn},'@/lib/plans/policy':policy,'@/lib/auth/viewer':{getViewer:async()=>viewer},'@/lib/demo/catalog':{},'@/lib/supabase/config':{},'@/lib/supabase/server':{createClient:async()=>({rpc:async name=>{assert.equal(name,'solo_catalog_access');gates++;return{error:deny?{message:'denied'}:null}}})},'@/lib/supabase/admin':{createAdminClient:()=>({rpc:async name=>{assert.equal(name,'solo_shared_catalog');reads++;return{error:null,data:{products:[row],has_more:false,brands:['Reference'],categories:['Travel Trailer'],years:[2026]}}}})}};
 const exports={};vm.runInNewContext(ts.transpileModule(readFileSync('src/lib/products/data.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,process:{env:{SUPABASE_SERVICE_ROLE_KEY:'test-placeholder'}},require:n=>{assert.ok(n in deps,n);return deps[n]}});
 const a=await exports.getSoloSharedCatalog();assert.equal(a.products[0].slug,'rv-'+row.id);assert.equal(a.products[0].imagePaths.length,0);
 viewer={...viewer,id:'b',organizationId:'org-b'};const b=await exports.getSoloSharedCatalog();assert.equal(b.products[0].id,row.id);assert.equal(reads,1);assert.equal(gates,2);
 deny=true;const blocked=await exports.getSoloSharedCatalog();assert.equal(blocked.products.length,0);assert.ok(blocked.error);assert.equal(gates,3);assert.equal(reads,1);
});
