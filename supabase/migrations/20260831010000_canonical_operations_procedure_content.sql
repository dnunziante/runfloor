-- Canonical, tenant-owned structured content for every Operations procedure.
-- Existing title/summary/step rows remain valid and are used as the fallback.
alter table public.operations_procedures
  add column if not exists content jsonb not null default '{}'::jsonb,
  add column if not exists source_type text not null default 'manual'
    check (source_type in ('manual', 'ai_generated', 'imported', 'assistant_generated'));

create index if not exists operations_procedures_org_source_idx
  on public.operations_procedures (organization_id, source_type);
