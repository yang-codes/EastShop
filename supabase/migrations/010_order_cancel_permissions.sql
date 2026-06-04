-- Allow public order lookup/cancel Edge Functions to read and cancel orders via service_role.

grant select, update on public.orders to service_role;
grant select on public.order_items to service_role;
grant select on public.notification_settings to service_role;

notify pgrst, 'reload schema';
