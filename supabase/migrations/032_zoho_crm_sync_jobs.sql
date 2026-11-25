-- VEYRION OS — Zoho CRM synchronization state
-- Service-role only. The browser never reads or writes this table directly.
create table if not exists public.zoho_sync_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workspace_record_id uuid not null references public.workspace_records(id) on delete cascade,
  module text not null default 'companies' check (module = 'companies'),
  status text not null default 'pending' check (status in ('pending','synced','needs_data','error')),
  zoho_module text not null default 'Leads',
  zoho_record_id text,
  idempotency_key text not null,
  attempts integer not null default 0,
  last_error text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, workspace_record_id),
  unique (organization_id, idempotency_key)
);
create index if not exists zoho_sync_jobs_status_idx
  on public.zoho_sync_jobs(status, updated_at)
  where status in ('pending','error');
alter table public.zoho_sync_jobs enable row level security;
revoke all on public.zoho_sync_jobs from anon, authenticated;
grant all on public.zoho_sync_jobs to service_role;
