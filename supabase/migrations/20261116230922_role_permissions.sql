create table public.organization_role_permissions (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  role public.organization_role not null,
  permissions jsonb not null,
  revision integer not null default 1,
  updated_at timestamptz not null default now(),
  updated_by uuid not null references auth.users(id),
  primary key (organization_id, role)
);
alter table public.organization_role_permissions enable row level security;
revoke all on public.organization_role_permissions from anon, public;
grant select, insert, update on public.organization_role_permissions to authenticated;

create function private.default_role_permissions(target_role public.organization_role)
returns jsonb language sql immutable set search_path='' as $$
  select jsonb_build_object('sales_ai',true,'inventory',true,'comparisons',true,'messages',true,
    'knowledge',true,'calculator',true,'sales_reports',true,'coaching',true,'operations',true,
    'executive',target_role in ('tenant_admin','manager'),'billing',true,'administration',target_role='tenant_admin')
$$;

create function private.role_permissions_for(target_org uuid,target_role public.organization_role)
returns jsonb language sql stable security invoker set search_path='' as $$
  select coalesce((select permissions from public.organization_role_permissions
    where organization_id=target_org and role=target_role), private.default_role_permissions(target_role))
$$;

create policy "Members read position permissions" on public.organization_role_permissions for select to authenticated
using (private.is_org_member(organization_id) or private.is_platform_owner());
create policy "Admins and managers insert position permissions" on public.organization_role_permissions for insert to authenticated
with check (private.has_org_role(organization_id,array['tenant_admin']::public.organization_role[])
  or (role in ('manager','salesperson') and private.has_org_role(organization_id,array['manager']::public.organization_role[])));
create policy "Admins and managers update position permissions" on public.organization_role_permissions for update to authenticated
using (private.has_org_role(organization_id,array['tenant_admin']::public.organization_role[])
  or (role in ('manager','salesperson') and private.has_org_role(organization_id,array['manager']::public.organization_role[])))
with check (private.has_org_role(organization_id,array['tenant_admin']::public.organization_role[])
  or (role in ('manager','salesperson') and private.has_org_role(organization_id,array['manager']::public.organization_role[])));

create table private.role_permission_audit (
  id bigint generated always as identity primary key,
  organization_id uuid not null,
  role public.organization_role not null,
  actor_id uuid not null,
  before_permissions jsonb,
  after_permissions jsonb not null,
  changed_at timestamptz not null default now()
);
revoke all on private.role_permission_audit from public, anon, authenticated;

-- A private trigger needs elevated access only to record the audit and inspect the
-- previous Manager ceiling. Every write independently authenticates and validates scope.
create function private.validate_role_permission_change()
returns trigger language plpgsql security definer set search_path='' as $$
declare actor_role public.organization_role; owner_actor boolean; ceiling jsonb; defaults jsonb; previous_permissions jsonb; entry record;
begin
  if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(new.organization_id::text,0));
  owner_actor := private.is_platform_owner();
  select role into actor_role from public.organization_memberships
    where organization_id=new.organization_id and user_id=auth.uid() and status='active';
  if not owner_actor and (actor_role is null or actor_role='salesperson' or (actor_role='manager' and new.role='tenant_admin')) then
    raise exception 'You cannot edit this position' using errcode='42501';
  end if;
  if tg_op='UPDATE' and (new.organization_id<>old.organization_id or new.role<>old.role) then
    raise exception 'Position and workspace cannot be changed' using errcode='42501';
  end if;
  defaults := private.default_role_permissions(new.role);
  if jsonb_typeof(new.permissions)<>'object' or (select count(*) from jsonb_object_keys(new.permissions))<>12 then
    raise exception 'Invalid permission selection' using errcode='22023';
  end if;
  ceiling := private.role_permissions_for(new.organization_id,'manager');
  previous_permissions := private.role_permissions_for(new.organization_id,new.role);
  for entry in select * from jsonb_each(new.permissions) loop
    if not defaults ? entry.key or jsonb_typeof(entry.value)<>'boolean' then
      raise exception 'Invalid permission selection' using errcode='22023';
    end if;
    if entry.value='true'::jsonb and (defaults->entry.key<>'true'::jsonb or
      (not owner_actor and actor_role='manager' and ceiling->entry.key<>'true'::jsonb and previous_permissions->entry.key<>'true'::jsonb)) then
      raise exception 'This permission is outside your role limits' using errcode='42501';
    end if;
  end loop;
  new.updated_by:=auth.uid(); new.updated_at:=now();
  new.revision:=case when tg_op='UPDATE' then old.revision+1 else 1 end;
  insert into private.role_permission_audit(organization_id,role,actor_id,before_permissions,after_permissions)
    values(new.organization_id,new.role,auth.uid(),case when tg_op='UPDATE' then old.permissions else null end,new.permissions);
  return new;
end $$;
revoke all on function private.validate_role_permission_change() from public,anon,authenticated;
create trigger validate_role_permission_change before insert or update on public.organization_role_permissions
for each row execute function private.validate_role_permission_change();

create function public.save_role_permissions(target_org uuid,target_role public.organization_role,selected_permissions jsonb,expected_revision integer)
returns integer language plpgsql security invoker set search_path='' as $$
declare saved_revision integer;
begin
  if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(target_org::text,0));
  if coalesce((select revision from public.organization_role_permissions where organization_id=target_org and role=target_role),0)<>expected_revision then
    raise exception 'Permissions changed. Reload this page before saving.' using errcode='40001';
  end if;
  if expected_revision=0 then
    insert into public.organization_role_permissions(organization_id,role,permissions,updated_by)
      values(target_org,target_role,selected_permissions,auth.uid()) returning revision into saved_revision;
  else
    update public.organization_role_permissions set permissions=selected_permissions
      where organization_id=target_org and role=target_role returning revision into saved_revision;
  end if;
  if saved_revision is null then raise exception 'Permission update denied' using errcode='42501'; end if;
  return saved_revision;
end $$;
revoke all on function public.save_role_permissions(uuid,public.organization_role,jsonb,integer) from public,anon;
grant execute on function public.save_role_permissions(uuid,public.organization_role,jsonb,integer) to authenticated;
revoke all on function private.default_role_permissions(public.organization_role),private.role_permissions_for(uuid,public.organization_role) from public,anon;
grant execute on function private.default_role_permissions(public.organization_role),private.role_permissions_for(uuid,public.organization_role) to authenticated;

create function private.has_area_permission(target_org uuid,permission_key text)
returns boolean language sql stable security invoker set search_path='' as $$
  select private.is_platform_owner() or exists(select 1 from public.organization_memberships m
    where m.organization_id=target_org and m.user_id=auth.uid() and m.status='active'
      and private.role_permissions_for(target_org,m.role)->permission_key='true'::jsonb)
$$;
revoke all on function private.has_area_permission(uuid,text) from public,anon;
grant execute on function private.has_area_permission(uuid,text) to authenticated;

-- These policies only narrow existing rights; no existing tenant or role boundary
-- is broadened. Platform-only billing and Opal controls retain their own rules.
do $$ declare t record; permission_key text;
begin
  for t in select table_name from information_schema.columns
    where table_schema='public' and column_name='organization_id'
      and table_name<>'organization_role_permissions' loop
    permission_key:=case
      when t.table_name like 'operations_%' then 'operations'
      when t.table_name like 'executive_%' or t.table_name like 'growth_%' then 'executive'
      when t.table_name like 'coach_%' or t.table_name like 'training_%' then 'coaching'
      when t.table_name in ('products','product_families','product_documents') then 'inventory'
      when t.table_name like 'competitor_%' then 'comparisons'
      when t.table_name in ('knowledge_documents','knowledge_document_chunks') then 'knowledge'
      when t.table_name in ('sales_content_items','text_template_categories') then 'messages'
      else null end;
    if permission_key is not null then
      execute format('create policy "Position area access" on public.%I as restrictive for all to authenticated using (private.has_area_permission(organization_id,%L)) with check (private.has_area_permission(organization_id,%L))',t.table_name,permission_key,permission_key);
    end if;
  end loop;
end $$;
