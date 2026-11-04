-- VEYRION OS — Supabase schema
-- Execute no SQL Editor do projeto Supabase.
create extension if not exists pgcrypto;

create table if not exists public.workspace_records (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  module text not null check (module in ('companies','contacts','opportunities','assets','maintenance','proposals','procurement','tasks','contracts','finance','campaigns')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists workspace_records_owner_module_idx
  on public.workspace_records(owner_id, module);
create index if not exists workspace_records_payload_gin
  on public.workspace_records using gin(payload);

alter table public.workspace_records enable row level security;
drop policy if exists "Users can read own records" on public.workspace_records;
create policy "Users can read own records" on public.workspace_records
  for select to authenticated using (owner_id = auth.uid());
drop policy if exists "Users can create own records" on public.workspace_records;
create policy "Users can create own records" on public.workspace_records
  for insert to authenticated with check (owner_id = auth.uid());
drop policy if exists "Users can update own records" on public.workspace_records;
create policy "Users can update own records" on public.workspace_records
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "Users can delete own records" on public.workspace_records;
create policy "Users can delete own records" on public.workspace_records
  for delete to authenticated using (owner_id = auth.uid());

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
drop trigger if exists workspace_records_updated_at on public.workspace_records;
create trigger workspace_records_updated_at before update on public.workspace_records
for each row execute procedure public.set_updated_at();

-- IMPORTANT:
-- 1) Enable email authentication in Supabase Auth.
-- 2) Configure Site URL and Redirect URLs for your deployed Vercel domain.
-- 3) Execute supabase/migrations/002_organizations_roles.sql after this file.
-- 4) The migration adds organizations, memberships and role-based RLS. Do not disable RLS.
