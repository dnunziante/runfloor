alter table public.operations_procedures add column if not exists sort_order integer not null default 0;
with ranked as (select id, row_number() over (partition by organization_id, category_id order by updated_at desc) - 1 as position from public.operations_procedures)
update public.operations_procedures procedure set sort_order = ranked.position from ranked where ranked.id = procedure.id;
create index if not exists operations_procedures_category_order_idx on public.operations_procedures (organization_id, category_id, sort_order);
