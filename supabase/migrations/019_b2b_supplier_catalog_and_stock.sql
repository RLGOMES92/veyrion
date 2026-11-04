-- Partner notebook catalog and stock availability for proposal composition.
create table if not exists public.b2b_supplier_products (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null default private.current_user_organization_id() references public.organizations(id) on delete cascade,
 supplier_id uuid not null references public.b2b_suppliers(id) on delete cascade,
 brand text, model text not null, description text,
 available_quantity integer not null default 0 check(available_quantity>=0),
 partner_unit_monthly numeric(14,2) not null check(partner_unit_monthly>=0),
 active boolean not null default true, created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(organization_id,supplier_id,model)
);
alter table public.b2b_proposal_items add column if not exists supplier_product_id uuid references public.b2b_supplier_products(id) on delete set null;
create index if not exists b2b_supplier_products_org_supplier_idx on public.b2b_supplier_products(organization_id,supplier_id,active);
create index if not exists b2b_proposal_items_product_idx on public.b2b_proposal_items(supplier_product_id);
alter table public.b2b_supplier_products enable row level security;
create policy b2b_supplier_products_select on public.b2b_supplier_products for select to authenticated
 using(private.can_access_veyrion_module(organization_id,'proposals',false) or private.can_access_veyrion_module(organization_id,'procurement',false) or private.can_access_veyrion_module(organization_id,'assets',false) or private.can_access_veyrion_module(organization_id,'finance',false));
create policy b2b_supplier_products_insert on public.b2b_supplier_products for insert to authenticated
 with check(organization_id=private.current_user_organization_id() and (private.can_access_veyrion_module(organization_id,'procurement',true) or private.can_access_veyrion_module(organization_id,'assets',true)));
create policy b2b_supplier_products_update on public.b2b_supplier_products for update to authenticated
 using(organization_id=private.current_user_organization_id() and (private.can_access_veyrion_module(organization_id,'procurement',true) or private.can_access_veyrion_module(organization_id,'assets',true)))
 with check(organization_id=private.current_user_organization_id() and (private.can_access_veyrion_module(organization_id,'procurement',true) or private.can_access_veyrion_module(organization_id,'assets',true)));
create policy b2b_supplier_products_delete on public.b2b_supplier_products for delete to authenticated
 using(organization_id=private.current_user_organization_id() and (private.can_access_veyrion_module(organization_id,'procurement',true) or private.can_access_veyrion_module(organization_id,'assets',true)));
create or replace function public.b2b_guard_proposal_item() returns trigger language plpgsql set search_path=public as $$
declare p public.b2b_proposals%rowtype; product public.b2b_supplier_products%rowtype;
begin
 if new.supplier_product_id is not null then
  select * into p from public.b2b_proposals where id=new.proposal_id and organization_id=new.organization_id;
  if not found then raise exception 'PROPOSAL_NOT_FOUND'; end if;
  select * into product from public.b2b_supplier_products where id=new.supplier_product_id and organization_id=new.organization_id and supplier_id=p.supplier_id and active=true;
  if not found then raise exception 'SUPPLIER_PRODUCT_NOT_AVAILABLE_FOR_SELECTED_PARTNER'; end if;
  if new.quantity>product.available_quantity then raise exception 'SUPPLIER_STOCK_INSUFFICIENT'; end if;
  new.model:=product.model; new.partner_unit_monthly:=product.partner_unit_monthly;
  if coalesce(new.description,'')='' then new.description:=coalesce(product.description,product.model); end if;
 end if;
 return new;
end $$;
drop trigger if exists b2b_guard_proposal_item on public.b2b_proposal_items;
create trigger b2b_guard_proposal_item before insert or update on public.b2b_proposal_items for each row execute function public.b2b_guard_proposal_item();
create trigger b2b_supplier_products_updated_at before update on public.b2b_supplier_products for each row execute function public.b2b_set_updated_at();
