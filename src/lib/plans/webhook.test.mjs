import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
function fixture(options={}) {
 const calls=[];
 const plan={organization_id:'org',plan_key:'sales_solo',stripe_account_id:'acct_test',livemode:false};
 const sub={id:'sub_test',livemode:false,customer:'cus_test',status:'active',latest_invoice:'in_test',items:{data:[{quantity:1,price:{id:options.upgrade?'price_complete':'price_solo'},current_period_start:100,current_period_end:200}]}};
 const invoice={id:'in_test',customer:'cus_test',parent:{subscription_details:{subscription:'sub_test'}},status:'paid',currency:'usd',amount_paid:options.upgrade?7400:2500,billing_reason:options.upgrade?'subscription_update':'subscription_cycle',lines:{data:[{amount:options.upgrade?9900:2500,pricing:{price_details:{price:options.upgrade?'price_complete':'price_solo'}},period:{start:100,end:200}}]},...options.invoice};
 Object.assign(sub,options.sub);
 const stripe={subscriptions:{retrieve:async()=>sub},invoices:{retrieve:async()=>invoice}};
 const deps={'server-only':{},'@/lib/supabase/admin':{createAdminClient:()=>({from:()=>({select(){return this},eq(){return this},maybeSingle:async()=>({data:plan,error:null})}),rpc:async(name,args)=>{calls.push({name,args});return{error:null}}})},'./stripe':{soloPrice:async()=>({id:'price_solo',unit_amount:2500})},'@/lib/billing/stripe':{completePrice:async()=>({id:'price_complete',unit_amount:9900})}};
 const exports={};vm.runInNewContext(ts.transpileModule(readFileSync('src/lib/plans/webhook.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,Date,require:n=>{assert.ok(n in deps,n);return deps[n]}});
 return {calls,run:(kind='invoice.paid',account='acct_test')=>exports.handleSoloEvent({id:'evt_test',type:kind,created:123,data:{object:kind.startsWith('customer.subscription')?{id:'sub_test'}:{id:'in_test',parent:{subscription_details:{subscription:'sub_test'}}}}},stripe,account,false)};
}
test('Solo paid access requires independently retrieved latest invoice, owner, period and full approved price',async()=>{
 const f=fixture();assert.equal(await f.run(),true);assert.equal(f.calls[0].args.paid_invoice,'in_test');
 for(const invoice of [{status:'open'},{id:'in_stale'},{customer:'cus_other'},{amount_paid:2499},{parent:{subscription_details:{subscription:'sub_other'}}},{lines:{data:[]}}]) {const bad=fixture({invoice});await bad.run();assert.equal(bad.calls[0].args.paid_invoice,null,JSON.stringify(invoice));}
});
test('subscription changes and failed payments never issue an allowance',async()=>{for(const kind of ['customer.subscription.updated','invoice.payment_failed']){const f=fixture();await f.run(kind);assert.equal(f.calls[0].args.paid_invoice,null);}});
test('wrong environment, quantity and unknown price are rejected before database grant',async()=>{
 for(const sub of [{livemode:true},{items:{data:[{quantity:2,price:{id:'price_solo'}}]}},{items:{data:[{quantity:1,price:{id:'unknown'}}]}}]){const f=fixture({sub});await assert.rejects(f.run());assert.equal(f.calls.length,0);}
 const wrong=fixture();await assert.rejects(wrong.run('invoice.paid','acct_other'));assert.equal(wrong.calls.length,0);
});
test('paid prorated upgrade accepts credit for Solo without free access on unpaid upgrade',async()=>{
 const f=fixture({upgrade:true});await f.run();assert.equal(f.calls[0].args.target_plan,'complete');assert.equal(f.calls[0].args.paid_invoice,'in_test');
 const unpaid=fixture({upgrade:true,invoice:{amount_paid:0}});await unpaid.run();assert.equal(unpaid.calls[0].args.paid_invoice,null);
});
