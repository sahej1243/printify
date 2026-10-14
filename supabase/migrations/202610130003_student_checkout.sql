-- Server-only temporary upload intents and student collection tracking.
create table public.upload_intents (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  storage_path text not null unique,
  original_filename text not null,
  expected_size_bytes integer not null check (expected_size_bytes between 8 and 26214400),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.upload_intents enable row level security;
revoke all on public.upload_intents from public, anon, authenticated;
grant all on public.upload_intents to service_role;

alter table public.orders
  add column collection_code_ciphertext text,
  add column student_confirmed_at timestamptz;

comment on column public.orders.collection_code_ciphertext is
  'AES-GCM encrypted with the order tracking token; the database stores only the hash in collection_code_hash.';
comment on column public.orders.student_confirmed_at is
  'Timestamp when the student confirms receipt after shop collection.';
