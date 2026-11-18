import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {randomBytes,randomUUID} from 'node:crypto';
function fixture(status='canceled',owner=true){
 const calls=[];const plan={plan_key:'sales_solo',owner_user_id:'owner',stripe_customer_id:'cus_test',stripe_account_id:'acct_test',livemode:false,status,checkout_session_id:'cs_old'};
 const stripe={subscriptions:{async *list(){if(status==='active')yield{status:'active'}}},checkout:{sessions:{retrieve:async()=>{calls.push('retrieve');return{status:'complete'}},create:async()=>{calls.push('create');return{id:'cs_new',url:'https://checkout.stripe.com/test'}}}}};
 const query={update(){return this},eq(){return this},or(){return this},select(){return this},maybeSingle:async()=>({data:{organization_id:'org'},error:null}),then(resolve,reject){return Promise.resolve({error:null}).then(resolve,reject)}};
 const deps={'node:crypto':{randomBytes,randomUUID},'next/navigation':{redirect:path=>{throw Error('REDIRECT:'+path)}},'@/lib/auth/viewer':{getViewer:async()=>({id:owner?'owner':'attacker',role:'tenant_admin',organizationId:'org',plan})},'@/lib/supabase/admin':{createAdminClient:()=>({from:()=>query})},'@/lib/ai-billing/stripe':{billingStripe:async()=>({stripe,account:'acct_test',live:false}),billingOrigin:()=> 'https://runfloor.test'},'@/lib/plans/stripe':{soloPrice:async()=>({id:'price_solo'})},'@/lib/billing/stripe':{completePrice:async()=>({id:'price_complete'})}};
 const exports={};vm.runInNewContext(ts.transpileModule(readFileSync('src/app/billing/solo-actions.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,Date,process:{env:{}},require:n=>{assert.ok(n in deps,n);return deps[n]}});return{calls,run:exports.startSoloCheckout};
}
test('canceled Solo can resubscribe without reusing its completed old Checkout session',async()=>{const f=fixture();await assert.rejects(f.run(),/REDIRECT:https:\/\/checkout.stripe.com\/test/);assert.deepEqual(f.calls,['create']);});
test('non-owner and already subscribed accounts cannot create another checkout',async()=>{for(const f of [fixture('active'),fixture('canceled',false)]){await assert.rejects(f.run(),/REDIRECT:\/billing\?error=/);assert.deepEqual(f.calls,[]);}});
