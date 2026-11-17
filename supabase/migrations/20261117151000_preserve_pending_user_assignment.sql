-- Preserve the latest Admin role and Platform Admin location at acceptance.
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

  if exists(select 1 from public.organization_memberships where organization_id=matching_invitation.organization_id and user_id=auth.uid() and status='suspended') then
    raise exception 'Your account access is disabled. Contact the Platform Admin.' using errcode='42501';
  end if;

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
  on conflict (organization_id, user_id) do update set role = public.organization_memberships.role, status = 'active', location_id = public.organization_memberships.location_id;

  select role,location_id into matching_invitation.role,matching_invitation.location_id from public.organization_memberships where organization_id=matching_invitation.organization_id and user_id=auth.uid();

  update public.organization_invitations set status = 'accepted', accepted_by = auth.uid(), accepted_at = now() where id = matching_invitation.id;
  return query select matching_invitation.organization_id, matching_invitation.role, matching_invitation.location_id;
end;
$$;

revoke all on function private.accept_organization_invitation() from public;
grant execute on function private.accept_organization_invitation() to authenticated;
