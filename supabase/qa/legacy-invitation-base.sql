-- QA ONLY: reconstructed dependency absent from committed historical migrations.
-- Never apply this fixture to an existing or production database.
create table public.organization_invitations(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),email text not null,role public.organization_role not null default 'salesperson',status text not null default 'pending',invited_by uuid references public.profiles(id),accepted_by uuid references public.profiles(id),accepted_at timestamptz,expires_at timestamptz not null default now()+interval '7 days',created_at timestamptz not null default now(),updated_at timestamptz not null default now());
alter table public.organization_invitations enable row level security;
revoke all on public.organization_invitations from anon,authenticated;
