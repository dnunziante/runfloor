-- Product catalogs are existing tenant-owned product_families. This migration
-- only lets tenant managers administer their own catalogs and products.

drop policy if exists "tenant admins manage organization products" on public.products;
create policy "catalog managers manage organization products" on public.products
for all to authenticated
using (private.has_org_role(organization_id, array['tenant_admin', 'manager']::public.organization_role[]) or private.is_platform_owner())
with check (private.has_org_role(organization_id, array['tenant_admin', 'manager']::public.organization_role[]) or private.is_platform_owner());

drop policy if exists "tenant admins manage organization product families" on public.product_families;
create policy "catalog managers manage organization product families" on public.product_families
for all to authenticated
using (private.has_org_role(organization_id, array['tenant_admin', 'manager']::public.organization_role[]) or private.is_platform_owner())
with check (private.has_org_role(organization_id, array['tenant_admin', 'manager']::public.organization_role[]) or private.is_platform_owner());

drop policy if exists "tenant admins upload product images" on storage.objects;
drop policy if exists "tenant admins update product images" on storage.objects;
drop policy if exists "tenant admins delete product images" on storage.objects;

create policy "catalog managers upload product images" on storage.objects for insert to authenticated
with check (storage.objects.bucket_id = 'product-images' and exists (
  select 1 from public.organizations org where org.id::text = (storage.foldername(storage.objects.name))[1]
  and (private.has_org_role(org.id, array['tenant_admin', 'manager']::public.organization_role[]) or private.is_platform_owner())
));
create policy "catalog managers update product images" on storage.objects for update to authenticated
using (storage.objects.bucket_id = 'product-images' and exists (
  select 1 from public.organizations org where org.id::text = (storage.foldername(storage.objects.name))[1]
  and (private.has_org_role(org.id, array['tenant_admin', 'manager']::public.organization_role[]) or private.is_platform_owner())
)) with check (storage.objects.bucket_id = 'product-images' and exists (
  select 1 from public.organizations org where org.id::text = (storage.foldername(storage.objects.name))[1]
  and (private.has_org_role(org.id, array['tenant_admin', 'manager']::public.organization_role[]) or private.is_platform_owner())
));
create policy "catalog managers delete product images" on storage.objects for delete to authenticated
using (storage.objects.bucket_id = 'product-images' and exists (
  select 1 from public.organizations org where org.id::text = (storage.foldername(storage.objects.name))[1]
  and (private.has_org_role(org.id, array['tenant_admin', 'manager']::public.organization_role[]) or private.is_platform_owner())
));
