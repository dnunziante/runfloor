-- Template products use the same flexible identity and specification shape as
-- tenant products. These records remain template-owned until a new tenant is
-- created from the template.
alter table public.industry_template_products
  add column if not exists model_year integer,
  add column if not exists model_variant text not null default '',
  add column if not exists specifications jsonb not null default '{}'::jsonb;

alter table public.industry_template_products
  add constraint industry_template_products_model_year_reasonable
  check (model_year is null or model_year between 1900 and 2200);
