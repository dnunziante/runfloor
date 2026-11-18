create or replace function public.solo_shared_catalog(page_number integer default 1,search_text text default '',selected_ids uuid[] default '{}',comparison boolean default false,brand_filter text default '',category_filter text default '',year_filter integer default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare template uuid;result jsonb;begin
 perform public.solo_catalog_access();
 if page_number not between 1 and 1000 or length(search_text)>80 or coalesce(cardinality(selected_ids),0)>3 or length(brand_filter)>120 or length(category_filter)>120 then raise exception 'Invalid catalog query';end if;
 select id into template from public.industry_templates where template_key='rv' and is_enabled and is_public_demo_visible and not is_internal_only;
 if template is null then return jsonb_build_object('products','[]'::jsonb,'has_more',false);end if;
 with matches as (
  select p.id,p.family_name,p.name,p.model,p.model_year,p.model_variant,p.specifications,p.description,p.base_price_cents,p.range_text,p.seats_text,p.powertrain_text,p.product_type,p.manufacturer,p.product_category,p.sort_order,
   row_number() over(partition by p.product_type order by p.sort_order,p.name,p.id) as type_rank
  from public.industry_template_products p where p.industry_template_id=template and (brand_filter='' or coalesce(nullif(p.specifications->>'brand',''),p.manufacturer)=brand_filter) and (category_filter='' or p.product_category=category_filter) and (year_filter is null or p.model_year=year_filter) and (search_text='' or concat_ws(' ',p.name,p.model,p.manufacturer,p.model_year,p.model_variant,p.product_category) ilike '%'||replace(replace(replace(search_text,'\','\\'),'%','\%'),'_','\_')||'%')
 ), page as (
  select * from matches where not comparison or type_rank<=20 order by sort_order,name,id limit 49 offset case when comparison then 0 else (page_number-1)*48 end
 ), selected as (
  select p.id,p.family_name,p.name,p.model,p.model_year,p.model_variant,p.specifications,p.description,p.base_price_cents,p.range_text,p.seats_text,p.powertrain_text,p.product_type,p.manufacturer,p.product_category,p.sort_order,0::bigint as type_rank
  from public.industry_template_products p where p.industry_template_id=template and (p.id=any(selected_ids) or (comparison and p.id in (select distinct on(d.product_type) d.id from public.industry_template_products d where d.industry_template_id=template and (d.product_type='competitor_product' or d.model_year is not null) order by d.product_type,d.sort_order,d.name,d.id)))
 ), shown as (select * from page limit 48), combined as (select distinct on(id) * from (select * from shown union all select * from selected) c order by id,type_rank)
 select jsonb_build_object('products',coalesce((select jsonb_agg(to_jsonb(c)-'type_rank' order by c.sort_order,c.name,c.id) from combined c),'[]'::jsonb),'has_more',(select count(*)>48 from page),'brands',(select coalesce(jsonb_agg(b),'[]'::jsonb) from (select distinct coalesce(nullif(specifications->>'brand',''),manufacturer) b from public.industry_template_products where industry_template_id=template order by b limit 100) x),'categories',(select coalesce(jsonb_agg(c),'[]'::jsonb) from (select distinct product_category c from public.industry_template_products where industry_template_id=template order by c limit 40) x),'years',(select coalesce(jsonb_agg(y),'[]'::jsonb) from (select distinct model_year y from public.industry_template_products where industry_template_id=template and model_year is not null order by y desc limit 40) x)) into result;
 return result;
end $$;

-- Evaluate the account-level ceiling once per statement rather than per shared row.
do $$declare t record;begin
 for t in select tablename from pg_policies where schemaname='public' and policyname='Free plan shared data ceiling' loop
 execute format('alter policy "Free plan shared data ceiling" on public.%I using((select not private.solo_free_actor())) with check((select not private.solo_free_actor()))',t.tablename);
 end loop;
end $$;

-- Free members must still read their authorized role ceiling so a fallback to
-- role defaults cannot undo a Platform Admin's existing restrictions.
drop policy "Sales Solo commercial ceiling" on public.organization_role_permissions;
create policy "Solo role permission reads" on public.organization_role_permissions as restrictive for select to authenticated using(private.is_platform_owner() or private.is_org_member(organization_id) or not private.is_sales_solo(organization_id));
create policy "Solo role permission inserts" on public.organization_role_permissions as restrictive for insert to authenticated with check(private.solo_data_allowed(organization_id));
create policy "Solo role permission updates" on public.organization_role_permissions as restrictive for update to authenticated using(private.solo_data_allowed(organization_id)) with check(private.solo_data_allowed(organization_id));
create policy "Solo role permission deletes" on public.organization_role_permissions as restrictive for delete to authenticated using(private.solo_data_allowed(organization_id));
