alter table public.sales_content_items
  add column if not exists category text not null default '',
  add column if not exists tags text[] not null default '{}';

alter table public.sales_content_items
  add constraint sales_content_items_category_length
  check (char_length(category) <= 120),
  add constraint sales_content_items_tags_limit
  check (cardinality(tags) <= 20);
