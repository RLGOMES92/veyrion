-- VEYRION OS — multi-tenant organizations and role-based access
-- Apply after the original schema.sql. Safe to re-run.
create extension if not exists pgcrypto;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'sales'
    check (role in ('owner','admin','manager','sales','operations','finance','viewer')),
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create index if not exists organization_members_user_idx
  on public.organization_members(user_id, organization_id);
create index if not exists organization_members_org_role_idx
  on public.organization_members(organization_id, role);

-- SECURITY DEFINER helpers avoid recursive RLS checks on organization_members.
create or replace function public.current_user_organization_id()
returns uuid
language sql stable security definer
set search_path = public
as $$
  select organization_id
  from public.organization_members
  where user_id = auth.uid()
  order by case role when 'owner' then 0 when 'admin' then 1 else 2 end, created_at
  limit 1
$$;

create or replace function public.has_org_role(_organization_id uuid, _roles text[])
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = _organization_id
      and user_id = auth.uid()
      and role = any(_roles)
  )
$$;

-- Create one organization for every existing auth user who does not yet have one.
do $$
declare u record; new_org_id uuid;
begin
  for u in select id, coalesce(nullif(raw_user_meta_data->>'company_name',''), split_part(email,'@',1), 'Minha empresa') as org_name
           from auth.users
           where not exists (select 1 from public.organization_members m where m.user_id = auth.users.id)
  loop
    insert into public.organizations(name, created_by)
    values (u.org_name, u.id)
    returning id into new_org_id;
    insert into public.organization_members(organization_id, user_id, role)
    values (new_org_id, u.id, 'owner');
  end loop;
end $$;

-- New signups automatically receive a private organization as its owner.
create or replace function public.handle_new_veyrion_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare new_org_id uuid; org_name text;
begin
  org_name := coalesce(nullif(new.raw_user_meta_data->>'company_name',''), split_part(new.email,'@',1), 'Minha empresa');
  insert into public.organizations(name, created_by)
  values (org_name, new.id)
  returning id into new_org_id;
  insert into public.organization_members(organization_id, user_id, role)
  values (new_org_id, new.id, 'owner');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_veyrion on auth.users;
create trigger on_auth_user_created_veyrion
after insert on auth.users
for each row execute procedure public.handle_new_veyrion_user();

alter table public.workspace_records
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade;

update public.workspace_records r
set organization_id = m.organization_id
from public.organization_members m
where r.organization_id is null
  and m.user_id = r.owner_id
  and m.role = 'owner';

-- Fail safely rather than leave unscoped records accessible.
do $$
begin
  if exists (select 1 from public.workspace_records where organization_id is null) then
    raise exception 'Some workspace_records could not be assigned to an organization. Review owner_id and organization_members before retrying.';
  end if;
end $$;

alter table public.workspace_records alter column organization_id set default public.current_user_organization_id();
alter table public.workspace_records alter column organization_id set not null;
create index if not exists workspace_records_org_module_idx
  on public.workspace_records(organization_id, module);

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;

drop policy if exists "Members can view their organization" on public.organizations;
create policy "Members can view their organization" on public.organizations
  for select to authenticated
  using (public.has_org_role(id, array['owner','admin','manager','sales','operations','finance','viewer']));

drop policy if exists "Owners and admins can update organization" on public.organizations;
create policy "Owners and admins can update organization" on public.organizations
  for update to authenticated
  using (public.has_org_role(id, array['owner','admin']))
  with check (public.has_org_role(id, array['owner','admin']));

drop policy if exists "Members can view team membership" on public.organization_members;
create policy "Members can view team membership" on public.organization_members
  for select to authenticated
  using (public.has_org_role(organization_id, array['owner','admin','manager','sales','operations','finance','viewer']));

drop policy if exists "Admins can add team members" on public.organization_members;
create policy "Admins can add team members" on public.organization_members
  for insert to authenticated
  with check (
    public.has_org_role(organization_id, array['owner','admin'])
    and role <> 'owner'
  );

drop policy if exists "Admins can change team roles" on public.organization_members;
create policy "Admins can change team roles" on public.organization_members
  for update to authenticated
  using (public.has_org_role(organization_id, array['owner','admin']) and role <> 'owner')
  with check (public.has_org_role(organization_id, array['owner','admin']) and role <> 'owner');

drop policy if exists "Admins can remove team members" on public.organization_members;
create policy "Admins can remove team members" on public.organization_members
  for delete to authenticated
  using (public.has_org_role(organization_id, array['owner','admin']) and role <> 'owner');

-- Module-aware access: finance is private to finance/admin; equipment/contracts to operations/admin;
-- commercial records to sales/manager/admin. Owners and admins can access everything.
create or replace function public.can_access_veyrion_module(_organization_id uuid, _module text, _write boolean default false)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = _organization_id
      and m.user_id = auth.uid()
      and (
        m.role in ('owner','admin')
        or (
          not _write and m.role = 'viewer'
          and _module <> 'finance'
        )
        or (
          _module = 'finance' and m.role = 'finance'
        )
        or (
          _module in ('assets','contracts') and m.role = 'operations'
        )
        or (
          _module in ('companies','contacts','opportunities','proposals','tasks')
          and m.role in ('manager','sales')
        )
      )
      and (not _write or m.role <> 'viewer')
  )
$$;

drop policy if exists "Users can read own records" on public.workspace_records;
drop policy if exists "Users can create own records" on public.workspace_records;
drop policy if exists "Users can update own records" on public.workspace_records;
drop policy if exists "Users can delete own records" on public.workspace_records;

create policy "Organization members can read permitted records" on public.workspace_records
  for select to authenticated
  using (public.can_access_veyrion_module(organization_id, module, false));

create policy "Permitted members can create records" on public.workspace_records
  for insert to authenticated
  with check (
    organization_id = public.current_user_organization_id()
    and public.can_access_veyrion_module(organization_id, module, true)
  );

create policy "Permitted members can update records" on public.workspace_records
  for update to authenticated
  using (public.can_access_veyrion_module(organization_id, module, true))
  with check (
    organization_id = public.current_user_organization_id()
    and public.can_access_veyrion_module(organization_id, module, true)
  );

create policy "Admins can delete records" on public.workspace_records
  for delete to authenticated
  using (
    public.has_org_role(organization_id, array['owner','admin'])
  );

-- Do not expose service-role keys in the browser. Keep the existing anon-key client.
