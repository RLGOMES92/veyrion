-- Keep the public rental inquiry inbox read-only for authenticated users.
-- The application reads leads through the authenticated API and submits new
-- inquiries through the anonymous public form. No browser workflow updates rows.
drop policy if exists "VEYRION sales roles can update rental inquiries"
  on public.public_lead_inquiries;

revoke update, delete, truncate
  on table public.public_lead_inquiries
  from anon, authenticated, public;

grant insert on table public.public_lead_inquiries to anon;
grant select on table public.public_lead_inquiries to authenticated;
