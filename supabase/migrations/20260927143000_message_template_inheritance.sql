-- sales_content_items remains the single source of truth. Platform-owner-created
-- message templates inherit through the tenant's assigned industry template;
-- tenant-created templates remain private to their organization.
alter table public.sales_content_items
  add column if not exists industry_template_id uuid references public.industry_templates(id) on delete set null;

create index if not exists sales_content_items_industry_type_status_idx
  on public.sales_content_items(industry_template_id, content_type, status, updated_at desc)
  where industry_template_id is not null;

create or replace function private.assign_message_template_industry()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.industry_template_id is null
     and new.content_type in ('email_template', 'text_template')
     and exists (select 1 from public.profiles where id = new.created_by and is_platform_owner = true) then
    select industry_template_id into new.industry_template_id
    from public.organizations where id = new.organization_id;
  end if;
  return new;
end;
$$;

drop trigger if exists assign_message_template_industry on public.sales_content_items;
create trigger assign_message_template_industry
before insert on public.sales_content_items
for each row execute function private.assign_message_template_industry();

-- Idempotent backfill: tag records in place; never copy template content.
update public.sales_content_items item
set industry_template_id = organization.industry_template_id
from public.organizations organization
where item.organization_id = organization.id
  and item.industry_template_id is null
  and item.content_type in ('email_template', 'text_template')
  and organization.industry_template_id is not null
  and exists (select 1 from public.profiles where id = item.created_by and is_platform_owner = true);

drop policy if exists "members read sales content" on public.sales_content_items;
create policy "members read sales content"
  on public.sales_content_items for select to authenticated
  using (
    private.is_platform_owner()
    or (private.is_org_member(organization_id) and status = 'published')
    or private.has_org_role(organization_id, array['tenant_admin']::public.organization_role[])
    or (
      status = 'published'
      and industry_template_id is not null
      and exists (
        select 1
        from public.organization_memberships membership
        join public.organizations organization on organization.id = membership.organization_id
        where membership.user_id = auth.uid()
          and membership.status = 'active'
          and organization.industry_template_id = sales_content_items.industry_template_id
      )
    )
  );
