-- Grant Edge Functions the minimum table privileges they need.
-- The function uses SUPABASE_SERVICE_ROLE_KEY, so database grants for service_role
-- must include product reads, order writes, and admin profile reads for admin-only functions.

grant select on public.products to service_role;

grant select on public.admin_profiles to service_role;

grant select, insert, delete on public.orders to service_role;

grant select, insert on public.order_items to service_role;
