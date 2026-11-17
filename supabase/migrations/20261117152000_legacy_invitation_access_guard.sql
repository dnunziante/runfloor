-- The legacy acceptance RPC remains callable, so it must enforce the same
-- pending-assignment and disabled-access rules as the current acceptance flow.
create or replace function private.accept_my_invitations_impl() returns integer
language plpgsql security definer set search_path='' as $$
declare actor uuid := auth.uid(); signed_email text; accepted_count integer;
begin
 if actor is null then raise exception 'Authentication required'; end if;
 select lower(email) into signed_email from auth.users where id=actor and email_confirmed_at is not null;
 if signed_email is null then return 0; end if;

 insert into public.organization_memberships(organization_id,user_id,role,status,location_id)
 select i.organization_id,actor,i.role,'active'::public.membership_status,i.location_id
 from public.organization_invitations i
 where lower(i.email)=signed_email and i.status='pending' and i.expires_at>now()
   and (i.auth_user_id is null or i.auth_user_id=actor)
 on conflict(organization_id,user_id) do update
 set status='active'::public.membership_status
 where public.organization_memberships.status <> 'suspended';

 update public.organization_invitations i set status='accepted',accepted_by=actor,accepted_at=now()
 where lower(i.email)=signed_email and i.status='pending' and i.expires_at>now()
   and (i.auth_user_id is null or i.auth_user_id=actor)
   and exists(select 1 from public.organization_memberships m where m.organization_id=i.organization_id and m.user_id=actor and m.status='active');
 get diagnostics accepted_count=row_count;
 return accepted_count;
end $$;
revoke all on function private.accept_my_invitations_impl() from public,anon;
grant execute on function private.accept_my_invitations_impl() to authenticated;
