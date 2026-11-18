-- No existing organization is enrolled or modified by this migration.
create table public.account_subscription_plans (
 organization_id uuid primary key references public.organizations(id),
 owner_user_id uuid not null references public.profiles(id),
 plan_key text not null default 'sales_solo' check(plan_key in ('sales_solo','complete')),
 status text not null default 'pending',
 seat_limit integer not null default 1 check(seat_limit between 1 and 10000),
 ai_limit_units bigint not null default 500000000 check(ai_limit_units between 0 and 100000000000),
 stripe_customer_id text unique, stripe_subscription_id text unique,
 stripe_account_id text, livemode boolean,
 paid_start timestamptz, paid_until timestamptz, cancel_at timestamptz,
 event_created bigint not null default 0, checkout_session_id text,
 checkout_attempt uuid, checkout_expires_at timestamptz,
 access_override_until timestamptz, created_at timestamptz not null default now()
);
alter table public.account_subscription_plans enable row level security;
grant select on public.account_subscription_plans to authenticated;
create policy "read own account plan" on public.account_subscription_plans for select to authenticated
 using(private.is_platform_owner() or private.is_org_member(organization_id));

create table public.sales_solo_catalog (
 id boolean primary key default true check(id), stripe_product_id text, stripe_price_id text,
 stripe_account_id text, livemode boolean, active boolean not null default false
);
insert into public.sales_solo_catalog(id) values(true);
alter table public.sales_solo_catalog enable row level security;
grant select on public.sales_solo_catalog to authenticated;
create policy "platform reads Solo catalog" on public.sales_solo_catalog for select to authenticated using(private.is_platform_owner());

create table public.sales_solo_periods (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.account_subscription_plans(organization_id),
 starts timestamptz not null, ends timestamptz not null check(ends>starts), invoice_id text not null unique,
 grant_id uuid references public.ai_credit_grants(id), unique(organization_id,starts)
);
alter table public.sales_solo_periods enable row level security;
grant select on public.sales_solo_periods to authenticated;
create policy "read own Solo periods" on public.sales_solo_periods for select to authenticated using(private.is_org_member(organization_id) or private.is_platform_owner());
create table public.sales_solo_stripe_events(id text primary key, created_at timestamptz not null default now());
alter table public.sales_solo_stripe_events enable row level security;
alter table public.ai_usage_requests add column solo_period_id uuid references public.sales_solo_periods(id);
create index ai_usage_solo_period on public.ai_usage_requests(solo_period_id);

create function private.account_paid(target_org uuid) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce((select access_override_until>now() or (status in ('active','past_due') and paid_start<=now() and paid_until>now()) from public.account_subscription_plans where organization_id=target_org),false)
$$;
create function private.is_sales_solo(target_org uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.account_subscription_plans where organization_id=target_org and plan_key='sales_solo')
$$;
revoke all on function private.account_paid(uuid),private.is_sales_solo(uuid) from public,anon;
grant execute on function private.account_paid(uuid),private.is_sales_solo(uuid) to authenticated,service_role;

create function public.activate_sales_solo(actor uuid,company text,contact_name text) returns uuid
language plpgsql security invoker set search_path='' as $$
declare org uuid; template uuid;
begin
 perform pg_advisory_xact_lock(hashtextextended(actor::text,0));
 if not private.rv_email_verified(actor) then raise exception 'Verify your email first';end if;
 select organization_id into org from public.account_subscription_plans where owner_user_id=actor and plan_key='sales_solo';
 if found then return org;end if;
 if exists(select 1 from public.organization_memberships where user_id=actor and status in ('active','invited')) then raise exception 'You already belong to an account';end if;
 if length(trim(company)) not between 2 and 120 or length(trim(contact_name)) not between 2 and 120 then raise exception 'Enter a company and contact name';end if;
 select id into template from public.industry_templates where template_key='rv' and is_enabled;
 insert into public.organizations(name,slug,industry_template_id) values(trim(company),'solo-'||replace(gen_random_uuid()::text,'-',''),template) returning id into org;
 update public.profiles set full_name=trim(contact_name) where id=actor;
 insert into public.organization_memberships(organization_id,user_id,role,status) values(org,actor,'tenant_admin','active');
 insert into public.account_subscription_plans(organization_id,owner_user_id) values(org,actor);
 insert into public.ai_billing_settings(organization_id,included_units) values(org,0);
 insert into public.platform_workspace_contexts(user_id,active_organization_id) values(actor,org) on conflict(user_id) do update set active_organization_id=org;
 return org;
end $$;
revoke all on function public.activate_sales_solo(uuid,text,text) from public,anon,authenticated;
grant execute on function public.activate_sales_solo(uuid,text,text) to service_role;

-- A commercial ceiling applies even if a member's role changes.
create function private.guard_solo_members() returns trigger language plpgsql security invoker set search_path='' as $$
declare org uuid; owner_id uuid; seats integer;
begin
 if tg_op='DELETE' then org:=old.organization_id;else org:=new.organization_id;end if;
 perform pg_advisory_xact_lock(hashtextextended(org::text,0));
 select owner_user_id,seat_limit into owner_id,seats from public.account_subscription_plans where organization_id=org and plan_key='sales_solo';
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
revoke all on function private.guard_solo_members() from public,anon;
grant execute on function private.guard_solo_members() to authenticated,service_role;
create trigger solo_member_limit before insert or update or delete on public.organization_memberships for each row execute function private.guard_solo_members();
create trigger solo_invitation_limit before insert or update or delete on public.organization_invitations for each row execute function private.guard_solo_members();
create trigger solo_location_limit before insert or update or delete on public.organization_member_locations for each row execute function private.guard_solo_members();

create function private.solo_data_allowed(target_org uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.is_platform_owner() or not private.is_sales_solo(target_org) or
 (private.account_paid(target_org) and private.is_org_member(target_org))
$$;
revoke all on function private.solo_data_allowed(uuid) from public,anon;
grant execute on function private.solo_data_allowed(uuid) to authenticated,service_role;
-- All organization-scoped tables retain their existing policies. Restrictive
-- policies add the commercial ceiling; they never grant a new permission.
do $$declare t record; blocked boolean;begin
 for t in select distinct table_name from information_schema.columns where table_schema='public' and column_name='organization_id'
   and table_name not in ('account_subscription_plans','sales_solo_periods','organization_memberships') loop
  blocked:=t.table_name like 'operations_%' or t.table_name like 'executive_%' or t.table_name like 'growth_%' or t.table_name like 'coach_%' or t.table_name like 'training_%';
  execute format('create policy "Sales Solo commercial ceiling" on public.%I as restrictive for all to authenticated using (%s) with check (%s)',t.table_name,
    case when blocked then 'private.is_platform_owner() or not private.is_sales_solo(organization_id)' else 'private.solo_data_allowed(organization_id)' end,
    case when blocked then 'private.is_platform_owner() or not private.is_sales_solo(organization_id)' else 'private.solo_data_allowed(organization_id)' end);
 end loop;
end $$;
-- Trusted service actions must not write Operations/Executive records for Solo.
create function private.guard_solo_workspace_write() returns trigger language plpgsql security definer set search_path='' as $$
declare org uuid;begin
 if tg_op='DELETE' then org:=old.organization_id;else org:=new.organization_id;end if;
 if private.is_sales_solo(org) then raise exception 'This workspace is outside Sales Solo' using errcode='42501';end if;
 if tg_op='DELETE' then return old;else return new;end if;
end $$;
revoke all on function private.guard_solo_workspace_write() from public,anon,authenticated;
do $$declare t record;begin
 for t in select distinct table_name from information_schema.columns where table_schema='public' and column_name='organization_id' and (table_name like 'operations_%' or table_name like 'executive_%' or table_name like 'growth_%' or table_name like 'coach_%' or table_name like 'training_%') loop
  execute format('create trigger solo_workspace_write before insert or update or delete on public.%I for each row execute function private.guard_solo_workspace_write()',t.table_name);
 end loop;
end $$;

-- Role-permission RPCs use SECURITY DEFINER, so their writes also need a gate.
create function private.guard_solo_role_permissions() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if private.is_sales_solo(new.organization_id) and not private.is_platform_owner() then raise exception 'Sales Solo permissions are fixed' using errcode='42501';end if;
 return new;
end $$;
revoke all on function private.guard_solo_role_permissions() from public,anon,authenticated;
create trigger solo_fixed_permissions before insert or update on public.organization_role_permissions for each row execute function private.guard_solo_role_permissions();

-- Summary exposes provider-cost units, not sellable credit balances.
create function public.sales_solo_summary(target_org uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.account_subscription_plans;period public.sales_solo_periods;used bigint;held bigint;begin
 if not(private.is_org_member(target_org) or private.is_platform_owner()) then raise exception 'Access denied';end if;
 select * into p from public.account_subscription_plans where organization_id=target_org;
 if not found then return null;end if;
 select * into period from public.sales_solo_periods where organization_id=target_org and starts<=now() and ends>now() order by starts desc limit 1;
 select coalesce(sum(provider_cost_units) filter(where state='settled'),0),coalesce(sum(greatest(reserved_units,provider_cost_units)) filter(where state in ('reserved','uncertain')),0) into used,held from public.ai_usage_requests where solo_period_id=period.id;
 return to_jsonb(p)||jsonb_build_object('used_units',used,'reserved_units',held,'remaining_units',greatest(0,p.ai_limit_units-used-held),'user_count',(select count(*) from public.organization_memberships where organization_id=target_org and status in ('active','invited')));
end $$;
revoke all on function public.sales_solo_summary(uuid) from public,anon;
grant execute on function public.sales_solo_summary(uuid) to authenticated,service_role;

-- One immutable reservation per provider call; the existing settlement routine
-- reconciles the same grant allocations and retains uncertain holds.
alter function public.reserve_ai_usage(uuid,uuid,uuid,text,text,bigint,bigint,text,uuid) rename to reserve_standard_ai_usage;
create function public.reserve_ai_usage(target_org uuid,target_user uuid,request_id uuid,feature text,target_model text,max_input bigint,max_output bigint,input_fingerprint text default null,target_location uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare p public.account_subscription_plans;period public.sales_solo_periods;rate public.ai_model_rates;g public.ai_credit_grants;need bigint;total bigint;begin
 perform pg_advisory_xact_lock(hashtextextended(target_org::text,0));
 select * into p from public.account_subscription_plans where organization_id=target_org and plan_key='sales_solo';
 if not found then return public.reserve_standard_ai_usage(target_org,target_user,request_id,feature,target_model,max_input,max_output,input_fingerprint,target_location);end if;
 if not private.account_paid(target_org) then raise exception 'Sales Solo requires a paid subscription';end if;
 if not exists(select 1 from public.organization_memberships where organization_id=target_org and user_id=target_user and status='active') and not exists(select 1 from public.profiles where id=target_user and is_platform_owner) then raise exception 'Membership required';end if;
 if max_input<0 or max_output<0 or max_input>4000000 or max_output>32768 or length(feature)>120 then raise exception 'Invalid request bounds';end if;
 if exists(select 1 from public.ai_usage_requests where id=request_id) then raise exception 'Duplicate AI request; inspect existing outcome before retrying';end if;
 if exists(select 1 from public.ai_billing_settings where organization_id=target_org and frozen) then raise exception 'AI paused';end if;
 select * into period from public.sales_solo_periods where organization_id=target_org and starts<=now() and ends>now() order by starts desc limit 1;
 if not found then raise exception 'Sales Solo allowance awaits paid renewal';end if;
 select * into rate from public.ai_model_rates where model=target_model and active;
 if not found then raise exception 'AI model pricing requires administrator configuration';end if;
 need:=ceil((max_input::numeric*rate.input_units_per_million+max_output::numeric*rate.output_units_per_million)/1000000);
 select coalesce(sum(case when state='settled' then provider_cost_units when state in ('reserved','uncertain') then greatest(reserved_units,provider_cost_units) else 0 end),0) into total from public.ai_usage_requests where solo_period_id=period.id;
 select * into g from public.ai_credit_grants where id=period.grant_id for update;
 if need<=0 or total+need>p.ai_limit_units or g.total_units-g.used_units-g.reserved_units-g.revoked_units<need then raise exception 'Sales Solo monthly AI cost limit reached; renews with your next paid billing period';end if;
 insert into public.ai_usage_requests(id,organization_id,user_id,operation,model,rate_id,reserved_units,fingerprint,solo_period_id) values(request_id,target_org,target_user,feature,target_model,rate.id,need,input_fingerprint,period.id);
 update public.ai_credit_grants set reserved_units=reserved_units+need where id=g.id;
 insert into public.ai_credit_allocations(request_id,grant_id,organization_id,units) values(request_id,g.id,target_org,need);
 return jsonb_build_object('id',request_id,'reserved_units',need,'rate',to_jsonb(rate));
end $$;
revoke all on function public.reserve_ai_usage(uuid,uuid,uuid,text,text,bigint,bigint,text,uuid) from public,anon,authenticated;
grant execute on function public.reserve_ai_usage(uuid,uuid,uuid,text,text,bigint,bigint,text,uuid) to service_role;

create function public.override_sales_solo(target_org uuid,new_seat_limit integer,new_ai_limit bigint,override_until timestamptz,reason text) returns void language plpgsql security definer set search_path='' as $$
declare period public.sales_solo_periods;used bigint;begin
 if not private.is_platform_owner() or length(trim(reason))<8 then raise exception 'Platform Admin and a clear reason are required' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(target_org::text,0));
 if new_seat_limit not between 1 and 10000 or new_ai_limit not between 0 and 100000000000 then raise exception 'Invalid limits';end if;
 if new_seat_limit<(select count(*) from public.organization_memberships where organization_id=target_org and status in ('active','invited')) then raise exception 'Existing users exceed the proposed limit';end if;
 select * into period from public.sales_solo_periods where organization_id=target_org and starts<=now() and ends>now() order by starts desc limit 1;
 select coalesce(sum(case when state='settled' then provider_cost_units when state in ('reserved','uncertain') then greatest(reserved_units,provider_cost_units) else 0 end),0) into used from public.ai_usage_requests where solo_period_id=period.id;
 if new_ai_limit<used then raise exception 'Limit cannot be lower than spent and reserved cost';end if;
 update public.account_subscription_plans set seat_limit=new_seat_limit,ai_limit_units=new_ai_limit,access_override_until=override_until where organization_id=target_org and plan_key='sales_solo';
 if not found then raise exception 'Sales Solo account not found';end if;
 update public.ai_credit_grants set total_units=new_ai_limit where id=period.grant_id;
 insert into public.ai_billing_audit(organization_id,actor_id,action,reason,details) values(target_org,auth.uid(),'sales_solo_override',trim(reason),jsonb_build_object('seat_limit',new_seat_limit,'ai_limit_units',new_ai_limit,'access_until',override_until));
end $$;
revoke all on function public.override_sales_solo(uuid,integer,bigint,timestamptz,text) from public,anon;
grant execute on function public.override_sales_solo(uuid,integer,bigint,timestamptz,text) to authenticated;

grant all on public.account_subscription_plans,public.sales_solo_catalog,public.sales_solo_periods,public.sales_solo_stripe_events to service_role;
