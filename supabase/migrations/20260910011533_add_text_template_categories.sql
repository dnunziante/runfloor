create table public.text_template_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 120),
  position integer not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index text_template_categories_org_name_idx
  on public.text_template_categories (organization_id, lower(name));
create index text_template_categories_org_position_idx
  on public.text_template_categories (organization_id, archived, position);

alter table public.text_template_categories enable row level security;

create policy "members read text template categories"
on public.text_template_categories for select to authenticated
using (private.is_org_member(organization_id) or private.is_platform_owner());

create policy "tenant admins manage text template categories"
on public.text_template_categories for all to authenticated
using (private.has_org_role(organization_id, array['tenant_admin']::public.organization_role[]) or private.is_platform_owner())
with check (private.has_org_role(organization_id, array['tenant_admin']::public.organization_role[]) or private.is_platform_owner());

insert into public.text_template_categories (organization_id, name, position)
select organization.id, category.name, category.position
from public.organizations organization
cross join (values
  ('New Lead', 10), ('Follow-Up', 20), ('Appointments', 30), ('Product & Inventory', 40),
  ('Quotes & Pricing', 50), ('Financing', 60), ('Trade-In', 70), ('Objection Follow-Up', 80),
  ('Closing', 90), ('Delivery & Pickup', 100), ('Post-Sale', 110), ('Service', 120),
  ('Promotions', 130), ('Lost Lead / Re-Engagement', 140), ('Customer Care', 150)
) as category(name, position)
on conflict do nothing;
