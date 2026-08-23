-- Reusable, tenant-owned foundations for adaptive customer role plays.
create table public.coach_persona_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  location_id uuid references public.locations(id) on delete set null,
  name text not null check (char_length(name) between 2 and 120),
  archetype text not null check (char_length(archetype) between 2 and 120),
  industry text not null default 'General sales' check (char_length(industry) between 2 and 120),
  difficulty text not null default 'Intermediate' check (difficulty in ('Beginner', 'Intermediate', 'Advanced', 'Expert')),
  is_active boolean not null default true,
  applicable_product_ids uuid[] not null default '{}',
  applicable_competitor_ids uuid[] not null default '{}',
  configuration jsonb not null default '{}'::jsonb check (jsonb_typeof(configuration) = 'object'),
  notes text not null default '',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.coach_sessions
  add column if not exists persona_template_id uuid references public.coach_persona_templates(id) on delete set null;

alter table public.coach_sessions
  drop constraint if exists coach_sessions_difficulty_check;
alter table public.coach_sessions
  add constraint coach_sessions_difficulty_check check (difficulty in ('Foundational', 'Beginner', 'Intermediate', 'Advanced', 'Expert'));

create index coach_persona_templates_org_active_idx on public.coach_persona_templates (organization_id, is_active, name);
create index coach_persona_templates_location_idx on public.coach_persona_templates (organization_id, location_id) where location_id is not null;
create index coach_sessions_persona_template_idx on public.coach_sessions (persona_template_id) where persona_template_id is not null;

alter table public.coach_persona_templates enable row level security;
grant select, insert, update, delete on public.coach_persona_templates to authenticated;

create policy "members read active persona templates" on public.coach_persona_templates
for select to authenticated using (
  private.is_platform_owner() or private.is_org_member(organization_id)
);

create policy "leaders manage persona templates" on public.coach_persona_templates
for all to authenticated using (
  private.is_platform_owner() or private.has_org_role(organization_id, array['tenant_admin', 'manager']::public.organization_role[])
) with check (
  private.is_platform_owner() or private.has_org_role(organization_id, array['tenant_admin', 'manager']::public.organization_role[])
);

-- Starter BGC demo templates are tenant seed data, never application constants.
insert into public.coach_persona_templates (organization_id, name, archetype, industry, difficulty, configuration, notes)
select organization.id, seed.name, seed.archetype, 'Golf cart retail', seed.difficulty,
  jsonb_build_object('primaryUse', seed.primary_use, 'primaryConcern', seed.concern, 'personality', seed.personality, 'informationToDiscover', jsonb_build_array('intended use', 'budget', 'timeline', 'decision makers')), 'Seeded BGC demo persona; edit freely for this workspace.'
from (values
  ('First-Time Golf Cart Buyer','First-time buyer','Beginner','Neighborhood transportation','Product fit','Friendly and curious'),
  ('Experienced Golf Cart Owner','Experienced owner','Intermediate','Replacement cart','Reliability','Practical and informed'),
  ('Price Shopper','Price shopper','Intermediate','Neighborhood transportation','Value and payment','Friendly but skeptical'),
  ('Competitor Shopper','Competitor shopper','Advanced','Comparing brands','Long-term value','Analytical'),
  ('Luxury/Feature-Focused Buyer','Luxury buyer','Intermediate','Comfort and features','Feature fit','Enthusiastic'),
  ('Family Buyer','Family buyer','Intermediate','Family transportation','Passenger space','Warm and busy'),
  ('Neighborhood/LSV Buyer','LSV buyer','Intermediate','Neighborhood driving','Street suitability','Direct'),
  ('Golf-Course Buyer','Golf-course buyer','Beginner','Golf course use','Course fit','Easygoing'),
  ('Financing-Focused Buyer','Financing buyer','Intermediate','Everyday use','Monthly payment','Practical'),
  ('Cash Buyer','Cash buyer','Beginner','Leisure use','Best value','Decisive'),
  ('Trade-In Customer','Trade-in customer','Intermediate','Replacement cart','Trade value','Cautious'),
  ('Just Looking Customer','Just looking','Beginner','Exploring options','Timing','Guarded'),
  ('Spouse/Partner Decision Customer','Shared decision buyer','Intermediate','Family use','Decision process','Collaborative'),
  ('Skeptical Researcher','Skeptical researcher','Advanced','Researching options','Trust','Skeptical'),
  ('Service/Warranty-Focused Buyer','Service-focused buyer','Intermediate','Long-term ownership','After-sale support','Careful'),
  ('Customization-Focused Buyer','Customization buyer','Intermediate','Personalized use','Available options','Creative'),
  ('Urgent Buyer','Urgent buyer','Intermediate','Immediate transportation','Availability','Focused'),
  ('Retiree/Community Buyer','Community buyer','Beginner','Community transportation','Comfort and support','Conversational'),
  ('Highly Informed Buyer','Highly informed buyer','Advanced','Comparing specifications','Product differentiation','Detailed'),
  ('Difficult/High-Objection Buyer','High-objection buyer','Expert','Evaluating a purchase','Value and trust','Demanding')
) as seed(name, archetype, difficulty, primary_use, concern, personality)
cross join public.organizations organization
where organization.name = 'BGC Dealerships'
on conflict do nothing;
