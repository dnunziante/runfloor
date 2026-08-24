-- Template-owned import sources support review before creating starter products.
create table if not exists public.industry_template_product_imports (
  id uuid primary key default gen_random_uuid(),
  industry_template_id uuid not null references public.industry_templates(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id) on delete restrict,
  original_filename text not null,
  storage_path text not null unique,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 20971520),
  created_at timestamptz not null default now()
);

alter table public.industry_template_products
  add column if not exists source_import_id uuid references public.industry_template_product_imports(id) on delete set null;

create index if not exists industry_template_product_imports_template_idx
  on public.industry_template_product_imports(industry_template_id, created_at desc);

create index if not exists industry_template_products_source_import_idx
  on public.industry_template_products(source_import_id);

alter table public.industry_template_product_imports enable row level security;

create policy "platform owners manage template product imports"
  on public.industry_template_product_imports for all to authenticated
  using (private.is_platform_owner()) with check (private.is_platform_owner());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('template-product-imports', 'template-product-imports', false, 20971520,
  array['application/pdf','image/jpeg','image/png','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','text/csv'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "platform owners read template product import files"
  on storage.objects for select to authenticated
  using (bucket_id = 'template-product-imports' and private.is_platform_owner());

create policy "platform owners upload template product import files"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'template-product-imports' and private.is_platform_owner());
