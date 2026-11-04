-- Store actual gateway fees and VEYRION net after provider fees and supplier split.
alter table public.b2b_charges add column if not exists gateway_fee numeric(14,2) not null default 0 check(gateway_fee>=0);
alter table public.b2b_charges add column if not exists veyrion_net numeric(14,2) not null default 0 check(veyrion_net>=0);
