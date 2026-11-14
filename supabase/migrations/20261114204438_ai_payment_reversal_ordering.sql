-- Apply current Stripe reversal state in the same transaction as the paid credit grant.
create or replace function public.apply_ai_credit_payment(event_id text,event_kind text,order_id uuid,session_id text,payment_id text,paid_cents int,paid_currency text,account_id text,live boolean,refund_cents int default 0,is_disputed boolean default false)
 returns void language plpgsql security definer set search_path='' as $$
 #variable_conflict use_variable
 declare o public.ai_credit_orders;g uuid;revoke_units bigint;org uuid;
 begin
 select organization_id into org from public.ai_credit_orders where id=order_id;if org is null then raise exception 'Unknown RunFloor order';end if;
 perform pg_advisory_xact_lock(hashtextextended(org::text,0));
 if exists(select 1 from public.runfloor_billing_events where id=event_id) then return;end if;
 select * into o from public.ai_credit_orders where id=order_id for update;
 if not exists(select 1 from public.runfloor_billing_customers where organization_id=org and stripe_account_id=account_id and livemode=live) then raise exception 'Wrong billing account or mode';end if;
 if event_kind='paid' then
  if paid_cents<>o.price_cents or paid_currency<>o.currency or o.stripe_session_id is distinct from session_id or payment_id is null or (o.payment_intent_id is not null and o.payment_intent_id<>payment_id) then raise exception 'Payment does not match order';end if;
  if o.grant_id is null then
   insert into public.ai_credit_grants(organization_id,kind,total_units,reference,expires_at) values(org,'purchased',o.credit_units,'purchase:'||o.id,case when o.expires_days is null then null else now()+make_interval(days=>o.expires_days) end) returning id into g;
   update public.ai_credit_orders set status='paid',payment_intent_id=payment_id,grant_id=g where id=o.id;
  end if;
  select * into o from public.ai_credit_orders where id=order_id;
  refund_cents:=greatest(o.refunded_cents,least(o.price_cents,greatest(0,refund_cents)));
  is_disputed:=coalesce(is_disputed,false) or o.disputed;
  if refund_cents>0 or is_disputed then
   revoke_units:=case when is_disputed then o.credit_units else ceil(o.credit_units::numeric*refund_cents/o.price_cents) end;
   update public.ai_credit_grants set revoked_units=revoke_units where id=o.grant_id;
   update public.ai_credit_orders set refunded_cents=refund_cents,disputed=is_disputed,status=case when is_disputed then 'disputed' else 'refunded' end where id=o.id;
  end if;
 elsif event_kind in('refund','dispute') then
  if o.payment_intent_id is distinct from payment_id or o.grant_id is null then raise exception 'Purchase not fulfilled yet; retry event';end if;
  refund_cents:=greatest(o.refunded_cents,least(o.price_cents,refund_cents));
  is_disputed:=case when event_kind='refund' then o.disputed else is_disputed end;
  revoke_units:=case when is_disputed then o.credit_units else ceil(o.credit_units::numeric*refund_cents/o.price_cents) end;
  update public.ai_credit_grants set revoked_units=revoke_units where id=o.grant_id;
  update public.ai_credit_orders set refunded_cents=refund_cents,disputed=is_disputed,status=case when is_disputed then 'disputed' when refund_cents>0 then 'refunded' else 'paid' end where id=o.id;
 elsif event_kind='failed' then
  update public.ai_credit_orders set status='failed' where id=o.id and status='pending';
 else raise exception 'Unsupported payment event';end if;
 insert into public.runfloor_billing_events(id,event_type) values(event_id,event_kind);
 end$$;
