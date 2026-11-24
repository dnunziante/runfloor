-- Separate workspace-level Opal Help budget. This migration must be reviewed and
-- applied to the intended Supabase project before the application code is deployed.
-- Units match ai_model_rates: 100,000,000 units represent $1.00 of provider cost.
create table public.opal_help_budget_periods (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  period_kind text not null check (period_kind in ('trial', 'subscription')),
  period_start timestamptz not null,
  period_end timestamptz not null,
  limit_units bigint not null default 200000000 check (limit_units = 200000000),
  created_at timestamptz not null default now(),
  unique (organization_id, period_kind, period_start),
  unique (id, organization_id),
  check (period_end > period_start)
);

create index opal_help_period_org_end
  on public.opal_help_budget_periods (organization_id, period_end desc);

create table public.opal_help_usage_requests (
  id uuid primary key,
  organization_id uuid not null references public.organizations(id),
  period_id uuid not null,
  user_id uuid not null references auth.users(id),
  model text not null,
  rate_id uuid not null references public.ai_model_rates(id),
  state text not null default 'reserved'
    check (state in ('reserved', 'uncertain', 'settled', 'released')),
  reserved_units bigint not null check (reserved_units >= 0),
  charged_units bigint not null default 0 check (charged_units >= 0),
  fingerprint text not null,
  usage jsonb,
  provider_request_id text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (id, organization_id),
  foreign key (period_id, organization_id)
    references public.opal_help_budget_periods(id, organization_id)
);

create index opal_help_usage_period_state
  on public.opal_help_usage_requests (period_id, state, created_at desc);

alter table public.opal_help_budget_periods enable row level security;
alter table public.opal_help_usage_requests enable row level security;
revoke all on public.opal_help_budget_periods from public, anon, authenticated;
revoke all on public.opal_help_usage_requests from public, anon, authenticated;
grant all on public.opal_help_budget_periods to service_role;
grant all on public.opal_help_usage_requests to service_role;

create function private.opal_help_current_period(target_org uuid)
returns table(period_kind text, period_start timestamptz, period_end timestamptz)
language sql stable security definer set search_path = '' as $$
  select candidate.period_kind, candidate.period_start, candidate.period_end
  from (
    select
      case when b.status = 'trialing' then 'trial' else 'subscription' end as period_kind,
      case when b.status = 'trialing' then b.trial_started_at else b.period_start end as period_start,
      case when b.status = 'trialing' then b.trial_ends_at else b.period_end end as period_end,
      1 as priority
    from public.rv_location_billing b
    where b.organization_id = target_org
      and ((b.status = 'trialing' and b.trial_ends_at > now())
        or (b.status in ('active', 'past_due') and b.period_start <= now() and b.period_end > now()))
    union all
    select
      case when c.subscription_status = 'trialing' then 'trial' else 'subscription' end,
      c.period_start,
      c.period_end,
      2
    from public.runfloor_billing_customers c
    where c.organization_id = target_org
      and c.subscription_status in ('trialing', 'active', 'past_due')
      and c.period_start <= now() and c.period_end > now()
    union all
    select
      case when p.status = 'trialing' then 'trial' else 'subscription' end,
      p.paid_start,
      p.paid_until,
      3
    from public.account_subscription_plans p
    where p.organization_id = target_org
      and p.plan_key in ('sales_solo', 'complete')
      and p.status in ('trialing', 'active', 'past_due')
      and p.paid_start <= now() and p.paid_until > now()
  ) candidate
  where candidate.period_start is not null and candidate.period_end is not null
  order by candidate.priority, candidate.period_start desc
  limit 1
$$;
revoke all on function private.opal_help_current_period(uuid) from public, anon, authenticated;
grant usage on schema private to service_role;
grant execute on function private.opal_help_current_period(uuid) to service_role;

create function public.get_opal_help_usage(target_org uuid, target_user uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
#variable_conflict use_variable
declare p record; budget public.opal_help_budget_periods; used bigint; reserved bigint;
begin
  if not exists (
    select 1 from public.organization_memberships m
    where m.organization_id = target_org and m.user_id = target_user and m.status = 'active'
  ) and not exists (
    select 1 from public.profiles u where u.id = target_user and u.is_platform_owner
  ) then raise exception 'Workspace membership required'; end if;

  select * into p from private.opal_help_current_period(target_org);
  if not found then
    return jsonb_build_object(
      'eligible', false, 'period_kind', null, 'limit_units', 200000000,
      'used_units', 0, 'reserved_units', 0, 'remaining_units', 0, 'reset_at', null
    );
  end if;

  insert into public.opal_help_budget_periods(organization_id, period_kind, period_start, period_end)
  values (target_org, p.period_kind, p.period_start, p.period_end)
  on conflict (organization_id, period_kind, period_start) do nothing;
  select * into budget from public.opal_help_budget_periods b
  where b.organization_id = target_org and b.period_kind = p.period_kind and b.period_start = p.period_start;
  select coalesce(sum(r.charged_units), 0),
         coalesce(sum(r.reserved_units) filter (where r.state in ('reserved', 'uncertain')), 0)
    into used, reserved
    from public.opal_help_usage_requests r where r.period_id = budget.id;
  return jsonb_build_object(
    'eligible', true, 'period_kind', budget.period_kind,
    'limit_units', budget.limit_units, 'used_units', used,
    'reserved_units', reserved,
    'remaining_units', greatest(0, budget.limit_units - used - reserved),
    'reset_at', budget.period_end
  );
end $$;
revoke all on function public.get_opal_help_usage(uuid, uuid) from public, anon, authenticated;
grant execute on function public.get_opal_help_usage(uuid, uuid) to service_role;

create function public.reserve_opal_help_usage(
  target_org uuid, target_user uuid, request_id uuid, target_model text,
  max_input bigint, max_output bigint, input_fingerprint text
) returns jsonb language plpgsql security definer set search_path = '' as $$
#variable_conflict use_variable
declare p record; budget public.opal_help_budget_periods; rate public.ai_model_rates;
  existing public.opal_help_usage_requests; need bigint; used bigint; reserved bigint;
begin
  if max_input < 0 or max_input > 200000 or max_output < 0 or max_output > 8192
    or length(target_model) > 120 or length(input_fingerprint) <> 64 then
    raise exception 'Invalid Opal request bounds';
  end if;
  if not exists (
    select 1 from public.organization_memberships m
    where m.organization_id = target_org and m.user_id = target_user and m.status = 'active'
  ) and not exists (
    select 1 from public.profiles u where u.id = target_user and u.is_platform_owner
  ) then raise exception 'Workspace membership required'; end if;

  perform pg_advisory_xact_lock(hashtextextended(target_org::text, 0));
  select * into existing from public.opal_help_usage_requests r where r.id = request_id;
  if found then
    if existing.organization_id <> target_org or existing.user_id <> target_user
      or existing.fingerprint <> input_fingerprint then
      raise exception 'Opal request id was already used for a different request';
    end if;
    return jsonb_build_object('status', 'duplicate');
  end if;

  select * into p from private.opal_help_current_period(target_org);
  if not found then raise exception 'A current trial or paid subscription is required for Opal AI'; end if;
  insert into public.opal_help_budget_periods(organization_id, period_kind, period_start, period_end)
  values (target_org, p.period_kind, p.period_start, p.period_end)
  on conflict (organization_id, period_kind, period_start) do nothing;
  select * into budget from public.opal_help_budget_periods b
  where b.organization_id = target_org and b.period_kind = p.period_kind and b.period_start = p.period_start
  for update;
  select * into rate from public.ai_model_rates r where r.model = target_model and r.active;
  if not found then raise exception 'Opal model pricing is not configured'; end if;
  need := ceil((max_input::numeric * rate.input_units_per_million + max_output::numeric * rate.output_units_per_million) / 1000000);
  select coalesce(sum(r.charged_units), 0),
         coalesce(sum(r.reserved_units) filter (where r.state in ('reserved', 'uncertain')), 0)
    into used, reserved
    from public.opal_help_usage_requests r where r.period_id = budget.id;
  if need <= 0 or used + reserved + need > budget.limit_units then
    return jsonb_build_object('status', 'exhausted');
  end if;
  insert into public.opal_help_usage_requests(
    id, organization_id, period_id, user_id, model, rate_id, reserved_units, fingerprint
  ) values (request_id, target_org, budget.id, target_user, target_model, rate.id, need, input_fingerprint);
  return jsonb_build_object('status', 'reserved', 'reserved_units', need);
end $$;
revoke all on function public.reserve_opal_help_usage(uuid, uuid, uuid, text, bigint, bigint, text) from public, anon, authenticated;
grant execute on function public.reserve_opal_help_usage(uuid, uuid, uuid, text, bigint, bigint, text) to service_role;

create function public.finish_opal_help_usage(
  request_id uuid, outcome text, actual_input bigint default 0,
  cached_input bigint default 0, actual_output bigint default 0,
  reasoning_output bigint default 0, provider_id text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
#variable_conflict use_variable
declare r public.opal_help_usage_requests; rate public.ai_model_rates; cost bigint;
begin
  select * into r from public.opal_help_usage_requests where id = request_id;
  if not found then raise exception 'Unknown Opal reservation'; end if;
  perform pg_advisory_xact_lock(hashtextextended(r.organization_id::text, 0));
  select * into r from public.opal_help_usage_requests where id = request_id for update;
  if r.state in ('settled', 'released') then
    return jsonb_build_object('state', r.state, 'charged_units', r.charged_units);
  end if;
  if outcome = 'uncertain' then
    update public.opal_help_usage_requests
      set state = 'uncertain', provider_request_id = provider_id
      where id = request_id;
    return jsonb_build_object('state', 'uncertain');
  end if;
  if outcome not in ('settled', 'released') or least(actual_input, cached_input, actual_output, reasoning_output) < 0
    or cached_input > actual_input or reasoning_output > actual_output then
    raise exception 'Invalid Opal usage';
  end if;
  if outcome = 'released' then
    update public.opal_help_usage_requests set state = 'released', reserved_units = 0,
      charged_units = 0, provider_request_id = provider_id, completed_at = now()
      where id = request_id;
    return jsonb_build_object('state', 'released', 'charged_units', 0);
  end if;

  select * into rate from public.ai_model_rates where id = r.rate_id;
  cost := ceil(((actual_input - cached_input)::numeric * rate.input_units_per_million
    + cached_input::numeric * rate.cached_units_per_million
    + actual_output::numeric * rate.output_units_per_million) / 1000000);
  if cost > r.reserved_units then
    -- Keep the hold at the verified cost and block new requests if a provider
    -- response exceeds the conservative pre-request reservation.
    update public.opal_help_usage_requests set state = 'uncertain',
      reserved_units = cost, charged_units = 0, usage = jsonb_build_object(
        'input', actual_input, 'cached', cached_input, 'output', actual_output,
        'reasoning', reasoning_output
      ), provider_request_id = provider_id
      where id = request_id;
    return jsonb_build_object('state', 'uncertain', 'requires_review', true);
  end if;
  update public.opal_help_usage_requests set state = 'settled', reserved_units = 0,
    charged_units = cost, usage = jsonb_build_object(
      'input', actual_input, 'cached', cached_input, 'output', actual_output,
      'reasoning', reasoning_output
    ), provider_request_id = provider_id, completed_at = now()
    where id = request_id;
  return jsonb_build_object('state', 'settled', 'charged_units', cost);
end $$;
revoke all on function public.finish_opal_help_usage(uuid, text, bigint, bigint, bigint, bigint, text) from public, anon, authenticated;
grant execute on function public.finish_opal_help_usage(uuid, text, bigint, bigint, bigint, bigint, text) to service_role;
