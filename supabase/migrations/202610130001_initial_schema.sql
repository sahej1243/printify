-- Printify's first database schema.
-- Student access is routed through server endpoints; students never query order
-- or payment rows directly. Shop staff can only read rows for their assigned shop.

create table public.shops (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  location text not null,
  is_active boolean not null default true,
  is_open boolean not null default true,
  price_per_page_paise integer not null default 200 check (price_per_page_paise > 0),
  currency text not null default 'INR' check (currency = 'INR'),
  created_at timestamptz not null default now()
);

create table public.shop_staff (
  shop_id uuid not null references public.shops(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'operator' check (role in ('owner', 'operator')),
  created_at timestamptz not null default now(),
  primary key (shop_id, user_id)
);

create or replace function public.is_valid_page_selection(selected integer[], document_pages integer)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select cardinality(selected) between 1 and 10000
    and array_position(selected, null) is null
    and coalesce((
      select min(page) >= 1
        and max(page) <= document_pages
        and count(distinct page) = cardinality(selected)
      from unnest(selected) as selection(page)
    ), false);
$$;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id),
  idempotency_key uuid,
  customer_name text,
  customer_email text,
  original_filename text not null,
  document_path text not null unique,
  file_size_bytes integer not null check (file_size_bytes between 1 and 26214400),
  page_count integer not null check (page_count between 1 and 10000),
  selected_pages integer[] not null check (cardinality(selected_pages) between 1 and 10000),
  copies smallint not null check (copies between 1 and 20),
  unit_price_paise integer not null check (unit_price_paise > 0),
  amount_paise bigint generated always as
    (cardinality(selected_pages)::bigint * copies::bigint * unit_price_paise::bigint) stored,
  currency text not null default 'INR' check (currency = 'INR'),
  payment_status text not null default 'pending'
    check (payment_status in ('pending', 'paid', 'failed', 'refunded')),
  fulfillment_status text not null default 'queued'
    check (fulfillment_status in ('queued', 'printing', 'ready', 'collected', 'cancelled')),
  tracking_token_hash text unique,
  collection_code_hash text unique,
  collection_code_issued_at timestamptz,
  collected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_selected_pages_within_document check (
    public.is_valid_page_selection(selected_pages, page_count)
  ),
  constraint orders_collected_has_timestamp check (
    (fulfillment_status = 'collected') = (collected_at is not null)
  )
);

create unique index orders_shop_idempotency_key_unique
  on public.orders(shop_id, idempotency_key)
  where idempotency_key is not null;
create index orders_shop_created_at_idx on public.orders(shop_id, created_at desc);
create index orders_shop_status_idx on public.orders(shop_id, payment_status, fulfillment_status);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  gateway text not null default 'razorpay' check (gateway = 'razorpay'),
  gateway_order_id text not null unique,
  gateway_payment_id text unique,
  amount_paise bigint not null check (amount_paise > 0),
  currency text not null default 'INR' check (currency = 'INR'),
  status text not null default 'created'
    check (status in ('created', 'authorized', 'captured', 'failed', 'refunded')),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payments_order_id_idx on public.payments(order_id);

-- Razorpay webhook event IDs make repeated deliveries safe to process once.
create table public.payment_webhook_events (
  id uuid primary key default gen_random_uuid(),
  gateway text not null default 'razorpay' check (gateway = 'razorpay'),
  gateway_event_id text not null unique,
  event_type text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger orders_set_updated_at
before update on public.orders
for each row execute function public.set_updated_at();

create trigger payments_set_updated_at
before update on public.payments
for each row execute function public.set_updated_at();

-- SECURITY DEFINER is needed so the membership lookup works with RLS enabled.
create or replace function public.is_assigned_shop_staff(target_shop_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.shop_staff as staff
    where staff.shop_id = target_shop_id
      and staff.user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_assigned_shop_staff(uuid) from public;
grant execute on function public.is_assigned_shop_staff(uuid) to authenticated;

alter table public.shops enable row level security;
alter table public.shop_staff enable row level security;
alter table public.orders enable row level security;
alter table public.payments enable row level security;
alter table public.payment_webhook_events enable row level security;

create policy "Anyone can view the active shop"
  on public.shops for select to anon, authenticated
  using (is_active = true);

create policy "Staff can view their own assignment"
  on public.shop_staff for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Assigned staff can view shop orders"
  on public.orders for select to authenticated
  using (public.is_assigned_shop_staff(shop_id));

create policy "Assigned staff can view order payments"
  on public.payments for select to authenticated
  using (
    exists (
      select 1 from public.orders as orders
      where orders.id = payments.order_id
        and public.is_assigned_shop_staff(orders.shop_id)
    )
  );

grant select on public.shops to anon, authenticated;
grant select on public.shop_staff, public.orders, public.payments to authenticated;
grant all on public.shops, public.shop_staff, public.orders, public.payments, public.payment_webhook_events to service_role;
revoke all on public.payment_webhook_events from anon, authenticated;
revoke insert, update, delete on public.shops, public.shop_staff, public.orders, public.payments
  from anon, authenticated;

-- Private PDF bucket. Uploads and signed URLs will be issued only by server-side
-- routes after validation and shop-staff authorization.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('order-pdfs', 'order-pdfs', false, 26214400, array['application/pdf'])
on conflict (id) do update set
  public = false,
  file_size_limit = 26214400,
  allowed_mime_types = array['application/pdf'];

create policy "Assigned shop staff can read their order PDFs"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'order-pdfs'
    and exists (
      select 1 from public.orders as orders
      where orders.document_path = storage.objects.name
        and public.is_assigned_shop_staff(orders.shop_id)
    )
  );

-- The initial single shop is seeded once; adjust its price and location later.
insert into public.shops (slug, name, location, price_per_page_paise)
values ('campus-print-house', 'Campus Print House', 'Student Centre', 200)
on conflict (slug) do nothing;
