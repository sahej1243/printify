-- Create or invite the shopkeeper from Supabase Dashboard → Authentication → Users first.
-- Replace the email below with the invited user's email before running this query.
insert into public.shop_staff (shop_id, user_id, role)
select shops.id, users.id, 'owner'
from public.shops as shops
cross join auth.users as users
where shops.slug = 'campus-print-house'
  and lower(users.email) = lower('shopowner@example.com')
on conflict (shop_id, user_id) do update set role = excluded.role;
