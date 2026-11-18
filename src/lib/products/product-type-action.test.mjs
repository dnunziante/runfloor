import * as planPolicy from "../plans/policy.ts";
import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { hasPagePermission, defaultPermissions } from '../auth/role-permissions.ts';

const id='10000000-0000-0000-0000-000000000001';
function setup(options={}) {
  const calls=[],paths=[];
  const viewer={id:'user-a',organizationId:'org-a',role:'manager',demo:false,...options.viewer};
  const product={id,slug:'jay-flight',family_id:'family-a',product_type:'our_product',...options.product};
  const deps={"@/lib/plans/policy":planPolicy,
    'next/cache':{revalidatePath:p=>paths.push(p)},
    '@/lib/auth/viewer':{getViewer:async()=>viewer},
    '@/lib/auth/role-permissions':{hasPagePermission},
    '@/lib/supabase/server':{createClient:async()=>({from(table){const record={table,filters:[]};calls.push(record);const q={select(){return q},eq(k,v){record.filters.push([k,v]);return q},update(value){record.update=value;return q},async maybeSingle(){if(table==='product_families')return{data:{slug:options.familySlug??'dealership-inventory'}};if(record.update)return{data:options.saveFails?null:{id},error:options.saveFails?{message:'denied'}:null};return{data:options.missing?null:product};}};return q;}})},
  };
  const source=ts.transpileModule(readFileSync('src/app/admin/products/product-type-actions.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const exports={};vm.runInNewContext(source,{exports,Date,require:name=>{assert.ok(name in deps,name);return deps[name]}});
  async function save(type='competitor_product',productId=id){const form=new FormData();form.set('productId',productId);form.set('productType',type);return exports.saveProductType({error:'',success:''},form);}
  return{calls,paths,save};
}
test('classification saves only the existing tenant product and preserves approval and guide fields',async()=>{
  const fixture=setup();const result=await fixture.save();assert.equal(result.productType,'competitor_product');assert.equal(result.error,'');
  const update=fixture.calls.find(c=>c.update);assert.deepEqual(Object.keys(update.update).sort(),['family_id','product_type','updated_at']);assert.equal(update.update.family_id,null);
  for(const call of fixture.calls)assert.ok(call.filters.some(([k,v])=>k==='organization_id'&&v==='org-a'));
  assert.ok(update.filters.some(([k,v])=>k==='id'&&v===id));assert.ok(update.filters.some(([k,v])=>k==='product_type'&&v==='our_product'));
  for(const path of ['/products/jay-flight','/competitors','/admin/competitors',`/admin/products/${id}/guide`])assert.ok(fixture.paths.includes(path));
});
test('converting competitor to My product clears an incompatible competitor catalog without publishing',async()=>{
  const fixture=setup({product:{product_type:'competitor_product'},familySlug:'competitor-brand-jayco'});assert.equal((await fixture.save('our_product')).error,'');const update=fixture.calls.find(c=>c.update).update;assert.equal(update.family_id,null);assert.equal('status' in update,false);assert.equal('review_status' in update,false);
});
test('matching catalogs are retained and invalid, unauthorized or demo changes never reach the database',async()=>{
  const valid=setup({product:{product_type:'competitor_product'},familySlug:'competitor-brand-jayco'});await valid.save();assert.equal('family_id' in valid.calls.find(c=>c.update).update,false);
  for(const viewer of [{role:'salesperson'},{demo:true},{permissions:{...defaultPermissions('manager'),inventory:false}}]){const f=setup({viewer});assert.ok((await f.save()).error);assert.equal(f.calls.length,0);}
  for(const [type,key] of [['unknown',id],['our_product','wrong-id']]){const f=setup();assert.ok((await f.save(type,key)).error);assert.equal(f.calls.length,0);}
});
test('unavailable or unsaved products report errors without a false success',async()=>{
  for(const options of [{missing:true},{saveFails:true}]){const f=setup(options);const result=await f.save();assert.ok(result.error);assert.equal(result.success,'');assert.equal(f.paths.length,0);}
});

test('forged Free Admin product actions stop before database access',async()=>{const f=setup({viewer:{role:'tenant_admin',plan:{plan_key:'sales_solo_free',status:'free'}}});await assert.rejects(f.save(),/Upgrade to Sales Solo/);assert.equal(f.calls.length,0);});
