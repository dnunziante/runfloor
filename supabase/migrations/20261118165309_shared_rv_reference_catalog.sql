create or replace function public.solo_catalog_access() returns void language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 if current_setting('role',true)='service_role' and auth.uid() is null then return;end if;
 if not exists(select 1 from public.industry_templates where template_key='rv' and is_enabled and is_public_demo_visible and not is_internal_only) then raise exception 'Shared catalog unavailable';end if;
 if auth.uid() is null or not exists(
 select 1 from public.organization_memberships m join public.organizations o on o.id=m.organization_id
 join public.industry_templates t on t.id=o.industry_template_id
 where m.user_id=auth.uid() and m.status='active' and t.template_key='rv' and t.is_enabled
 and private.rv_has_access(m.organization_id)) then raise exception 'RV catalog membership required' using errcode='42501';end if;
 insert into public.solo_catalog_request_limits(user_id,window_start,requests) values(auth.uid(),date_trunc('minute',now()),1)
 on conflict(user_id) do update set window_start=excluded.window_start,requests=case when solo_catalog_request_limits.window_start=excluded.window_start then solo_catalog_request_limits.requests+1 else 1 end returning requests into n;
 if n>120 then raise exception 'Catalog request limit reached; try again shortly' using errcode='P0001';end if;
end $$;
