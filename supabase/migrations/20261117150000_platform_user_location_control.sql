-- Account Admins add users/assign roles; Platform Admin owns location/access edits.
-- Trusted service provisioning and verified invitation acceptance retain their
-- existing authority. These triggers run as INVOKER so definer RPCs remain
-- distinguishable from direct authenticated Data API writes.
create or replace function private.guard_user_management() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
 if current_user not in ('authenticated','anon') or private.is_platform_owner() then
   if tg_op = 'DELETE' then return old; end if;
   return new;
 end if;
 if tg_table_name = 'organization_member_locations' then
   raise exception 'Only the Platform Admin can assign user locations.' using errcode='42501';
 end if;
 if tg_op = 'DELETE' then
   raise exception 'Only the Platform Admin can remove user access.' using errcode='42501';
 end if;
 if not private.has_org_role(new.organization_id,array['tenant_admin']::public.organization_role[]) then
   raise exception 'Account Admin access is required.' using errcode='42501';
 end if;
 if tg_op = 'INSERT' then
   if new.location_id is not null then
     raise exception 'Only the Platform Admin can assign user locations.' using errcode='42501';
   end if;
 elsif (to_jsonb(new) - array['role','updated_at']) is distinct from (to_jsonb(old) - array['role','updated_at']) then
   raise exception 'Account Admins may assign roles only. Other user changes require the Platform Admin.' using errcode='42501';
 end if;
 if tg_table_name = 'organization_memberships' and tg_op = 'UPDATE' and new.role is distinct from old.role then
   if old.user_id = auth.uid() then
     raise exception 'Use another Admin to change your own role.' using errcode='42501';
   end if;
   perform pg_advisory_xact_lock(hashtextextended(new.organization_id::text,917));
   if old.role = 'tenant_admin' and old.status = 'active' and
      (select count(*) from public.organization_memberships where organization_id=old.organization_id and role='tenant_admin' and status='active') < 2 then
     raise exception 'Keep at least one active Admin in the account.' using errcode='42501';
   end if;
 end if;
 return new;
end $$;
revoke all on function private.guard_user_management() from public;
grant execute on function private.guard_user_management() to authenticated;
create trigger guard_user_management before insert or update or delete on public.organization_memberships for each row execute function private.guard_user_management();
create trigger guard_user_management before insert or update or delete on public.organization_invitations for each row execute function private.guard_user_management();
create trigger guard_user_management before insert or update or delete on public.organization_member_locations for each row execute function private.guard_user_management();

-- A Platform Admin may assign the invited membership before acceptance.
-- Acceptance must not overwrite that decision with an older invitation value.
create or replace function private.accept_organization_invitation()
returns table (accepted_organization_id uuid, accepted_role public.organization_role, accepted_location_id uuid)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  matching_invitation public.organization_invitations%rowtype;
  signed_in_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if auth.uid() is null or signed_in_email = '' then
    raise exception 'You must be signed in to accept an invitation.';
  end if;

  select * into matching_invitation
  from public.organization_invitations
  where status = 'pending' and expires_at > now() and auth_user_id = auth.uid() and lower(email) = signed_in_email
  order by created_at desc limit 1 for update;
  if not found then raise exception 'No active invitation is available for this account.'; end if;

  insert into public.profiles (id, full_name, first_name, last_name, phone, email)
  values (
    auth.uid(),
    nullif(trim(concat_ws(' ', matching_invitation.first_name, matching_invitation.last_name)), ''),
    matching_invitation.first_name,
    matching_invitation.last_name,
    matching_invitation.phone,
    matching_invitation.email
  )
  on conflict (id) do update set
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    first_name = coalesce(excluded.first_name, public.profiles.first_name),
    last_name = coalesce(excluded.last_name, public.profiles.last_name),
    phone = coalesce(excluded.phone, public.profiles.phone),
    email = excluded.email;

  insert into public.organization_memberships (organization_id, user_id, role, status, location_id)
  values (matching_invitation.organization_id, auth.uid(), matching_invitation.role, 'active', matching_invitation.location_id)
  on conflict (organization_id, user_id) do update set role = excluded.role, status = 'active', location_id = public.organization_memberships.location_id;

  select location_id into matching_invitation.location_id from public.organization_memberships where organization_id=matching_invitation.organization_id and user_id=auth.uid();

  update public.organization_invitations set status = 'accepted', accepted_by = auth.uid(), accepted_at = now() where id = matching_invitation.id;
  return query select matching_invitation.organization_id, matching_invitation.role, matching_invitation.location_id;
end;
$$;

revoke all on function private.accept_organization_invitation() from public;
grant execute on function private.accept_organization_invitation() to authenticated;
