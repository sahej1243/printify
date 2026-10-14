-- Customer price is ₹3/page/copy: ₹2 shop earnings + ₹1 Printify fee.
alter table public.shops
  alter column price_per_page_paise set default 300;

alter table public.shops
  drop constraint if exists shops_price_per_page_paise_check,
  add constraint shops_price_per_page_paise_check check (price_per_page_paise >= 100);

update public.shops
set price_per_page_paise = 300
where slug = 'campus-print-house';

alter table public.orders
  drop constraint if exists orders_unit_price_paise_check,
  add constraint orders_unit_price_paise_check check (unit_price_paise >= 100),
  add column platform_fee_paise bigint generated always as
    (cardinality(selected_pages)::bigint * copies::bigint * 100) stored,
  add column shop_earnings_paise bigint generated always as
    (cardinality(selected_pages)::bigint * copies::bigint * (unit_price_paise - 100)::bigint) stored;

comment on column public.shops.price_per_page_paise is
  'Total customer price per printed page and copy, in paise.';
comment on column public.orders.platform_fee_paise is
  'Printify fee: ₹1 per printed page per copy, in paise.';
comment on column public.orders.shop_earnings_paise is
  'Shop share after the platform fee, in paise.';
