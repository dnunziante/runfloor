-- Category settings and recoverable archives; existing procedure content is retained.
create table public.platform_procedure_categories (
 id uuid primary key default gen_random_uuid(), name text not null unique check (char_length(btrim(name)) between 2 and 120),
 description text not null default '' check (char_length(description) <= 1000),
 style_name text not null default '', sort_order integer not null default 1000,
 archived_at timestamptz, archived_by uuid references public.profiles(id) on delete set null,
 created_at timestamptz not null default now()
);
create unique index platform_procedure_categories_name_ci on public.platform_procedure_categories(lower(name));
alter table public.platform_procedure_categories enable row level security;
revoke all on public.platform_procedure_categories from anon;
grant select,insert,update,delete on public.platform_procedure_categories to authenticated;
create policy "read platform procedure categories" on public.platform_procedure_categories for select to authenticated using (archived_at is null or private.is_platform_owner());
create policy "owners manage platform procedure categories" on public.platform_procedure_categories for all to authenticated using (private.is_platform_owner()) with check (private.is_platform_owner());
insert into public.platform_procedure_categories(name,style_name,sort_order)
 select name,name,ordinality::integer from unnest(array['Sales Procedures','Delivery & Post-Sale','Inventory','Service','Parts','CRM & Lead Management','Customer Experience','Management','Employee & Administrative','Other','Uncategorized']) with ordinality as defaults(name,ordinality);
insert into public.platform_procedure_categories(name,style_name) select distinct category,category from public.platform_procedure_templates on conflict(name) do nothing;
alter table public.platform_procedure_templates add constraint platform_procedure_category_fkey foreign key(category) references public.platform_procedure_categories(name) on update cascade on delete restrict;
alter table public.operations_procedure_categories
 add column description text not null default '' check(char_length(description)<=1000),
 add column style_name text not null default '',
 add column sort_order integer not null default 1000,
 add column archived_at timestamptz,
 add column archived_by uuid references public.profiles(id) on delete set null;
update public.operations_procedure_categories set style_name=name, sort_order=coalesce(array_position(array['Sales Procedures','Delivery & Post-Sale','Inventory','Service','Parts','CRM & Lead Management','Customer Experience','Management','Employee & Administrative','Other','Uncategorized'],name),1000);
-- Defaults are organization-owned copies and are now customizable.
drop policy "managers update custom operations procedure categories" on public.operations_procedure_categories;
drop policy "managers delete custom operations procedure categories" on public.operations_procedure_categories;
create policy "managers update operations procedure categories" on public.operations_procedure_categories for update to authenticated
 using(private.has_org_role(organization_id,array['tenant_admin','manager']::public.organization_role[]))
 with check(private.has_org_role(organization_id,array['tenant_admin','manager']::public.organization_role[]));
create policy "managers delete operations procedure categories" on public.operations_procedure_categories for delete to authenticated
 using(private.has_org_role(organization_id,array['tenant_admin','manager']::public.organization_role[]));

alter table public.platform_procedure_templates
 add column archived_at timestamptz,
 add column archived_by uuid references public.profiles(id) on delete set null,
 add column archive_category_id uuid,
 add column original_category text;

create index platform_procedure_categories_archive_idx on public.platform_procedure_categories (archived_at,sort_order);
create index platform_procedure_templates_archive_idx on public.platform_procedure_templates (archived_at);

alter table public.operations_procedures
 add column archived_at timestamptz,
 add column archived_by uuid references public.profiles(id) on delete set null,
 add column archive_category_id uuid,
 add column original_category text;
alter table public.operations_procedures add column archived_previous_status text;
create index operations_procedure_categories_archive_idx on public.operations_procedure_categories (organization_id,archived_at,sort_order);
create index operations_procedures_archive_idx on public.operations_procedures (organization_id,archived_at);
-- Preserve legacy archived procedures without guessing the user who archived them.
update public.operations_procedures set archived_at=updated_at,original_category=category,archived_previous_status='draft' where status='archived';
alter policy "members read published platform procedure templates" on public.platform_procedure_templates using ((is_published and archived_at is null) or private.is_platform_owner());

-- SECURITY INVOKER: every read and write remains subject to the caller's RLS.
create function public.manage_platform_procedure_library(action text,item_id uuid default null,payload jsonb default '{}'::jsonb)
returns uuid language plpgsql security invoker set search_path='' as $$
declare c public.platform_procedure_categories%rowtype; d public.platform_procedure_categories%rowtype; v_procedure public.platform_procedure_templates%rowtype;
 new_id uuid; choice text; dest uuid; other_id uuid; other_order integer; source_order integer; stamp timestamptz:=clock_timestamp();
begin
 if auth.uid() is null or not (private.is_platform_owner()) then raise exception 'Management access is required.'; end if;
 -- Serialize category changes, including new procedures/moves performed through this RPC.
 perform c0.id from public.platform_procedure_categories c0 where true order by c0.id for update;
 if action='category_create' then
  insert into public.platform_procedure_categories (name,description,sort_order)
  values(btrim(payload->>'name'),coalesce(payload->>'description',''),coalesce((select max(c0.sort_order)+1 from public.platform_procedure_categories c0 where true),1)) returning id into new_id;
  return new_id;
 end if;
 if action like 'category_%' then
  select * into c from public.platform_procedure_categories c0 where c0.id=item_id and true for update;
  if not found then raise exception 'Category not found or access denied.'; end if;
  if action='category_update' then
   if c.archived_at is not null then raise exception 'Restore the category before editing it.'; end if;
   update public.platform_procedure_categories set name=btrim(payload->>'name'),description=coalesce(payload->>'description','') where id=c.id;
   
  elsif action='category_reorder' then
   if c.archived_at is not null then raise exception 'Restore the category before reordering it.'; end if;
   -- Normalize order before swapping so equal initial positions remain deterministic.
   with ranked as (select c0.id,row_number() over(order by c0.sort_order,c0.name,c0.id)::integer n from public.platform_procedure_categories c0 where true and c0.archived_at is null)
   update public.platform_procedure_categories c0 set sort_order=ranked.n from ranked where c0.id=ranked.id;
   select sort_order into source_order from public.platform_procedure_categories where id=c.id;
   if payload->>'direction' not in ('up','down') then raise exception 'Invalid direction.'; end if;
   other_order:=source_order+case when payload->>'direction'='up' then -1 else 1 end;
   select c0.id into other_id from public.platform_procedure_categories c0 where true and c0.archived_at is null and c0.sort_order=other_order;
   if other_id is not null then
    update public.platform_procedure_categories set sort_order=case when id=c.id then other_order else source_order end where id in(c.id,other_id);
   end if;
  elsif action='category_archive' then
   if c.archived_at is not null then raise exception 'Category is already archived.'; end if;
   update public.platform_procedure_categories set archived_at=stamp,archived_by=auth.uid() where id=c.id;
   update public.platform_procedure_templates p set archived_at=stamp,archived_by=auth.uid(),archive_category_id=c.id,original_category=c.name
    where p.category=c.name and true and p.archived_at is null;
  elsif action='category_restore' then
   if c.archived_at is null then raise exception 'Category is not archived.'; end if;
   update public.platform_procedure_categories set archived_at=null,archived_by=null where id=c.id;
   update public.platform_procedure_templates p set archived_at=null,archived_by=null,archive_category_id=null,original_category=null
    where p.archive_category_id=c.id and true;
  elsif action='category_delete' then
   if coalesce((payload->>'confirmed')::boolean,false) is not true then raise exception 'Confirm deletion first.'; end if;
   choice:=payload->>'disposition';
   if choice not in ('move','uncategorized','archive','delete') or choice is null then raise exception 'Choose what should happen to the procedures.'; end if;
   if choice in ('move','uncategorized','archive') then
    if choice='move' then
     dest:=(payload->>'destination')::uuid;
     select * into d from public.platform_procedure_categories d0 where d0.id=dest and true and d0.archived_at is null;
     if not found or d.id=c.id then raise exception 'Choose a different active category.'; end if;
    else
     if lower(c.name)='uncategorized' then raise exception 'Choose another category or delete its procedures.'; end if;
     select * into d from public.platform_procedure_categories d0 where lower(d0.name)='uncategorized' and true and d0.archived_at is null;
     if not found then
      if exists(select 1 from public.platform_procedure_categories d0 where lower(d0.name)='uncategorized' and true) then raise exception 'Restore Uncategorized or choose another destination.'; end if;
      insert into public.platform_procedure_categories(name) values('Uncategorized') returning * into d;
     end if;
    end if;
    if choice='archive' then
     update public.platform_procedure_templates p set archived_at=stamp,archived_by=auth.uid(),original_category=c.name
      where p.category=c.name and true and p.archived_at is null;
    end if;
    -- Archived items remain archived when moved; retain their original category label.
    update public.platform_procedure_templates p set category=d.name,archive_category_id=null,
     original_category=case when p.archived_at is not null then coalesce(p.original_category,c.name) else null end
     where p.category=c.name and true;
   else
    delete from public.platform_procedure_templates p where p.category=c.name and true;
   end if;
   delete from public.platform_procedure_categories where id=c.id;
  else raise exception 'Unknown category action.';
  end if;
  return c.id;
 end if;
 select * into v_procedure from public.platform_procedure_templates p0 where p0.id=item_id and true for update;
 if not found then raise exception 'Procedure not found or access denied.'; end if;
 if action='procedure_archive' then
  if v_procedure.archived_at is not null then raise exception 'Procedure is already archived.'; end if;
  update public.platform_procedure_templates set archived_at=stamp,archived_by=auth.uid(),original_category=v_procedure.category,archive_category_id=null where id=v_procedure.id;
 elsif action in ('procedure_move','procedure_restore') then
  dest:=nullif(payload->>'destination','')::uuid;
  select * into d from public.platform_procedure_categories d0 where true and d0.archived_at is null
   and (case when dest is not null then d0.id=dest else d0.name=v_procedure.category end);
  if not found then raise exception 'The original category is unavailable. Restore it or choose an active category.'; end if;
  if action='procedure_restore' then
   if v_procedure.archived_at is null then raise exception 'Procedure is not archived.'; end if;
   update public.platform_procedure_templates set category=d.name,archived_at=null,archived_by=null,archive_category_id=null,original_category=null where id=v_procedure.id;
  else
   update public.platform_procedure_templates set category=d.name,archive_category_id=null where id=v_procedure.id;
  end if;
 elsif action='procedure_duplicate' then
  if v_procedure.archived_at is not null then raise exception 'Restore the procedure before duplicating it.'; end if;
  insert into public.platform_procedure_templates(title,category,owner,summary,steps,content,version,is_published,created_by)
   values(left(v_procedure.title,153)||' - Copy',v_procedure.category,v_procedure.owner,v_procedure.summary,v_procedure.steps,v_procedure.content,v_procedure.version,v_procedure.is_published,auth.uid()) returning id into new_id;
  return new_id;
 elsif action='procedure_delete' then
  if coalesce((payload->>'confirmed')::boolean,false) is not true then raise exception 'Confirm deletion first.'; end if;
  delete from public.platform_procedure_templates where id=v_procedure.id;
 else raise exception 'Unknown procedure action.';
 end if;
 return v_procedure.id;
end;
$$;
revoke all on function public.manage_platform_procedure_library(text,uuid,jsonb) from public,anon;
grant execute on function public.manage_platform_procedure_library(text,uuid,jsonb) to authenticated;

-- SECURITY INVOKER: every read and write remains subject to the caller's RLS.
create function public.manage_tenant_procedure_library(action text,item_id uuid default null,payload jsonb default '{}'::jsonb,target_organization uuid default null)
returns uuid language plpgsql security invoker set search_path='' as $$
declare c public.operations_procedure_categories%rowtype; d public.operations_procedure_categories%rowtype; v_procedure public.operations_procedures%rowtype;
 new_id uuid; choice text; dest uuid; other_id uuid; other_order integer; source_order integer; stamp timestamptz:=clock_timestamp();
begin
 if auth.uid() is null or not (private.has_org_role(target_organization,array['tenant_admin','manager']::public.organization_role[])) then raise exception 'Management access is required.'; end if;
 -- Serialize category changes, including new procedures/moves performed through this RPC.
 perform c0.id from public.operations_procedure_categories c0 where c0.organization_id=target_organization order by c0.id for update;
 if action='category_create' then
  insert into public.operations_procedure_categories (organization_id,name,description,sort_order)
  values(target_organization,btrim(payload->>'name'),coalesce(payload->>'description',''),coalesce((select max(c0.sort_order)+1 from public.operations_procedure_categories c0 where c0.organization_id=target_organization),1)) returning id into new_id;
  return new_id;
 end if;
 if action like 'category_%' then
  select * into c from public.operations_procedure_categories c0 where c0.id=item_id and c0.organization_id=target_organization for update;
  if not found then raise exception 'Category not found or access denied.'; end if;
  if action='category_update' then
   if c.archived_at is not null then raise exception 'Restore the category before editing it.'; end if;
   update public.operations_procedure_categories set name=btrim(payload->>'name'),description=coalesce(payload->>'description','') where id=c.id;
   update public.operations_procedures p set category=btrim(payload->>'name') where p.category_id=c.id and p.organization_id=target_organization;
  elsif action='category_reorder' then
   if c.archived_at is not null then raise exception 'Restore the category before reordering it.'; end if;
   -- Normalize order before swapping so equal initial positions remain deterministic.
   with ranked as (select c0.id,row_number() over(order by c0.sort_order,c0.name,c0.id)::integer n from public.operations_procedure_categories c0 where c0.organization_id=target_organization and c0.archived_at is null)
   update public.operations_procedure_categories c0 set sort_order=ranked.n from ranked where c0.id=ranked.id;
   select sort_order into source_order from public.operations_procedure_categories where id=c.id;
   if payload->>'direction' not in ('up','down') then raise exception 'Invalid direction.'; end if;
   other_order:=source_order+case when payload->>'direction'='up' then -1 else 1 end;
   select c0.id into other_id from public.operations_procedure_categories c0 where c0.organization_id=target_organization and c0.archived_at is null and c0.sort_order=other_order;
   if other_id is not null then
    update public.operations_procedure_categories set sort_order=case when id=c.id then other_order else source_order end where id in(c.id,other_id);
   end if;
  elsif action='category_archive' then
   if c.archived_at is not null then raise exception 'Category is already archived.'; end if;
   update public.operations_procedure_categories set archived_at=stamp,archived_by=auth.uid() where id=c.id;
   update public.operations_procedures p set archived_at=stamp,archived_by=auth.uid(),archive_category_id=c.id,original_category=c.name, archived_previous_status=status, status='archived'
    where p.category_id=c.id and p.organization_id=target_organization and p.archived_at is null;
  elsif action='category_restore' then
   if c.archived_at is null then raise exception 'Category is not archived.'; end if;
   update public.operations_procedure_categories set archived_at=null,archived_by=null where id=c.id;
   update public.operations_procedures p set archived_at=null,archived_by=null,archive_category_id=null,original_category=null, status=coalesce(archived_previous_status,'draft'), archived_previous_status=null
    where p.archive_category_id=c.id and p.organization_id=target_organization;
  elsif action='category_delete' then
   if coalesce((payload->>'confirmed')::boolean,false) is not true then raise exception 'Confirm deletion first.'; end if;
   choice:=payload->>'disposition';
   if choice not in ('move','uncategorized','archive','delete') or choice is null then raise exception 'Choose what should happen to the procedures.'; end if;
   if choice in ('move','uncategorized','archive') then
    if choice='move' then
     dest:=(payload->>'destination')::uuid;
     select * into d from public.operations_procedure_categories d0 where d0.id=dest and d0.organization_id=target_organization and d0.archived_at is null;
     if not found or d.id=c.id then raise exception 'Choose a different active category.'; end if;
    else
     if lower(c.name)='uncategorized' then raise exception 'Choose another category or delete its procedures.'; end if;
     select * into d from public.operations_procedure_categories d0 where lower(d0.name)='uncategorized' and d0.organization_id=target_organization and d0.archived_at is null;
     if not found then
      if exists(select 1 from public.operations_procedure_categories d0 where lower(d0.name)='uncategorized' and d0.organization_id=target_organization) then raise exception 'Restore Uncategorized or choose another destination.'; end if;
      insert into public.operations_procedure_categories(organization_id,name) values(target_organization,'Uncategorized') returning * into d;
     end if;
    end if;
    if choice='archive' then
     update public.operations_procedures p set archived_at=stamp,archived_by=auth.uid(),original_category=c.name, archived_previous_status=status, status='archived'
      where p.category_id=c.id and p.organization_id=target_organization and p.archived_at is null;
    end if;
    -- Archived items remain archived when moved; retain their original category label.
    update public.operations_procedures p set category_id=d.id, category=d.name,archive_category_id=null,
     original_category=case when p.archived_at is not null then coalesce(p.original_category,c.name) else null end
     where p.category_id=c.id and p.organization_id=target_organization;
   else
    delete from public.operations_procedures p where p.category_id=c.id and p.organization_id=target_organization;
   end if;
   delete from public.operations_procedure_categories where id=c.id;
  else raise exception 'Unknown category action.';
  end if;
  return c.id;
 end if;
 select * into v_procedure from public.operations_procedures p0 where p0.id=item_id and p0.organization_id=target_organization for update;
 if not found then raise exception 'Procedure not found or access denied.'; end if;
 if action='procedure_archive' then
  if v_procedure.archived_at is not null then raise exception 'Procedure is already archived.'; end if;
  update public.operations_procedures set archived_at=stamp,archived_by=auth.uid(),original_category=v_procedure.category,archive_category_id=null, archived_previous_status=status, status='archived' where id=v_procedure.id;
 elsif action in ('procedure_move','procedure_restore') then
  dest:=nullif(payload->>'destination','')::uuid;
  select * into d from public.operations_procedure_categories d0 where d0.organization_id=target_organization and d0.archived_at is null
   and (case when dest is not null then d0.id=dest else d0.id=v_procedure.category_id end);
  if not found then raise exception 'The original category is unavailable. Restore it or choose an active category.'; end if;
  if action='procedure_restore' then
   if v_procedure.archived_at is null then raise exception 'Procedure is not archived.'; end if;
   update public.operations_procedures set category_id=d.id, category=d.name,archived_at=null,archived_by=null,archive_category_id=null,original_category=null, status=coalesce(archived_previous_status,'draft'), archived_previous_status=null where id=v_procedure.id;
  else
   update public.operations_procedures set category_id=d.id, category=d.name,archive_category_id=null where id=v_procedure.id;
  end if;
 elsif action='procedure_duplicate' then
  if v_procedure.archived_at is not null then raise exception 'Restore the procedure before duplicating it.'; end if;
  insert into public.operations_procedures(organization_id,title,category_id,category,owner,summary,status,version,content,source_type,sort_order,created_by)
   values(target_organization,left(v_procedure.title,153)||' - Copy',v_procedure.category_id,v_procedure.category,v_procedure.owner,v_procedure.summary,v_procedure.status,v_procedure.version,v_procedure.content,v_procedure.source_type,v_procedure.sort_order,auth.uid()) returning id into new_id;
   insert into public.operations_procedure_steps(organization_id,procedure_id,title,position)
    select target_organization,new_id,s.title,s.position from public.operations_procedure_steps s where s.procedure_id=v_procedure.id and s.organization_id=target_organization;
  return new_id;
 elsif action='procedure_delete' then
  if coalesce((payload->>'confirmed')::boolean,false) is not true then raise exception 'Confirm deletion first.'; end if;
  delete from public.operations_procedures where id=v_procedure.id;
 else raise exception 'Unknown procedure action.';
 end if;
 return v_procedure.id;
end;
$$;
revoke all on function public.manage_tenant_procedure_library(text,uuid,jsonb,uuid) from public,anon;
grant execute on function public.manage_tenant_procedure_library(text,uuid,jsonb,uuid) to authenticated;
-- Block creating/restoring active procedures inside archived categories, including legacy CRUD paths.
create function private.validate_platform_procedure_category() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.archived_at is null and (tg_op='INSERT' or new.category is distinct from old.category or old.archived_at is not null) then
  perform id from public.platform_procedure_categories where name=new.category and archived_at is null for share;
  if not found then raise exception 'Choose an active platform category.'; end if;
 end if;
 return new;
end; $$;
create trigger validate_platform_procedure_category before insert or update of category,archived_at on public.platform_procedure_templates for each row execute function private.validate_platform_procedure_category();
create function private.validate_tenant_procedure_category() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.archived_at is null and (tg_op='INSERT' or new.category_id is distinct from old.category_id or old.archived_at is not null) then
  perform id from public.operations_procedure_categories where id=new.category_id and organization_id=new.organization_id and archived_at is null for share;
  if not found then raise exception 'Choose an active category in your organization.'; end if;
 end if;
 return new;
end; $$;
create trigger validate_tenant_procedure_category before insert or update of category_id,archived_at on public.operations_procedures for each row execute function private.validate_tenant_procedure_category();
-- New organization defaults retain the original visual order.
create function private.initialize_procedure_category_style() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.style_name='' then new.style_name:=new.name; end if;
 if new.sort_order=1000 then new.sort_order:=coalesce(array_position(array['Sales Procedures','Delivery & Post-Sale','Inventory','Service','Parts','CRM & Lead Management','Customer Experience','Management','Employee & Administrative','Other','Uncategorized'],new.name),1000); end if;
 return new;
end; $$;
create trigger initialize_tenant_procedure_category_style before insert on public.operations_procedure_categories for each row execute function private.initialize_procedure_category_style();
create trigger initialize_platform_procedure_category_style before insert on public.platform_procedure_categories for each row execute function private.initialize_procedure_category_style();
