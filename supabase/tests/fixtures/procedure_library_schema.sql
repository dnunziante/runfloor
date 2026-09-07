create role anon; create role authenticated;
create schema auth; create schema private;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema public,auth,private to authenticated,anon;
create type public.organization_role as enum('tenant_admin','manager','sales_rep');
create table public.profiles(id uuid primary key,full_name text,is_platform_owner boolean default false);
create table public.organizations(id uuid primary key);
create table public.organization_memberships(organization_id uuid references public.organizations,user_id uuid references public.profiles,role public.organization_role,status text default 'active');
create function private.is_platform_owner() returns boolean language sql stable security definer set search_path=public as $$ select coalesce((select is_platform_owner from profiles where id=auth.uid()),false) $$;
create function private.is_org_member(target_org uuid) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from organization_memberships where user_id=auth.uid() and organization_id=target_org and status='active') $$;
create function private.has_org_role(target_org uuid,allowed_roles public.organization_role[]) returns boolean language sql stable security definer set search_path=public as $$ select private.is_platform_owner() or exists(select 1 from organization_memberships where user_id=auth.uid() and organization_id=target_org and status='active' and role=any(allowed_roles)) $$;
create function private.set_operations_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end; $$;
create table public.operations_procedures(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations,
 title text not null check(char_length(title) between 2 and 160),category text not null,owner text not null,summary text not null,
 status text not null default 'draft' check(status in('draft','published','archived')),version integer not null default 1,
 created_by uuid not null references public.profiles,created_at timestamptz default now(),updated_at timestamptz default now(),
 content jsonb not null default '{}',source_type text default 'manual',sort_order integer default 0
);
create table public.operations_procedure_steps(id uuid primary key default gen_random_uuid(),organization_id uuid references public.organizations,procedure_id uuid references public.operations_procedures on delete cascade,title text not null,position integer);
alter table public.operations_procedures enable row level security;
alter table public.operations_procedure_steps enable row level security;
grant select,insert,update,delete on all tables in schema public to authenticated;
create policy "members read operations procedures" on public.operations_procedures for select to authenticated using(private.is_org_member(organization_id) or private.is_platform_owner());
create policy "managers manage operations procedures" on public.operations_procedures for all to authenticated using(private.has_org_role(organization_id,array['tenant_admin','manager']::public.organization_role[])) with check(private.has_org_role(organization_id,array['tenant_admin','manager']::public.organization_role[]));
create policy "members read procedure steps" on public.operations_procedure_steps for select to authenticated using(private.is_org_member(organization_id) or private.is_platform_owner());
create policy "managers manage procedure steps" on public.operations_procedure_steps for all to authenticated using(private.has_org_role(organization_id,array['tenant_admin','manager']::public.organization_role[])) with check(private.has_org_role(organization_id,array['tenant_admin','manager']::public.organization_role[]));
insert into public.profiles values('90000000-0000-0000-0000-000000000001','Local QA owner',true),('90000000-0000-0000-0000-000000000002','Local QA representative',false);
insert into public.organizations values('91000000-0000-0000-0000-000000000001'),('91000000-0000-0000-0000-000000000002');
insert into public.organization_memberships values('91000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000001','tenant_admin','active'),('91000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000002','sales_rep','active');
