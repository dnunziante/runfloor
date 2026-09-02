create table public.platform_procedure_templates (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 2 and 160),
  category text not null,
  owner text not null,
  summary text not null,
  steps jsonb not null default '[]'::jsonb,
  content jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  is_published boolean not null default true,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.operations_procedures add column if not exists platform_template_id uuid references public.platform_procedure_templates(id) on delete set null;
alter table public.operations_procedures add column if not exists platform_template_version integer;
alter table public.operations_procedures enable row level security;
alter table public.platform_procedure_templates enable row level security;
revoke all on public.platform_procedure_templates from anon;
grant select on public.platform_procedure_templates to authenticated;
grant insert, update, delete on public.platform_procedure_templates to authenticated;
create policy "members read published platform procedure templates" on public.platform_procedure_templates for select to authenticated using (is_published or private.is_platform_owner());
create policy "platform owners manage procedure templates" on public.platform_procedure_templates for all to authenticated using (private.is_platform_owner()) with check (private.is_platform_owner());
