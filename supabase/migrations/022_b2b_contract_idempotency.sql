-- A proposal can produce only one contract. This makes contract creation idempotent under concurrent requests.
create unique index if not exists b2b_contracts_proposal_id_uidx
  on public.b2b_contracts(proposal_id);