create table public.sales_solo_signup_intents (
 id uuid primary key default gen_random_uuid(),
 owner_user_id uuid not null references public.profiles(id),
 workspace_name text not null check(length(trim(workspace_name)) between 2 and 120),
 workspace_identity text not null check(length(workspace_identity) between 2 and 120),
 contact_name text not null check(length(trim(contact_name)) between 2 and 120),
 phone text,
 stripe_customer_id text not null,
 stripe_account_id text not null,
 livemode boolean not null,
 checkout_session_id text unique,
 status text not null default 'pending' check(status in ('pending','provisioned','expired')),
 organization_id uuid unique references public.organizations(id),
 created_at timestamptz not null default now(),
 completed_at timestamptz
);
create unique index sales_solo_signup_one_pending_per_owner on public.sales_solo_signup_intents(owner_user_id) where status='pending';
create unique index sales_solo_signup_unique_pending_name on public.sales_solo_signup_intents(workspace_identity) where status='pending';
alter table public.sales_solo_signup_intents enable row level security;
revoke all on public.sales_solo_signup_intents from public,anon,authenticated;
grant all on public.sales_solo_signup_intents to service_role;

create function public.provision_sales_solo_signup(
 intent_key uuid,customer_key text,account_key text,live boolean,subscription_key text,price_key text,
 event_key text,event_created bigint,billing_status text,starts timestamptz,ends timestamptz,invoice_id text
) returns uuid language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare intent public.sales_solo_signup_intents;org uuid;template uuid;
begin
 select * into intent from public.sales_solo_signup_intents where id=intent_key for update;
 if not found then raise exception 'Unknown Solo signup';end if;
 if intent.status='provisioned' then return intent.organization_id;end if;
 if intent.status<>'pending' or intent.stripe_customer_id is distinct from customer_key or intent.stripe_account_id is distinct from account_key or intent.livemode is distinct from live then raise exception 'Solo signup billing ownership mismatch';end if;
 if not private.rv_email_verified(intent.owner_user_id) then raise exception 'Verify your email first';end if;
 if billing_status<>'active' or starts is null or ends is null or ends<=starts or length(trim(invoice_id))<5 then raise exception 'Initial Solo payment is not active';end if;
 if not exists(select 1 from public.sales_solo_catalog where id and active and stripe_price_id=price_key and stripe_account_id=account_key and livemode=live) then raise exception 'Unapproved Sales Solo price';end if;
 perform pg_advisory_xact_lock(hashtextextended(intent.owner_user_id::text,0));
 if exists(select 1 from public.organization_memberships where user_id=intent.owner_user_id and status in ('active','invited')) then raise exception 'This account already belongs to a workspace';end if;
 if exists(select 1 from public.organizations where regexp_replace(lower(name),'[^a-z0-9]','','g')=intent.workspace_identity and id is distinct from intent.organization_id) then raise exception 'Workspace name is already in use';end if;
 select id into template from public.industry_templates where template_key='rv' and is_enabled;
 if template is null then raise exception 'Sales workspace template is unavailable';end if;
 insert into public.organizations(name,slug,industry_template_id)
 values(intent.workspace_name,'solo-'||replace(gen_random_uuid()::text,'-',''),template) returning id into org;
 update public.profiles set full_name=intent.contact_name,phone=intent.phone where id=intent.owner_user_id;
 insert into public.organization_memberships(organization_id,user_id,role,status) values(org,intent.owner_user_id,'tenant_admin','active');
 insert into public.account_subscription_plans(organization_id,owner_user_id,plan_key,status,stripe_customer_id,stripe_subscription_id,stripe_account_id,livemode,event_created)
 values(org,intent.owner_user_id,'sales_solo','pending',customer_key,subscription_key,account_key,live,event_created);
 insert into public.ai_billing_settings(organization_id,included_units) values(org,0);
 insert into public.platform_workspace_contexts(user_id,active_organization_id) values(intent.owner_user_id,org)
 on conflict(user_id) do update set active_organization_id=excluded.active_organization_id;
 perform public.apply_sales_solo_event(event_key,'invoice.paid',event_created,org,customer_key,account_key,live,subscription_key,price_key,billing_status,starts,ends,null,invoice_id,'sales_solo');
 update public.sales_solo_signup_intents set status='provisioned',organization_id=org,completed_at=now() where id=intent.id;
 return org;
end $$;
revoke all on function public.provision_sales_solo_signup(uuid,text,text,boolean,text,text,text,bigint,text,timestamptz,timestamptz,text) from public,anon,authenticated;
grant execute on function public.provision_sales_solo_signup(uuid,text,text,boolean,text,text,text,bigint,text,timestamptz,timestamptz,text) to service_role;
