-- Reserve supplier stock only after a tripartite contract is signed and activated.
alter table public.b2b_contracts add column if not exists stock_reserved_at timestamptz;
create or replace function public.b2b_reserve_contract_stock()
returns trigger language plpgsql set search_path=public
as $$
declare item record; product public.b2b_supplier_products%rowtype;
begin
 if new.status='ACTIVE' and old.status is distinct from 'ACTIVE' and new.stock_reserved_at is null then
  for item in select supplier_product_id,quantity from public.b2b_proposal_items where proposal_id=new.proposal_id and supplier_product_id is not null loop
   select * into product from public.b2b_supplier_products where id=item.supplier_product_id and organization_id=new.organization_id and active=true for update;
   if not found or product.available_quantity<item.quantity then raise exception 'SUPPLIER_STOCK_INSUFFICIENT_ON_CONTRACT_ACTIVATION'; end if;
   update public.b2b_supplier_products set available_quantity=available_quantity-item.quantity where id=product.id and organization_id=new.organization_id;
  end loop;
  new.stock_reserved_at=now();
 end if;
 return new;
end $$;
drop trigger if exists b2b_reserve_contract_stock on public.b2b_contracts;
create trigger b2b_reserve_contract_stock before update of status on public.b2b_contracts for each row execute function public.b2b_reserve_contract_stock();
