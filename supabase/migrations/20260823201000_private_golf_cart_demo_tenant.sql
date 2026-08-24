-- A separate, empty internal test tenant. No BGC data is copied into this workspace.

insert into public.organizations (name, slug, status, industry_template_id, subscription_status, is_internal_demo)
select 'Golf Cart Demo', 'golf-cart-demo', 'active', id, 'active', true
from public.industry_templates
where template_key = 'golf-cart'
on conflict (slug) do update set
  industry_template_id = excluded.industry_template_id,
  subscription_status = excluded.subscription_status,
  is_internal_demo = excluded.is_internal_demo,
  updated_at = now();
