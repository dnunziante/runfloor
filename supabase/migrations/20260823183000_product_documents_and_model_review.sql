-- Product Documents & Models: additive tenant-scoped source records and review state.
-- Applied to the linked Supabase project on 2026-08-23.
alter table public.products add column if not exists source_document_id uuid;
alter table public.products add column if not exists review_status text not null default 'approved' check (review_status in ('pending_review', 'approved', 'needs_attention'));
create table if not exists public.product_documents (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id) on delete restrict, title text not null check (char_length(title) between 2 and 180),
  original_filename text not null, storage_path text not null unique, mime_type text not null, size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 20971520),
  initial_product_type text not null check (initial_product_type in ('our_product','competitor_product')), manufacturer text not null default '',
  processing_status text not null default 'uploading' check (processing_status in ('uploading','processing','processed','needs_review','failed')),
  models_found integer not null default 0 check (models_found >= 0), processing_error text not null default '', created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (storage_path like organization_id::text || '/%')
);
alter table public.products add constraint products_source_document_id_fkey foreign key (source_document_id) references public.product_documents(id) on delete set null;
create index if not exists product_documents_tenant_status_idx on public.product_documents (organization_id, processing_status, created_at desc);
create index if not exists products_tenant_document_idx on public.products (organization_id, source_document_id);
alter table public.product_documents enable row level security;
create policy "members read organization product documents" on public.product_documents for select to authenticated using (private.is_org_member(organization_id) or private.is_platform_owner());
create policy "managers manage organization product documents" on public.product_documents for all to authenticated using (private.has_org_role(organization_id, array['tenant_admin','manager']::public.organization_role[]) or private.is_platform_owner()) with check (private.has_org_role(organization_id, array['tenant_admin','manager']::public.organization_role[]) or private.is_platform_owner());
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types) values ('product-documents','product-documents',false,20971520,array['image/jpeg','image/png','application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']) on conflict (id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy "members read organization product document files" on storage.objects for select to authenticated using (bucket_id='product-documents' and private.is_org_member(((storage.foldername(name))[1])::uuid));
create policy "managers upload organization product document files" on storage.objects for insert to authenticated with check (bucket_id='product-documents' and private.has_org_role(((storage.foldername(name))[1])::uuid,array['tenant_admin','manager']::public.organization_role[]));
create policy "managers delete organization product document files" on storage.objects for delete to authenticated using (bucket_id='product-documents' and private.has_org_role(((storage.foldername(name))[1])::uuid,array['tenant_admin','manager']::public.organization_role[]));
