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
    '@/lib/features':{isFeatureDestinationEnabled:()=>true},
    '@/lib/supabase/config':{isLocalDemoMode:()=>false,isSupabaseConfigured:()=>true},
    '@supabase/ssr':{createServerClient:()=>({
      auth:{getUser:async()=>({data:{user:{id:'user-a'}}})},
      from(table){const result={data:table==='profiles'?{is_platform_owner:role==='platform_owner'}:table==='organization_memberships'?[{organization_id:'org-a',role}]:table==='platform_workspace_contexts'?{active_organization_id:'org-a'}:options.values?{permissions:options.values}:null,error:table==='organization_role_permissions'?options.error:null};const query={select(){return query},eq(){return query},maybeSingle:async()=>result,then(resolve,reject){return Promise.resolve(result).then(resolve,reject)}};return query},
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
