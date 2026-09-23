alter table public.text_template_categories
  drop constraint if exists text_template_categories_content_group_check;

alter table public.text_template_categories
  add constraint text_template_categories_content_group_check
  check (content_group in ('message_template', 'sales_script', 'objection_response'));

alter table public.sales_content_items
  add column if not exists objection text not null default '';

alter table public.sales_content_items
  drop constraint if exists sales_content_items_objection_length;

alter table public.sales_content_items
  add constraint sales_content_items_objection_length
  check (char_length(objection) <= 4000);

insert into public.text_template_categories (organization_id, content_group, name, position)
select organization.id, 'objection_response', category.name, category.position
from public.organizations organization
cross join (values
  ('Price', 10),
  ('Need to Think', 20),
  ('Spouse / Partner', 30),
  ('Shopping Around', 40),
  ('Competitor', 50),
  ('Financing', 60),
  ('Payment', 70),
  ('Trade-In', 80),
  ('Timing', 90),
  ('Inventory / Availability', 100),
  ('Features', 110),
  ('Brand', 120),
  ('Warranty', 130),
  ('Service', 140),
  ('Delivery', 150),
  ('Trust', 160),
  ('Not Ready', 170),
  ('Follow-Up', 180)
) as category(name, position)
on conflict do nothing;
