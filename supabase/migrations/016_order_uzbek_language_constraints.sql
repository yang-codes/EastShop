-- Allow Uzbek order snapshots after adding Uzbek storefront localization.

alter table public.orders
  drop constraint if exists orders_language_check;

alter table public.orders
  add constraint orders_language_check
  check (language in ('zh', 'en', 'ru', 'uz'));

alter table public.order_items
  drop constraint if exists order_items_language_check;

alter table public.order_items
  add constraint order_items_language_check
  check (language in ('zh', 'en', 'ru', 'uz'));
