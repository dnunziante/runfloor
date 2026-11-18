-- Do not expose another user's activity even under an explicit seat exception.
do $$declare t text;begin
 foreach t in array array['assistant_conversations','assistant_interactions','performance_events'] loop
  execute format('create policy "Solo own Sales activity" on public.%I as restrictive for all to authenticated using (private.is_platform_owner() or not private.is_sales_solo(organization_id) or user_id=auth.uid()) with check (private.is_platform_owner() or not private.is_sales_solo(organization_id) or user_id=auth.uid())',t);
 end loop;
end $$;
-- Customer account settings do not include location or shared administration.
do $$declare t text;op text;expression text:='private.is_platform_owner() or not private.is_sales_solo(organization_id)';begin
 foreach t in array array['locations','organization_settings'] loop
  execute format('create policy "Solo platform-only insert" on public.%I as restrictive for insert to authenticated with check (%s)',t,expression);
  execute format('create policy "Solo platform-only update" on public.%I as restrictive for update to authenticated using (%s) with check (%s)',t,expression,expression);
  execute format('create policy "Solo platform-only delete" on public.%I as restrictive for delete to authenticated using (%s)',t,expression);
 end loop;
end $$;
create function private.guard_solo_paid_write() returns trigger language plpgsql security definer set search_path='' as $$
declare org uuid;begin
 if tg_op='DELETE' then org:=old.organization_id;else org:=new.organization_id;end if;
 if private.is_sales_solo(org) and not private.account_paid(org) then raise exception 'Sales Solo requires verified paid access' using errcode='42501';end if;
 if tg_op='DELETE' then return old;else return new;end if;
end $$;
revoke all on function private.guard_solo_paid_write() from public,anon,authenticated;
do $$declare t text;begin
 foreach t in array array['products','product_families','product_documents','knowledge_documents','knowledge_document_chunks','sales_content_items','text_template_categories','competitor_sources','competitor_sync_runs','competitor_sync_candidates','competitor_product_aliases','competitor_product_change_history'] loop
  execute format('create trigger solo_paid_write before insert or update or delete on public.%I for each row execute function private.guard_solo_paid_write()',t);
 end loop;
end $$;
create function private.solo_storage_allowed(object_name text) returns boolean language plpgsql stable security definer set search_path='' as $$
declare org uuid;segment text:=split_part(object_name,'/',1);begin
 if segment !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return true;end if;
 org:=segment::uuid;
 return private.solo_data_allowed(org);
end $$;
revoke all on function private.solo_storage_allowed(text) from public,anon;
grant execute on function private.solo_storage_allowed(text) to authenticated;
create policy "Sales Solo storage ceiling" on storage.objects as restrictive for all to authenticated using(private.solo_storage_allowed(name)) with check(private.solo_storage_allowed(name));

-- No usable allowance exists until a paid, current billing period exists.
create or replace function public.sales_solo_summary(target_org uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.account_subscription_plans;period public.sales_solo_periods;used bigint;held bigint;begin
 if not(private.is_org_member(target_org) or private.is_platform_owner()) then raise exception 'Access denied';end if;
 select * into p from public.account_subscription_plans where organization_id=target_org;
 if not found then return null;end if;
 select * into period from public.sales_solo_periods where organization_id=target_org and starts<=now() and ends>now() order by starts desc limit 1;
 select coalesce(sum(provider_cost_units) filter(where state='settled'),0),coalesce(sum(greatest(reserved_units,provider_cost_units)) filter(where state in ('reserved','uncertain')),0) into used,held from public.ai_usage_requests where solo_period_id=period.id;
 return to_jsonb(p)||jsonb_build_object('used_units',used,'reserved_units',held,'remaining_units',case when period.id is null or not private.account_paid(target_org) then 0 else greatest(0,p.ai_limit_units-used-held) end,'user_count',(select count(*) from public.organization_memberships where organization_id=target_org and status in ('active','invited')));
end $$;
