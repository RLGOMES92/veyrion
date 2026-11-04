-- Finance users need read access to client, supplier and contract data to reconcile billing.
create policy b2b_clients_finance_select on public.b2b_clients for select to authenticated
 using(private.can_access_veyrion_module(organization_id,'finance',false));
create policy b2b_suppliers_finance_select on public.b2b_suppliers for select to authenticated
 using(private.can_access_veyrion_module(organization_id,'finance',false));
create policy b2b_contracts_finance_select on public.b2b_contracts for select to authenticated
 using(private.can_access_veyrion_module(organization_id,'finance',false));
