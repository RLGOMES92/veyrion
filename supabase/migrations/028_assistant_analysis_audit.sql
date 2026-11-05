create table if not exists public.assistant_analysis_audit (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete cascade,
  engine text not null check (engine in ('rules','ai')),
  model text,
  records_analyzed integer not null default 0 check (records_analyzed between 0 and 300),
  insights_returned integer not null default 0 check (insights_returned between 0 and 5),
  outcome text not null check (outcome in ('completed','fallback','empty')),
  occurred_at timestamptz not null default now()
);

create index if not exists assistant_analysis_audit_org_time_idx
  on public.assistant_analysis_audit (organization_id, occurred_at desc);

alter table public.assistant_analysis_audit enable row level security;

drop policy if exists "Organization members can record own assistant analysis" on public.assistant_analysis_audit;
create policy "Organization members can record own assistant analysis"
  on public.assistant_analysis_audit
  for insert to authenticated
  with check (
    actor_id = (select auth.uid())
    and exists (
      select 1 from public.organization_members m
      where m.organization_id = assistant_analysis_audit.organization_id
        and m.user_id = (select auth.uid())
    )
  );

drop policy if exists "Organization managers can read assistant analysis audit" on public.assistant_analysis_audit;
create policy "Organization managers can read assistant analysis audit"
  on public.assistant_analysis_audit
  for select to authenticated
  using (public.has_org_role(organization_id, array['owner','admin','manager']));

grant select, insert on public.assistant_analysis_audit to authenticated;
revoke update, delete on public.assistant_analysis_audit from authenticated, anon;
