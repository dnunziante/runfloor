import * as planPolicy from '../plans/policy.ts';
import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import * as permissions from './role-permissions.ts';

async function request(role,path,options={}) {
  const reply=(status=200)=>({status,cookies:{getAll:()=>[],set(){}}});
  const dependencies={
    '@/lib/auth/role-permissions':permissions,
    '@/lib/plans/policy':planPolicy,
    '@/lib/features':{isFeatureDestinationEnabled:()=>true},
    '@/lib/supabase/config':{isLocalDemoMode:()=>false,isSupabaseConfigured:()=>true},
    '@supabase/ssr':{createServerClient:()=>({
      auth:{getUser:async()=>({data:{user:{id:'user-a'}}})},
      from(table){const result={data:table==='account_subscription_plans'?options.plan??null:table==='profiles'?{is_platform_owner:role==='platform_owner'}:table==='organization_memberships'?[{organization_id:'org-a',role}]:table==='platform_workspace_contexts'?{active_organization_id:'org-a'}:options.values?{permissions:options.values}:null,error:table==='organization_role_permissions'?options.error:null};const query={select(){return query},eq(){return query},maybeSingle:async()=>result,then(resolve,reject){return Promise.resolve(result).then(resolve,reject)}};return query},
      rpc:async()=>({data:{allowed:true}}),
    })},
    'next/server':{NextResponse:{next:()=>reply(),redirect:url=>({...reply(307),url:url.href}),json:(body,{status})=>({...reply(status),body})}},
  };
  const source=ts.transpileModule(readFileSync('src/proxy.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const exports={};vm.runInNewContext(source,{exports,URL,process:{env:{NEXT_PUBLIC_SUPABASE_URL:'https://test.invalid',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'test'}},require:name=>{assert.ok(name in dependencies,name);return dependencies[name]}});
  return exports.proxy({nextUrl:new URL(`https://runfloor.test${path}`),url:`https://runfloor.test${path}`,method:options.method??'GET',cookies:{get:()=>undefined}});
}
test('actual proxy enforces disabled page and API permissions',async()=>{
  const values={...permissions.defaultPermissions('manager'),inventory:false};
  const denied=await request('manager','/products/123',{values});assert.equal(denied.status,307);assert.equal(denied.url,'https://runfloor.test/dashboard?access=restricted');
  assert.equal((await request('manager','/api/products/bulk-import',{values,method:'POST'})).status,403);
  assert.equal((await request('manager','/operations',{values})).status,200);
  assert.equal((await request('manager','/products',{error:{message:'unavailable'}})).status,503);
});
test('role editor remains reachable without opening other administration pages',async()=>{
  for(const role of ['manager','salesperson']){
    assert.equal((await request(role,'/admin/settings/roles')).status,200);
    assert.equal((await request(role,'/admin/settings')).status,307);
    assert.equal((await request(role,'/admin/users')).status,307);
  }
  const values={...permissions.defaultPermissions('tenant_admin'),administration:false};
  assert.equal((await request('tenant_admin','/admin/settings/roles',{values})).status,200);
  assert.equal((await request('tenant_admin','/admin/settings',{values})).status,307);
});

const soloPlan={plan_key:'sales_solo',owner_user_id:'user-a',status:'active',paid_start:'2020-01-01T00:00:00Z',paid_until:'2099-01-01T00:00:00Z'};
test('Solo commercial ceiling survives every account role and permission flag',async()=>{
  for(const role of ['tenant_admin','manager','salesperson']) {
    const values=Object.fromEntries(Object.keys(permissions.defaultPermissions('tenant_admin')).map(k=>[k,true]));
    for(const path of ['/operations','/executive','/admin/users','/admin/settings/roles','/api/workspace-assistant/operations','/api/admin/content/unsafe']) {
      const result=await request(role,path,{plan:soloPlan,values,method:'POST'});assert.equal(result.status,403,role+path);
    }
    for(const path of ['/assistant','/products','/comparisons','/messages','/quote-calculator','/analytics']) assert.equal((await request(role,path,{plan:soloPlan,values})).status,200,role+path);
  }
  assert.equal((await request('platform_owner','/operations',{plan:soloPlan})).status,200);
});
test('unpaid Solo retains self service while Sales requires a paid period',async()=>{
  const plan={...soloPlan,status:'pending',paid_start:null,paid_until:null};
  for(const path of ['/billing','/admin/settings','/help']) assert.equal((await request('tenant_admin',path,{plan})).status,200,path);
  assert.equal((await request('tenant_admin','/assistant',{plan})).url,'https://runfloor.test/billing');
  assert.equal((await request('tenant_admin','/api/assistant',{plan,method:'POST'})).status,403);
});

test('Free and expired Solo allow read-only shared browsing while rejecting paid tools and forged POSTs',async()=>{
 for(const plan of [{...soloPlan,plan_key:'sales_solo_free',status:'free',paid_start:null,paid_until:null},{...soloPlan,status:'canceled'}])for(const role of ['tenant_admin','manager','salesperson']){
  for(const path of ['/products','/comparisons','/billing'])assert.equal((await request(role,path,{plan})).status,200,role+path);
  for(const path of ['/operations','/executive','/assistant','/messages','/quote-calculator','/admin/products','/admin/users','/admin/settings/roles','/api/opal','/api/product-documents','/api/products/bulk-import'])assert.equal((await request(role,path,{plan,method:'POST'})).status,403,role+path);
  assert.equal((await request(role,'/products',{plan,method:'POST'})).status,403);
 }
 const plan={...soloPlan,plan_key:'sales_solo_free',status:'free'};
 assert.equal((await request('tenant_admin','/admin/settings',{plan,method:'POST'})).status,200);
});
