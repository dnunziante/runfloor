alter table public.sales_results add column if not exists is_demo boolean not null default false;
create index if not exists sales_results_demo_idx on public.sales_results (organization_id, is_demo, period_start);

create or replace function private.reset_bgc_demo_performance()
returns void language plpgsql security definer set search_path = public, private as $$
declare demo_org uuid := '10000000-0000-0000-0000-000000000001';
begin
  if not private.has_org_role(demo_org, array['tenant_admin']::public.organization_role[]) and not private.is_platform_owner() then raise exception 'Not authorized'; end if;
  delete from public.sales_results where organization_id = demo_org and is_demo;
  insert into public.sales_results (organization_id,location_id,period_start,revenue_target,revenue_actual,units_target,units_actual,leads,appointments,notes,status,is_demo)
  select demo_org, l.id, m.period, 180000 + (row_number() over (order by l.name)*9000), round((180000 + (row_number() over (order by l.name)*9000)) * (0.90 + ((extract(month from m.period)::int + row_number() over (order by l.name)) % 18)::numeric / 100),2), 16 + ((row_number() over (order by l.name)-1)%12), greatest(10, round((16 + ((row_number() over (order by l.name)-1)%12)) * (0.90 + ((extract(month from m.period)::int + row_number() over (order by l.name)) % 18)::numeric / 100))::int), 80 + ((row_number() over (order by l.name)*7 + extract(month from m.period)::int*5)%95), 34 + ((row_number() over (order by l.name)*3 + extract(month from m.period)::int*4)%45), 'BGC Demo performance seed', case when m.period='2026-08-01' and row_number() over (order by l.name)%5=0 then 'draft' else 'approved' end, true
  from public.locations l cross join generate_series(date '2026-01-01', date '2026-08-01', interval '1 month') m(period)
  where l.organization_id=demo_org;
end $$;
revoke all on function private.reset_bgc_demo_performance() from public;
grant execute on function private.reset_bgc_demo_performance() to authenticated;
