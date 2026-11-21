-- Public commercial inquiries for the VEYRION rental landing page.
-- Anonymous visitors can INSERT only; authenticated organization members can read.
create table if not exists public.public_lead_inquiries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 120),
  company text not null check (char_length(company) between 2 and 180),
  role text not null default '' check (char_length(role) <= 120),
  email text not null check (char_length(email) <= 254),
  city text not null check (char_length(city) between 2 and 140),
  quantity text not null check (char_length(quantity) <= 80),
  term text not null check (char_length(term) <= 80),
  need text not null default '' check (char_length(need) <= 180),
  source text not null default 'site_locacao',
  status text not null default 'novo',
  created_at timestamptz not null default now()
);

create index if not exists public_lead_inquiries_org_created_idx
  on public.public_lead_inquiries (organization_id, created_at desc);
create index if not exists public_lead_inquiries_org_email_idx
  on public.public_lead_inquiries (organization_id, lower(email));

alter table public.public_lead_inquiries enable row level security;

drop policy if exists "Public can submit VEYRION rental inquiry" on public.public_lead_inquiries;
create policy "Public can submit VEYRION rental inquiry"
  on public.public_lead_inquiries
  for insert to anon
  with check (
    organization_id = '415757ac-3b33-4cf2-8a7a-6daa9d49d725'::uuid
    and source = 'site_locacao'
    and status = 'novo'
  );

drop policy if exists "Organization members can read rental inquiries" on public.public_lead_inquiries;
create policy "Organization members can read rental inquiries"
  on public.public_lead_inquiries
  for select to authenticated
  using (
    public.has_org_role(organization_id, array['owner','admin','manager','sales'])
  );

grant insert on public.public_lead_inquiries to anon;
grant select on public.public_lead_inquiries to authenticated;
