-- Restrict lead inquiries to commercial roles and remove unused write privileges.
-- This migration is intentionally staged in the VEYRION review branch; do not apply to production before owner validation.

drop policy if exists "Organization members can read rental inquiries" on public.public_lead_inquiries;
drop policy if exists "VEYRION sales roles can read rental inquiries" on public.public_lead_inquiries;

create policy "VEYRION sales roles can read rental inquiries"
  on public.public_lead_inquiries
  for select to authenticated
  using (
    organization_id = public.current_user_organization_id()
    and exists (
      select 1
      from public.organization_members member
      where member.organization_id = public.public_lead_inquiries.organization_id
        and member.user_id = (select auth.uid())
        and member.role in ('owner', 'admin', 'manager', 'sales')
    )
  );

revoke select, update, delete on public.public_lead_inquiries from anon, authenticated, public;
grant select on public.public_lead_inquiries to authenticated;
grant insert on public.public_lead_inquiries to anon;
