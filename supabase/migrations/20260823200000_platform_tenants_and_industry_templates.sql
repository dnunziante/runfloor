-- Additive multi-tenant platform metadata. Existing organization-owned data remains unchanged.

create table public.industry_templates (
  id uuid primary key default gen_random_uuid(),
  template_key text not null unique check (template_key ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null unique check (char_length(name) between 2 and 120),
  starter_configuration jsonb not null default '{}'::jsonb check (jsonb_typeof(starter_configuration) = 'object'),
  is_enabled boolean not null default true,
  is_internal_only boolean not null default false,
  is_public_demo_visible boolean not null default false,
  is_available_during_signup boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.organizations
  add column if not exists industry_template_id uuid references public.industry_templates(id) on delete set null,
  add column if not exists logo_path text,
  add column if not exists branding_settings jsonb not null default '{}'::jsonb check (jsonb_typeof(branding_settings) = 'object'),
  add column if not exists subscription_status text not null default 'trial' check (subscription_status in ('trial', 'active', 'past_due', 'suspended', 'cancelled')),
  add column if not exists is_internal_demo boolean not null default false;

create index if not exists organizations_industry_template_idx on public.organizations(industry_template_id);
create index if not exists organizations_internal_demo_idx on public.organizations(is_internal_demo) where is_internal_demo;

create table public.platform_workspace_contexts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  active_organization_id uuid not null references public.organizations(id) on delete cascade,
  updated_at timestamptz not null default now()
);
create index platform_workspace_contexts_active_org_idx on public.platform_workspace_contexts(active_organization_id);

alter table public.industry_templates enable row level security;
alter table public.platform_workspace_contexts enable row level security;

create policy "platform owners read industry templates"
on public.industry_templates for select to authenticated
using (private.is_platform_owner());
create policy "platform owners manage industry templates"
on public.industry_templates for all to authenticated
using (private.is_platform_owner())
with check (private.is_platform_owner());

create policy "users read own workspace context"
on public.platform_workspace_contexts for select to authenticated
using (user_id = (select auth.uid()));
create policy "users set permitted workspace context"
on public.platform_workspace_contexts for insert to authenticated
with check (user_id = (select auth.uid()) and (private.is_platform_owner() or private.is_org_member(active_organization_id)));
create policy "users update permitted workspace context"
on public.platform_workspace_contexts for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()) and (private.is_platform_owner() or private.is_org_member(active_organization_id)));
create policy "users remove own workspace context"
on public.platform_workspace_contexts for delete to authenticated
using (user_id = (select auth.uid()));

grant select, insert, update, delete on public.industry_templates to authenticated;
grant select, insert, update, delete on public.platform_workspace_contexts to authenticated;

insert into public.industry_templates (template_key, name, starter_configuration, is_enabled, is_internal_only, is_public_demo_visible, is_available_during_signup)
values
  ('golf-cart', 'Golf Cart', '{"terminology":{"customer":"Customer","lead":"Lead","product":"Golf Cart / LSV","salesRep":"Sales Rep","manager":"Manager","location":"Location"}}'::jsonb, true, true, false, false),
  ('rv', 'RV', '{"terminology":{"customer":"Customer","lead":"Lead","product":"RV","salesRep":"Sales Rep","manager":"Manager","location":"Location"}}'::jsonb, true, false, true, true),
  ('marine', 'Marine', '{"terminology":{"customer":"Customer","lead":"Lead","product":"Boat","salesRep":"Sales Rep","manager":"Manager","location":"Location"}}'::jsonb, true, false, true, true),
  ('powersports', 'Powersports', '{"terminology":{"customer":"Customer","lead":"Lead","product":"Vehicle","salesRep":"Sales Rep","manager":"Manager","location":"Location"}}'::jsonb, true, false, true, true),
  ('automotive', 'Automotive', '{"terminology":{"customer":"Customer","lead":"Lead","product":"Vehicle","salesRep":"Sales Rep","manager":"Manager","location":"Location"}}'::jsonb, true, false, true, true),
  ('general-sales', 'General Sales', '{"terminology":{"customer":"Customer","lead":"Lead","product":"Product / Service","salesRep":"Sales Rep","manager":"Manager","location":"Location"}}'::jsonb, true, false, true, true)
on conflict (template_key) do update set
  name = excluded.name,
  starter_configuration = excluded.starter_configuration,
  is_enabled = excluded.is_enabled,
  is_internal_only = excluded.is_internal_only,
  is_public_demo_visible = excluded.is_public_demo_visible,
  is_available_during_signup = excluded.is_available_during_signup,
  updated_at = now();

update public.organizations
set industry_template_id = (select id from public.industry_templates where template_key = 'golf-cart')
where slug = 'bgc-dealerships' and industry_template_id is null;
