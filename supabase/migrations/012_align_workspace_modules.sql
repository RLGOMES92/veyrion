-- Align persisted module keys with all record modules exposed by app/page.tsx.
alter table public.workspace_records
  drop constraint if exists workspace_records_module_check;
alter table public.workspace_records
  add constraint workspace_records_module_check
  check (module in (
    'companies','contacts','opportunities','assets','maintenance',
    'proposals','procurement','tasks','contracts','finance','campaigns'
  ));