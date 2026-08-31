-- Tenant-owned procedure categories. Defaults are copied per organization so
-- dealerships can customize their own library without changing another tenant.
create table public.operations_procedure_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 80),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id)
);

create unique index operations_procedure_categories_org_name_idx
  on public.operations_procedure_categories (organization_id, lower(name));

create or replace function public.seed_operations_procedure_categories(target_organization_id uuid)
returns void language sql security definer set search_path = public as $$
  insert into public.operations_procedure_categories (organization_id, name, is_default)
  values
    (target_organization_id, 'Sales Procedures', true),
    (target_organization_id, 'Delivery & Post-Sale', true),
    (target_organization_id, 'Inventory', true),
    (target_organization_id, 'Service', true),
    (target_organization_id, 'Parts', true),
    (target_organization_id, 'CRM & Lead Management', true),
    (target_organization_id, 'Customer Experience', true),
    (target_organization_id, 'Management', true),
    (target_organization_id, 'Employee & Administrative', true),
    (target_organization_id, 'Other', true),
    (target_organization_id, 'Uncategorized', true)
  on conflict (organization_id, lower(name)) do nothing;
$$;

select public.seed_operations_procedure_categories(id) from public.organizations;

create or replace function public.seed_operations_procedure_categories_for_organization()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.seed_operations_procedure_categories(new.id);
  return new;
end;
$$;

create trigger organizations_seed_operations_procedure_categories
after insert on public.organizations
for each row execute function public.seed_operations_procedure_categories_for_organization();

alter table public.operations_procedures add column category_id uuid;

update public.operations_procedures procedure
set category_id = category_row.id
from public.operations_procedure_categories category_row
where category_row.organization_id = procedure.organization_id
  and category_row.name = case
    when lower(procedure.category) in ('delivery', 'delivery & post-sale') then 'Delivery & Post-Sale'
    when lower(procedure.category) in ('sales floor', 'sales procedures') then 'Sales Procedures'
    when lower(procedure.category) = 'service' then 'Service'
    when lower(procedure.category) in ('store operations', 'safety') then 'Employee & Administrative'
    when lower(procedure.category) = 'inventory' then 'Inventory'
    when lower(procedure.category) = 'parts' then 'Parts'
    when lower(procedure.category) in ('crm', 'crm & lead management') then 'CRM & Lead Management'
    when lower(procedure.category) = 'customer experience' then 'Customer Experience'
    when lower(procedure.category) = 'management' then 'Management'
    else 'Uncategorized'
  end;

alter table public.operations_procedures alter column category_id set not null;
alter table public.operations_procedures
  add constraint operations_procedures_category_org_fkey
  foreign key (category_id, organization_id)
  references public.operations_procedure_categories(id, organization_id) on delete restrict;
create index operations_procedures_org_category_idx
  on public.operations_procedures(organization_id, category_id);

alter table public.operations_procedure_categories enable row level security;
revoke all on public.operations_procedure_categories from anon;
grant select, insert, update, delete on public.operations_procedure_categories to authenticated;
create policy "members read operations procedure categories" on public.operations_procedure_categories for select to authenticated
using (private.is_org_member(organization_id) or private.is_platform_owner());
create policy "managers create custom operations procedure categories" on public.operations_procedure_categories for insert to authenticated
with check (not is_default and private.has_org_role(organization_id, array['tenant_admin', 'manager']::public.organization_role[]));
create policy "managers update custom operations procedure categories" on public.operations_procedure_categories for update to authenticated
using (not is_default and private.has_org_role(organization_id, array['tenant_admin', 'manager']::public.organization_role[]))
with check (not is_default and private.has_org_role(organization_id, array['tenant_admin', 'manager']::public.organization_role[]));
create policy "managers delete custom operations procedure categories" on public.operations_procedure_categories for delete to authenticated
using (not is_default and private.has_org_role(organization_id, array['tenant_admin', 'manager']::public.organization_role[]));

create trigger operations_procedure_categories_set_updated_at before update on public.operations_procedure_categories
for each row execute function private.set_operations_updated_at();
