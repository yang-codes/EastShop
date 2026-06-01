alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.admin_profiles enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_profiles
    where user_id = auth.uid()
      and is_active = true
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

grant usage on schema public to anon, authenticated;
grant select on public.categories to anon, authenticated;
grant select on public.products to anon, authenticated;
grant select on public.admin_profiles to authenticated;
grant select, insert, update, delete on public.categories to authenticated;
grant select, insert, update, delete on public.products to authenticated;
grant select, update on public.orders to authenticated;
grant select on public.order_items to authenticated;

drop policy if exists "public read active categories" on public.categories;
drop policy if exists "admins manage categories" on public.categories;
drop policy if exists "public read active products" on public.products;
drop policy if exists "admins manage products" on public.products;
drop policy if exists "admins read orders" on public.orders;
drop policy if exists "admins update orders" on public.orders;
drop policy if exists "admins read order items" on public.order_items;
drop policy if exists "users read own admin profile" on public.admin_profiles;
drop policy if exists "admins read admin profiles" on public.admin_profiles;

create policy "public read active categories"
on public.categories
for select
to anon, authenticated
using (is_active = true);

create policy "admins manage categories"
on public.categories
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "public read active products"
on public.products
for select
to anon, authenticated
using (is_active = true);

create policy "admins manage products"
on public.products
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "admins read orders"
on public.orders
for select
to authenticated
using (public.is_admin());

create policy "admins update orders"
on public.orders
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "admins read order items"
on public.order_items
for select
to authenticated
using (public.is_admin());

create policy "users read own admin profile"
on public.admin_profiles
for select
to authenticated
using (user_id = auth.uid());

create policy "admins read admin profiles"
on public.admin_profiles
for select
to authenticated
using (public.is_admin());
