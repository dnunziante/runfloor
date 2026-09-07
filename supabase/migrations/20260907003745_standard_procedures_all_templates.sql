-- The nine approved categories form the shared procedure baseline for every industry template.
-- This migration is independent of the pending archive/category-management migration.
alter table public.platform_procedure_templates add column is_standard boolean not null default false;
update public.platform_procedure_templates set is_standard=true where category in
 ('Sales Procedures','Delivery & Post-Sale','Inventory','Service','Parts','CRM & Lead Management','Customer Experience','Management','Employee & Administrative');
create index platform_procedure_templates_standard_idx on public.platform_procedure_templates(id) where is_standard;

-- Source identity, rather than title, prevents repeated pushes from duplicating tenant copies.
create unique index operations_procedures_org_platform_template_unique on public.operations_procedures(organization_id,platform_template_id) where platform_template_id is not null;

create function private.mark_new_standard_procedure() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.category in ('Sales Procedures','Delivery & Post-Sale','Inventory','Service','Parts','CRM & Lead Management','Customer Experience','Management','Employee & Administrative') then new.is_standard:=true; end if;
 return new;
end; $$;
create trigger platform_procedures_mark_standard before insert on public.platform_procedure_templates for each row execute function private.mark_new_standard_procedure();

-- Lossless text-to-document adapter for the existing legacy templates. Rich documents pass through unchanged.
create function private.standard_procedure_content(source_steps jsonb,source_content jsonb)
returns jsonb language plpgsql immutable security invoker set search_path='' as $$
declare body text; line text; nodes jsonb:='[]'; node jsonb; heading boolean;
begin
 if source_content->'runfloorDocument'->>'format'='tiptap-v1' and source_content->'runfloorDocument'->'document'->>'type'='doc' then return source_content; end if;
 if jsonb_typeof(source_steps)='array' then
  select string_agg(case when jsonb_typeof(value)='string' then value#>>'{}' else jsonb_pretty(value) end,E'\n\n' order by ordinality) into body from jsonb_array_elements(source_steps) with ordinality;
 elsif jsonb_typeof(source_steps)='string' then body:=source_steps#>>'{}';
 else body:=coalesce(source_steps::text,''); end if;
 foreach line in array regexp_split_to_array(coalesce(body,''),E'\r\n|\r|\n') loop
  heading:=line ~ '^(?:\d+[.)]\s+\S|#{1,3}\s+\S)' or line ~ '^(?:[A-Z][A-Z &:/-]{3,}|(?:[A-Z][a-z]+\s+){0,3}(?:Standard|Standards|Purpose|Responsibilities|Procedure|Expectations|Principle|Notes|Warning|Tips|Example|Examples))$';
  node:=jsonb_build_object('type',case when heading then 'heading' else 'paragraph' end);
  if heading then node:=node||'{"attrs":{"level":2}}'::jsonb; end if;
  if line<>'' then node:=node||jsonb_build_object('content',jsonb_build_array(jsonb_build_object('type','text','text',line))); end if;
  nodes:=nodes||jsonb_build_array(node);
 end loop;
 return coalesce(source_content,'{}')||jsonb_build_object('runfloorDocument',jsonb_build_object('format','tiptap-v1','document',jsonb_build_object('type','doc','content',nodes)));
end; $$;

create function private.copy_standard_procedures(target_organization uuid)
returns integer language plpgsql security invoker set search_path='' as $$
declare inserted_count integer;
begin
 -- Organization locking serializes duplicate pushes. RLS governs every statement.
 perform id from public.organizations where id=target_organization for update;
 if not found then raise exception 'Tenant not found or access denied.'; end if;
 insert into public.operations_procedure_categories(organization_id,name,is_default)
 select distinct target_organization,t.category,false from public.platform_procedure_templates t
 where t.is_standard and t.is_published and to_jsonb(t)->>'archived_at' is null
 and not exists(select 1 from public.operations_procedure_categories c where c.organization_id=target_organization and lower(c.name)=lower(t.category))
 on conflict(organization_id,lower(name)) do nothing;
 if exists (
  select 1 from public.platform_procedure_templates t
  join public.operations_procedure_categories c on c.organization_id=target_organization and lower(c.name)=lower(t.category)
  where t.is_standard and t.is_published and to_jsonb(t)->>'archived_at' is null and to_jsonb(c)->>'archived_at' is not null
  and not exists(select 1 from public.operations_procedures p where p.organization_id=target_organization and p.platform_template_id=t.id)
 ) then raise exception 'Restore the matching tenant category before installing its standard procedures.'; end if;
 insert into public.operations_procedures(organization_id,title,category_id,category,owner,summary,status,version,content,source_type,platform_template_id,platform_template_version,created_by,sort_order)
 select target_organization,t.title,c.id,c.name,t.owner,t.summary,'published',1,
  private.standard_procedure_content(t.steps,t.content),'manual',t.id,t.version,coalesce(auth.uid(),t.created_by),
  row_number() over(partition by c.id order by t.title,t.id)::integer + coalesce((select max(p.sort_order) from public.operations_procedures p where p.organization_id=target_organization and p.category_id=c.id),0)
 from public.platform_procedure_templates t
 join public.operations_procedure_categories c on c.organization_id=target_organization and lower(c.name)=lower(t.category)
 where t.is_standard and t.is_published and to_jsonb(t)->>'archived_at' is null and to_jsonb(c)->>'archived_at' is null
 and not exists(select 1 from public.operations_procedures p where p.organization_id=target_organization and p.platform_template_id=t.id)
 on conflict(organization_id,platform_template_id) where platform_template_id is not null do nothing;
 get diagnostics inserted_count=row_count;
 return inserted_count;
end; $$;

create function public.install_standard_procedures(target_organization uuid)
returns integer language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is null or not private.is_platform_owner() then raise exception 'Platform owner access is required.'; end if;
 return private.copy_standard_procedures(target_organization);
end; $$;
revoke all on function public.install_standard_procedures(uuid) from public,anon;
grant execute on function public.install_standard_procedures(uuid) to authenticated;

-- Runs after the existing organizations_seed_operations_procedure_categories trigger.
-- Every new tenant inherits the shared baseline, regardless of its industry template.
create function private.seed_standard_procedures_for_new_organization()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 perform private.copy_standard_procedures(new.id);
 return new;
end; $$;
create trigger organizations_seed_standard_procedures after insert on public.organizations
 for each row execute function private.seed_standard_procedures_for_new_organization();

-- The user explicitly requested delivery to ALL existing tenants, including suspended demos.
-- Only missing source-linked copies are inserted; existing tenant rows are never updated.
do $$ declare tenant record; begin
 for tenant in select id from public.organizations order by id loop
  perform private.copy_standard_procedures(tenant.id);
 end loop;
end; $$;
