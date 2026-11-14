-- Service-role clients invoke existing private tenant helpers through table triggers.
-- No anonymous or authenticated privileges are expanded.
grant usage on schema private to service_role;
create index ai_audit_actor_idx on public.ai_billing_audit(actor_id);
create index ai_audit_org_time_idx on public.ai_billing_audit(organization_id,created_at desc);
create index ai_allocations_grant_org_idx on public.ai_credit_allocations(grant_id,organization_id);
create index ai_allocations_request_org_idx on public.ai_credit_allocations(request_id,organization_id);
create index ai_orders_grant_idx on public.ai_credit_orders(grant_id);
create index ai_orders_org_time_idx on public.ai_credit_orders(organization_id,created_at desc);
create index ai_orders_pack_idx on public.ai_credit_orders(pack_id);
create index ai_orders_user_idx on public.ai_credit_orders(user_id);
create index ai_packs_approver_idx on public.ai_credit_packs(approved_by);
create index ai_usage_rate_idx on public.ai_usage_requests(rate_id);
create index ai_usage_user_idx on public.ai_usage_requests(user_id);
create index runfloor_catalog_approver_idx on public.runfloor_billing_catalog(approved_by);
