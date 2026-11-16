import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
test('database policies protect drafts, role-specific guides, version publication, and request limits',async()=>{
 const db=new PGlite();
 try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create schema private;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table public.profiles(id uuid primary key,is_platform_owner boolean);
 create table public.organization_memberships(user_id uuid,organization_id uuid,role text,status text,created_at timestamptz default now());
 create table public.platform_workspace_contexts(user_id uuid,active_organization_id uuid);
 create function private.is_platform_owner() returns boolean language sql stable security definer as $$select coalesce((select is_platform_owner from public.profiles where id=auth.uid()),false)$$;
 grant usage on schema auth,private to authenticated;grant execute on function auth.uid(),private.is_platform_owner() to authenticated;
 grant select on public.organization_memberships,public.platform_workspace_contexts to authenticated;
 insert into public.profiles values('00000000-0000-0000-0000-000000000001',true);
 insert into public.organization_memberships(user_id,organization_id,role,status) values('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','tenant_admin','active'),('00000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','salesperson','active');`);
 await db.exec(readFileSync('supabase/migrations/20261116003658_opal_help_center.sql','utf8'));
 await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);`);
 assert.equal((await db.query(`select * from public.opal_article_versions where status='draft'`)).rows.length,0);
 assert.equal((await db.query(`select * from public.opal_article_versions where slug='monthly-review'`)).rows.length,0);
 assert.ok((await db.query(`select * from public.opal_article_versions where slug='ai-credits'`)).rows.length===1);
 await assert.rejects(db.query(`select public.opal_save_article('{}')`));
 for(let i=0;i<10;i++)assert.equal((await db.query('select public.opal_reserve_request() as allowed')).rows[0].allowed,true);
 assert.equal((await db.query('select public.opal_reserve_request() as allowed')).rows[0].allowed,false);
 await db.exec(`select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);`);
 const original=(await db.query(`select payload from public.opal_article_versions where slug='ai-credits' and status='published'`)).rows[0].payload;
 await db.query('select public.opal_save_article($1)',[JSON.stringify({...original,status:'draft',body:'Pending edit'})]);
 assert.equal((await db.query(`select payload from public.opal_article_versions where slug='ai-credits' and status='published'`)).rows[0].payload.body,original.body);
 await db.query('select public.opal_save_article($1)',[JSON.stringify({...original,status:'published',body:'Approved edit'})]);
 assert.equal((await db.query(`select * from public.opal_article_versions where slug='ai-credits' and status='published'`)).rows.length,1);
 await db.query('select public.opal_save_article($1)',[JSON.stringify({...original,status:'archived'})]);
 assert.equal((await db.query(`select * from public.opal_article_versions where slug='ai-credits' and status='published'`)).rows.length,0);
 }finally{await db.close();}
});
