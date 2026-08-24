-- Seed a deliberately generic starter catalog for the private Golf Cart Demo tenant.
-- This migration is idempotent and never reads from or changes another tenant.

with demo_tenant as (
  select id
  from public.organizations
  where slug = 'golf-cart-demo'
), families as (
  insert into public.product_families (
    organization_id, name, slug, description, sort_order
  )
  select demo_tenant.id, seed.name, seed.slug, seed.description, seed.sort_order
  from demo_tenant
  cross join (
    values
      ('Demo Utility', 'demo-utility', 'Generic utility models for private workspace testing.', 10),
      ('Demo Touring', 'demo-touring', 'Generic touring models for private workspace testing.', 20)
  ) as seed(name, slug, description, sort_order)
  on conflict (organization_id, slug) do update
  set name = excluded.name,
      description = excluded.description,
      sort_order = excluded.sort_order,
      updated_at = now()
  returning id, slug
)
insert into public.products (
  organization_id, family_id, name, slug, model, description,
  base_price_cents, range_text, seats_text, powertrain_text, highlights,
  visual_theme, status, sort_order, product_type, brand, manufacturer,
  model_year, model_variant, product_category, review_status
)
select
  demo_tenant.id,
  family.id,
  seed.name,
  seed.slug,
  seed.model,
  seed.description,
  seed.base_price_cents,
  seed.range_text,
  seed.seats_text,
  seed.powertrain_text,
  seed.highlights,
  'blue',
  'published',
  seed.sort_order,
  seed.product_type,
  seed.brand,
  seed.manufacturer,
  2026,
  seed.model_variant,
  'Golf Cart / LSV',
  'approved'
from demo_tenant
cross join (
  values
    ('demo-utility-4', 'Demo Utility 4', 'Utility 4', 'A generic four-passenger utility model for feature testing.', 995000, 'Up to 45 miles', '4 passengers', '72V', array['Generic starter catalog item', 'Private demo workspace'], 10, 'our_product', 'Demo Motors', 'Demo Motors', 'Standard', 'demo-utility'),
    ('demo-touring-6', 'Demo Touring 6', 'Touring 6', 'A generic six-passenger touring model for feature testing.', 1245000, 'Up to 50 miles', '6 passengers', '72V', array['Generic starter catalog item', 'Private demo workspace'], 20, 'our_product', 'Demo Motors', 'Demo Motors', 'Extended', 'demo-touring'),
    ('sample-rival-4', 'Sample Rival 4', 'Rival 4', 'A generic competitor example for comparison-flow testing.', 1050000, 'Up to 40 miles', '4 passengers', '72V', array['Generic competitor example', 'Private demo workspace'], 30, 'competitor_product', 'Sample Motors', 'Sample Motors', 'Standard', 'demo-utility')
) as seed(slug, name, model, description, base_price_cents, range_text, seats_text, powertrain_text, highlights, sort_order, product_type, brand, manufacturer, model_variant, family_slug)
join families family on family.slug = seed.family_slug
on conflict (organization_id, slug) do update
set name = excluded.name,
    family_id = excluded.family_id,
    model = excluded.model,
    description = excluded.description,
    base_price_cents = excluded.base_price_cents,
    range_text = excluded.range_text,
    seats_text = excluded.seats_text,
    powertrain_text = excluded.powertrain_text,
    highlights = excluded.highlights,
    status = excluded.status,
    sort_order = excluded.sort_order,
    product_type = excluded.product_type,
    brand = excluded.brand,
    manufacturer = excluded.manufacturer,
    model_year = excluded.model_year,
    model_variant = excluded.model_variant,
    product_category = excluded.product_category,
    review_status = excluded.review_status,
    updated_at = now();
