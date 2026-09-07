-- Run against an isolated QA database seeded with the fixtures in the local test harness.
select set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000001',true);
set local role authenticated;
do $test$
declare a uuid; b uuid; x uuid; y uuid; z uuid; result_count integer; scope text; cat text; proc text; rpc text; args text;
begin
-- Platform flows preserve formatted JSON and metadata.
a:=public.manage_platform_procedure_library('category_create',null,'{"name":"QA platform A","description":"Test category"}');
b:=public.manage_platform_procedure_library('category_create',null,'{"name":"QA platform B"}');
insert into public.platform_procedure_templates(title,category,owner,summary,content,steps,created_by) values('QA template','QA platform A','QA owner','QA purpose','{"custom":"preserve","runfloorDocument":{"format":"tiptap-v1","document":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Formatting preserved","marks":[{"type":"bold"}]}]}]}}}','["Legacy step"]',auth.uid()) returning id into x;
y:=public.manage_platform_procedure_library('procedure_duplicate',x);
if (select content from public.platform_procedure_templates where id=x) is distinct from (select content from public.platform_procedure_templates where id=y) then raise exception 'Duplicate lost formatting'; end if;
perform public.manage_platform_procedure_library('procedure_archive',y);
perform public.manage_platform_procedure_library('category_update',a,'{"name":"QA platform renamed","description":"Saved description"}');
if (select category from public.platform_procedure_templates where id=x)<>'QA platform renamed' then raise exception 'Rename did not synchronize'; end if;
perform public.manage_platform_procedure_library('category_reorder',a,'{"direction":"up"}');
perform public.manage_platform_procedure_library('category_archive',a);
perform public.manage_platform_procedure_library('category_restore',a);
if (select archived_at from public.platform_procedure_templates where id=x) is not null or (select archived_at from public.platform_procedure_templates where id=y) is null then raise exception 'Category restore changed separate archive'; end if;
perform public.manage_platform_procedure_library('procedure_restore',y);
perform public.manage_platform_procedure_library('procedure_move',y,jsonb_build_object('destination',b));
perform public.manage_platform_procedure_library('category_delete',a,jsonb_build_object('confirmed',true,'disposition','archive'));
if (select archived_at from public.platform_procedure_templates where id=x) is null or (select original_category from public.platform_procedure_templates where id=x)<>'QA platform renamed' then raise exception 'Delete/archive lost original category'; end if;
perform public.manage_platform_procedure_library('procedure_restore',x,jsonb_build_object('destination',b));
perform public.manage_platform_procedure_library('category_delete',b,'{"confirmed":true,"disposition":"delete"}');
if exists(select 1 from public.platform_procedure_templates where id in(x,y)) then raise exception 'Permanent category delete failed'; end if;
-- Tenant flows, including independent copy of all legacy steps.
a:=public.manage_tenant_procedure_library('category_create',null,'{"name":"QA tenant A"}','91000000-0000-0000-0000-000000000001');
b:=public.manage_tenant_procedure_library('category_create',null,'{"name":"QA tenant B"}','91000000-0000-0000-0000-000000000001');
insert into public.operations_procedures(organization_id,title,category_id,category,owner,summary,status,content,created_by) values('91000000-0000-0000-0000-000000000001','QA tenant procedure',a,'QA tenant A','QA owner','QA procedure purpose','published','{"custom":"preserve"}',auth.uid()) returning id into x;
insert into public.operations_procedure_steps(organization_id,procedure_id,title,position) values('91000000-0000-0000-0000-000000000001',x,'Legacy QA step',0);
y:=public.manage_tenant_procedure_library('procedure_duplicate',x,'{}','91000000-0000-0000-0000-000000000001');
if (select count(*) from public.operations_procedure_steps where procedure_id=y)<>1 then raise exception 'Duplicate lost steps'; end if;
perform public.manage_tenant_procedure_library('category_update',a,'{"name":"QA tenant renamed"}','91000000-0000-0000-0000-000000000001');
perform public.manage_tenant_procedure_library('category_reorder',a,'{"direction":"down"}','91000000-0000-0000-0000-000000000001');
perform public.manage_tenant_procedure_library('procedure_archive',y,'{}','91000000-0000-0000-0000-000000000001');
perform public.manage_tenant_procedure_library('category_archive',a,'{}','91000000-0000-0000-0000-000000000001');
begin
 insert into public.operations_procedures(organization_id,title,category_id,category,owner,summary,status,created_by) values('91000000-0000-0000-0000-000000000001','QA blocked',a,'QA tenant renamed','QA owner','Should not save here','draft',auth.uid());
 raise exception 'Test failed: archived category accepted insert';
exception when others then if sqlerrm='Test failed: archived category accepted insert' then raise; end if; end;
perform public.manage_tenant_procedure_library('category_restore',a,'{}','91000000-0000-0000-0000-000000000001');
if (select status from public.operations_procedures where id=x)<>'published' or (select archived_at from public.operations_procedures where id=y) is null then raise exception 'Restore changed publishing state'; end if;
perform public.manage_tenant_procedure_library('procedure_move',y,jsonb_build_object('destination',b),'91000000-0000-0000-0000-000000000001');
perform public.manage_tenant_procedure_library('procedure_restore',y,'{}','91000000-0000-0000-0000-000000000001');
perform public.manage_tenant_procedure_library('category_delete',a,jsonb_build_object('confirmed',true,'disposition','move','destination',b),'91000000-0000-0000-0000-000000000001');
if (select category_id from public.operations_procedures where id=x)<>b then raise exception 'Category delete/move failed'; end if;
perform public.manage_tenant_procedure_library('category_delete',b,'{"confirmed":true,"disposition":"uncategorized"}','91000000-0000-0000-0000-000000000001');
perform public.manage_tenant_procedure_library('procedure_delete',x,'{"confirmed":true}','91000000-0000-0000-0000-000000000001');
perform public.manage_tenant_procedure_library('procedure_delete',y,'{"confirmed":true}','91000000-0000-0000-0000-000000000001');
end;
$test$;
reset role;
select 'Management transaction tests passed' as result;
-- Rollback safety: an invalid destination must not remove or partially move anything.
set local role authenticated;
do $test$
declare a uuid; x uuid;
begin
 a:=public.manage_tenant_procedure_library('category_create',null,'{"name":"QA rollback"}','91000000-0000-0000-0000-000000000001');
 insert into public.operations_procedures(organization_id,title,category_id,category,owner,summary,status,created_by)
 values('91000000-0000-0000-0000-000000000001','QA rollback procedure',a,'QA rollback','QA owner','QA preservation test','draft',auth.uid()) returning id into x;
 begin
  perform public.manage_tenant_procedure_library('category_delete',a,'{"confirmed":true,"disposition":"move","destination":"30000000-0000-0000-0000-000000000001"}','91000000-0000-0000-0000-000000000001');
  raise exception 'Invalid destination accepted';
 exception when others then if sqlerrm='Invalid destination accepted' then raise; end if; end;
 if not exists(select 1 from public.operations_procedure_categories where id=a) or (select category_id from public.operations_procedures where id=x)<>a then raise exception 'Failed delete partially changed data'; end if;
 begin
  perform public.manage_tenant_procedure_library('category_delete',a,'{"disposition":"delete"}','91000000-0000-0000-0000-000000000001');
  raise exception 'Unconfirmed deletion accepted';
 exception when others then if sqlerrm='Unconfirmed deletion accepted' then raise; end if; end;
end; $test$;
reset role;
-- Local fixture owner becomes an ordinary tenant administrator for isolation tests.
update public.profiles set is_platform_owner=false where id='90000000-0000-0000-0000-000000000001';
set local role authenticated;
do $test$
declare a uuid;
begin
 perform public.manage_tenant_procedure_library('category_create',null,'{"name":"QA authorized tenant admin"}','91000000-0000-0000-0000-000000000001');
 begin
  perform public.manage_tenant_procedure_library('category_create',null,'{"name":"QA forbidden other tenant"}','91000000-0000-0000-0000-000000000002');
  raise exception 'Cross-tenant access accepted';
 exception when others then if sqlerrm='Cross-tenant access accepted' then raise; end if; end;
 begin
  perform public.manage_platform_procedure_library('category_create',null,'{"name":"QA forbidden platform"}');
  raise exception 'Tenant administrator got platform access';
 exception when others then if sqlerrm='Tenant administrator got platform access' then raise; end if; end;
 if exists(select 1 from public.operations_procedure_categories where organization_id='91000000-0000-0000-0000-000000000002') then raise exception 'Other tenant categories leaked'; end if;
 -- Organization-owned default categories are editable with the same manager permissions.
 select id into a from public.operations_procedure_categories where name='Sales Procedures' and organization_id='91000000-0000-0000-0000-000000000001';
 perform public.manage_tenant_procedure_library('category_update',a,'{"name":"QA renamed default"}','91000000-0000-0000-0000-000000000001');
end; $test$;
reset role;
select set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000002',true);
set local role authenticated;
do $test$
declare changed integer;
begin
 begin
  perform public.manage_tenant_procedure_library('category_create',null,'{"name":"QA forbidden representative"}','91000000-0000-0000-0000-000000000001');
  raise exception 'Representative mutation accepted';
 exception when others then if sqlerrm='Representative mutation accepted' then raise; end if; end;
 update public.operations_procedure_categories set name='QA unauthorized update' where organization_id='91000000-0000-0000-0000-000000000001';
 get diagnostics changed=row_count;
 if changed<>0 then raise exception 'Representative bypassed RLS'; end if;
end; $test$;
reset role;
select 'Isolation, role enforcement, default customization, confirmation, and rollback tests passed' as result;
