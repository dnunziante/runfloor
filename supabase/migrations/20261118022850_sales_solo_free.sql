-- Existing accounts and catalog records are preserved. Registration remains gated.
alter table public.account_subscription_plans drop constraint account_subscription_plans_plan_key_check;
alter table public.account_subscription_plans add constraint account_subscription_plans_plan_key_check check(plan_key in ('sales_solo_free','sales_solo','complete'));
create or replace function private.is_sales_solo(target_org uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.account_subscription_plans where organization_id=target_org and plan_key in ('sales_solo','sales_solo_free'))
$$;
create or replace function private.account_paid(target_org uuid) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce((select plan_key<>'sales_solo_free' and (access_override_until>now() or (status in ('active','past_due') and paid_start<=now() and paid_until>now())) from public.account_subscription_plans where organization_id=target_org),false)
$$;
create function public.activate_sales_solo_free(actor uuid,company text,contact_name text) returns uuid language plpgsql security invoker set search_path='' as $$
declare org uuid;begin
 if not private.rv_email_verified(actor) then raise exception 'Verify your email first';end if;
 select organization_id into org from public.account_subscription_plans where owner_user_id=actor and plan_key='sales_solo_free';
 if found then return org;end if;
 org:=public.activate_sales_solo(actor,company,contact_name);
 -- An existing paid owner must use cancellation, never activation, to change access.
 update public.account_subscription_plans set plan_key='sales_solo_free',status='free',ai_limit_units=0 where organization_id=org and status='pending' and stripe_customer_id is null and paid_start is null;
 return org;
end $$;
revoke all on function public.activate_sales_solo_free(uuid,text,text) from public,anon,authenticated;
grant execute on function public.activate_sales_solo_free(uuid,text,text) to service_role;
create or replace function private.guard_solo_members() returns trigger language plpgsql security invoker set search_path='' as $$
declare org uuid; owner_id uuid; seats integer;
begin
 if tg_op='DELETE' then org:=old.organization_id;else org:=new.organization_id;end if;
 perform pg_advisory_xact_lock(hashtextextended(org::text,0));
 select owner_user_id,seat_limit into owner_id,seats from public.account_subscription_plans where organization_id=org and plan_key in ('sales_solo','sales_solo_free');
 if not found then if tg_op='DELETE' then return old;else return new;end if;end if;
 if current_user in ('authenticated','anon') and not private.is_platform_owner() then
   raise exception 'Sales Solo does not include team or location administration' using errcode='42501';
 end if;
 if tg_table_name='organization_invitations' and tg_op<>'DELETE' and (to_jsonb(new)->>'status')='pending' then
   if (select count(*) from public.organization_memberships where organization_id=org and status in ('active','invited')) >= seats then raise exception 'Sales Solo user limit reached';end if;
 elsif tg_table_name='organization_memberships' and tg_op<>'DELETE' and (to_jsonb(new)->>'status') in ('active','invited') then
   if (select count(*) from public.organization_memberships where organization_id=org and status in ('active','invited') and id<>new.id)>=seats then raise exception 'Sales Solo user limit reached';end if;
 end if;
 if tg_op='DELETE' then return old;else return new;end if;
end $$;

alter function public.reserve_ai_usage(uuid,uuid,uuid,text,text,bigint,bigint,text,uuid) rename to reserve_solo_paid_usage;
create function public.reserve_ai_usage(target_org uuid,target_user uuid,request_id uuid,feature text,target_model text,max_input bigint,max_output bigint,input_fingerprint text default null,target_location uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.account_subscription_plans where organization_id=target_org and plan_key='sales_solo_free') then raise exception 'Sales Solo Free does not include AI';end if;
 return public.reserve_solo_paid_usage(target_org,target_user,request_id,feature,target_model,max_input,max_output,input_fingerprint,target_location);
end $$;
revoke all on function public.reserve_ai_usage(uuid,uuid,uuid,text,text,bigint,bigint,text,uuid) from public,anon,authenticated;
grant execute on function public.reserve_ai_usage(uuid,uuid,uuid,text,text,bigint,bigint,text,uuid) to service_role;
alter function public.apply_sales_solo_event(text,text,bigint,uuid,text,text,boolean,text,text,text,timestamptz,timestamptz,timestamptz,text,text) rename to apply_paid_sales_solo_event;
create or replace function public.apply_paid_sales_solo_event(event_key text,event_kind text,event_created bigint,target_org uuid,customer_key text,account_key text,live boolean,subscription_key text,price_key text,billing_status text,starts timestamptz,ends timestamptz,cancels timestamptz,paid_invoice text default null,target_plan text default 'sales_solo')
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
 update public.account_subscription_plans set status=billing_status,event_created=greatest(event_created,p.event_created),stripe_subscription_id=subscription_key,cancel_at=cancels,
 checkout_session_id=case when billing_status in ('canceled','incomplete_expired') then null else checkout_session_id end,
 checkout_attempt=case when billing_status in ('canceled','incomplete_expired') then null else checkout_attempt end,
 checkout_expires_at=case when billing_status in ('canceled','incomplete_expired') then null else checkout_expires_at end where organization_id=target_org;
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
 if exists(select 1 from public.sales_solo_periods sp where sp.organization_id=target_org and sp.starts=apply_paid_sales_solo_event.starts) then return;end if;
 insert into public.sales_solo_periods(organization_id,starts,ends,invoice_id) values(target_org,starts,ends,paid_invoice) returning id into period_id;
 insert into public.ai_credit_grants(organization_id,kind,total_units,period_start,expires_at,reference) values(target_org,'included',p.ai_limit_units,starts,ends,'sales-solo:'||paid_invoice) returning id into new_grant_id;
 update public.sales_solo_periods set grant_id=new_grant_id where id=period_id;
 update public.account_subscription_plans set paid_start=starts,paid_until=ends where organization_id=target_org;
end $$;

create function public.apply_sales_solo_event(event_key text,event_kind text,event_created bigint,target_org uuid,customer_key text,account_key text,live boolean,subscription_key text,price_key text,billing_status text,starts timestamptz,ends timestamptz,cancels timestamptz,paid_invoice text default null,target_plan text default 'sales_solo')
returns void language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(target_org::text,0));
 if paid_invoice is not null and target_plan='sales_solo' and billing_status in ('active','past_due') then
  update public.account_subscription_plans set plan_key='sales_solo',ai_limit_units=500000000 where organization_id=target_org and plan_key='sales_solo_free';
 end if;
 -- Ownership, approved price, environment and duplicate invoice checks remain authoritative;
 -- any failure rolls back the plan transition in the same transaction.
 perform public.apply_paid_sales_solo_event(event_key,event_kind,event_created,target_org,customer_key,account_key,live,subscription_key,price_key,billing_status,starts,ends,cancels,paid_invoice,target_plan);
end $$;
revoke all on function public.apply_sales_solo_event(text,text,bigint,uuid,text,text,boolean,text,text,text,timestamptz,timestamptz,timestamptz,text,text) from public,anon,authenticated;
grant execute on function public.apply_sales_solo_event(text,text,bigint,uuid,text,text,boolean,text,text,text,timestamptz,timestamptz,timestamptz,text,text) to service_role;
-- Per-user bounds protect both cached application reads and direct RPC requests.
create table public.solo_catalog_request_limits(user_id uuid primary key references public.profiles(id),window_start timestamptz not null,requests integer not null);
alter table public.solo_catalog_request_limits enable row level security;
revoke all on public.solo_catalog_request_limits from public,anon,authenticated;
grant all on public.solo_catalog_request_limits to service_role;
create function public.solo_catalog_access() returns void language plpgsql security definer set search_path='' as $$
declare n integer;begin
 if current_setting('role',true)='service_role' and auth.uid() is null then return;end if;
 if not exists(select 1 from public.industry_templates where template_key='rv' and is_enabled and is_public_demo_visible and not is_internal_only) then raise exception 'Shared catalog unavailable';end if;
 if auth.uid() is null or not exists(select 1 from public.account_subscription_plans p join public.organization_memberships m on m.organization_id=p.organization_id where m.user_id=auth.uid() and m.status='active' and p.plan_key in ('sales_solo','sales_solo_free')) then raise exception 'Solo catalog membership required' using errcode='42501';end if;
 insert into public.solo_catalog_request_limits(user_id,window_start,requests) values(auth.uid(),date_trunc('minute',now()),1)
 on conflict(user_id) do update set window_start=excluded.window_start,requests=case when solo_catalog_request_limits.window_start=excluded.window_start then solo_catalog_request_limits.requests+1 else 1 end returning requests into n;
 if n>120 then raise exception 'Catalog request limit reached; try again shortly' using errcode='P0001';end if;
end $$;
revoke all on function public.solo_catalog_access() from public,anon;
grant execute on function public.solo_catalog_access() to authenticated,service_role;
create function public.solo_shared_catalog(page_number integer default 1,search_text text default '',selected_ids uuid[] default '{}',comparison boolean default false,brand_filter text default '',category_filter text default '',year_filter integer default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare template uuid;result jsonb;begin
 perform public.solo_catalog_access();
 if page_number not between 1 and 1000 or length(search_text)>80 or coalesce(cardinality(selected_ids),0)>3 or length(brand_filter)>120 or length(category_filter)>120 then raise exception 'Invalid catalog query';end if;
 select id into template from public.industry_templates where template_key='rv' and is_enabled and is_public_demo_visible and not is_internal_only;
 if template is null then return jsonb_build_object('products','[]'::jsonb,'has_more',false);end if;
 with matches as (
  select p.id,p.family_name,p.name,p.model,p.model_year,p.model_variant,p.specifications,p.description,p.base_price_cents,p.range_text,p.seats_text,p.powertrain_text,p.product_type,p.manufacturer,p.product_category,p.sort_order,
   row_number() over(partition by p.product_type order by p.sort_order,p.name,p.id) as type_rank
  from public.industry_template_products p where p.industry_template_id=template and (brand_filter='' or coalesce(nullif(p.specifications->>'brand',''),p.manufacturer)=brand_filter) and (category_filter='' or p.product_category=category_filter) and (year_filter is null or p.model_year=year_filter) and (search_text='' or concat_ws(' ',p.name,p.model,p.manufacturer,p.model_year,p.model_variant,p.product_category) ilike '%'||replace(replace(replace(search_text,'\','\\'),'%','\%'),'_','\_')||'%')
 ), page as (
  select * from matches where not comparison or type_rank<=20 order by sort_order,name,id limit 49 offset case when comparison then 0 else (page_number-1)*48 end
 ), selected as (
  select p.id,p.family_name,p.name,p.model,p.model_year,p.model_variant,p.specifications,p.description,p.base_price_cents,p.range_text,p.seats_text,p.powertrain_text,p.product_type,p.manufacturer,p.product_category,p.sort_order,0::bigint as type_rank
  from public.industry_template_products p where p.industry_template_id=template and p.id=any(selected_ids)
 ), shown as (select * from page limit 48), combined as (select distinct on(id) * from (select * from shown union all select * from selected) c order by id,type_rank)
 select jsonb_build_object('products',coalesce((select jsonb_agg(to_jsonb(c)-'type_rank' order by c.sort_order,c.name,c.id) from combined c),'[]'::jsonb),'has_more',(select count(*)>48 from page),'brands',(select coalesce(jsonb_agg(b),'[]'::jsonb) from (select distinct coalesce(nullif(specifications->>'brand',''),manufacturer) b from public.industry_template_products where industry_template_id=template order by b limit 100) x),'categories',(select coalesce(jsonb_agg(c),'[]'::jsonb) from (select distinct product_category c from public.industry_template_products where industry_template_id=template order by c limit 40) x),'years',(select coalesce(jsonb_agg(y),'[]'::jsonb) from (select distinct model_year y from public.industry_template_products where industry_template_id=template and model_year is not null order by y desc limit 40) x)) into result;
 return result;
end $$;
revoke all on function public.solo_shared_catalog(integer,text,uuid[],boolean,text,text,integer) from public,anon;
grant execute on function public.solo_shared_catalog(integer,text,uuid[],boolean,text,text,integer) to authenticated,service_role;
create or replace function public.override_sales_solo(target_org uuid,new_seat_limit integer,new_ai_limit bigint,override_until timestamptz,reason text) returns void language plpgsql security definer set search_path='' as $$
declare period public.sales_solo_periods;used bigint;begin
 if not private.is_platform_owner() or length(trim(reason))<8 then raise exception 'Platform Admin and a clear reason are required' using errcode='42501';end if;
 if new_ai_limit<>0 and exists(select 1 from public.account_subscription_plans where organization_id=target_org and plan_key='sales_solo_free') then raise exception 'Free plans cannot receive an AI allowance; use a paid plan';end if;
 perform pg_advisory_xact_lock(hashtextextended(target_org::text,0));
 if new_seat_limit not between 1 and 10000 or new_ai_limit not between 0 and 100000000000 then raise exception 'Invalid limits';end if;
 if new_seat_limit<(select count(*) from public.organization_memberships where organization_id=target_org and status in ('active','invited')) then raise exception 'Existing users exceed the proposed limit';end if;
 select * into period from public.sales_solo_periods where organization_id=target_org and starts<=now() and ends>now() order by starts desc limit 1;
 select coalesce(sum(case when state='settled' then provider_cost_units when state in ('reserved','uncertain') then greatest(reserved_units,provider_cost_units) else 0 end),0) into used from public.ai_usage_requests where solo_period_id=period.id;
 if new_ai_limit<used then raise exception 'Limit cannot be lower than spent and reserved cost';end if;
 update public.account_subscription_plans set seat_limit=new_seat_limit,ai_limit_units=new_ai_limit,access_override_until=override_until where organization_id=target_org and plan_key in ('sales_solo','sales_solo_free');
 if not found then raise exception 'Sales Solo account not found';end if;
 update public.ai_credit_grants set total_units=new_ai_limit where id=period.grant_id;
 insert into public.ai_billing_audit(organization_id,actor_id,action,reason,details) values(target_org,auth.uid(),'sales_solo_override',trim(reason),jsonb_build_object('seat_limit',new_seat_limit,'ai_limit_units',new_ai_limit,'access_until',override_until));
end $$;

-- Check the account before background document parsing or embeddings, without issuing a grant.
create function public.solo_document_processing_access(target_org uuid) returns boolean language sql stable security definer set search_path='' as $$
 select not private.is_sales_solo(target_org) or private.account_paid(target_org)
$$;
revoke all on function public.solo_document_processing_access(uuid) from public,anon,authenticated;
grant execute on function public.solo_document_processing_access(uuid) to service_role;
-- Shared non-Sales reference tables cannot become a back door through the Data API.
create function private.solo_free_actor() returns boolean language sql stable security definer set search_path='' as $$
 select not private.is_platform_owner() and coalesce((select private.is_sales_solo(m.organization_id) and not private.account_paid(m.organization_id)
 from public.organization_memberships m left join public.platform_workspace_contexts c on c.user_id=m.user_id
 where m.user_id=auth.uid() and m.status='active' order by (m.organization_id=c.active_organization_id) desc nulls last,m.organization_id limit 1),false)
$$;
revoke all on function private.solo_free_actor() from public,anon;
grant execute on function private.solo_free_actor() to authenticated;
do $$declare t record;begin
 for t in select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relrowsecurity
 and c.relname not in ('profiles','organizations','platform_workspace_contexts','opal_article_versions','opal_events','opal_request_limits')
 and not exists(select 1 from information_schema.columns col where col.table_schema='public' and col.table_name=c.relname and col.column_name='organization_id') loop
 execute format('create policy "Free plan shared data ceiling" on public.%I as restrictive for all to authenticated using(not private.solo_free_actor()) with check(not private.solo_free_actor())',t.relname);
 end loop;
end $$;
