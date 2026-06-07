-- Storefront title and intro shown above the product catalog.

alter table public.store_settings
  add column if not exists store_title jsonb not null default '{"zh":"EastShop","en":"EastShop","ru":"EastShop","uz":"EastShop"}'::jsonb,
  add column if not exists store_description jsonb not null default '{"zh":"面向中亚市场的多语言商品商城。","en":"A multilingual product store for Central Asia.","ru":"Многоязычный каталог товаров для Центральной Азии.","uz":"Markaziy Osiyo uchun ko‘p tilli mahsulotlar do‘koni."}'::jsonb;

update public.store_settings
set
  store_title = coalesce(nullif(store_title, '{}'::jsonb), '{"zh":"EastShop","en":"EastShop","ru":"EastShop","uz":"EastShop"}'::jsonb),
  store_description = coalesce(nullif(store_description, '{}'::jsonb), '{"zh":"面向中亚市场的多语言商品商城。","en":"A multilingual product store for Central Asia.","ru":"Многоязычный каталог товаров для Центральной Азии.","uz":"Markaziy Osiyo uchun ko‘p tilli mahsulotlar do‘koni."}'::jsonb)
where id = 'default';

notify pgrst, 'reload schema';
