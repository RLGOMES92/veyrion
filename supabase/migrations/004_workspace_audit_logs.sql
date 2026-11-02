-- VEYRION OS — audit trail for workspace records.
-- Apply after schema.sql, migration 002 and migration 003.

create table if not exists public.workspace_audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  record_id uuid not null,
  module text not null,
  action text not null check (action in ('INSERT','UPDATE','DELETE')),
  actor_id uuid references auth.users(id) on delete set null,
  changed_fields text[] not null default '{}',
  occurred_at timestamptz not null default now()
);

create index if not exists workspace_audit_logs_org_time_idx
  on public.workspace_audit_logs(organization_id, occurred_at desc);
create index if not exists workspace_audit_logs_record_idx
  on public.workspace_audit_logs(organization_id, record_id, occurred_at desc);

alter table public.workspace_audit_logs enable row level security;

drop policy if exists "Organization admins can read audit history" on public.workspace_audit_logs;
create policy "Organization admins can read audit history"
  on public.workspace_audit_logs
  for select to authenticated
  using (
    public.has_org_role(organization_id, array['owner','admin','manager'])
  );

create or replace function public.log_veyrion_workspace_record_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_record_id uuid;
  v_module text;
  v_fields text[];
  v_before jsonb;
  v_after jsonb;
begin
  if TG_OP = 'DELETE' then
    v_org_id := OLD.organization_id;
    v_record_id := OLD.id;
    v_module := OLD.module;
    v_before := OLD.payload;
    v_after := '{}'::jsonb;
  elsif TG_OP = 'INSERT' then
    v_org_id := NEW.organization_id;
    v_record_id := NEW.id;
    v_module := NEW.module;
    v_before := '{}'::jsonb;
    v_after := NEW.payload;
  else
    v_org_id := NEW.organization_id;
    v_record_id := NEW.id;
    v_module := NEW.module;
    v_before := OLD.payload;
    v_after := NEW.payload;
  end if;

  select coalesce(array_agg(key order by key), '{}'::text[])
    into v_fields
  from (
    select key
    from jsonb_object_keys(coalesce(v_before, '{}'::jsonb) || coalesce(v_after, '{}'::jsonb)) as keys(key)
    where coalesce(v_before, '{}'::jsonb)->key is distinct from coalesce(v_after, '{}'::jsonb)->key
  ) changed;

  insert into public.workspace_audit_logs (
    organization_id, record_id, module, action, actor_id, changed_fields
  ) values (
    v_org_id, v_record_id, v_module, TG_OP, auth.uid(), v_fields
  );

  if TG_OP = 'DELETE' then return OLD; end if;
  return NEW;
end;
$$;

drop trigger if exists workspace_records_audit on public.workspace_records;
create trigger workspace_records_audit
after insert or update or delete on public.workspace_records
for each row execute function public.log_veyrion_workspace_record_change();

-- Audit rows are written only by the trigger; no client insert/update/delete policies are granted.
