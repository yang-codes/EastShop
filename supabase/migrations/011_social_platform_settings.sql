-- Add configurable social/contact platforms for checkout and order lookup.

alter table public.store_settings
  add column if not exists social_platforms jsonb not null default '[]'::jsonb;

update public.store_settings
set social_platforms = '[
  {"id":"telegram","label":{"zh":"Telegram","en":"Telegram","ru":"Telegram"},"code":"telegram","isActive":true,"sortOrder":1},
  {"id":"instagram","label":{"zh":"Instagram","en":"Instagram","ru":"Instagram"},"code":"instagram","isActive":true,"sortOrder":2},
  {"id":"facebook","label":{"zh":"Facebook","en":"Facebook","ru":"Facebook"},"code":"facebook","isActive":true,"sortOrder":3},
  {"id":"other","label":{"zh":"其他","en":"Other","ru":"Другое"},"code":"other","isActive":true,"sortOrder":99}
]'::jsonb
where id = 'default'
  and jsonb_array_length(social_platforms) = 0;

alter table public.orders
  add column if not exists social_platform text;

grant select, insert, update on public.store_settings to authenticated;
grant select, insert, update on public.store_settings to service_role;
grant select, insert, update on public.orders to service_role;

notify pgrst, 'reload schema';
