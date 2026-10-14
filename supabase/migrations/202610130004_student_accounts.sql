-- Optional student accounts. Guest checkout remains available.
alter table public.orders
  add column student_user_id uuid references auth.users(id) on delete set null;

create index orders_student_history_idx
  on public.orders(student_user_id, created_at desc)
  where student_user_id is not null;

comment on column public.orders.student_user_id is
  'Authenticated student who placed the order; null for guest checkout.';
