-- VEYRION OS — secure email invitations for organization members
-- Apply after migration 002_organizations_roles.sql.
create table if not exists public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin','manager','sales','operations','finance','viewer')),
  invited_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  unique (organization_id, email, accepted_at)
);

create index if not exists organization_invitations_email_idx
  on public.organization_invitations (lower(email), expires_at)
  where accepted_at is null;

alter table public.organization_invitations enable row level security;

drop policy if exists "Admins can view organization invitations" on public.organization_invitations;
create policy "Admins can view organization invitations" on public.organization_invitations
  for select to authenticated
  using (public.has_org_role(organization_id, array['owner','admin']));

drop policy if exists "Invited email can view own invitation" on public.organization_invitations;
create policy "Invited email can view own invitation" on public.organization_invitations
  for select to authenticated
  using (lower(email) = lower(auth.jwt()->>'email') and accepted_at is null and expires_at > now());

drop policy if exists "Admins can create organization invitations" on public.organization_invitations;
create policy "Admins can create organization invitations" on public.organization_invitations
  for insert to authenticated
  with check (
    public.has_org_role(organization_id, array['owner','admin'])
    and invited_by = auth.uid()
    and role <> 'owner'
  );

drop policy if exists "Admins can revoke organization invitations" on public.organization_invitations;
create policy "Admins can revoke organization invitations" on public.organization_invitations
  for delete to authenticated
  using (public.has_org_role(organization_id, array['owner','admin']) and accepted_at is null);

create or replace function public.accept_veyrion_invitation()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  invite public.organization_invitations%rowtype;
  account_email text;
begin
  if auth.uid() is null then
    raise exception 'É necessário entrar na conta antes de aceitar o convite.';
  end if;

  account_email := lower(coalesce(auth.jwt()->>'email',''));
  if account_email = '' then
    raise exception 'Não foi possível confirmar o e-mail da conta.';
  end if;

  select * into invite
  from public.organization_invitations
  where lower(email) = account_email
    and accepted_at is null
    and expires_at > now()
  order by created_at desc
  limit 1
  for update;

  if not found then
    return jsonb_build_object('accepted', false, 'message', 'Nenhum convite pendente encontrado para este e-mail.');
  end if;

  insert into public.organization_members (organization_id, user_id, role, invited_by)
  values (invite.organization_id, auth.uid(), invite.role, invite.invited_by)
  on conflict (organization_id, user_id) do nothing;

  update public.organization_invitations
  set accepted_at = now()
  where id = invite.id;

  return jsonb_build_object('accepted', true, 'organization_id', invite.organization_id, 'role', invite.role);
end;
$$;

revoke all on function public.accept_veyrion_invitation() from public;
grant execute on function public.accept_veyrion_invitation() to authenticated;
