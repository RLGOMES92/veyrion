-- VEYRION OS — initial workspace schema
create extension if not exists pgcrypto;
create table if not exists public.workspace_records (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  module text not null check (module in ('companies','contacts','opportunities','assets','proposals','tasks','contracts','finance')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists workspace_records_owner_module_idx on public.workspace_records(owner_id, module);
create index if not exists workspace_records_payload_gin on public.workspace_records using gin(payload);
alter table public.workspace_records enable row level security;
drop policy if exists "Users can read own records" on public.workspace_records;
create policy "Users can read own records" on public.workspace_records for select to authenticated using (owner_id = auth.uid());
drop policy if exists "Users can create own records" on public.workspace_records;
create policy "Users can create own records" on public.workspace_records for insert to authenticated with check (owner_id = auth.uid());
drop policy if exists "Users can update own records" on public.workspace_records;
create policy "Users can update own records" on public.workspace_records for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "Users can delete own records" on public.workspace_records;
create policy "Users can delete own records" on public.workspace_records for delete to authenticated using (owner_id = auth.uid());
create or replace function public.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
drop trigger if exists workspace_records_updated_at on public.workspace_records;
create trigger workspace_records_updated_at before update on public.workspace_records for each row execute function public.set_updated_at();