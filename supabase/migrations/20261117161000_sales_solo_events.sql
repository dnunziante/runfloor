create function public.apply_sales_solo_event(event_key text,event_kind text,event_created bigint,target_org uuid,customer_key text,account_key text,live boolean,subscription_key text,price_key text,billing_status text,starts timestamptz,ends timestamptz,cancels timestamptz,paid_invoice text default null,target_plan text default 'sales_solo')
returns void language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare p public.account_subscription_plans;catalog public.sales_solo_catalog;period_id uuid;new_grant_id uuid;loc uuid;begin
 perform pg_advisory_xact_lock(hashtextextended(target_org::text,0));
 select * into p from public.account_subscription_plans where organization_id=target_org for update;
 if not found or p.stripe_customer_id is distinct from customer_key or p.stripe_account_id is distinct from account_key or p.livemode is distinct from live then raise exception 'Unknown subscription ownership';end if;
 if p.stripe_subscription_id is not null and p.stripe_subscription_id<>subscription_key and p.status not in ('canceled','incomplete_expired') then raise exception 'A different subscription is already assigned';end if;
 if exists(select 1 from public.sales_solo_stripe_events where id=event_key) then return;end if;
 if target_plan='sales_solo' then
  select * into catalog from public.sales_solo_catalog where id and active;
  if not found or catalog.stripe_price_id is distinct from price_key or catalog.stripe_account_id is distinct from account_key or catalog.livemode is distinct from live then raise exception 'Unapproved Sales Solo price';end if;
 elsif target_plan='complete' then
  if not exists(select 1 from public.runfloor_billing_catalog where active and stripe_price_id=price_key) then raise exception 'Unapproved Complete price';end if;
 else raise exception 'Unknown plan';end if;
 insert into public.sales_solo_stripe_events(id) values(event_key);
 if event_created<p.event_created and paid_invoice is null then return;end if;
 if starts is null or ends is null or ends<=starts then raise exception 'Invalid subscription period';end if;
 update public.account_subscription_plans set status=billing_status,event_created=greatest(event_created,p.event_created),stripe_subscription_id=subscription_key,cancel_at=cancels where organization_id=target_org;
 -- Upgraded accounts continue using the established location billing lifecycle,
 -- including failed payments and cancellation events that grant no allowance.
 if p.plan_key='complete' and target_plan='complete' then
  perform public.apply_rv_stripe_event(event_key,event_kind,event_created,customer_key,subscription_key,price_key,case when billing_status='incomplete_expired' then 'expired' else billing_status end,starts,ends,cancels,paid_invoice is not null);
  if paid_invoice is not null and (p.paid_start is null or starts>=p.paid_start) then
   update public.account_subscription_plans set paid_start=starts,paid_until=ends where organization_id=target_org;
  end if;
  return;
 end if;
 -- Price or subscription changes alone never expand access or refresh cost limits.
 if paid_invoice is null then return;end if;
 if p.paid_start is not null and starts<p.paid_start then return;end if;
 if target_plan='complete' then
  select id into loc from public.locations where organization_id=target_org and is_active order by sort_order,id limit 1;
  if loc is null then raise exception 'Platform Admin must set up a location before upgrade';end if;
  insert into public.rv_trial_claims(organization_id,owner_user_id,dealership_identity) values(target_org,p.owner_user_id,'solo-upgrade-'||target_org) on conflict(organization_id) do nothing;
  insert into public.rv_location_billing(location_id,organization_id,stripe_customer_id) values(loc,target_org,customer_key) on conflict(location_id) do update set stripe_customer_id=excluded.stripe_customer_id;
  perform public.apply_rv_stripe_event(event_key,event_kind,event_created,customer_key,subscription_key,price_key,billing_status,starts,ends,cancels,true);
  update public.account_subscription_plans set plan_key='complete',paid_start=starts,paid_until=ends where organization_id=target_org;
  return;
 end if;
 if p.plan_key<>'sales_solo' then raise exception 'A downgrade requires reviewed seat and data checks';end if;
 if exists(select 1 from public.sales_solo_periods sp where sp.organization_id=target_org and sp.starts=apply_sales_solo_event.starts) then return;end if;
 insert into public.sales_solo_periods(organization_id,starts,ends,invoice_id) values(target_org,starts,ends,paid_invoice) returning id into period_id;
 insert into public.ai_credit_grants(organization_id,kind,total_units,period_start,expires_at,reference) values(target_org,'included',p.ai_limit_units,starts,ends,'sales-solo:'||paid_invoice) returning id into new_grant_id;
 update public.sales_solo_periods set grant_id=new_grant_id where id=period_id;
 update public.account_subscription_plans set paid_start=starts,paid_until=ends where organization_id=target_org;
end $$;
revoke all on function public.apply_sales_solo_event(text,text,bigint,uuid,text,text,boolean,text,text,text,timestamptz,timestamptz,timestamptz,text,text) from public,anon,authenticated;
grant execute on function public.apply_sales_solo_event(text,text,bigint,uuid,text,text,boolean,text,text,text,timestamptz,timestamptz,timestamptz,text,text) to service_role;
