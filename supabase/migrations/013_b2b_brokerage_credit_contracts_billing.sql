-- VEYRION OS: B2B brokerage, credit screening, tripartite contracts and recurring billing.
-- Requires the organization helpers installed by migrations 002 and 010.
create table if not exists public.b2b_clients (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null default private.current_user_organization_id() references public.organizations(id) on delete cascade,
 created_by uuid not null default auth.uid() references auth.users(id),
 cnpj text not null check(cnpj ~ '^[0-9]{14}$'), legal_name text not null, trade_name text,
 registration_status text not null default 'PENDENTE', opening_date date, primary_cnae text, primary_cnae_code text,
 address jsonb not null default '{}'::jsonb, qsa jsonb not null default '[]'::jsonb,
 source_name text, source_checked_at timestamptz, employee_count integer check(employee_count is null or employee_count>=0),
 employee_range text, monthly_revenue_estimate numeric(14,2) check(monthly_revenue_estimate is null or monthly_revenue_estimate>=0),
 rental_limit_monthly numeric(14,2) generated always as(round(coalesce(monthly_revenue_estimate,0)*0.15,2)) stored,
 credit_decision text not null default 'MANUAL_REVIEW' check(credit_decision in('APPROVED','MANUAL_REVIEW','REJECTED')),
 credit_score integer check(credit_score is null or credit_score between 0 and 100), credit_reasons jsonb not null default '[]'::jsonb,
 credit_reviewed_at timestamptz, credit_reviewed_by uuid references auth.users(id), notes text,
 asaas_customer_id text, contact_email text, contact_phone text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(organization_id,cnpj)
);
create table if not exists public.b2b_suppliers (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null default private.current_user_organization_id() references public.organizations(id) on delete cascade,
 created_by uuid not null default auth.uid() references auth.users(id), legal_name text not null, trade_name text, cnpj text check(cnpj is null or cnpj ~ '^[0-9]{14}$'),
 contact_name text, contact_email text, contact_phone text, whatsapp text, address jsonb not null default '{}'::jsonb,
 bank_recipient_id text, asaas_wallet_id text, signature_email text, active boolean not null default true,
 sla_replacement_hours integer check(sla_replacement_hours is null or sla_replacement_hours>0), maintenance_terms text, notes text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.b2b_credit_assessments (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null default private.current_user_organization_id() references public.organizations(id) on delete cascade,
 client_id uuid not null references public.b2b_clients(id) on delete cascade, provider text not null, provider_reference text,
 status text not null default 'PENDING' check(status in('PENDING','COMPLETED','FAILED','REQUIRES_REVIEW')),
 score numeric(7,2), decision text not null default 'MANUAL_REVIEW' check(decision in('APPROVED','MANUAL_REVIEW','REJECTED')),
 factors jsonb not null default '[]'::jsonb, raw_summary jsonb not null default '{}'::jsonb, checked_at timestamptz,
 created_by uuid references auth.users(id), created_at timestamptz not null default now()
);
create table if not exists public.b2b_proposals (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null default private.current_user_organization_id() references public.organizations(id) on delete cascade,
 created_by uuid not null default auth.uid() references auth.users(id), client_id uuid not null references public.b2b_clients(id) on delete restrict,
 supplier_id uuid not null references public.b2b_suppliers(id) on delete restrict, proposal_number text not null,
 status text not null default 'DRAFT' check(status in('DRAFT','CREDIT_REVIEW','SENT','NEGOTIATION','SIGNING','WON','LOST','CANCELLED')),
 term_months integer not null check(term_months in(12,24,36)), monthly_revenue numeric(14,2) not null default 0 check(monthly_revenue>=0),
 monthly_supplier_cost numeric(14,2) not null default 0 check(monthly_supplier_cost>=0), monthly_gross_margin numeric(14,2) not null default 0,
 margin_percent numeric(7,3) not null default 0, setup_fee numeric(14,2) not null default 0,
 manual_credit_override boolean not null default false, manual_override_reason text, approved_by uuid references auth.users(id), approved_at timestamptz,
 valid_until date, notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(organization_id,proposal_number)
);
create table if not exists public.b2b_proposal_items (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null default private.current_user_organization_id() references public.organizations(id) on delete cascade,
 proposal_id uuid not null references public.b2b_proposals(id) on delete cascade, description text not null, model text not null,
 quantity integer not null check(quantity>0), partner_unit_monthly numeric(14,2) not null check(partner_unit_monthly>=0),
 client_unit_monthly numeric(14,2) not null check(client_unit_monthly>=0), created_at timestamptz not null default now()
);
create table if not exists public.b2b_contracts (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null default private.current_user_organization_id() references public.organizations(id) on delete cascade,
 created_by uuid not null default auth.uid() references auth.users(id), proposal_id uuid not null references public.b2b_proposals(id) on delete restrict,
 client_id uuid not null references public.b2b_clients(id) on delete restrict, supplier_id uuid not null references public.b2b_suppliers(id) on delete restrict,
 status text not null default 'DRAFT' check(status in('DRAFT','PENDING_SIGNATURE','ACTIVE','SUSPENDED','TERMINATED','EXPIRED')),
 contract_html text, contract_version integer not null default 1, signature_provider text, signature_document_id text, signature_url text,
 signed_at timestamptz, start_date date, end_date date, sla_replacement_hours integer,
 late_fee_percent numeric(6,3) not null default 2, interest_monthly_percent numeric(6,3) not null default 1,
 recurring_amount numeric(14,2) not null, partner_amount numeric(14,2) not null, veyrion_commission numeric(14,2) not null,
 billing_provider text, billing_subscription_id text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.b2b_charges (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null default private.current_user_organization_id() references public.organizations(id) on delete cascade,
 contract_id uuid not null references public.b2b_contracts(id) on delete cascade, client_id uuid not null references public.b2b_clients(id) on delete restrict,
 supplier_id uuid not null references public.b2b_suppliers(id) on delete restrict, provider text not null default 'ASAAS', provider_charge_id text,
 provider_subscription_id text, status text not null default 'PENDING' check(status in('PENDING','CONFIRMED','RECEIVED','OVERDUE','REFUNDED','CANCELLED','FAILED')),
 due_date date not null, paid_at timestamptz, gross_amount numeric(14,2) not null check(gross_amount>=0),
 veyrion_fee numeric(14,2) not null check(veyrion_fee>=0), supplier_net numeric(14,2) not null check(supplier_net>=0),
 payment_method text, invoice_url text, split_status text not null default 'NOT_REQUESTED' check(split_status in('NOT_REQUESTED','PENDING','DONE','FAILED','NOT_CONFIGURED')),
 provider_payload jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(provider,provider_charge_id)
);
create table if not exists public.b2b_integration_events (
 id uuid primary key default gen_random_uuid(), organization_id uuid references public.organizations(id) on delete cascade,
 provider text not null, event_id text not null, event_type text not null, payload jsonb not null default '{}'::jsonb,
 processed_at timestamptz, processing_error text, created_at timestamptz not null default now(), unique(provider,event_id)
);
create index if not exists b2b_clients_org_cnpj_idx on public.b2b_clients(organization_id,cnpj);
create index if not exists b2b_clients_asaas_customer_idx on public.b2b_clients(asaas_customer_id);
create index if not exists b2b_proposals_org_status_idx on public.b2b_proposals(organization_id,status,created_at desc);
create index if not exists b2b_contracts_org_status_idx on public.b2b_contracts(organization_id,status,end_date);
create index if not exists b2b_charges_org_status_due_idx on public.b2b_charges(organization_id,status,due_date);
create index if not exists b2b_credit_client_idx on public.b2b_credit_assessments(client_id,created_at desc);

create or replace function public.b2b_recalculate_proposal(_proposal_id uuid) returns void language plpgsql set search_path=public as $$
begin update public.b2b_proposals p set monthly_revenue=coalesce(x.revenue,0),monthly_supplier_cost=coalesce(x.cost,0),
 monthly_gross_margin=coalesce(x.revenue,0)-coalesce(x.cost,0),
 margin_percent=case when coalesce(x.revenue,0)>0 then round(((coalesce(x.revenue,0)-coalesce(x.cost,0))/x.revenue)*100,3) else 0 end,updated_at=now()
 from(select sum(quantity*client_unit_monthly) revenue,sum(quantity*partner_unit_monthly) cost from public.b2b_proposal_items where proposal_id=_proposal_id)x where p.id=_proposal_id; end $$;
create or replace function public.b2b_proposal_items_recalc() returns trigger language plpgsql set search_path=public as $$
begin perform public.b2b_recalculate_proposal(case when tg_op='DELETE' then old.proposal_id else new.proposal_id end); return null; end $$;
drop trigger if exists b2b_proposal_items_recalc on public.b2b_proposal_items;
create trigger b2b_proposal_items_recalc after insert or update or delete on public.b2b_proposal_items for each row execute function public.b2b_proposal_items_recalc();

create or replace function public.b2b_guard_proposal() returns trigger language plpgsql set search_path=public as $$
declare c public.b2b_clients%rowtype; age_months integer;
begin
 select * into c from public.b2b_clients where id=new.client_id and organization_id=new.organization_id;
 if not found then raise exception 'CLIENT_NOT_FOUND_IN_ORGANIZATION'; end if;
 if upper(coalesce(c.registration_status,''))<>'ATIVA' then raise exception 'CLIENT_CNPJ_NOT_ACTIVE'; end if;
 if c.credit_decision='REJECTED' then raise exception 'CLIENT_CREDIT_REJECTED'; end if;
 age_months:=case when c.opening_date is null then null else (extract(year from age(current_date,c.opening_date))*12+extract(month from age(current_date,c.opening_date)))::integer end;
 if new.status in('SENT','NEGOTIATION','SIGNING','WON') then
  if c.credit_decision<>'APPROVED' and not(new.manual_credit_override and new.approved_by is not null and length(trim(coalesce(new.manual_override_reason,'')))>=10) then raise exception 'CREDIT_REVIEW_REQUIRED'; end if;
  if age_months is null or age_months<6 then if not(new.manual_credit_override and new.approved_by is not null and length(trim(coalesce(new.manual_override_reason,'')))>=10) then raise exception 'COMPANY_UNDER_SIX_MONTHS_OR_FOUNDATION_UNKNOWN_REQUIRES_REVIEW'; end if; end if;
  if c.monthly_revenue_estimate is null or c.monthly_revenue_estimate<=0 then raise exception 'MONTHLY_REVENUE_REQUIRED'; end if;
  if new.monthly_revenue>c.rental_limit_monthly and not(new.manual_credit_override and new.approved_by is not null and length(trim(coalesce(new.manual_override_reason,'')))>=10) then raise exception 'RENTAL_LIMIT_EXCEEDED_15_PERCENT'; end if;
 end if; return new; end $$;
drop trigger if exists b2b_guard_proposal on public.b2b_proposals;
create trigger b2b_guard_proposal before insert or update on public.b2b_proposals for each row execute function public.b2b_guard_proposal();

create or replace function public.b2b_set_updated_at() returns trigger language plpgsql set search_path=public as $$ begin new.updated_at=now(); return new; end $$;
do $$ declare t text; begin foreach t in array array['b2b_clients','b2b_suppliers','b2b_proposals','b2b_contracts','b2b_charges'] loop
 execute format('drop trigger if exists %I_updated_at on public.%I',t,t);
 execute format('create trigger %I_updated_at before update on public.%I for each row execute function public.b2b_set_updated_at()',t,t);
end loop; end $$;

alter table public.b2b_clients enable row level security;
alter table public.b2b_suppliers enable row level security;
alter table public.b2b_credit_assessments enable row level security;
alter table public.b2b_proposals enable row level security;
alter table public.b2b_proposal_items enable row level security;
alter table public.b2b_contracts enable row level security;
alter table public.b2b_charges enable row level security;
alter table public.b2b_integration_events enable row level security;
create policy b2b_clients_select on public.b2b_clients for select to authenticated using(private.can_access_veyrion_module(organization_id,'companies',false));
create policy b2b_clients_insert on public.b2b_clients for insert to authenticated with check(organization_id=private.current_user_organization_id() and private.can_access_veyrion_module(organization_id,'companies',true));
create policy b2b_clients_update on public.b2b_clients for update to authenticated using(private.can_access_veyrion_module(organization_id,'companies',true)) with check(organization_id=private.current_user_organization_id() and private.can_access_veyrion_module(organization_id,'companies',true));
create policy b2b_suppliers_select on public.b2b_suppliers for select to authenticated using(private.can_access_veyrion_module(organization_id,'procurement',false) or private.can_access_veyrion_module(organization_id,'assets',false));
create policy b2b_suppliers_write on public.b2b_suppliers for all to authenticated using(organization_id=private.current_user_organization_id() and private.can_access_veyrion_module(organization_id,'procurement',true)) with check(organization_id=private.current_user_organization_id() and private.can_access_veyrion_module(organization_id,'procurement',true));
create policy b2b_credit_select on public.b2b_credit_assessments for select to authenticated using(private.can_access_veyrion_module(organization_id,'companies',false));
create policy b2b_credit_insert on public.b2b_credit_assessments for insert to authenticated with check(organization_id=private.current_user_organization_id() and private.can_access_veyrion_module(organization_id,'companies',true));
create policy b2b_proposals_select on public.b2b_proposals for select to authenticated using(private.can_access_veyrion_module(organization_id,'proposals',false));
create policy b2b_proposals_write on public.b2b_proposals for all to authenticated using(organization_id=private.current_user_organization_id() and private.can_access_veyrion_module(organization_id,'proposals',true)) with check(organization_id=private.current_user_organization_id() and private.can_access_veyrion_module(organization_id,'proposals',true));
create policy b2b_proposal_items_access on public.b2b_proposal_items for all to authenticated using(organization_id=private.current_user_organization_id() and private.can_access_veyrion_module(organization_id,'proposals',true)) with check(organization_id=private.current_user_organization_id() and private.can_access_veyrion_module(organization_id,'proposals',true));
create policy b2b_contracts_select on public.b2b_contracts for select to authenticated using(private.can_access_veyrion_module(organization_id,'contracts',false) or private.can_access_veyrion_module(organization_id,'proposals',false));
create policy b2b_contracts_write on public.b2b_contracts for all to authenticated using(organization_id=private.current_user_organization_id() and private.can_access_veyrion_module(organization_id,'contracts',true)) with check(organization_id=private.current_user_organization_id() and private.can_access_veyrion_module(organization_id,'contracts',true));
create policy b2b_charges_select on public.b2b_charges for select to authenticated using(private.can_access_veyrion_module(organization_id,'finance',false));
create policy b2b_charges_write on public.b2b_charges for all to authenticated using(organization_id=private.current_user_organization_id() and private.can_access_veyrion_module(organization_id,'finance',true)) with check(organization_id=private.current_user_organization_id() and private.can_access_veyrion_module(organization_id,'finance',true));
create policy b2b_events_select on public.b2b_integration_events for select to authenticated using(organization_id is not null and private.has_org_role(organization_id,array['owner','admin']));
revoke all on public.b2b_integration_events from anon,authenticated;
grant select on public.b2b_integration_events to authenticated;
