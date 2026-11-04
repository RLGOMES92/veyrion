-- VEYRION OS — move security-definer helpers out of exposed public schema,
-- restrict invitation acceptance to authenticated users, and tune policies/indexes.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;
alter function public.current_user_organization_id() set schema private;
alter function public.has_org_role(uuid, text[]) set schema private;
alter function public.can_access_veyrion_module(uuid, text, boolean) set schema private;
alter function public.accept_veyrion_invitation() set schema private;
revoke all on function private.current_user_organization_id() from public, anon;
revoke all on function private.has_org_role(uuid, text[]) from public, anon;
revoke all on function private.can_access_veyrion_module(uuid, text, boolean) from public, anon;
revoke all on function private.accept_veyrion_invitation() from public, anon;
grant execute on function private.current_user_organization_id() to authenticated;
grant execute on function private.has_org_role(uuid, text[]) to authenticated;
grant execute on function private.can_access_veyrion_module(uuid, text, boolean) to authenticated;
grant execute on function private.accept_veyrion_invitation() to authenticated;
create or replace function public.accept_veyrion_invitation()
returns jsonb language sql security invoker set search_path = public, private
as $$ select private.accept_veyrion_invitation(); $$;
revoke all on function public.accept_veyrion_invitation() from public, anon;
grant execute on function public.accept_veyrion_invitation() to authenticated;
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public
as $$ begin new.updated_at = now(); return new; end; $$;
create index if not exists organization_invitations_invited_by_idx on public.organization_invitations(invited_by);
create index if not exists organization_members_invited_by_idx on public.organization_members(invited_by);
create index if not exists organizations_created_by_idx on public.organizations(created_by);
create index if not exists sales_goals_created_by_idx on public.sales_goals(created_by);
create index if not exists workspace_audit_logs_actor_id_idx on public.workspace_audit_logs(actor_id);
drop policy if exists "Admins can view organization invitations" on public.organization_invitations;
drop policy if exists "Invited email can view own invitation" on public.organization_invitations;
drop policy if exists "Users can view authorized invitations" on public.organization_invitations;
create policy "Users can view authorized invitations" on public.organization_invitations
for select to authenticated using (
  private.has_org_role(organization_id, array['owner','admin'])
  or (lower(email) = lower((select auth.jwt()) ->> 'email') and accepted_at is null and expires_at > now())
);
drop policy if exists "Admins can create organization invitations" on public.organization_invitations;
create policy "Admins can create organization invitations" on public.organization_invitations
for insert to authenticated with check (
  private.has_org_role(organization_id, array['owner','admin'])
  and invited_by = (select auth.uid()) and role <> 'owner'
);
drop policy if exists "Admins can change other team roles" on public.organization_members;
create policy "Admins can change other team roles" on public.organization_members
for update to authenticated using (
  user_id <> (select auth.uid()) and private.has_org_role(organization_id, array['owner','admin']) and role <> 'owner'
) with check (
  user_id <> (select auth.uid()) and private.has_org_role(organization_id, array['owner','admin']) and role <> 'owner'
);
drop policy if exists "Admins can remove other team members" on public.organization_members;
create policy "Admins can remove other team members" on public.organization_members
for delete to authenticated using (
  user_id <> (select auth.uid()) and private.has_org_role(organization_id, array['owner','admin']) and role <> 'owner'
);