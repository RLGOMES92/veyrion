-- VEYRION OS — extend the audit trail to team membership and invitations.
-- Apply after migrations 002 and 006. Values such as email and user IDs are never copied
-- into changed_fields; the audit log stores only the names of changed columns.

create or replace function public.log_veyrion_team_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old jsonb := '{}'::jsonb;
  v_new jsonb := '{}'::jsonb;
  v_org_id uuid;
  v_record_id uuid;
  v_fields text[];
begin
  if TG_OP <> 'INSERT' then
    v_old := to_jsonb(OLD);
  end if;
  if TG_OP <> 'DELETE' then
    v_new := to_jsonb(NEW);
  end if;

  v_org_id := coalesce(v_new->>'organization_id', v_old->>'organization_id')::uuid;
  v_record_id := coalesce(v_new->>'id', v_old->>'id')::uuid;

  select coalesce(array_agg(key order by key), '{}'::text[])
    into v_fields
  from (
    select key
    from jsonb_object_keys(v_old || v_new) as keys(key)
    where key not in ('id','organization_id','user_id','email','invited_by','created_at')
      and v_old->key is distinct from v_new->key
  ) changed;

  insert into public.workspace_audit_logs (
    organization_id, record_id, module, action, actor_id, changed_fields
  ) values (
    v_org_id, v_record_id, TG_ARGV[0], TG_OP, auth.uid(), v_fields
  );

  if TG_OP = 'DELETE' then return OLD; end if;
  return NEW;
end;
$$;

drop trigger if exists organization_members_audit on public.organization_members;
create trigger organization_members_audit
after insert or update or delete on public.organization_members
for each row execute function public.log_veyrion_team_change('team');

drop trigger if exists organization_invitations_audit on public.organization_invitations;
create trigger organization_invitations_audit
after insert or update or delete on public.organization_invitations
for each row execute function public.log_veyrion_team_change('team_invites');

-- Audit rows remain read-only for clients and inherit migration 004's admin/manager policy.
