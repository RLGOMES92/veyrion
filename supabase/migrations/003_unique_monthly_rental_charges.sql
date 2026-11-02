-- VEYRION OS — prevent duplicate monthly rental charges.
-- Apply after schema.sql and migrations/002_organizations_roles.sql.
-- Existing duplicate charge keys are reported before the index is created.
do $$
begin
  if exists (
    select 1
    from public.workspace_records
    where module = 'finance'
      and nullif(btrim(payload->>'charge_key'), '') is not null
    group by organization_id, payload->>'charge_key'
    having count(*) > 1
  ) then
    raise exception 'Duplicate VEYRION finance charge_key values exist. Review duplicate monthly rental charges before applying migration 003.';
  end if;
end
$$;

create unique index if not exists workspace_records_unique_finance_charge_key
  on public.workspace_records (organization_id, (payload->>'charge_key'))
  where module = 'finance'
    and nullif(btrim(payload->>'charge_key'), '') is not null;
