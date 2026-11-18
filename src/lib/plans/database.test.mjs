import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {creditDatabase} from '../ai-billing/test-database.mjs';
const owner='20000000-0000-0000-0000-000000000011',other='20000000-0000-0000-0000-000000000012';
test('Sales Solo migrations enforce paid periods, actual-cost cap and commercial access in PostgreSQL',async t=>{
 const db=await creditDatabase(); const q=async(s,a=[])=> (await db.query(s,a)).rows;
 try {
 await db.exec(`
 alter table auth.users add column email_confirmed_at timestamptz;
 alter table profiles add column full_name text;
 alter table organizations alter column id set default gen_random_uuid();
 alter table organizations add column name text;alter table organizations add column slug text unique;alter table organizations add column industry_template_id uuid;
 create table industry_templates(id uuid primary key default gen_random_uuid(),template_key text,is_enabled boolean,is_available_during_signup boolean,is_public_demo_visible boolean default true,is_internal_only boolean default false);
 insert into industry_templates(template_key,is_enabled,is_available_during_signup) values('rv',true,true);
 alter table locations add column name text;alter table locations add column sort_order int default 0;alter table locations add unique(id,organization_id);
 create type membership_status as enum('active','invited','suspended');
 alter table organization_memberships alter column status type membership_status using status::membership_status;
 alter table organization_memberships add column id uuid default gen_random_uuid() primary key;alter table organization_memberships add column location_id uuid;alter table organization_memberships add unique(organization_id,user_id);
 create table organization_member_locations(organization_id uuid,user_id uuid,location_id uuid,primary key(organization_id,user_id,location_id));
 create table organization_invitations(id uuid primary key default gen_random_uuid(),organization_id uuid,email text,status text default 'pending');
 create table platform_workspace_contexts(user_id uuid primary key,active_organization_id uuid);
 create table organization_role_permissions(organization_id uuid,role public.organization_role,permissions jsonb);
 create table industry_template_products(id uuid primary key default gen_random_uuid(),industry_template_id uuid,family_name text default 'RVs',name text,model text default '',model_year integer default 2026,model_variant text default '',specifications jsonb default '{}',description text default '',base_price_cents bigint default 0,range_text text default '',seats_text text default '',powertrain_text text default '',product_type text default 'our_product',manufacturer text default '',product_category text default 'Travel Trailer',sort_order integer default 0);
 alter table industry_templates enable row level security;alter table industry_template_products enable row level security;create policy fixture_templates on industry_templates for select to authenticated using(true);create policy fixture_catalog on industry_template_products for select to authenticated using(true);grant select on industry_templates,industry_template_products to authenticated;
 create schema storage;create table storage.objects(id uuid primary key default gen_random_uuid(),name text);
 alter table storage.objects enable row level security;
 `);
 for(const name of ['20261115004649_rv_complete_billing.sql']) await db.exec(readFileSync('supabase/migrations/'+name,'utf8'));
 for(const table of ['assistant_conversations','assistant_interactions','performance_events','operations_incidents','executive_reviews','organization_settings','products','product_families','product_documents','knowledge_documents','knowledge_document_chunks','sales_content_items','text_template_categories','competitor_sources','competitor_sync_runs','competitor_sync_candidates','competitor_product_aliases','competitor_product_change_history']) {
  await db.exec(`create table ${table}(id uuid primary key default gen_random_uuid(),organization_id uuid,user_id uuid,label text);alter table ${table} enable row level security;create policy fixture_member on ${table} for all to authenticated using(private.is_org_member(organization_id)) with check(private.is_org_member(organization_id));grant all on ${table} to authenticated;`);
 }
 for(const table of ['organization_memberships','organization_member_locations','organization_invitations','organization_role_permissions','locations']) await db.exec(`alter table ${table} enable row level security;create policy fixture_member on ${table} for all to authenticated using(private.is_org_member(organization_id)) with check(private.is_org_member(organization_id));grant all on ${table} to authenticated;`);
 for(const name of ['20261117160000_sales_solo.sql','20261117161000_sales_solo_events.sql','20261117162000_sales_solo_hardening.sql']) await db.exec(readFileSync('supabase/migrations/'+name,'utf8'));
 await db.exec(readFileSync("supabase/migrations/20261118022850_sales_solo_free.sql","utf8"));
 await db.exec(readFileSync("supabase/migrations/20261118030001_solo_free_catalog_guards.sql","utf8"));
 await db.exec(readFileSync("supabase/migrations/20261118165309_shared_rv_reference_catalog.sql","utf8"));
 await q('insert into auth.users values($1,now()),($2,null)',[owner,other]);await q('insert into profiles(id) values($1),($2)',[owner,other]);
 await assert.rejects(q("select activate_sales_solo($1,'QA','QA Owner')",[other]),/Verify your email/);
 const org=(await q("select activate_sales_solo($1,'Solo QA','QA Owner') org",[owner]))[0].org;
 const plan=async()=> (await q('select * from account_subscription_plans where organization_id=$1',[org]))[0];
 const count=async()=>Number((await q('select count(*) n from sales_solo_periods where organization_id=$1',[org]))[0].n);
 const now=new Date(Date.now()-1000).toISOString(),end=new Date(Date.now()+86400000*30).toISOString();
 const event=(id,created,paid,starts=now,ends=end,status='active',cancels=null)=>q('select apply_sales_solo_event($1,$2,$3,$4,$5,$6,false,$7,$8,$9,$10,$11,$12,$13)',[id,paid?'invoice.paid':'customer.subscription.updated',created,org,'cus_qa','acct_qa','sub_qa','price_qa',status,starts,ends,cancels,paid]);
 await q("update sales_solo_catalog set active=true,stripe_product_id='prod_qa',stripe_price_id='price_qa',stripe_account_id='acct_qa',livemode=false");
 await q("update account_subscription_plans set stripe_customer_id='cus_qa',stripe_account_id='acct_qa',livemode=false where organization_id=$1",[org]);
 await t.test('verified owner is existing Admin with no trial, location or unpaid allowance',async()=>{
  assert.equal((await q('select role from organization_memberships where organization_id=$1',[org]))[0].role,'tenant_admin');
  assert.equal((await q('select count(*)::int n from locations where organization_id=$1',[org]))[0].n,0);
  assert.equal((await q('select count(*)::int n from ai_credit_grants where organization_id=$1',[org]))[0].n,0);
  await event('created',1,null);assert.equal(await count(),0);assert.equal((await q('select private.account_paid($1) paid',[org]))[0].paid,false);
 });
 await event('paid',2,'in_first');await event('paid',2,'in_first');await event('duplicate-period',3,'in_other');assert.equal(await count(),1);
 await q("insert into ai_model_rates(model,version,input_units_per_million,cached_units_per_million,output_units_per_million,active,source_url) values('qa-solo','qa',1000000000,500000000,1000000000,true,'https://example.com')");
 let n=0;const id=()=>`30000000-0000-0000-0000-${String(++n).padStart(12,'0')}`;
 const reserve=(key,input)=>q("select reserve_ai_usage($1,$2,$3,'qa','qa-solo',$4,0)",[org,owner,key,input]);
 await t.test('actual settlement frees unused holds; uncertainty and purchased credits cannot bypass $5',async()=>{
  const first=id();await reserve(first,300000);await assert.rejects(reserve(id(),300000),/monthly AI cost limit/);
  await q("select finish_ai_usage($1,'settled',100000)",[first]);const held=id();await reserve(held,400000);await assert.rejects(reserve(held,400000),/Duplicate AI request/);
  await q("select finish_ai_usage($1,'uncertain')",[held]);await q("insert into ai_credit_grants(organization_id,kind,total_units,reference) values($1,'purchased',99900000000,'legacy-pack')",[org]);await assert.rejects(reserve(id(),1),/monthly AI cost limit/);
  await q("select set_config('request.jwt.claim.sub',$1,false)",[owner]);const summary=(await q('select sales_solo_summary($1) s',[org]))[0].s;assert.equal(summary.used_units,100000000);assert.equal(summary.reserved_units,400000000);assert.equal(summary.remaining_units,0);
 });
 await t.test('single-user ceiling rejects even trusted writes and invitations',async()=>{
  await assert.rejects(q("insert into organization_memberships(organization_id,user_id,role,status) values($1,$2,'tenant_admin','active')",[org,other]),/user limit reached/);
  await assert.rejects(q("insert into organization_invitations(organization_id,email,status) values($1,'not-sent@example.com','pending')",[org]),/user limit reached/);
 });
 await t.test('paid-only reset, late delivery and invoice deduplication',async()=>{
  await event('failed-renewal',10,null,end,new Date(Date.now()+86400000*60).toISOString(),'past_due');assert.equal(await count(),1);assert.equal((await plan()).paid_until.toISOString(),new Date(end).toISOString());
  await event('late-paid-same-period',4,'in_first');assert.equal(await count(),1);
  await event('renewal',11,'in_renewal',end,new Date(Date.now()+86400000*60).toISOString());assert.equal(await count(),2);
  assert.equal(Number((await q("select total_units from ai_credit_grants where reference='sales-solo:in_renewal'"))[0].total_units),500000000);
  // Restore current paid date for the remaining access checks; future-period grants remain unusable until their start.
  await q('update account_subscription_plans set paid_start=$2,paid_until=$3 where organization_id=$1',[org,now,end]);
 });
 await t.test('RLS rejects role/location changes and other-user/Ops data but saves own Sales at cap',async()=>{
  await q("update account_subscription_plans set plan_key='complete' where organization_id=$1",[org]);
  await q("insert into operations_incidents(organization_id,label) values($1,'preserved')",[org]);await q("insert into assistant_conversations(organization_id,user_id,label) values($1,$2,'other activity')",[org,other]);
  await q("update account_subscription_plans set plan_key='sales_solo' where organization_id=$1",[org]);
  await db.exec('set role authenticated');assert.equal((await q('select * from operations_incidents')).length,0);assert.equal((await q('select * from assistant_conversations')).length,0);
  await assert.rejects(q("update organization_memberships set role='manager' where organization_id=$1",[org]),/does not include team/);
  await assert.rejects(q("insert into locations(organization_id,name) values($1,'forged')",[org]),/row-level security/);
  await q("insert into products(organization_id,label) values($1,'non AI save at cap')",[org]);assert.equal((await q('select * from products')).length,1);
  await assert.rejects(q("select override_sales_solo($1,2,1000000000,null,'forged override')",[org]),/Platform Admin/);
  await db.exec('reset role');
 });
 await t.test('only Platform Admin can override; the exception is audited',async()=>{
  await q('update profiles set is_platform_owner=true where id=$1',[other]);await q("select set_config('request.jwt.claim.sub',$1,false)",[other]);await db.exec('set role authenticated');
  await q("select override_sales_solo($1,2,600000000,null,'QA explicit platform exception')",[org]);assert.equal((await q("select count(*)::int n from ai_billing_audit where action='sales_solo_override'"))[0].n,1);
  await db.exec('reset role');await q('update profiles set is_platform_owner=false where id=$1',[other]);await q("select set_config('request.jwt.claim.sub',$1,false)",[owner]);
 });
 await t.test('cancellation preserves records and denies paid access',async()=>{
  await q("update account_subscription_plans set checkout_session_id='cs_completed',checkout_attempt=gen_random_uuid(),checkout_expires_at=now()+interval '30 minutes' where organization_id=$1",[org]);
  await event('scheduled-cancel',12,null,now,end,'active',end);assert.equal((await q('select private.account_paid($1) paid',[org]))[0].paid,true);
  await event('cancel',13,null,now,end,'canceled',new Date().toISOString());assert.equal((await q('select private.account_paid($1) paid',[org]))[0].paid,false);await assert.rejects(reserve(id(),1),/requires a paid subscription/);assert.equal((await plan()).checkout_session_id,null);assert.equal((await plan()).checkout_expires_at,null);assert.equal((await q('select count(*)::int n from products'))[0].n,1);
 });
 await t.test('upgrade requires paid invoice; upgraded cancellation reaches location billing',async()=>{
  await q("update runfloor_billing_catalog set active=true,stripe_price_id='price_complete',approved_by=$1",[owner]);
  const upgrade=(key,paid,status='active')=>q("select apply_sales_solo_event($1,'customer.subscription.updated',20,$2,'cus_qa','acct_qa',false,'sub_qa','price_complete',$3,$4,$5,null,$6,'complete')",[key,org,status,now,end,paid]);
  await upgrade('unpaid-upgrade',null);assert.equal((await plan()).plan_key,'sales_solo');
  await assert.rejects(upgrade('paid-without-location','in_upgrade'),/set up a location/);
  await q("insert into locations(organization_id,name) values($1,'Platform location')",[org]);await upgrade('paid-upgrade','in_upgrade');assert.equal((await plan()).plan_key,'complete');
  await upgrade('upgraded-cancel',null,'canceled');assert.equal((await q('select status from rv_location_billing where organization_id=$1',[org]))[0].status,'canceled');
 });
 await t.test('new paid month gives exactly $5 without rolling over expired grants',async()=>{
  await q('update auth.users set email_confirmed_at=now() where id=$1',[other]);const fresh=(await q("select activate_sales_solo($1,'Renewal QA','Renewal Owner') org",[other]))[0].org;
  await q("update account_subscription_plans set stripe_customer_id='cus_renew',stripe_account_id='acct_qa',livemode=false where organization_id=$1",[fresh]);
  const apply=async(key,invoice,start,end)=>q("select apply_sales_solo_event($1,'invoice.paid',30,$2,'cus_renew','acct_qa',false,'sub_renew','price_qa','active',$3,$4,null,$5)",[key,fresh,start,end,invoice]);
  await apply('expired-month','in_expired',new Date(Date.now()-86400000*60).toISOString(),new Date(Date.now()-86400000*30).toISOString());
  await apply('current-month','in_current',now,end);await q("select set_config('request.jwt.claim.sub',$1,false)",[other]);
  const summary=(await q('select sales_solo_summary($1) s',[fresh]))[0].s;assert.equal(summary.remaining_units,500000000);
  const key=id();await q("select reserve_ai_usage($1,$2,$3,'renewal','qa-solo',500000,0)",[fresh,other,key]);
  await assert.rejects(q("select reserve_ai_usage($1,$2,$3,'renewal','qa-solo',1,0)",[fresh,other,id()]),/monthly AI cost limit/);
  assert.equal(Number((await q('select count(*) n from ai_credit_grants where organization_id=$1',[fresh]))[0].n),2);
 });
 await t.test('Free signup, catalog scope, no AI, no writes, paid conversion and expiration fallback',async()=>{
  const uid='20000000-0000-0000-0000-000000000033';await q('insert into auth.users values($1,now())',[uid]);await q('insert into profiles(id) values($1)',[uid]);
  const orgFree=(await q("select activate_sales_solo_free($1,'Free QA','Free Owner') org",[uid]))[0].org;
  assert.equal((await q("select activate_sales_solo_free($1,'Free QA','Free Owner') org",[uid]))[0].org,orgFree);
  assert.equal((await q('select role from organization_memberships where organization_id=$1',[orgFree]))[0].role,'tenant_admin');
  assert.equal((await q('select count(*)::int n from ai_credit_grants where organization_id=$1',[orgFree]))[0].n,0);
  await assert.rejects(q("select reserve_ai_usage($1,$2,$3,'help','qa-solo',1,0)",[orgFree,uid,id()]),/Free does not include AI/);
  await assert.rejects(q("insert into products(organization_id,label) values($1,'blocked trusted write')",[orgFree]),/requires verified paid/);
  await q("insert into industry_template_products(industry_template_id,name,product_type) select id,'Public model '||n,case when n%2=0 then 'our_product' else 'competitor_product' end from industry_templates cross join generate_series(1,65) n where template_key='rv'");
  await q("select set_config('request.jwt.claim.sub',$1,false)",[uid]);await db.exec('set role authenticated');
  const first=(await q('select solo_shared_catalog() c'))[0].c;assert.equal(first.products.length,48);assert.equal(new Set(first.products.map(p=>p.id)).size,48);assert.equal(first.has_more,true);assert.ok(first.products.every(p=>p.name.startsWith('Public model')));
  const second=(await q("select solo_shared_catalog(2) c"))[0].c;assert.equal(second.products.length,17);assert.equal(second.has_more,false);assert.equal((await q("select * from industry_template_products")).length,0);
  const searched=(await q("select solo_shared_catalog(1,'Public model 3','{}',true) c"))[0].c;assert.ok(searched.products.some(p=>p.product_type==='our_product'));assert.ok(searched.products.some(p=>p.product_type==='competitor_product'));
  await assert.rejects(q("update organization_memberships set role='manager' where organization_id=$1",[orgFree]),/does not include team/);
  await assert.rejects(q("insert into products(organization_id,label) values($1,'blocked client write')",[orgFree]),/requires verified paid|row-level security/);
  await assert.rejects(q("select solo_shared_catalog(1001)"),/Invalid catalog/);await db.exec('reset role');
  assert.equal((await q('select solo_document_processing_access($1) allowed',[orgFree]))[0].allowed,false);
  await q("update industry_templates set is_public_demo_visible=false where template_key='rv'");await db.exec('set role authenticated');await assert.rejects(q('select solo_shared_catalog()'),/Shared catalog unavailable/);await db.exec('reset role');await q("update industry_templates set is_public_demo_visible=true where template_key='rv'");
  await q('update solo_catalog_request_limits set requests=120 where user_id=$1',[uid]);await db.exec('set role authenticated');await assert.rejects(q('select solo_shared_catalog()'),/request limit reached/);await db.exec('reset role');await q('update solo_catalog_request_limits set requests=0 where user_id=$1',[uid]);
  await q("update account_subscription_plans set stripe_customer_id='cus_free',stripe_account_id='acct_qa',livemode=false where organization_id=$1",[orgFree]);
  const ev=(key,paid,status='active')=>q("select apply_sales_solo_event($1,'invoice.paid',40,$2,'cus_free','acct_qa',false,'sub_free','price_qa',$3,$4,$5,null,$6)",[key,orgFree,status,now,end,paid]);
  await ev('free-unpaid',null);assert.equal((await q('select plan_key from account_subscription_plans where organization_id=$1',[orgFree]))[0].plan_key,'sales_solo_free');
  await ev('free-paid','in_free_paid');await ev('free-paid','in_free_paid');assert.equal((await q('select plan_key from account_subscription_plans where organization_id=$1',[orgFree]))[0].plan_key,'sales_solo');
  assert.equal((await q('select count(*)::int n from ai_credit_grants where organization_id=$1',[orgFree]))[0].n,1);
  await ev('free-cancel',null,'canceled');assert.equal((await q('select private.account_paid($1) p',[orgFree]))[0].p,false);
  await assert.rejects(q("select reserve_ai_usage($1,$2,$3,'background','qa-solo',1,0)",[orgFree,uid,id()]),/requires a paid subscription/);
  await db.exec('set role authenticated');assert.equal((await q('select solo_shared_catalog() c'))[0].c.products.length,48);await db.exec('reset role');
 });
 await t.test('the preloaded reference library also authorizes Complete RV members, without exposing tenant records',async()=>{
  await db.exec('reset role');
  const orgRv='70000000-0000-4000-8000-000000000001',rvMember='70000000-0000-4000-8000-000000000003';
  await q('insert into auth.users values($1,now())',[rvMember]);await q('insert into profiles(id) values($1)',[rvMember]);
  await q("insert into organizations(id,name,slug,industry_template_id) select $1,'Complete reference QA','complete-reference-qa',id from industry_templates where template_key='rv'",[orgRv]);
  await q("insert into organization_memberships(organization_id,user_id,role,status) values($1,$2,'salesperson','active')",[orgRv,rvMember]);
  await q("select set_config('request.jwt.claim.sub',$1,false)",[rvMember]);await db.exec('set role authenticated');
  assert.ok((await q('select solo_shared_catalog() c'))[0].c.products.length>0);
  await db.exec('reset role');await q('update organizations set industry_template_id=null where id=$1',[orgRv]);await db.exec('set role authenticated');
  await assert.rejects(q('select solo_shared_catalog()'),/RV catalog membership required/);
  await q("select set_config('request.jwt.claim.sub',$1,false)",['70000000-0000-4000-8000-000000000002']);
  await assert.rejects(q('select solo_shared_catalog()'),/RV catalog membership required/);
  await db.exec('reset role');
 });
 } finally {await db.close();}
});
