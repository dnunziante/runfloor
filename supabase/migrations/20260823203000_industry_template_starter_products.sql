create table if not exists public.industry_template_products (
  id uuid primary key default gen_random_uuid(),
  industry_template_id uuid not null references public.industry_templates(id) on delete cascade,
  family_name text not null default 'Starter Products',
  name text not null,
  model text not null default '',
  description text not null default '',
  base_price_cents integer not null default 0 check (base_price_cents >= 0),
  range_text text not null default '',
  seats_text text not null default '',
  powertrain_text text not null default '',
  product_type text not null default 'our_product' check (product_type in ('our_product', 'competitor_product')),
  manufacturer text not null default '',
  product_category text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists industry_template_products_template_sort_idx
  on public.industry_template_products(industry_template_id, sort_order, created_at);

alter table public.industry_template_products enable row level security;

create policy "platform owners manage template products"
  on public.industry_template_products for all
  to authenticated
  using (private.is_platform_owner())
  with check (private.is_platform_owner());
