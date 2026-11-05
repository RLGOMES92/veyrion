create table if not exists public.b2b_notification_outbox (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  contract_id uuid not null references public.b2b_contracts(id) on delete restrict,
  supplier_id uuid,
  notification_type text not null,
  idempotency_key text not null unique,
  recipient_email text not null,
  subject text not null,
  html_body text not null,
  status text not null default 'PENDING' check (status in ('PENDING','PROCESSING','RETRY','SENT','FAILED')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  sent_at timestamptz,
  provider_message_id text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists b2b_notification_outbox_due_idx
  on public.b2b_notification_outbox(status, next_attempt_at, created_at)
  where status in ('PENDING','RETRY','PROCESSING');

alter table public.b2b_notification_outbox enable row level security;
revoke all on public.b2b_notification_outbox from anon, authenticated;
grant all on public.b2b_notification_outbox to service_role;

create or replace function public.claim_b2b_notification_outbox(p_limit integer default 20)
returns setof public.b2b_notification_outbox
language sql
security definer
set search_path = public
as $$
  with candidates as (
    select id
    from public.b2b_notification_outbox
    where (
      status in ('PENDING','RETRY') and next_attempt_at <= now()
    ) or (
      status = 'PROCESSING' and locked_at < now() - interval '10 minutes'
    )
    order by created_at
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 20), 50))
  )
  update public.b2b_notification_outbox as q
  set status = 'PROCESSING',
      attempt_count = q.attempt_count + 1,
      locked_at = now(),
      updated_at = now()
  from candidates
  where q.id = candidates.id
  returning q.*;
$$;

revoke all on function public.claim_b2b_notification_outbox(integer) from public, anon, authenticated;
grant execute on function public.claim_b2b_notification_outbox(integer) to service_role;
