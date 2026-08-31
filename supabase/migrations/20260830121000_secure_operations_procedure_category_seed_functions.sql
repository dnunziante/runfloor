-- These SECURITY DEFINER helpers are only invoked by the organization trigger.
revoke all on function public.seed_operations_procedure_categories(uuid) from public, anon, authenticated;
revoke all on function public.seed_operations_procedure_categories_for_organization() from public, anon, authenticated;
