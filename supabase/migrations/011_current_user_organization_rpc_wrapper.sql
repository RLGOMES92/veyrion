-- Preserve the PostgREST RPC used by the VEYRION frontend without
-- exposing the SECURITY DEFINER implementation from the private schema.
create or replace function public.current_user_organization_id()
returns uuid
language sql
stable
security invoker
set search_path = public, private
as $$
  select private.current_user_organization_id()
$$;
revoke all on function public.current_user_organization_id() from public, anon;
grant execute on function public.current_user_organization_id() to authenticated;