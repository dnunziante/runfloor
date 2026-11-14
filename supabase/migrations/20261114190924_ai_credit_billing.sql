-- RunFloor only. Integer microcredits: 1 credit = 1,000,000 units; $1 cost = 100,000,000 units.
create table public.ai_billing_settings (
 organization_id uuid primary key references public.organizations(id), included_units bigint not null default 2000000000 check(included_units>=0),
 reset_day int not null default 1 check(reset_day between 1 and 28), warn_at int[] not null default array[75,90],
 frozen boolean not null default false, billing_admin_ids uuid[] not null default '{}', updated_at timestamptz not null default now()
);
create table public.ai_model_rates (
 id uuid primary key default gen_random_uuid(), model text not null, version text not null, input_units_per_million bigint not null check(input_units_per_million>=0),
 cached_units_per_million bigint not null check(cached_units_per_million>=0), output_units_per_million bigint not null check(output_units_per_million>=0),
 active boolean not null default false, source_url text not null, created_at timestamptz not null default now(), unique(model,version)
);
create unique index ai_model_one_active on public.ai_model_rates(model) where active;
insert into public.ai_model_rates(model,version,input_units_per_million,cached_units_per_million,output_units_per_million,active,source_url) values
 ('gpt-5-mini','2026-11-14',25000000,2500000,200000000,true,'https://developers.openai.com/api/docs/models/gpt-5-mini'),
 ('text-embedding-3-small','2026-11-14',2000000,2000000,0,true,'https://developers.openai.com/api/docs/models/text-embedding-3-small');
create table public.ai_credit_grants (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),kind text not null check(kind in('included','purchased','adjustment')),
 total_units bigint not null,used_units bigint not null default 0 check(used_units>=0),reserved_units bigint not null default 0 check(reserved_units>=0),
 revoked_units bigint not null default 0 check(revoked_units>=0),period_start timestamptz,expires_at timestamptz,reference text not null unique,
 created_at timestamptz not null default now(),unique(id,organization_id),check(total_units>=0 or kind='adjustment')
);
create index ai_credit_grants_org on public.ai_credit_grants(organization_id,expires_at);
create table public.ai_usage_requests (
 id uuid primary key,organization_id uuid not null references public.organizations(id),user_id uuid not null references auth.users(id),
 operation text not null,model text not null,rate_id uuid not null references public.ai_model_rates(id),state text not null default 'reserved' check(state in('reserved','uncertain','settled','released')),
 reserved_units bigint not null check(reserved_units>=0),charged_units bigint not null default 0 check(charged_units>=0),provider_cost_units bigint not null default 0 check(provider_cost_units>=0),
 fingerprint text,usage jsonb,provider_request_id text,created_at timestamptz not null default now(),completed_at timestamptz,unique(id,organization_id)
);
create index ai_usage_org_user_time on public.ai_usage_requests(organization_id,user_id,created_at desc);
create table public.ai_credit_allocations (
 request_id uuid not null,grant_id uuid not null,organization_id uuid not null,units bigint not null check(units>0),
 primary key(request_id,grant_id),foreign key(request_id,organization_id) references public.ai_usage_requests(id,organization_id),
 foreign key(grant_id,organization_id) references public.ai_credit_grants(id,organization_id)
);
create table public.ai_credit_notifications (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),period_start timestamptz not null,
 threshold int not null,created_at timestamptz not null default now(),unique(organization_id,period_start,threshold)
);
create table public.ai_billing_audit (
 id uuid primary key default gen_random_uuid(),organization_id uuid references public.organizations(id),actor_id uuid references auth.users(id),
 action text not null,reason text not null,details jsonb not null default '{}',created_at timestamptz not null default now()
);
create table public.ai_credit_packs (
 id uuid primary key default gen_random_uuid(),name text not null,credit_units bigint not null check(credit_units>0),price_cents int not null check(price_cents>0),
 currency text not null default 'usd' check(currency='usd'),expires_days int check(expires_days>0),active boolean not null default false,
 approved_by uuid references auth.users(id),created_at timestamptz not null default now(),check(not active or approved_by is not null)
);
create table public.runfloor_billing_customers (
 organization_id uuid primary key references public.organizations(id),stripe_customer_id text not null unique,
 stripe_account_id text not null,livemode boolean not null,subscription_id text unique,subscription_status text,
 period_start timestamptz,period_end timestamptz,updated_at timestamptz not null default now()
);
create table public.ai_credit_orders (
 id uuid primary key,organization_id uuid not null references public.organizations(id),user_id uuid not null references auth.users(id),
 pack_id uuid not null references public.ai_credit_packs(id),credit_units bigint not null,price_cents int not null,currency text not null,
 expires_days int,stripe_session_id text unique,payment_intent_id text unique,status text not null default 'pending' check(status in('pending','paid','failed','refunded','disputed')),
 refunded_cents int not null default 0,disputed boolean not null default false,grant_id uuid references public.ai_credit_grants(id),created_at timestamptz not null default now()
);
create table public.runfloor_billing_events (id text primary key,event_type text not null,created_at timestamptz not null default now());
create table public.runfloor_billing_catalog (
 id boolean primary key default true check(id),monthly_price_cents int not null default 9900 check(monthly_price_cents=9900),
 location_limit int not null default 1 check(location_limit=1),included_units bigint not null default 2000000000,
 stripe_price_id text,active boolean not null default false,approved_by uuid references auth.users(id),check(not active or (approved_by is not null and stripe_price_id is not null))
);
insert into public.runfloor_billing_catalog default values;

create function private.can_manage_ai_billing(org uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.has_org_role(org,array['tenant_admin']::public.organization_role[]) or
 (private.is_org_member(org) and exists(select 1 from public.ai_billing_settings s where s.organization_id=org and auth.uid()=any(s.billing_admin_ids)))
$$;
-- No tenant can change balances, grant credits, settle provider usage or approve prices directly.
do $$declare t text;begin
 foreach t in array array['ai_billing_settings','ai_model_rates','ai_credit_grants','ai_usage_requests','ai_credit_allocations','ai_credit_notifications','ai_billing_audit','ai_credit_packs','runfloor_billing_customers','ai_credit_orders','runfloor_billing_events','runfloor_billing_catalog'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon,authenticated',t);
 execute format('grant all on public.%I to service_role',t);
 end loop;
end$$;
grant select on public.ai_billing_settings,public.ai_credit_notifications,public.ai_credit_packs,public.ai_credit_orders,public.runfloor_billing_customers,public.runfloor_billing_catalog to authenticated;
create policy ai_settings_read on public.ai_billing_settings for select to authenticated using(private.is_org_member(organization_id) or private.is_platform_owner());
create policy ai_notifications_read on public.ai_credit_notifications for select to authenticated using(private.is_org_member(organization_id) or private.is_platform_owner());
create policy ai_packs_read on public.ai_credit_packs for select to authenticated using(active or private.is_platform_owner());
create policy ai_orders_read on public.ai_credit_orders for select to authenticated using(private.can_manage_ai_billing(organization_id));
create policy ai_customers_read on public.runfloor_billing_customers for select to authenticated using(private.can_manage_ai_billing(organization_id));
create policy ai_catalog_read on public.runfloor_billing_catalog for select to authenticated using(true);
-- Provider costs and token details are platform-only. Customer history exposes a limited column set.
grant select(id,organization_id,user_id,operation,model,state,reserved_units,charged_units,created_at,completed_at) on public.ai_usage_requests to authenticated;
create policy ai_usage_read on public.ai_usage_requests for select to authenticated using(private.is_platform_owner() or private.can_manage_ai_billing(organization_id) or (private.is_org_member(organization_id) and user_id=auth.uid()));
grant select on public.ai_model_rates,public.ai_billing_audit to authenticated;
create policy ai_rates_read on public.ai_model_rates for select to authenticated using(private.is_platform_owner());
create policy ai_audit_read on public.ai_billing_audit for select to authenticated using(private.is_platform_owner());

create function private.ensure_ai_period(org uuid) returns void language plpgsql security definer set search_path='' as $$
 #variable_conflict use_variable
 declare cfg public.ai_billing_settings; start_at timestamptz; end_at timestamptz; last_end timestamptz; sub public.runfloor_billing_customers;
 begin
 insert into public.ai_billing_settings(organization_id) values(org) on conflict do nothing;
 select * into cfg from public.ai_billing_settings where organization_id=org;
 if exists(select 1 from public.ai_credit_grants where organization_id=org and kind='included' and period_start<=now() and expires_at>now()) then return;end if;
 select * into sub from public.runfloor_billing_customers where organization_id=org;
 if sub.subscription_id is not null then
  if sub.subscription_status not in('active','trialing') or sub.period_start is null or sub.period_end<=now() then return;end if;
  start_at:=sub.period_start;end_at:=sub.period_end;
 else
  start_at:=date_trunc('month',now() at time zone 'UTC') at time zone 'UTC'+make_interval(days=>cfg.reset_day-1);
  if start_at>now() then start_at:=start_at-interval '1 month';end if;
  end_at:=start_at+interval '1 month';
 end if;
 select max(expires_at) into last_end from public.ai_credit_grants where organization_id=org and kind='included';
 -- Changing reset dates never creates an overlapping second allowance.
 if last_end>start_at then start_at:=last_end;end if;
 if start_at>=end_at then return;end if;
 insert into public.ai_credit_grants(organization_id,kind,total_units,period_start,expires_at,reference)
 values(org,'included',cfg.included_units,start_at,end_at,'period:'||org||':'||start_at) on conflict(reference) do nothing;
 end$$;
create function public.reserve_ai_usage(target_org uuid,target_user uuid,request_id uuid,feature text,target_model text,max_input bigint,max_output bigint,input_fingerprint text default null)
 returns jsonb language plpgsql security definer set search_path='' as $$
 #variable_conflict use_variable
 declare rate public.ai_model_rates;cfg public.ai_billing_settings;r public.ai_usage_requests;g public.ai_credit_grants;need bigint;left_units bigint;available bigint;take bigint;
 begin
 if max_input<0 or max_output<0 or max_input>4000000 or max_output>32768 or length(feature)>120 then raise exception 'Invalid request bounds';end if;
 if not exists(select 1 from public.organization_memberships where organization_id=target_org and user_id=target_user and status='active') and
 not exists(select 1 from public.profiles where id=target_user and is_platform_owner) then raise exception 'Membership required';end if;
 perform pg_advisory_xact_lock(hashtextextended(target_org::text,0));
 select * into r from public.ai_usage_requests where id=request_id;
 if found then raise exception 'Duplicate AI request; inspect existing outcome before retrying';end if;
 perform private.ensure_ai_period(target_org);
 select * into cfg from public.ai_billing_settings where organization_id=target_org;
 if cfg.frozen then raise exception 'AI paused for this company';end if;
 select * into rate from public.ai_model_rates where model=target_model and active;
 if not found then raise exception 'AI model pricing requires administrator configuration';end if;
 need:=ceil((max_input::numeric*rate.input_units_per_million+max_output::numeric*rate.output_units_per_million)/1000000);
 select coalesce(sum(total_units-used_units-reserved_units-revoked_units),0) into available from public.ai_credit_grants
 where organization_id=target_org and (expires_at is null or expires_at>now());
 if need<=0 or available<need then raise exception 'Insufficient AI credits. Buy credits or wait for the monthly reset.';end if;
 insert into public.ai_usage_requests(id,organization_id,user_id,operation,model,rate_id,reserved_units,fingerprint) values(request_id,target_org,target_user,feature,target_model,rate.id,need,input_fingerprint);
 left_units:=need;
 for g in select * from public.ai_credit_grants where organization_id=target_org and (expires_at is null or expires_at>now()) and total_units-used_units-reserved_units-revoked_units>0
 order by case kind when 'included' then 0 else 1 end,expires_at nulls last,created_at,id for update loop
  take:=least(left_units,g.total_units-g.used_units-g.reserved_units-g.revoked_units);
  update public.ai_credit_grants set reserved_units=reserved_units+take where id=g.id;
  insert into public.ai_credit_allocations values(request_id,g.id,target_org,take);
  left_units:=left_units-take;exit when left_units=0;
 end loop;
 return jsonb_build_object('id',request_id,'reserved_units',need,'rate',to_jsonb(rate));
 end$$;
create function public.finish_ai_usage(request_id uuid,outcome text,actual_input bigint default 0,cached_input bigint default 0,actual_output bigint default 0,reasoning_output bigint default 0,provider_id text default null)
 returns jsonb language plpgsql security definer set search_path='' as $$
 #variable_conflict use_variable
 declare r public.ai_usage_requests;rate public.ai_model_rates;a record;cost bigint;remaining bigint;used bigint;start_at timestamptz;total bigint;threshold int;cfg public.ai_billing_settings;
 begin
 select * into r from public.ai_usage_requests where id=request_id;if not found then raise exception 'Unknown AI reservation';end if;
 perform pg_advisory_xact_lock(hashtextextended(r.organization_id::text,0));
 select * into r from public.ai_usage_requests where id=request_id for update;
 if r.state in('settled','released') then return jsonb_build_object('state',r.state);end if;
 if outcome='uncertain' then update public.ai_usage_requests set state='uncertain',provider_request_id=provider_id where id=request_id;return jsonb_build_object('state','uncertain');end if;
 if outcome not in('settled','released') or least(actual_input,cached_input,actual_output,reasoning_output)<0 or cached_input>actual_input or reasoning_output>actual_output then raise exception 'Invalid usage';end if;
 select * into rate from public.ai_model_rates where id=r.rate_id;
 cost:=case when outcome='released' then 0 else ceil(((actual_input-cached_input)::numeric*rate.input_units_per_million+cached_input::numeric*rate.cached_units_per_million+actual_output::numeric*rate.output_units_per_million)/1000000) end;
 -- If a provider violates the conservative bound, retain the hold and freeze further AI rather than overspend silently.
 if cost>r.reserved_units then
  update public.ai_usage_requests set state='uncertain',provider_cost_units=cost,usage=jsonb_build_object('input',actual_input,'cached',cached_input,'output',actual_output,'reasoning',reasoning_output) where id=request_id;
  update public.ai_billing_settings set frozen=true where organization_id=r.organization_id;
  return jsonb_build_object('state','uncertain','requires_review',true);
 end if;
 remaining:=cost;
 for a in select x.* from public.ai_credit_allocations x join public.ai_credit_grants g on g.id=x.grant_id where x.request_id=request_id
 order by case g.kind when 'included' then 0 else 1 end,g.expires_at nulls last,g.created_at,g.id loop
  used:=least(remaining,a.units);remaining:=remaining-used;
  update public.ai_credit_grants set reserved_units=reserved_units-a.units,used_units=used_units+used where id=a.grant_id;
 end loop;
 update public.ai_usage_requests set state=outcome,charged_units=cost,provider_cost_units=cost,provider_request_id=provider_id,completed_at=now(),
 usage=jsonb_build_object('input',actual_input,'cached',cached_input,'output',actual_output,'reasoning',reasoning_output) where id=request_id;
 select * into cfg from public.ai_billing_settings where organization_id=r.organization_id;
 select period_start,total_units,used_units into start_at,total,used from public.ai_credit_grants where organization_id=r.organization_id and kind='included' and period_start<=now() and expires_at>now() order by period_start desc limit 1;
 foreach threshold in array cfg.warn_at loop
  if total>0 and used::numeric/total*100>=threshold then insert into public.ai_credit_notifications(organization_id,period_start,threshold) values(r.organization_id,start_at,threshold) on conflict do nothing;end if;
 end loop;
 return jsonb_build_object('state',outcome,'charged_units',cost);
 end$$;
create function public.get_ai_credit_summary(target_org uuid) returns jsonb language plpgsql security definer set search_path='' as $$
 #variable_conflict use_variable
 declare result jsonb;
 begin
 if not(private.is_org_member(target_org) or private.is_platform_owner()) then raise exception 'Access denied';end if;
 perform pg_advisory_xact_lock(hashtextextended(target_org::text,0));perform private.ensure_ai_period(target_org);
 select jsonb_build_object('included_units',coalesce(sum(total_units) filter(where kind='included'),0),'used_units',coalesce(sum(used_units) filter(where kind='included'),0),
 'included_remaining_units',coalesce(sum(total_units-used_units-reserved_units-revoked_units) filter(where kind='included'),0),'reserved_units',coalesce(sum(reserved_units),0),'purchased_units',coalesce(sum(total_units-used_units-reserved_units-revoked_units) filter(where kind<>'included'),0),
 'available_units',coalesce(sum(total_units-used_units-reserved_units-revoked_units),0),'period_start',max(period_start) filter(where kind='included'),'period_end',max(expires_at) filter(where kind='included'),
 'can_manage',private.can_manage_ai_billing(target_org),'frozen',(select frozen from public.ai_billing_settings where organization_id=target_org)) into result
 from public.ai_credit_grants where organization_id=target_org and (expires_at is null or expires_at>now());return result;
 end$$;

create function public.admin_ai_billing(action text,target_org uuid,parameters jsonb,reason text) returns void language plpgsql security definer set search_path='' as $$
 #variable_conflict use_variable
 declare k text;
 begin
 if not private.is_platform_owner() or length(trim(reason))<5 then raise exception 'Platform owner and audit reason required';end if;
 if target_org is not null then perform pg_advisory_xact_lock(hashtextextended(target_org::text,0));end if;
 if action='settings' then
  if parameters ? 'warn_at' and (jsonb_array_length(parameters->'warn_at')=0 or exists(select 1 from jsonb_array_elements_text(parameters->'warn_at') x where x::int not between 1 and 100)) then raise exception 'Invalid warning thresholds';end if;
  insert into public.ai_billing_settings(organization_id,included_units,reset_day,frozen,warn_at) values(target_org,(parameters->>'included_units')::bigint,(parameters->>'reset_day')::int,(parameters->>'frozen')::boolean,case when parameters ? 'warn_at' then array(select jsonb_array_elements_text(parameters->'warn_at')::int) else array[75,90] end)
  on conflict(organization_id) do update set included_units=excluded.included_units,reset_day=excluded.reset_day,frozen=excluded.frozen,warn_at=excluded.warn_at,updated_at=now();
 elsif action='adjustment' then
  insert into public.ai_credit_grants(organization_id,kind,total_units,reference) values(target_org,'adjustment',(parameters->>'units')::bigint,'admin:'||gen_random_uuid());
 elsif action='billing_admin' then
  if not exists(select 1 from public.organization_memberships where organization_id=target_org and user_id=(parameters->>'user_id')::uuid and status='active') then raise exception 'Active member required';end if;
  update public.ai_billing_settings set billing_admin_ids=case when (parameters->>'enabled')::boolean then array_append(array_remove(billing_admin_ids,(parameters->>'user_id')::uuid),(parameters->>'user_id')::uuid) else array_remove(billing_admin_ids,(parameters->>'user_id')::uuid) end where organization_id=target_org;
 elsif action='pack' then
  -- Draft only: approval/activation is a distinct explicitly audited operation.
  insert into public.ai_credit_packs(name,credit_units,price_cents,expires_days) values(parameters->>'name',(parameters->>'credit_units')::bigint,(parameters->>'price_cents')::int,(parameters->>'expires_days')::int);
 elsif action='approve_pack' then
  update public.ai_credit_packs set active=(parameters->>'active')::boolean,approved_by=auth.uid() where id=(parameters->>'id')::uuid;
 elsif action='rate' then
  k:=parameters->>'model';update public.ai_model_rates set active=false where model=k and active;
  insert into public.ai_model_rates(model,version,input_units_per_million,cached_units_per_million,output_units_per_million,active,source_url)
  values(k,parameters->>'version',(parameters->>'input_units_per_million')::bigint,(parameters->>'cached_units_per_million')::bigint,(parameters->>'output_units_per_million')::bigint,true,parameters->>'source_url');
 else raise exception 'Unknown admin action';end if;
 insert into public.ai_billing_audit(organization_id,actor_id,action,reason,details) values(target_org,auth.uid(),action,reason,parameters);
 end$$;
-- Explicit execution boundaries; default PUBLIC execute is always removed.
revoke all on function private.can_manage_ai_billing(uuid),private.ensure_ai_period(uuid) from public,anon,authenticated;
grant execute on function private.can_manage_ai_billing(uuid) to authenticated;
revoke all on function public.reserve_ai_usage(uuid,uuid,uuid,text,text,bigint,bigint,text),public.finish_ai_usage(uuid,text,bigint,bigint,bigint,bigint,text) from public,anon,authenticated;
grant execute on function public.reserve_ai_usage(uuid,uuid,uuid,text,text,bigint,bigint,text),public.finish_ai_usage(uuid,text,bigint,bigint,bigint,bigint,text) to service_role;
revoke all on function public.get_ai_credit_summary(uuid),public.admin_ai_billing(text,uuid,jsonb,text) from public,anon;
grant execute on function public.get_ai_credit_summary(uuid),public.admin_ai_billing(text,uuid,jsonb,text) to authenticated;
-- Verified payment fulfillment and reversible purchase entitlement adjustments.
create function public.apply_ai_credit_payment(event_id text,event_kind text,order_id uuid,session_id text,payment_id text,paid_cents int,paid_currency text,account_id text,live boolean,refund_cents int default 0,is_disputed boolean default false)
 returns void language plpgsql security definer set search_path='' as $$
 #variable_conflict use_variable
 declare o public.ai_credit_orders;g uuid;revoke_units bigint;org uuid;
 begin
 select organization_id into org from public.ai_credit_orders where id=order_id;if org is null then raise exception 'Unknown RunFloor order';end if;
 perform pg_advisory_xact_lock(hashtextextended(org::text,0));
 if exists(select 1 from public.runfloor_billing_events where id=event_id) then return;end if;
 select * into o from public.ai_credit_orders where id=order_id for update;
 if not exists(select 1 from public.runfloor_billing_customers where organization_id=org and stripe_account_id=account_id and livemode=live) then raise exception 'Wrong billing account or mode';end if;
 if event_kind='paid' then
  if paid_cents<>o.price_cents or paid_currency<>o.currency or o.stripe_session_id is distinct from session_id or payment_id is null then raise exception 'Payment does not match order';end if;
  if o.grant_id is null then
   insert into public.ai_credit_grants(organization_id,kind,total_units,reference,expires_at) values(org,'purchased',o.credit_units,'purchase:'||o.id,case when o.expires_days is null then null else now()+make_interval(days=>o.expires_days) end) returning id into g;
   update public.ai_credit_orders set status='paid',payment_intent_id=payment_id,grant_id=g where id=o.id;
  end if;
 elsif event_kind in('refund','dispute') then
  if o.payment_intent_id is distinct from payment_id or o.grant_id is null then raise exception 'Purchase not fulfilled yet; retry event';end if;
  refund_cents:=greatest(o.refunded_cents,least(o.price_cents,refund_cents));
  is_disputed:=case when event_kind='refund' then o.disputed else is_disputed end;
  revoke_units:=case when is_disputed then o.credit_units else ceil(o.credit_units::numeric*refund_cents/o.price_cents) end;
  update public.ai_credit_grants set revoked_units=revoke_units where id=o.grant_id;
  update public.ai_credit_orders set refunded_cents=refund_cents,disputed=is_disputed,status=case when is_disputed then 'disputed' when refund_cents>0 then 'refunded' else 'paid' end where id=o.id;
 elsif event_kind='failed' then
  update public.ai_credit_orders set status='failed' where id=o.id and status='pending';
 else raise exception 'Unsupported payment event';end if;
 insert into public.runfloor_billing_events(id,event_type) values(event_id,event_kind);
 end$$;
revoke all on function public.apply_ai_credit_payment(text,text,uuid,text,text,int,text,text,boolean,int,boolean) from public,anon,authenticated;
grant execute on function public.apply_ai_credit_payment(text,text,uuid,text,text,int,text,text,boolean,int,boolean) to service_role;
-- No recurring price is active until explicitly approved in platform administration.
create function public.apply_runfloor_subscription(event_id text,target_org uuid,customer_id text,subscription text,sub_status text,start_at timestamptz,end_at timestamptz,price_id text,account_id text,live boolean)
 returns void language plpgsql security definer set search_path='' as $$
 #variable_conflict use_variable
 begin
 perform pg_advisory_xact_lock(hashtextextended(target_org::text,0));
 if exists(select 1 from public.runfloor_billing_events where id=event_id) then return;end if;
 if not exists(select 1 from public.runfloor_billing_customers where organization_id=target_org and stripe_customer_id=customer_id and stripe_account_id=account_id and livemode=live) then raise exception 'Unknown RunFloor billing customer';end if;
 if not exists(select 1 from public.runfloor_billing_catalog where stripe_price_id=price_id and active) then raise exception 'Subscription price not approved';end if;
 if end_at<=start_at then raise exception 'Invalid subscription period';end if;
 update public.runfloor_billing_customers set subscription_id=subscription,subscription_status=sub_status,period_start=start_at,period_end=end_at,updated_at=now() where organization_id=target_org;
 insert into public.runfloor_billing_events(id,event_type) values(event_id,'subscription');
 end$$;
revoke all on function public.apply_runfloor_subscription(text,uuid,text,text,text,timestamptz,timestamptz,text,text,boolean) from public,anon,authenticated;
grant execute on function public.apply_runfloor_subscription(text,uuid,text,text,text,timestamptz,timestamptz,text,text,boolean) to service_role;
create function private.limit_runfloor_locations() returns trigger language plpgsql security definer set search_path='' as $$
 begin
 if new.is_active and exists(select 1 from public.runfloor_billing_customers where organization_id=new.organization_id and subscription_id is not null) then
 perform pg_advisory_xact_lock(hashtextextended(new.organization_id::text,1));
 if (select count(*) from public.locations where organization_id=new.organization_id and is_active and id<>new.id)>=1 then raise exception 'The RunFloor plan includes one active location';end if;
 end if;return new;end$$;
create trigger runfloor_location_limit before insert or update of is_active,organization_id on public.locations for each row execute function private.limit_runfloor_locations();
revoke all on function private.limit_runfloor_locations() from public,anon,authenticated;
insert into public.ai_model_rates(model,version,input_units_per_million,cached_units_per_million,output_units_per_million,active,source_url)
values('gpt-5.6-terra','2026-11-14',200000000,20000000,1200000000,true,'https://developers.openai.com/api/docs/models/gpt-5.6-terra');
-- Catalog activation is deliberately separate from drafting the fixed $99 plan.
create function public.admin_approve_runfloor_plan(price_id text,enabled boolean,reason text) returns void language plpgsql security definer set search_path='' as $$
 begin
 if not private.is_platform_owner() or length(trim(reason))<5 then raise exception 'Platform owner and approval reason required';end if;
 update public.runfloor_billing_catalog set stripe_price_id=price_id,active=enabled,approved_by=auth.uid() where id;
 insert into public.ai_billing_audit(actor_id,action,reason,details) values(auth.uid(),'approve_subscription',reason,jsonb_build_object('price_id',price_id,'enabled',enabled));
 end$$;
revoke all on function public.admin_approve_runfloor_plan(text,boolean,text) from public,anon;
grant execute on function public.admin_approve_runfloor_plan(text,boolean,text) to authenticated;
-- Durable duplicate protection without retaining prompt or document contents.

create unique index ai_usage_active_fingerprint on public.ai_usage_requests(organization_id,user_id,operation,fingerprint) where fingerprint is not null and state in('reserved','uncertain');
create function public.admin_reconcile_ai_usage(request_id uuid,outcome text,usage_data jsonb,reason text) returns jsonb language plpgsql security definer set search_path='' as $$
 #variable_conflict use_variable
 declare r public.ai_usage_requests;result jsonb;
 begin
 if not private.is_platform_owner() or length(trim(reason))<10 then raise exception 'Platform owner and verification reason required';end if;
 select * into r from public.ai_usage_requests where id=request_id and state='uncertain';if not found then raise exception 'Uncertain request not found';end if;
 result:=public.finish_ai_usage(request_id,outcome,coalesce((usage_data->>'input')::bigint,0),coalesce((usage_data->>'cached')::bigint,0),coalesce((usage_data->>'output')::bigint,0),coalesce((usage_data->>'reasoning')::bigint,0),usage_data->>'provider_id');
 insert into public.ai_billing_audit(organization_id,actor_id,action,reason,details) values(r.organization_id,auth.uid(),'reconcile',reason,usage_data||jsonb_build_object('request',request_id,'outcome',outcome));return result;
 end$$;
revoke all on function public.admin_reconcile_ai_usage(uuid,text,jsonb,text) from public,anon;
grant execute on function public.admin_reconcile_ai_usage(uuid,text,jsonb,text) to authenticated;

-- A durable company-wide slot prevents concurrent subscription checkouts.
create table public.runfloor_subscription_checkouts(organization_id uuid primary key references public.organizations(id),request_id uuid not null,session_id text,expires_at timestamptz,created_at timestamptz not null default now());
alter table public.runfloor_subscription_checkouts enable row level security;
revoke all on public.runfloor_subscription_checkouts from anon,authenticated;grant all on public.runfloor_subscription_checkouts to service_role;
create function public.claim_runfloor_subscription_checkout(org uuid,request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
 #variable_conflict use_variable
 declare slot public.runfloor_subscription_checkouts;
 begin
 perform pg_advisory_xact_lock(hashtextextended(org::text,0));
 insert into public.runfloor_subscription_checkouts(organization_id,request_id) values(org,request_id) on conflict do nothing;
 select * into slot from public.runfloor_subscription_checkouts where organization_id=org;
 return to_jsonb(slot);
 end$$;
revoke all on function public.claim_runfloor_subscription_checkout(uuid,uuid) from public,anon,authenticated;grant execute on function public.claim_runfloor_subscription_checkout(uuid,uuid) to service_role;

-- Recurring-plan refunds/disputes require review; never silently mint or erase usage.
create function public.review_runfloor_subscription_payment(event_id text,customer_id text,account_id text,live boolean) returns void language plpgsql security definer set search_path='' as $$
 #variable_conflict use_variable
 declare org uuid;
 begin
 select organization_id into org from public.runfloor_billing_customers where stripe_customer_id=customer_id and stripe_account_id=account_id and livemode=live and subscription_id is not null;
 if org is null then return;end if;
 perform pg_advisory_xact_lock(hashtextextended(org::text,0));
 if exists(select 1 from public.runfloor_billing_events where id=event_id) then return;end if;
 insert into public.ai_billing_settings(organization_id,frozen) values(org,true) on conflict(organization_id) do update set frozen=true;
 insert into public.ai_billing_audit(organization_id,action,reason,details) values(org,'subscription_payment_review','Subscription refund or dispute requires review',jsonb_build_object('event_id',event_id));
 insert into public.runfloor_billing_events(id,event_type) values(event_id,'subscription_payment_review');
 end$$;
revoke all on function public.review_runfloor_subscription_payment(text,text,text,boolean) from public,anon,authenticated;grant execute on function public.review_runfloor_subscription_payment(text,text,text,boolean) to service_role;
