alter table public.coach_scenarios add column if not exists tags text[] not null default '{}';
alter table public.coach_scenarios drop constraint if exists coach_scenarios_tags_limit;
alter table public.coach_scenarios add constraint coach_scenarios_tags_limit check (cardinality(tags) <= 20);
create index if not exists coach_scenarios_org_updated_idx on public.coach_scenarios (organization_id, updated_at desc);
create index if not exists coach_scenarios_tags_gin_idx on public.coach_scenarios using gin (tags);

alter table public.text_template_categories drop constraint if exists text_template_categories_content_group_check;
alter table public.text_template_categories add constraint text_template_categories_content_group_check
  check (content_group in ('message_template','sales_script','objection_response','practice_scenario'));

insert into public.text_template_categories (organization_id, content_group, name, position)
select o.id, 'practice_scenario', seed.name, seed.position
from public.organizations o
cross join (values ('Discovery',10),('Objection Handling',20),('Negotiation',30),('Closing',40),('Follow-Up',50)) as seed(name,position)
on conflict (organization_id, content_group, name) do nothing;
