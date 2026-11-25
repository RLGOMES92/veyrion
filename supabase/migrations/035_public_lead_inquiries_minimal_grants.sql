-- Restrict the public lead table to only the API operations it requires.
-- Anonymous visitors can submit; authenticated sales roles can read via RLS.
revoke all privileges on table public.public_lead_inquiries from anon, authenticated, public;
grant insert on table public.public_lead_inquiries to anon;
grant select on table public.public_lead_inquiries to authenticated;
