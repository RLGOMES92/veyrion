-- VEYRION OS — monthly commercial goals.
-- Apply after schema.sql and migrations 002, 003 and 004.

create table if not exists public.sales_goals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  seller_name text not null check (length(trim(seller_name)) between 1 and 120),
  competence text not null check (competence ~ '^[0-9]{4}-(0[1-9]|1[0-2])),
  target_value numeric(14,2) not null default 0 check (target_value >= 0),
  target_opportunities integer not null default 0 check (target_opportunities >= 0),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, seller_name, competence)
);

create index if not exists sales_goals_org_competence_idx
  on public.sales_goals(organization_id, competence);

alter table public.sales_goals enable row level security;

drop policy if exists "Organization members can read sales goals" on public.sales_goals;
create policy "Organization members can read sales goals"
  on public.sales_goals
  for select to authenticated
  using (
    public.has_org_role(
      organization_id,
      array['owner','admin','manager','sales','operations','finance','viewer']
    )
  );

drop policy if exists "Managers can create sales goals" on public.sales_goals;
create policy "Managers can create sales goals"
  on public.sales_goals
  for insert to authenticated
  with check (
    organization_id = public.current_user_organization_id()
    and public.has_org_role(organization_id, array['owner','admin','manager'])
  );

drop policy if exists "Managers can update sales goals" on public.sales_goals;
create policy "Managers can update sales goals"
  on public.sales_goals
  for update to authenticated
  using (
    public.has_org_role(organization_id, array['owner','admin','manager'])
  )
  with check (
    organization_id = public.current_user_organization_id()
    and public.has_org_role(organization_id, array['owner','admin','manager'])
  );

drop policy if exists "Managers can delete sales goals" on public.sales_goals;
create policy "Managers can delete sales goals"
  on public.sales_goals
  for delete to authenticated
  using (
    public.has_org_role(organization_id, array['owner','admin','manager'])
  );

create or replace function public.set_sales_goal_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists sales_goals_updated_at on public.sales_goals;
create trigger sales_goals_updated_at
before update on public.sales_goals
for each row execute function public.set_sales_goal_updated_at();
),
  target_value numeric(14,2) not null default 0 check (target_value >= 0),
  target_opportunities integer not null default 0 check (target_opportunities >= 0),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, seller_name, competence)
);

create index if not exists sales_goals_org_competence_idx
  on public.sales_goals(organization_id, competence);

alter table public.sales_goals enable row level security;

drop policy if exists "Organization members can read sales goals" on public.sales_goals;
create policy "Organization members can read sales goals"
  on public.sales_goals
  for select to authenticated
  using (
    public.has_org_role(
      organization_id,
      array['owner','admin','manager','sales','operations','finance','viewer']
    )
  );

drop policy if exists "Managers can create sales goals" on public.sales_goals;
create policy "Managers can create sales goals"
  on public.sales_goals
  for insert to authenticated
  with check (
    organization_id = public.current_user_organization_id()
    and public.has_org_role(organization_id, array['owner','admin','manager'])
  );

drop policy if exists "Managers can update sales goals" on public.sales_goals;
create policy "Managers can update sales goals"
  on public.sales_goals
  for update to authenticated
  using (
    public.has_org_role(organization_id, array['owner','admin','manager'])
  )
  with check (
    organization_id = public.current_user_organization_id()
    and public.has_org_role(organization_id, array['owner','admin','manager'])
  );

drop policy if exists "Managers can delete sales goals" on public.sales_goals;
create policy "Managers can delete sales goals"
  on public.sales_goals
  for delete to authenticated
  using (
    public.has_org_role(organization_id, array['owner','admin','manager'])
  );

create or replace function public.set_sales_goal_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists sales_goals_updated_at on public.sales_goals;
create trigger sales_goals_updated_at
before update on public.sales_goals
for each row execute function public.set_sales_goal_updated_at();
