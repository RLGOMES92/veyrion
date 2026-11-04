-- Merge read access for business, operations and finance into one policy per table.
drop policy if exists b2b_clients_select on public.b2b_clients;
drop policy if exists b2b_clients_finance_select on public.b2b_clients;
create policy b2b_clients_select on public.b2b_clients for select to authenticated
 using(private.can_access_veyrion_module(organization_id,'companies',false) or private.can_access_veyrion_module(organization_id,'finance',false));
drop policy if exists b2b_suppliers_select on public.b2b_suppliers;
drop policy if exists b2b_suppliers_finance_select on public.b2b_suppliers;
create policy b2b_suppliers_select on public.b2b_suppliers for select to authenticated
 using(private.can_access_veyrion_module(organization_id,'procurement',false) or private.can_access_veyrion_module(organization_id,'assets',false) or private.can_access_veyrion_module(organization_id,'finance',false));
drop policy if exists b2b_contracts_select on public.b2b_contracts;
drop policy if exists b2b_contracts_finance_select on public.b2b_contracts;
create policy b2b_contracts_select on public.b2b_contracts for select to authenticated
 using(private.can_access_veyrion_module(organization_id,'contracts',false) or private.can_access_veyrion_module(organization_id,'proposals',false) or private.can_access_veyrion_module(organization_id,'finance',false));
