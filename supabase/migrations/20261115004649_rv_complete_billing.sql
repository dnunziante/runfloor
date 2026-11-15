-- Additive RV-only billing. No existing organization is enrolled or repriced.
create table public.rv_trial_claims (
 organization_id uuid primary key references public.organizations(id),
 owner_user_id uuid not null unique references public.profiles(id),
 dealership_identity text not null unique,
 created_at timestamptz not null default now()
);
create table public.rv_location_billing (
 location_id uuid primary key,
 organization_id uuid not null references public.organizations(id),
 trial_started_at timestamptz not null default now(),
 trial_ends_at timestamptz not null default (now() + interval '168 hours'),
 status text not null default 'trialing' check(status in ('trialing','active','past_due','canceled','expired','incomplete','unpaid','paused')),
 stripe_customer_id text unique,
 stripe_subscription_id text unique,
 stripe_price_id text,
 period_start timestamptz,
 period_end timestamptz,
 cancel_at timestamptz,
 risk_review_required boolean not null default false,
 checkout_session_id text,
 checkout_attempt uuid,
 checkout_expires_at timestamptz,
 last_event_created bigint not null default 0,
 foreign key(location_id, organization_id) references public.locations(id,organization_id),
 check(trial_ends_at = trial_started_at + interval '168 hours'),
 check(period_end is null or period_end > period_start)
);
-- Reuse the existing fractional-credit ledger, reservation, and settlement system.
alter table public.ai_credit_grants add column location_id uuid references public.locations(id);
alter table public.ai_usage_requests add column location_id uuid references public.locations(id);
create index ai_credit_grants_location on public.ai_credit_grants(location_id,expires_at);
create table public.rv_trial_reminders (
 location_id uuid not null references public.rv_location_billing(location_id),
 user_id uuid not null references public.profiles(id),
 milestone text not null check(milestone in ('welcome','two_days','one_day','expired')),
 displayed_at timestamptz not null default now(),
 primary key(location_id,user_id,milestone)
);
create table public.rv_onboarding_progress (
 location_id uuid not null references public.rv_location_billing(location_id),
 user_id uuid not null references public.profiles(id),
 completed text[] not null default '{}', dismissed boolean not null default false,
 primary key(location_id,user_id)
);

create function private.rv_can_view_location(target_org uuid,target_location uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (private.is_platform_owner() or
 (private.is_org_member(target_org) and (private.has_org_role(target_org,array['tenant_admin']::public.organization_role[]) or exists(
 select 1 from public.organization_member_locations m where m.organization_id=target_org and m.location_id=target_location and m.user_id=auth.uid()
 ) or exists(select 1 from public.organization_memberships m where m.organization_id=target_org and m.user_id=auth.uid() and m.status='active' and m.location_id=target_location))))
$$;
revoke all on function private.rv_can_view_location(uuid,uuid) from public,anon;
grant execute on function private.rv_can_view_location(uuid,uuid) to authenticated;

alter table public.rv_trial_claims enable row level security;
alter table public.rv_location_billing enable row level security;
alter table public.rv_trial_reminders enable row level security;
alter table public.rv_onboarding_progress enable row level security;
create policy "assigned members read RV location billing" on public.rv_location_billing for select to authenticated using(private.rv_can_view_location(organization_id,location_id));
create policy "members read own RV reminders" on public.rv_trial_reminders for select to authenticated using(user_id=auth.uid() and exists(select 1 from public.rv_location_billing b where b.location_id=rv_trial_reminders.location_id));
create policy "members read own RV onboarding" on public.rv_onboarding_progress for select to authenticated using(user_id=auth.uid() and exists(select 1 from public.rv_location_billing b where b.location_id=rv_onboarding_progress.location_id));
create policy "members update own RV onboarding" on public.rv_onboarding_progress for all to authenticated using(user_id=auth.uid() and exists(select 1 from public.rv_location_billing b where b.location_id=rv_onboarding_progress.location_id)) with check(user_id=auth.uid() and exists(select 1 from public.rv_location_billing b where b.location_id=rv_onboarding_progress.location_id));
grant select,insert,update on public.rv_onboarding_progress to authenticated;

-- Narrow auth lookup: service_role need not receive direct access to auth.users.
create function private.rv_email_verified(actor uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.users where id=actor and email_confirmed_at is not null)
$$;
revoke all on function private.rv_email_verified(uuid) from public,anon,authenticated;
grant usage on schema private to service_role;
grant execute on function private.rv_email_verified(uuid) to service_role;

-- Server-only provisioning, called after auth.getUser verifies an email-confirmed user.
create function public.activate_rv_trial(actor uuid,dealership text,contact_name text) returns uuid
language plpgsql security invoker set search_path='' as $$
declare org uuid; loc uuid; template uuid; identity_key text;
begin
 perform pg_advisory_xact_lock(hashtextextended(actor::text,0));
 if not private.rv_email_verified(actor) then raise exception 'Verify your email before activating a trial.'; end if;
 select organization_id into org from public.rv_trial_claims where owner_user_id=actor;
 if found then return org; end if;
 if exists(select 1 from public.organization_memberships where user_id=actor and status='active') then raise exception 'You already belong to a dealership. Use its workspace or ask your administrator.'; end if;
 if length(trim(dealership)) not between 2 and 120 or length(trim(contact_name)) not between 2 and 120 then raise exception 'Enter a dealership and contact name.'; end if;
 identity_key := regexp_replace(lower(trim(dealership)),'[^a-z0-9]','','g');
 if length(identity_key)<2 then raise exception 'Enter a valid dealership name.'; end if;
 select id into template from public.industry_templates where template_key='rv' and is_enabled and is_available_during_signup;
 if template is null then raise exception 'RV signup is not available.'; end if;
 if exists(select 1 from public.organizations where regexp_replace(lower(name),'[^a-z0-9]','','g')=identity_key) then raise exception 'This dealership already exists. Ask its administrator for an invitation.'; end if;
 insert into public.organizations(name,slug,industry_template_id) values(trim(dealership),'rv-'||replace(gen_random_uuid()::text,'-',''),template) returning id into org;
 insert into public.rv_trial_claims(organization_id,owner_user_id,dealership_identity) values(org,actor,identity_key);
 update public.profiles set full_name=trim(contact_name) where id=actor;
 insert into public.locations(organization_id,name) values(org,trim(dealership)) returning id into loc;
 insert into public.organization_memberships(organization_id,user_id,role,status,location_id) values(org,actor,'tenant_admin','active',loc);
 insert into public.organization_member_locations(organization_id,user_id,location_id) values(org,actor,loc);
 insert into public.platform_workspace_contexts(user_id,active_organization_id) values(actor,org) on conflict(user_id) do update set active_organization_id=org;
 insert into public.rv_location_billing(location_id,organization_id) values(loc,org);
 insert into public.ai_billing_settings(organization_id,included_units) values(org,0);
 insert into public.ai_credit_grants(organization_id,location_id,kind,total_units,period_start,expires_at,reference) values(org,loc,'included',100000000,now(),now()+interval '168 hours','trial:'||org);
 return org;
end $$;
revoke all on function public.activate_rv_trial(uuid,text,text) from public,anon,authenticated;
grant execute on function public.activate_rv_trial(uuid,text,text) to service_role;

-- Timestamp enforcement does not depend on a scheduled job.
create function private.rv_has_access(target_org uuid,target_location uuid default null) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (
 not exists(select 1 from public.rv_trial_claims where organization_id=target_org)
 or exists(select 1 from public.rv_location_billing b where b.organization_id=target_org
 and (target_location is null or b.location_id=target_location)
 and private.rv_can_view_location(target_org,b.location_id)
 and ((b.status='trialing' and b.trial_ends_at>now()) or (b.status in ('active','past_due') and b.period_end>now()))))
$$;
revoke all on function private.rv_has_access(uuid,uuid) from public,anon;
grant execute on function private.rv_has_access(uuid,uuid) to authenticated;

create function public.rv_access_state(target_org uuid,target_location uuid default null) returns jsonb
language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is null or not(private.is_org_member(target_org) or private.is_platform_owner()) then raise exception 'Unauthorized'; end if;
 return jsonb_build_object('allowed',private.rv_has_access(target_org,target_location));
end $$;
revoke all on function public.rv_access_state(uuid,uuid) from public,anon;
grant execute on function public.rv_access_state(uuid,uuid) to authenticated;

-- Defense in depth for direct Data API calls; keep account and billing access after expiry.
do $$ declare t record; predicate text; begin
 for t in select c.table_name from information_schema.columns c join pg_class p on p.relname=c.table_name join pg_namespace n on n.oid=p.relnamespace and n.nspname=c.table_schema
 where c.table_schema='public' and c.column_name='organization_id' and p.relkind='r' and p.relrowsecurity
 and c.table_name not like 'rv_%' and c.table_name not in ('organization_memberships','organization_member_locations','platform_workspace_contexts') loop
 predicate := 'private.rv_has_access(organization_id)';
 if exists(select 1 from information_schema.columns where table_schema='public' and table_name=t.table_name and column_name='location_id') then predicate := 'private.rv_has_access(organization_id, location_id)'; end if;
 execute format('create policy "RV subscription entitlement" on public.%I as restrictive for all to authenticated using (%s) with check (%s)',t.table_name,predicate,predicate);
 end loop;
end $$;

-- A single transaction records the event, billing state, and paid-period allocation.
create function public.apply_rv_stripe_event(event_key text,event_kind text,event_created bigint,customer_key text,subscription_key text,price_key text,billing_status text,starts timestamptz,ends timestamptz,cancels timestamptz,paid_period boolean) returns void
language plpgsql security invoker set search_path='' as $$
declare b public.rv_location_billing; inserted integer;
begin
 select * into b from public.rv_location_billing where stripe_customer_id=customer_key for update;
 if not found then raise exception 'Unknown billing customer'; end if;
 if b.stripe_subscription_id is not null and b.stripe_subscription_id<>subscription_key and not (b.status in ('canceled','expired') and event_created>=b.last_event_created) then return; end if;
 insert into public.runfloor_billing_events(id,event_type) values(event_key,event_kind) on conflict do nothing;
 get diagnostics inserted=row_count;
 if inserted=0 then return; end if;
 if event_created>=b.last_event_created then
 update public.rv_location_billing set stripe_subscription_id=subscription_key,stripe_price_id=price_key,status=billing_status,cancel_at=cancels,checkout_session_id=case when billing_status in ('canceled','expired') then null else checkout_session_id end,checkout_expires_at=case when billing_status in ('canceled','expired') then null else checkout_expires_at end,last_event_created=event_created where location_id=b.location_id;
 end if;
 if paid_period and billing_status in ('active','past_due') and ends>now() and (b.period_start is null or starts>=b.period_start) then
 insert into public.ai_credit_grants(organization_id,location_id,kind,total_units,period_start,expires_at,reference)
 values(b.organization_id,b.location_id,'included',2000000000,starts,ends,'rv-period:'||b.location_id||':'||starts) on conflict do nothing;
 get diagnostics inserted=row_count;
 if inserted>0 then
 update public.ai_credit_grants set expires_at=least(expires_at,now()) where organization_id=b.organization_id and location_id=b.location_id and kind='included' and reference<>'rv-period:'||b.location_id||':'||starts and expires_at>now();
 update public.rv_location_billing set period_start=starts,period_end=ends where location_id=b.location_id;
 end if;
 end if;
end $$;
revoke all on function public.apply_rv_stripe_event(text,text,bigint,text,text,text,text,timestamptz,timestamptz,timestamptz,boolean) from public,anon,authenticated;
grant execute on function public.apply_rv_stripe_event(text,text,bigint,text,text,text,text,timestamptz,timestamptz,timestamptz,boolean) to service_role;

create function private.rv_expire_trials(target_org uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not(private.is_org_member(target_org) or private.is_platform_owner()) then raise exception 'Unauthorized'; end if;
 update public.rv_location_billing set status='expired' where organization_id=target_org and status='trialing' and trial_ends_at<=now();
end $$;
revoke all on function private.rv_expire_trials(uuid) from public,anon;
grant execute on function private.rv_expire_trials(uuid) to authenticated;
create function private.rv_is_managed(target_org uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (private.is_org_member(target_org) or private.is_platform_owner()) and exists(select 1 from public.rv_trial_claims where organization_id=target_org)
$$;
revoke all on function private.rv_is_managed(uuid) from public,anon;
grant execute on function private.rv_is_managed(uuid) to authenticated;
create or replace function public.rv_access_state(target_org uuid,target_location uuid default null) returns jsonb
language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is null or not(private.is_org_member(target_org) or private.is_platform_owner()) then raise exception 'Unauthorized'; end if;
 perform private.rv_expire_trials(target_org);
 return jsonb_build_object('allowed',private.rv_has_access(target_org,target_location),'managed',private.rv_is_managed(target_org));
end $$;

create function public.add_rv_paid_location(actor uuid,target_org uuid,location_name text) returns uuid
language plpgsql security invoker set search_path='' as $$
declare loc uuid; started timestamptz;
begin
 perform pg_advisory_xact_lock(hashtextextended(target_org::text,0));
 if not exists(select 1 from public.organization_memberships where user_id=actor and organization_id=target_org and status='active' and role='tenant_admin') then raise exception 'Unauthorized'; end if;
 select created_at into started from public.rv_trial_claims where organization_id=target_org;
 if not found then raise exception 'Existing organizations require a reviewed billing migration.'; end if;
 if length(trim(location_name)) not between 2 and 120 then raise exception 'Enter a location name.'; end if;
 select id into loc from public.locations where organization_id=target_org and lower(name)=lower(trim(location_name));
 if not found then insert into public.locations(organization_id,name) values(target_org,trim(location_name)) returning id into loc;end if;
 insert into public.organization_member_locations(organization_id,user_id,location_id) values(target_org,actor,loc) on conflict do nothing;
 -- The organization has already claimed its introductory trial. New locations require payment.
 insert into public.rv_location_billing(location_id,organization_id,trial_started_at,trial_ends_at,status) values(loc,target_org,started,started+interval '168 hours','expired') on conflict do nothing;
 return loc;
end $$;
revoke all on function public.add_rv_paid_location(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.add_rv_paid_location(uuid,uuid,text) to service_role;

grant select on public.rv_location_billing,public.rv_trial_reminders to authenticated;
grant all on public.rv_trial_claims,public.rv_location_billing,public.rv_trial_reminders,public.rv_onboarding_progress to service_role;

-- Extend existing metering; never add another provider transport or change per-operation costs.
alter function public.reserve_ai_usage(uuid,uuid,uuid,text,text,bigint,bigint,text) rename to reserve_legacy_ai_usage;
create function public.reserve_ai_usage(target_org uuid,target_user uuid,request_id uuid,feature text,target_model text,max_input bigint,max_output bigint,input_fingerprint text default null,target_location uuid default null)
 returns jsonb language plpgsql security definer set search_path='' as $$
 #variable_conflict use_variable
 declare rate public.ai_model_rates;cfg public.ai_billing_settings;r public.ai_usage_requests;g public.ai_credit_grants;need bigint;left_units bigint;available bigint;take bigint;
 begin
 if max_input<0 or max_output<0 or max_input>4000000 or max_output>32768 or length(feature)>120 then raise exception 'Invalid request bounds';end if;
 if not exists(select 1 from public.organization_memberships where organization_id=target_org and user_id=target_user and status='active') and
 not exists(select 1 from public.profiles where id=target_user and is_platform_owner) then raise exception 'Membership required';end if;
 perform pg_advisory_xact_lock(hashtextextended(target_org::text,0));
 if not exists(select 1 from public.rv_trial_claims where organization_id=target_org) then
 return public.reserve_legacy_ai_usage(target_org,target_user,request_id,feature,target_model,max_input,max_output,input_fingerprint);
 end if;
 if target_location is null then select location_id into target_location from public.organization_memberships where organization_id=target_org and user_id=target_user and status='active';end if;
 if target_location is null then select min(location_id::text)::uuid into target_location from public.rv_location_billing where organization_id=target_org having count(*)=1;end if;
 if not exists(select 1 from public.organization_memberships where organization_id=target_org and user_id=target_user and status='active' and role='tenant_admin') and not exists(select 1 from public.organization_member_locations where organization_id=target_org and user_id=target_user and location_id=target_location) then raise exception 'Location access denied';end if;
 if not exists(select 1 from public.rv_location_billing where organization_id=target_org and location_id=target_location and ((status='trialing' and trial_ends_at>now()) or(status in ('active','past_due') and period_end>now()))) then raise exception 'Your location requires an active trial or subscription';end if;

 select * into r from public.ai_usage_requests where id=request_id;
 if found then raise exception 'Duplicate AI request; inspect existing outcome before retrying';end if;
 perform private.ensure_ai_period(target_org);
 select * into cfg from public.ai_billing_settings where organization_id=target_org;
 if cfg.frozen then raise exception 'AI paused for this company';end if;
 select * into rate from public.ai_model_rates where model=target_model and active;
 if not found then raise exception 'AI model pricing requires administrator configuration';end if;
 need:=ceil((max_input::numeric*rate.input_units_per_million+max_output::numeric*rate.output_units_per_million)/1000000);
 select coalesce(sum(total_units-used_units-reserved_units-revoked_units),0) into available from public.ai_credit_grants
 where organization_id=target_org and location_id=target_location and (expires_at is null or expires_at>now());
 if need<=0 or available<need then raise exception 'Insufficient AI credits. Buy credits or wait for the monthly reset.';end if;
 insert into public.ai_usage_requests(id,organization_id,user_id,operation,model,rate_id,reserved_units,fingerprint,location_id) values(request_id,target_org,target_user,feature,target_model,rate.id,need,input_fingerprint,target_location);
 left_units:=need;
 for g in select * from public.ai_credit_grants where organization_id=target_org and location_id=target_location and (expires_at is null or expires_at>now()) and total_units-used_units-reserved_units-revoked_units>0
 order by case kind when 'included' then 0 else 1 end,expires_at nulls last,created_at,id for update loop
  take:=least(left_units,g.total_units-g.used_units-g.reserved_units-g.revoked_units);
  update public.ai_credit_grants set reserved_units=reserved_units+take where id=g.id;
  insert into public.ai_credit_allocations values(request_id,g.id,target_org,take);
  left_units:=left_units-take;exit when left_units=0;
 end loop;
 return jsonb_build_object('id',request_id,'reserved_units',need,'rate',to_jsonb(rate));
 end$$;

revoke all on function public.reserve_ai_usage(uuid,uuid,uuid,text,text,bigint,bigint,text,uuid) from public,anon,authenticated;
grant execute on function public.reserve_ai_usage(uuid,uuid,uuid,text,text,bigint,bigint,text,uuid) to service_role;
-- Enrolled trial organizations must not receive the legacy automatic monthly allowance.
do $migration$ declare definition text; begin
 definition:=pg_get_functiondef('private.ensure_ai_period(uuid)'::regprocedure);
 definition:=replace(definition,' insert into public.ai_billing_settings',' if exists(select 1 from public.rv_trial_claims where organization_id=org) then return;end if;
 insert into public.ai_billing_settings');
 execute definition;
 definition:=pg_get_functiondef('public.get_ai_credit_summary(uuid)'::regprocedure);
 definition:=replace(definition,' perform pg_advisory_xact_lock',' if exists(select 1 from public.rv_trial_claims where organization_id=target_org) then raise exception ''Use location Subscription & Billing for this workspace'';end if;
 perform pg_advisory_xact_lock');
 execute definition;
 definition:=pg_get_functiondef('public.admin_reconcile_ai_usage(uuid,text,jsonb,text)'::regprocedure);
 definition:=replace(definition,'where organization_id=r.organization_id and (expires_at','where organization_id=r.organization_id and (r.location_id is null or location_id=r.location_id) and (expires_at');
 execute definition;
end $migration$;
create function private.rv_billing_rows(target_org uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(b)||jsonb_build_object(
 'included_credits',coalesce((select sum(total_units-used_units-reserved_units-revoked_units)/1000000.0 from public.ai_credit_grants g where g.organization_id=target_org and g.location_id=b.location_id and g.kind='included' and (g.expires_at is null or g.expires_at>now())),0),
 'purchased_credits',coalesce((select sum(total_units-used_units-reserved_units-revoked_units)/1000000.0 from public.ai_credit_grants g where g.organization_id=target_org and g.location_id=b.location_id and g.kind<>'included' and (g.expires_at is null or g.expires_at>now())),0))), '[]'::jsonb)
 from public.rv_location_billing b where b.organization_id=target_org and private.rv_can_view_location(target_org,b.location_id)
$$;
revoke all on function private.rv_billing_rows(uuid) from public,anon;
grant execute on function private.rv_billing_rows(uuid) to authenticated;
create function public.get_rv_billing_rows(target_org uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$ begin
 perform private.rv_expire_trials(target_org);
 return private.rv_billing_rows(target_org);
end $$;
revoke all on function public.get_rv_billing_rows(uuid) from public,anon;
grant execute on function public.get_rv_billing_rows(uuid) to authenticated;

revoke all on public.rv_trial_claims from anon,authenticated;
