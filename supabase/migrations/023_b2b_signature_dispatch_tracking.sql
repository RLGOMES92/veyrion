-- Track ZapSign dispatch outcomes separately from the contract lifecycle.
-- UNKNOWN means the provider may have created the document; never retry automatically.
alter table public.b2b_contracts
  add column if not exists signature_dispatch_status text not null default 'NOT_REQUESTED'
    check (signature_dispatch_status in ('NOT_REQUESTED','SENDING','SENT','FAILED','UNKNOWN')),
  add column if not exists signature_dispatch_error text,
  add column if not exists signature_dispatch_attempted_at timestamptz;

create index if not exists b2b_contracts_signature_dispatch_idx
  on public.b2b_contracts(organization_id, signature_dispatch_status, updated_at desc);
