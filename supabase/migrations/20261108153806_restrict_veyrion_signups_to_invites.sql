-- Only explicitly invited email identities may be created in VEYRION OS.
-- Existing users and memberships are not modified.
create or replace function public.handle_new_veyrion_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  invite public.organization_invitations%rowtype;
begin
  select *
    into invite
  from public.organization_invitations
  where lower(email) = lower(new.email)
    and accepted_at is null
    and expires_at > now()
  order by created_at desc
  limit 1
  for update;

  if not found then
    raise exception 'Cadastro restrito: é necessário um convite válido para acessar o VEYRION OS.'
      using errcode = '42501';
  end if;

  insert into public.organization_members (
    organization_id, user_id, role, invited_by
  ) values (
    invite.organization_id, new.id, invite.role, invite.invited_by
  )
  on conflict (organization_id, user_id) do nothing;

  update public.organization_invitations
  set accepted_at = now()
  where id = invite.id;

  return new;
end;
$function$;
