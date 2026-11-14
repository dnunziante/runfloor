import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
export async function creditDatabase() {
  const db = new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema private;
create table auth.users(id uuid primary key);create type public.organization_role as enum('tenant_admin','manager','salesperson');
create table public.organizations(id uuid primary key);create table public.locations(id uuid primary key default gen_random_uuid(),organization_id uuid,is_active boolean default true);create table public.profiles(id uuid primary key,is_platform_owner boolean default false);
create table public.organization_memberships(organization_id uuid,user_id uuid,role public.organization_role,status text);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create function private.is_platform_owner() returns boolean language sql stable security definer as $$select coalesce((select is_platform_owner from public.profiles where id=auth.uid()),false)$$;
create function private.is_org_member(org uuid) returns boolean language sql stable security definer as $$select exists(select 1 from public.organization_memberships where organization_id=org and user_id=auth.uid() and status='active')$$;
create function private.has_org_role(org uuid,roles public.organization_role[]) returns boolean language sql stable security definer as $$select private.is_platform_owner() or exists(select 1 from public.organization_memberships where organization_id=org and user_id=auth.uid() and role=any(roles) and status='active')$$;
grant usage on schema auth,private to authenticated,service_role;grant execute on function auth.uid(),private.is_platform_owner(),private.is_org_member(uuid),private.has_org_role(uuid,public.organization_role[]) to authenticated,service_role;`);
  await db.exec(
    readFileSync(
      "supabase/migrations/20261114190924_ai_credit_billing.sql",
      "utf8",
    ),
  );
  await db.exec(
    readFileSync(
      "supabase/migrations/20261114202014_ai_billing_service_permissions.sql",
      "utf8",
    ),
  );
  await db.exec(
    readFileSync(
      "supabase/migrations/20261114203211_ai_checkout_recovery.sql",
      "utf8",
    ),
  );
  await db.exec(
    readFileSync(
      "supabase/migrations/20261114203546_ai_usage_overage_reconciliation.sql",
      "utf8",
    ),
  );
  await db.exec(
    readFileSync(
      "supabase/migrations/20261114204438_ai_payment_reversal_ordering.sql",
      "utf8",
    ),
  );
  return db;
}
