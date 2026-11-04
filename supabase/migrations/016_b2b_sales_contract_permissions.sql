-- Allow sales/manager users with proposal permissions to create and update the contracts they originate.
drop policy if exists b2b_contracts_insert on public.b2b_contracts;
drop policy if exists b2b_contracts_update on public.b2b_contracts;
create policy b2b_contracts_insert on public.b2b_contracts for insert to authenticated
 with check(organization_id=private.current_user_organization_id() and (private.can_access_veyrion_module(organization_id,'contracts',true) or private.can_access_veyrion_module(organization_id,'proposals',true)));
create policy b2b_contracts_update on public.b2b_contracts for update to authenticated
 using(organization_id=private.current_user_organization_id() and (private.can_access_veyrion_module(organization_id,'contracts',true) or private.can_access_veyrion_module(organization_id,'proposals',true)))
 with check(organization_id=private.current_user_organization_id() and (private.can_access_veyrion_module(organization_id,'contracts',true) or private.can_access_veyrion_module(organization_id,'proposals',true)));
