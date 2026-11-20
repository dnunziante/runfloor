-- Workspace activation copies starter procedures in the same transaction.
-- Aggregate nodes once instead of repeatedly copying a growing JSON document.
-- Preserve output, invoker permissions and existing tenant procedures.
create or replace function private.standard_procedure_content(source_steps jsonb,source_content jsonb)
returns jsonb language plpgsql immutable security invoker set search_path='' as $$
declare body text; nodes jsonb;
begin
 if source_content->'runfloorDocument'->>'format'='tiptap-v1' and source_content->'runfloorDocument'->'document'->>'type'='doc' then return source_content; end if;
 if jsonb_typeof(source_steps)='array' then
  select string_agg(case when jsonb_typeof(value)='string' then value#>>'{}' else jsonb_pretty(value) end,E'\n\n' order by ordinality) into body from jsonb_array_elements(source_steps) with ordinality;
 elsif jsonb_typeof(source_steps)='string' then body:=source_steps#>>'{}';
 else body:=coalesce(source_steps::text,''); end if;

 select coalesce(jsonb_agg(
   jsonb_build_object('type',case when heading then 'heading' else 'paragraph' end)
   || case when heading then '{"attrs":{"level":2}}'::jsonb else '{}'::jsonb end
   || case when line<>'' then jsonb_build_object('content',jsonb_build_array(jsonb_build_object('type','text','text',line))) else '{}'::jsonb end
   order by ordinality), '[]'::jsonb)
 into nodes
 from (
   select line,ordinality,line ~ '^(?:\d+[.)]\s+\S|#{1,3}\s+\S)' or line ~ '^(?:[A-Z][A-Z &:/-]{3,}|(?:[A-Z][a-z]+\s+){0,3}(?:Standard|Standards|Purpose|Responsibilities|Procedure|Expectations|Principle|Notes|Warning|Tips|Example|Examples))$' as heading
   from regexp_split_to_table(coalesce(body,''),E'\r\n|\r|\n') with ordinality as lines(line,ordinality)
 ) parsed;
 return coalesce(source_content,'{}')||jsonb_build_object('runfloorDocument',jsonb_build_object('format','tiptap-v1','document',jsonb_build_object('type','doc','content',nodes)));
end; $$;
