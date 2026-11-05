alter table public.b2b_notification_outbox
  alter column recipient_email drop not null;

alter table public.b2b_notification_outbox
  drop constraint if exists b2b_notification_outbox_status_check;

alter table public.b2b_notification_outbox
  add constraint b2b_notification_outbox_status_check
  check (status in ('PENDING','PROCESSING','RETRY','SENT','FAILED','BLOCKED'));