-- Commercial inbox fields and role-scoped updates for public rental inquiries.
alter table public.public_lead_inquiries
  add column if not exists assigned_to uuid references auth.users(id) on delete set null,
  add column if not exists follow_up_at date,
  add column if not exists internal_notes text not null default '',
  add column if not exists updated_at timestamptz not null default now();

alter table public.public_lead_inquiries
  drop constraint if exists public_lead_inquiries_status_check;
alter table public.public_lead_inquiries
  add constraint public_lead_inquiries_status_check
  check (status in ('novo', 'em_atendimento', 'qualificado', 'proposta', 'convertido', 'perdido'));

drop policy if exists "VEYRION sales roles can update rental inquiries" on public.public_lead_inquiries;
create policy "VEYRION sales roles can update rental inquiries"
  on public.public_lead_inquiries
  for update to authenticated
  using (
    organization_id = public.current_user_organization_id()
    and exists (
      select 1 from public.organization_members member
      where member.organization_id = public_lead_inquiries.organization_id
        and member.user_id = (select auth.uid())
        and member.role = any (array['owner','admin','manager','sales'])
    )
  )
  with check (
    organization_id = public.current_user_organization_id()
    and exists (
      select 1 from public.organization_members member
      where member.organization_id = public_lead_inquiries.organization_id
        and member.user_id = (select auth.uid())
        and member.role = any (array['owner','admin','manager','sales'])
    )
  );

grant update on public.public_lead_inquiries to authenticated;
