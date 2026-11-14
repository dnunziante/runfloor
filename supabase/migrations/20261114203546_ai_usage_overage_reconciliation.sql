-- Verified over-bound usage can be reconciled only by a platform owner, atomically
-- reserving any additional available credits. AI remains frozen until separately reviewed.
create or replace function public.admin_reconcile_ai_usage(request_id uuid,outcome text,usage_data jsonb,reason text) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare r public.ai_usage_requests;rate public.ai_model_rates;g public.ai_credit_grants;result jsonb;cost bigint;need bigint;available bigint;take bigint;input bigint;cached bigint;output bigint;reasoning bigint;
begin
 if not private.is_platform_owner() or length(trim(reason))<10 then raise exception 'Platform owner and verification reason required';end if;
 select * into r from public.ai_usage_requests where id=request_id;if not found then raise exception 'Uncertain request not found';end if;
 perform pg_advisory_xact_lock(hashtextextended(r.organization_id::text,0));
 select * into r from public.ai_usage_requests where id=request_id and state='uncertain' for update;if not found then raise exception 'Uncertain request not found';end if;
 input:=coalesce((usage_data->>'input')::bigint,0);cached:=coalesce((usage_data->>'cached')::bigint,0);output:=coalesce((usage_data->>'output')::bigint,0);reasoning:=coalesce((usage_data->>'reasoning')::bigint,0);
 if outcome not in('settled','released') or least(input,cached,output,reasoning)<0 or cached>input or reasoning>output then raise exception 'Invalid verified usage';end if;
 select * into rate from public.ai_model_rates where id=r.rate_id;
 cost:=case when outcome='released' then 0 else ceil(((input-cached)::numeric*rate.input_units_per_million+cached::numeric*rate.cached_units_per_million+output::numeric*rate.output_units_per_million)/1000000) end;
 need:=greatest(0,cost-r.reserved_units);
 if need>0 then
  select coalesce(sum(total_units-used_units-reserved_units-revoked_units),0) into available from public.ai_credit_grants where organization_id=r.organization_id and (expires_at is null or expires_at>now());
  if available<need then raise exception 'Additional credits or an audited adjustment are required to reconcile verified usage';end if;
  for g in select * from public.ai_credit_grants where organization_id=r.organization_id and (expires_at is null or expires_at>now()) and total_units-used_units-reserved_units-revoked_units>0 order by case kind when 'included' then 0 else 1 end,expires_at nulls last,created_at,id for update loop
   take:=least(need,g.total_units-g.used_units-g.reserved_units-g.revoked_units);
   update public.ai_credit_grants set reserved_units=reserved_units+take where id=g.id;
   insert into public.ai_credit_allocations(request_id,grant_id,organization_id,units) values(request_id,g.id,r.organization_id,take) on conflict on constraint ai_credit_allocations_pkey do update set units=public.ai_credit_allocations.units+excluded.units;
   need:=need-take;exit when need=0;
  end loop;
  update public.ai_usage_requests set reserved_units=cost where id=request_id;
 end if;
 result:=public.finish_ai_usage(request_id,outcome,input,cached,output,reasoning,usage_data->>'provider_id');
 if result->>'state'='uncertain' then raise exception 'Verified usage could not be reconciled';end if;
 insert into public.ai_billing_audit(organization_id,actor_id,action,reason,details) values(r.organization_id,auth.uid(),'reconcile',reason,usage_data||jsonb_build_object('request',request_id,'outcome',outcome));return result;
end$$;
