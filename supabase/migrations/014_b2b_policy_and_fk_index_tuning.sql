-- B2B foreign-key indexes and split permissive SELECT from write policies.
create index if not exists b2b_charges_client_id_idx on public.b2b_charges(client_id);
create index if not exists b2b_charges_contract_id_idx on public.b2b_charges(contract_id);
create index if not exists b2b_charges_supplier_id_idx on public.b2b_charges(supplier_id);
create index if not exists b2b_clients_created_by_idx on public.b2b_clients(created_by);
create index if not exists b2b_clients_credit_reviewed_by_idx on public.b2b_clients(credit_reviewed_by);
create index if not exists b2b_contracts_client_id_idx on public.b2b_contracts(client_id);
create index if not exists b2b_contracts_created_by_idx on public.b2b_contracts(created_by);
create index if not exists b2b_contracts_proposal_id_idx on public.b2b_contracts(proposal_id);
create index if not exists b2b_contracts_supplier_id_idx on public.b2b_contracts(supplier_id);
create index if not exists b2b_credit_created_by_idx on public.b2b_credit_assessments(created_by);
create index if not exists b2b_credit_org_idx on public.b2b_credit_assessments(organization_id);
create index if not exists b2b_events_org_idx on public.b2b_integration_events(organization_id);
create index if not exists b2b_proposal_items_org_idx on public.b2b_proposal_items(organization_id);
create index if not exists b2b_proposal_items_proposal_idx on public.b2b_proposal_items(proposal_id);
create index if not exists b2b_proposals_approved_by_idx on public.b2b_proposals(approved_by);
create index if not exists b2b_proposals_client_idx on public.b2b_proposals(client_id);
create index if not exists b2b_proposals_created_by_idx on public.b2b_proposals(created_by);
create index if not exists b2b_proposals_supplier_idx on public.b2b_proposals(supplier_id);
create index if not exists b2b_suppliers_created_by_idx on public.b2b_suppliers(created_by);
create index if not exists b2b_suppliers_org_idx on public.b2b_suppliers(organization_id);

drop policy if exists b2b_suppliers_write on public.b2b_suppliers;
create policy b2b_suppliers_insert on public.b2b_suppliers for insert to authenticated with check(organization_id=private.current_user_organization_id() and private.can_access_veyrion_module(organization_id,'procurement',true));
create policy b2b_suppliers_update on public.b2b_suppliers for update to authenticated using(organization_id=private.current_user_organization_id() and private.can_access_veyrion_module(organization_id,'procurement',true)) with check(organization_id=private.current_user_organization_id() and private.can_access_veyrion_module(organization_id,'procurement',true));
create policy b2b_suppliers_delete on public.b2b_suppliers for delete to authenticated using(organization_id=private.current_user_organization_id() and private.can_access_veyrion_module(organization_id,'procurement',true));

drop policy if exists b2b_proposals_write on public.b2b_proposals;
create policy b2b_proposals_insert on public.b2b_proposals for insert to authenticated with check(organization_id=private.current_user_organization_id() and private.can_access_veyrion_module(organization_id,'proposals',true));
create policy b2b_proposals_update on public.b2b_proposals for update to authenticated using(organization_id=private.current_user_organization_id() and private.can_access_veyrion_module(organization_id,'proposals',true)) with check(organization_id=private.current_user_organization_id() and private.can_access_veyrion_module(organization_id,'proposals',true));
create policy b2b_proposals_delete on public.b2b_proposals for delete to authenticated using(organization_id=private.current_user_organization_id() and private.can_access_veyrion_module(organization_id,'proposals',true));

drop policy if exists b2b_contracts_write on public.b2b_contracts;
create policy b2b_contracts_insert on public.b2b_contracts for insert to authenticated with check(organization_id=private.current_user_organization_id() and private.can_access_veyrion_module(organization_id,'contracts',true));
create policy b2b_contracts_update on public.b2b_contracts for update to authenticated using(organization_id=private.current_user_organization_id() and private.can_access_veyrion_module(organization_id,'contracts',true)) with check(organization_id=private.current_user_organization_id() and private.can_access_veyrion_module(organization_id,'contracts',true));
create policy b2b_contracts_delete on public.b2b_contracts for delete to authenticated using(organization_id=private.current_user_organization_id() and private.can_access_veyrion_module(organization_id,'contracts',true));

drop policy if exists b2b_charges_write on public.b2b_charges;
create policy b2b_charges_insert on public.b2b_charges for insert to authenticated with check(organization_id=private.current_user_organization_id() and private.can_access_veyrion_module(organization_id,'finance',true));
create policy b2b_charges_update on public.b2b_charges for update to authenticated using(organization_id=private.current_user_organization_id() and private.can_access_veyrion_module(organization_id,'finance',true)) with check(organization_id=private.current_user_organization_id() and private.can_access_veyrion_module(organization_id,'finance',true));
create policy b2b_charges_delete on public.b2b_charges for delete to authenticated using(organization_id=private.current_user_organization_id() and private.can_access_veyrion_module(organization_id,'finance',true));
