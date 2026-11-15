-- Additive knowledge-first controls. No coaching data or existing records removed.
alter table public.knowledge_documents
  add column assistant_scopes text[] not null default '{}',
  add column knowledge_authority text not null default 'uploaded' check (knowledge_authority in ('uploaded','approved','policy')),
  add column knowledge_expires_at timestamptz,
  add column management_only boolean not null default false;

-- Preserve the old Sales allowlist. Ambiguous/general/management collections
-- remain excluded until an administrator explicitly grants an assistant scope.
update public.knowledge_documents set assistant_scopes=array['sales'] where lower(collection) in ('sales process','product knowledge','competitor knowledge');
update public.knowledge_documents set assistant_scopes=array['operations'] where lower(collection)='operations';
alter table public.knowledge_documents add constraint knowledge_assistant_scopes_valid check (assistant_scopes <@ array['sales','operations']::text[]);

create table public.ai_knowledge_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  sales_mode text not null default 'fallback' check (sales_mode in ('internal_only','fallback','verify')),
  operations_mode text not null default 'fallback' check (operations_mode in ('internal_only','fallback','verify')),
  external_enabled boolean not null default true,
  daily_limit integer not null default 50 check (daily_limit between 0 and 1000),
  cache_minutes integer not null default 60 check (cache_minutes between 1 and 1440),
  allowed_domains text[] not null default '{}',
  updated_at timestamptz not null default now()
);
create table public.ai_knowledge_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  location_id uuid,
  assistant text not null check (assistant in ('sales','operations')),
  category text not null,
  topic text not null check (length(topic)<=200),
  source_classification text not null check (source_classification in ('internal','external','mixed','unverified')),
  internal_complete boolean not null,
  research_attempted boolean not null,
  research_used boolean not null,
  research_succeeded boolean not null,
  answered boolean not null,
  created_at timestamptz not null default now(),
  foreign key (location_id,organization_id) references public.locations(id,organization_id) on delete set null (location_id)
);
create index ai_knowledge_events_org_time on public.ai_knowledge_events(organization_id,created_at desc);
create index ai_knowledge_events_user on public.ai_knowledge_events(user_id);
create table public.ai_knowledge_gaps (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  assistant text not null check (assistant in ('sales','operations')),
  category text not null, topic text not null check(length(topic)<=200),
  missing_information text not null,
  occurrences integer not null default 1,
  source_references jsonb not null default '[]',
  proposed_answer text not null default '',
  draft_title text not null default '',
  draft_category text not null default 'General',
  draft_scopes text[] not null default '{}',
  status text not null default 'open' check(status in ('open','draft','indexing','resolved')),
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz, document_id uuid references public.knowledge_documents(id) on delete set null,
  first_seen_at timestamptz not null default now(), last_seen_at timestamptz not null default now(),
  unique(organization_id,assistant,category,topic)
);
create index ai_knowledge_gaps_org_status on public.ai_knowledge_gaps(organization_id,status,last_seen_at desc);
create index ai_knowledge_gaps_document on public.ai_knowledge_gaps(document_id);
create index ai_knowledge_gaps_approver on public.ai_knowledge_gaps(approved_by);
create table public.ai_research_requests (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null, cache_key text not null,
  provider_usage jsonb not null default '{}', provider_model text,
  status text not null default 'reserved' check(status in ('reserved','success','failed')),
  created_at timestamptz not null default now()
);
create index ai_research_requests_budget on public.ai_research_requests(organization_id,created_at desc);
create index ai_research_requests_user on public.ai_research_requests(user_id,created_at desc);
create table public.ai_research_cache (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  cache_key text not null, evidence jsonb not null, expires_at timestamptz not null,
  primary key(organization_id,cache_key)
);
alter table public.ai_knowledge_settings enable row level security;
alter table public.ai_knowledge_events enable row level security;
alter table public.ai_knowledge_gaps enable row level security;
alter table public.ai_research_requests enable row level security;
alter table public.ai_research_cache enable row level security;
revoke all on public.ai_knowledge_settings,public.ai_knowledge_events,public.ai_knowledge_gaps,public.ai_research_requests,public.ai_research_cache from anon,authenticated;
grant select,insert,update on public.ai_knowledge_settings to authenticated;
grant select on public.ai_knowledge_events,public.ai_knowledge_gaps,public.ai_research_requests to authenticated;
grant all on public.ai_knowledge_settings,public.ai_knowledge_events,public.ai_knowledge_gaps,public.ai_research_requests,public.ai_research_cache to service_role;
create policy "members read AI settings" on public.ai_knowledge_settings for select to authenticated using (private.is_org_member(organization_id) or private.is_platform_owner());
create policy "admins insert AI settings" on public.ai_knowledge_settings for insert to authenticated with check (private.has_org_role(organization_id,array['tenant_admin']::public.organization_role[]) or private.is_platform_owner());
create policy "admins update AI settings" on public.ai_knowledge_settings for update to authenticated using (private.has_org_role(organization_id,array['tenant_admin']::public.organization_role[]) or private.is_platform_owner()) with check (private.has_org_role(organization_id,array['tenant_admin']::public.organization_role[]) or private.is_platform_owner());
create policy "admins read AI usage" on public.ai_knowledge_events for select to authenticated using (private.has_org_role(organization_id,array['tenant_admin']::public.organization_role[]) or private.is_platform_owner());
create policy "admins read AI gaps" on public.ai_knowledge_gaps for select to authenticated using (private.has_org_role(organization_id,array['tenant_admin']::public.organization_role[]) or private.is_platform_owner());
create policy "admins read research usage" on public.ai_research_requests for select to authenticated using (private.has_org_role(organization_id,array['tenant_admin']::public.organization_role[]) or private.is_platform_owner());
-- No authenticated write policies for telemetry, gaps or research caches: the
-- authenticated application validates the actor, then writes server-side only.

create function public.match_ai_knowledge(query_embedding extensions.vector(1536), target_org uuid, target_assistant text, search_text text)
returns table(chunk_id uuid,document_id uuid,title text,content text,collection text,authority text,updated_at timestamptz,expires_at timestamptz,location_id uuid)
language sql stable security invoker set search_path=public,extensions as $$
  select c.id,d.id,d.title,c.content,d.collection,d.knowledge_authority,d.updated_at,d.knowledge_expires_at,d.location_id
  from public.knowledge_document_chunks c join public.knowledge_documents d on d.id=c.document_id and d.organization_id=c.organization_id
  where d.organization_id=target_org and c.organization_id=target_org and d.status='ready'
    and target_assistant=any(d.assistant_scopes) and coalesce(d.context_type,'knowledge')<>'communication_example'
    and (private.is_org_member(target_org) or private.is_platform_owner())
    and (not d.management_only or private.has_org_role(target_org,array['manager','tenant_admin']::public.organization_role[]) or private.is_platform_owner())
    and (d.location_id is null or private.has_org_role(target_org,array['tenant_admin']::public.organization_role[]) or private.is_platform_owner()
      or exists(select 1 from public.organization_memberships m where m.organization_id=target_org and m.user_id=auth.uid() and m.status='active' and m.location_id=d.location_id)
      or exists(select 1 from public.organization_member_locations ml where ml.organization_id=target_org and ml.user_id=auth.uid() and ml.location_id=d.location_id))
  order by (case when d.knowledge_authority='policy' then 0 else 1 end),
    (coalesce(1-(c.embedding <=> query_embedding),0) + ts_rank_cd(c.search_vector,websearch_to_tsquery('english',left(search_text,2000)))) desc
  limit 16;
$$;
revoke all on function public.match_ai_knowledge(extensions.vector,uuid,text,text) from public,anon;
grant execute on function public.match_ai_knowledge(extensions.vector,uuid,text,text) to authenticated;

create function public.reserve_ai_research(target_org uuid,actor uuid,request_key text,max_daily integer)
returns uuid language plpgsql security invoker set search_path=public as $$
declare reservation uuid; configured_limit integer;
begin
  if not exists(select 1 from public.organization_memberships where organization_id=target_org and user_id=actor and status='active') and not exists(select 1 from public.profiles where id=actor and is_platform_owner) then return null; end if;
  perform pg_advisory_xact_lock(hashtextextended(target_org::text,0));
  select least(greatest(max_daily,0),daily_limit) into configured_limit from public.ai_knowledge_settings where organization_id=target_org and external_enabled;
  configured_limit:=coalesce(configured_limit,least(greatest(max_daily,0),50));
  if exists(select 1 from public.ai_knowledge_settings where organization_id=target_org and not external_enabled) then return null; end if;
  if (select count(*) from public.ai_research_requests where organization_id=target_org and created_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC')>=configured_limit then return null; end if;
  if (select count(*) from public.ai_research_requests where organization_id=target_org and user_id=actor and created_at>now()-interval '1 minute')>=5 then return null; end if;
  if exists(select 1 from public.ai_research_requests where organization_id=target_org and cache_key=request_key and created_at>now()-interval '45 seconds') then return null; end if;
  insert into public.ai_research_requests(organization_id,user_id,cache_key) values(target_org,actor,left(request_key,100)) returning id into reservation;
  return reservation;
end $$;
revoke all on function public.reserve_ai_research(uuid,uuid,text,integer) from public,anon,authenticated;
grant execute on function public.reserve_ai_research(uuid,uuid,text,integer) to service_role;

create function public.record_ai_knowledge(target_org uuid,actor uuid,target_location uuid,event jsonb)
returns void language plpgsql security invoker set search_path=public as $$
begin
  if not exists(select 1 from public.organization_memberships where organization_id=target_org and user_id=actor and status='active') and not exists(select 1 from public.profiles where id=actor and is_platform_owner) then raise exception 'Unauthorized actor'; end if;
  insert into public.ai_knowledge_events(organization_id,user_id,location_id,assistant,category,topic,source_classification,internal_complete,research_attempted,research_used,research_succeeded,answered)
  values(target_org,actor,target_location,event->>'assistant',event->>'category',left(event->>'topic',200),event->>'classification',(event->>'internalComplete')::boolean,(event->>'researchAttempted')::boolean,(event->>'researchUsed')::boolean,(event->>'researchSucceeded')::boolean,(event->>'answered')::boolean);
  if not (event->>'internalComplete')::boolean then
    insert into public.ai_knowledge_gaps(organization_id,assistant,category,topic,missing_information,source_references,proposed_answer)
    values(target_org,event->>'assistant',event->>'category',left(event->>'topic',200),left(event->>'missing',500),coalesce(event->'sourceReferences','[]'),left(coalesce(event->>'suggestedAnswer',''),12000))
    on conflict(organization_id,assistant,category,topic) do update set occurrences=ai_knowledge_gaps.occurrences+1,last_seen_at=now(),source_references=excluded.source_references;
  end if;
end $$;
revoke all on function public.record_ai_knowledge(uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.record_ai_knowledge(uuid,uuid,uuid,jsonb) to service_role;

-- Existing template relationships, never arbitrary template IDs from the client.
create policy "members read their assigned industry template" on public.industry_templates for select to authenticated using (
  is_enabled and exists(select 1 from public.organizations o where o.industry_template_id=industry_templates.id and private.is_org_member(o.id))
);
grant select on public.industry_template_products to authenticated;
create policy "members read their assigned industry products" on public.industry_template_products for select to authenticated using (
  exists(select 1 from public.organizations o join public.industry_templates t on t.id=o.industry_template_id where o.industry_template_id=industry_template_products.industry_template_id and t.is_enabled and private.is_org_member(o.id))
);
