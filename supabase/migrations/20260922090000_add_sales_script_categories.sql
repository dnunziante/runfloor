alter table public.text_template_categories
  add column if not exists content_group text not null default 'message_template'
  check (content_group in ('message_template', 'sales_script'));

drop index if exists public.text_template_categories_org_name_idx;

create unique index if not exists text_template_categories_org_group_name_idx
  on public.text_template_categories (organization_id, content_group, name);

create index if not exists text_template_categories_org_group_position_idx
  on public.text_template_categories (organization_id, content_group, archived, position);

insert into public.text_template_categories (organization_id, content_group, name, position)
select organization.id, 'sales_script', category.name, category.position
from public.organizations organization
cross join (values
  ('New Lead', 10),
  ('Opening', 20),
  ('Discovery', 30),
  ('Needs Analysis', 40),
  ('Qualification', 50),
  ('Product Presentation', 60),
  ('Product Comparison', 70),
  ('Trade-In', 80),
  ('Pricing', 90),
  ('Financing', 100),
  ('Objection Handling', 110),
  ('Appointment Setting', 120),
  ('Demo / Test Drive', 130),
  ('Closing', 140),
  ('Follow-Up', 150),
  ('Lost Lead / Re-Engagement', 160),
  ('Referral', 170),
  ('Post-Sale', 180)
) as category(name, position)
on conflict do nothing;
