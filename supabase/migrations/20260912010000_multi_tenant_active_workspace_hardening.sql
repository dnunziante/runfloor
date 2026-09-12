-- Complete the existing multi-tenant membership model without recreating users
-- or tenant-owned data. Authentication identity remains globally unique in
-- auth.users; access is granted per organization through this junction table.

create unique index if not exists organization_memberships_user_organization_uidx
  on public.organization_memberships (user_id, organization_id);

create index if not exists organization_memberships_active_user_idx
  on public.organization_memberships (user_id, created_at)
  where status = 'active';

-- Preserve and backfill the searchable identity mirror used by trusted server
-- invitation handling. Authorization never relies on this email field.
update public.profiles profile
set email = lower(auth_user.email)
from auth.users auth_user
where profile.id = auth_user.id
  and (profile.email is null or lower(profile.email) <> lower(auth_user.email));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    lower(new.email)
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(public.profiles.full_name, excluded.full_name);
  return new;
end;
$$;

-- The existing active-workspace table is user-scoped, despite its historical
-- name. Every user may select only a tenant backed by an active membership;
-- the existing platform-owner exception is retained for platform operations.
drop policy if exists "users set permitted workspace context" on public.platform_workspace_contexts;
create policy "users set permitted workspace context"
on public.platform_workspace_contexts for insert to authenticated
with check (
  user_id = (select auth.uid())
  and (private.is_platform_owner() or private.is_org_member(active_organization_id))
);

drop policy if exists "users update permitted workspace context" on public.platform_workspace_contexts;
create policy "users update permitted workspace context"
on public.platform_workspace_contexts for update to authenticated
using (user_id = (select auth.uid()))
with check (
  user_id = (select auth.uid())
  and (private.is_platform_owner() or private.is_org_member(active_organization_id))
);
