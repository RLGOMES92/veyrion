-- Atomic webhook processing lease. A duplicate delivery may only claim an unprocessed
-- event when no worker owns it or the previous lease has expired.
alter table public.b2b_integration_events
  add column if not exists processing_started_at timestamptz;

create index if not exists b2b_integration_events_pending_idx
  on public.b2b_integration_events(provider, processing_started_at)
  where processed_at is null;
