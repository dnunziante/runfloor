-- QA ONLY: reconstructed dependency absent from committed historical migrations.
-- Never apply this fixture to an existing or production database.
create table public.knowledge_document_chunks(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),document_id uuid not null references public.knowledge_documents(id),chunk_index int not null,content text not null,token_count int,created_at timestamptz not null default now());
alter table public.knowledge_document_chunks enable row level security;
revoke all on public.knowledge_document_chunks from anon,authenticated;
