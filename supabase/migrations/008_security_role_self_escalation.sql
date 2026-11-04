-- VEYRION OS — prevent admins from changing or removing their own membership.
-- Apply after migrations 002 and 007. Safe to re-run.
-- Admins may still manage other non-owner members; the organization owner is protected.

create or replace function public.prevent_veyrion_membership_identity_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.id is distinct from old.id
    or new.organization_id is distinct from old.organization_id
    or new.user_id is distinct from old.user_id
    or new.created_at is distinct from old.created_at
    or new.invited_by is distinct from old.invited_by then
    raise exception 'Os identificadores do vínculo de equipe não podem ser alterados.';
  end if;
  return new;
end;
$$;

drop trigger if exists organization_members_identity_guard on public.organization_members;
create trigger organization_members_identity_guard
before update on public.organization_members
for each row execute function public.prevent_veyrion_membership_identity_change();

drop policy if exists "Admins can change team roles" on public.organization_members;
create policy "Admins can change other team roles" on public.organization_members
  for update to authenticated
  using (
    user_id <> auth.uid()
    and public.has_org_role(organization_id, array['owner','admin'])
    and role <> 'owner'
  )
  with check (
    user_id <> auth.uid()
    and public.has_org_role(organization_id, array['owner','admin'])
    and role <> 'owner'
  );

drop policy if exists "Admins can remove team members" on public.organization_members;
create policy "Admins can remove other team members" on public.organization_members
  for delete to authenticated
  using (
    user_id <> auth.uid()
    and public.has_org_role(organization_id, array['owner','admin'])
    and role <> 'owner'
  );
