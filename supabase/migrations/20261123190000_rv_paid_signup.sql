-- Paid RunFloor onboarding: a workspace is created only after Stripe confirms the first paid invoice.
create table public.rv_paid_signup_intents (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles(id),
  dealership_name text not null check (length(trim(dealership_name)) between 2 and 120),
  dealership_identity text not null,
  contact_name text not null check (length(trim(contact_name)) between 2 and 120),
  phone text,
  stripe_customer_id text not null,
  checkout_session_id text unique,
  status text not null default 'pending' check (status in ('pending','provisioned','expired')),
  organization_id uuid references public.organizations(id),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create unique index rv_paid_signup_one_pending_per_owner
  on public.rv_paid_signup_intents(owner_user_id) where status='pending';
create unique index rv_paid_signup_unique_pending_name
  on public.rv_paid_signup_intents(dealership_identity) where status='pending';
alter table public.rv_paid_signup_intents enable row level security;
revoke all on public.rv_paid_signup_intents from public, anon, authenticated;
grant select, insert, update on public.rv_paid_signup_intents to service_role;

-- Called only by the verified Stripe webhook after retrieving and validating the first paid invoice.
create function public.provision_rv_paid_signup(
  intent_key uuid,
  event_key text,
  event_created bigint,
  customer_key text,
  subscription_key text,
  price_key text,
  period_starts timestamptz,
  period_ends timestamptz
) returns uuid
language plpgsql security definer set search_path='' as $$
declare
  intent public.rv_paid_signup_intents;
  org uuid;
  loc uuid;
  template uuid;
begin
  select * into intent from public.rv_paid_signup_intents where id=intent_key for update;
  if not found or intent.stripe_customer_id<>customer_key then raise exception 'Unknown paid signup'; end if;
  if intent.status='provisioned' then return intent.organization_id; end if;
  if intent.status<>'pending' then raise exception 'Paid signup is not pending'; end if;
  if not private.rv_email_verified(intent.owner_user_id) then raise exception 'Verified account required'; end if;
  if period_starts is null or period_ends is null or period_ends<=period_starts or period_ends<=now() then raise exception 'Invalid paid billing period'; end if;
  if not exists(select 1 from public.runfloor_billing_catalog where id=true and active and stripe_price_id=price_key) then raise exception 'Price is not approved'; end if;
  if exists(select 1 from public.organization_memberships where user_id=intent.owner_user_id and status in ('active','invited')) then raise exception 'Account already belongs to a workspace'; end if;
  if length(intent.dealership_identity)<2 then raise exception 'Enter a valid dealership name'; end if;
  if exists(select 1 from public.rv_trial_claims where dealership_identity=intent.dealership_identity)
     or exists(select 1 from public.organizations where regexp_replace(lower(name),'[^a-z0-9]','','g')=intent.dealership_identity) then
    raise exception 'This dealership already exists. Ask its administrator for an invitation.';
  end if;
  select id into template from public.industry_templates where template_key='rv' and is_enabled and is_available_during_signup;
  if template is null then raise exception 'RV signup is not available'; end if;

  insert into public.organizations(name,slug,industry_template_id)
    values(trim(intent.dealership_name),'rv-'||replace(gen_random_uuid()::text,'-',''),template) returning id into org;
  insert into public.rv_trial_claims(organization_id,owner_user_id,dealership_identity)
    values(org,intent.owner_user_id,intent.dealership_identity);
  update public.profiles set full_name=trim(intent.contact_name) where id=intent.owner_user_id;
  insert into public.locations(organization_id,name) values(org,trim(intent.dealership_name)) returning id into loc;
  insert into public.organization_memberships(organization_id,user_id,role,status,location_id)
    values(org,intent.owner_user_id,'tenant_admin','active',loc);
  insert into public.organization_member_locations(organization_id,user_id,location_id)
    values(org,intent.owner_user_id,loc);
  insert into public.platform_workspace_contexts(user_id,active_organization_id)
    values(intent.owner_user_id,org) on conflict(user_id) do update set active_organization_id=excluded.active_organization_id;
  insert into public.rv_location_billing(location_id,organization_id,stripe_customer_id,stripe_subscription_id,stripe_price_id,status)
    values(loc,org,customer_key,subscription_key,price_key,'active');
  insert into public.ai_billing_settings(organization_id,included_units) values(org,0);

  perform public.apply_rv_stripe_event(event_key,'invoice.paid',event_created,customer_key,subscription_key,price_key,'active',period_starts,period_ends,null,true);
  update public.rv_paid_signup_intents
    set status='provisioned',organization_id=org,completed_at=now()
    where id=intent_key;
  return org;
end $$;
revoke all on function public.provision_rv_paid_signup(uuid,text,bigint,text,text,text,timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.provision_rv_paid_signup(uuid,text,bigint,text,text,text,timestamptz,timestamptz) to service_role;
