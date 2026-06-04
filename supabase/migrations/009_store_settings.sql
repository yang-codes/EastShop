-- Storefront settings that are safe for public reads.
-- Phone prefixes are used by checkout and order lookup forms.

create table if not exists public.store_settings (
  id text primary key default 'default',
  phone_prefixes jsonb not null default '[]'::jsonb,
  created_at timestamp without time zone not null default timezone('Asia/Shanghai', now()),
  updated_at timestamp without time zone not null default timezone('Asia/Shanghai', now()),
  constraint store_settings_singleton check (id = 'default')
);

drop trigger if exists set_store_settings_updated_at on public.store_settings;
create trigger set_store_settings_updated_at
before update on public.store_settings
for each row execute function public.set_updated_at();

alter table public.store_settings enable row level security;

grant select on public.store_settings to anon, authenticated;
grant insert, update on public.store_settings to authenticated;

drop policy if exists "public read store settings" on public.store_settings;
drop policy if exists "admins write store settings" on public.store_settings;

create policy "public read store settings"
on public.store_settings
for select
to anon, authenticated
using (true);

create policy "admins write store settings"
on public.store_settings
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

insert into public.store_settings (id, phone_prefixes)
values (
  'default',
  '[
    {"id":"cn","label":{"zh":"中国","en":"China","ru":"Китай"},"prefix":"+86","isActive":true,"sortOrder":1},
    {"id":"kz","label":{"zh":"哈萨克斯坦","en":"Kazakhstan","ru":"Казахстан"},"prefix":"+7","isActive":true,"sortOrder":2},
    {"id":"ru","label":{"zh":"俄罗斯","en":"Russia","ru":"Россия"},"prefix":"+7","isActive":true,"sortOrder":3},
    {"id":"uz","label":{"zh":"乌兹别克斯坦","en":"Uzbekistan","ru":"Узбекистан"},"prefix":"+998","isActive":true,"sortOrder":4},
    {"id":"kg","label":{"zh":"吉尔吉斯斯坦","en":"Kyrgyzstan","ru":"Кыргызстан"},"prefix":"+996","isActive":true,"sortOrder":5},
    {"id":"tj","label":{"zh":"塔吉克斯坦","en":"Tajikistan","ru":"Tajikistan"},"prefix":"+992","isActive":true,"sortOrder":6},
    {"id":"tm","label":{"zh":"土库曼斯坦","en":"Turkmenistan","ru":"Туркменистан"},"prefix":"+993","isActive":true,"sortOrder":7},
    {"id":"other","label":{"zh":"其他","en":"Other","ru":"Другое"},"prefix":"+","isActive":true,"isCustom":true,"sortOrder":99}
  ]'::jsonb
)
on conflict (id) do nothing;

notify pgrst, 'reload schema';
