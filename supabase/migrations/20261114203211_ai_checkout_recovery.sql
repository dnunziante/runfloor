-- Release a checkout slot only after the server verifies Stripe's terminal state.
create function public.release_runfloor_subscription_checkout(org uuid,expected_request uuid,expected_session text) returns void language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(org::text,0));
 perform pg_advisory_xact_lock(hashtextextended(org::text,1));
 delete from public.runfloor_subscription_checkouts where organization_id=org and request_id=expected_request and session_id=expected_session;
end$$;
revoke all on function public.release_runfloor_subscription_checkout(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.release_runfloor_subscription_checkout(uuid,uuid,text) to service_role;
create or replace function public.claim_runfloor_subscription_checkout(org uuid,request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare slot public.runfloor_subscription_checkouts;
begin
 perform pg_advisory_xact_lock(hashtextextended(org::text,0));
 perform pg_advisory_xact_lock(hashtextextended(org::text,1));
 if (select count(*) from public.locations where organization_id=org and is_active)>1 then raise exception 'The RunFloor plan includes one active location';end if;
 insert into public.runfloor_subscription_checkouts(organization_id,request_id) values(org,request_id) on conflict do nothing;
 select * into slot from public.runfloor_subscription_checkouts where organization_id=org;
 return to_jsonb(slot);
end$$;
create or replace function private.limit_runfloor_locations() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(new.organization_id::text,1));
 if new.is_active and (exists(select 1 from public.runfloor_billing_customers where organization_id=new.organization_id and subscription_id is not null) or exists(select 1 from public.runfloor_subscription_checkouts where organization_id=new.organization_id)) then
 if (select count(*) from public.locations where organization_id=new.organization_id and is_active and id<>new.id)>=1 then raise exception 'The RunFloor plan includes one active location';end if;
 end if;return new;
end$$;
