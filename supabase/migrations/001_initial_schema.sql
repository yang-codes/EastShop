create extension if not exists pgcrypto;

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name_zh text not null default '',
  name_en text not null default '',
  name_ru text not null default '',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamp without time zone not null default timezone('Asia/Shanghai', now()),
  updated_at timestamp without time zone not null default timezone('Asia/Shanghai', now())
);

create table if not exists public.products (
  id text primary key,
  category_id uuid references public.categories(id) on delete set null,
  name_zh text not null default '',
  name_en text not null default '',
  name_ru text not null default '',
  description_zh text not null default '',
  description_en text not null default '',
  description_ru text not null default '',
  detail_zh text not null default '',
  detail_en text not null default '',
  detail_ru text not null default '',
  price numeric(12, 2) not null default 0 check (price >= 0),
  cover_image text,
  images jsonb not null default '[]'::jsonb,
  specs jsonb not null default '[]'::jsonb,
  tags jsonb not null default '[]'::jsonb,
  sort_order integer not null default 0,
  is_featured boolean not null default false,
  is_active boolean not null default true,
  created_at timestamp without time zone not null default timezone('Asia/Shanghai', now()),
  updated_at timestamp without time zone not null default timezone('Asia/Shanghai', now())
);

create table if not exists public.orders (
  id text primary key default ('ORD-' || to_char(timezone('Asia/Shanghai', now()), 'YYYYMMDD') || '-' || upper(substr(gen_random_uuid()::text, 1, 8))),
  customer_name text not null,
  phone text not null,
  social_handle text,
  address text not null,
  note text,
  latitude double precision,
  longitude double precision,
  location_accuracy double precision,
  geo_country text,
  geo_city text,
  geo_street text,
  source text not null check (source in ('telegram', 'instagram', 'web')),
  language text not null default 'en' check (language in ('zh', 'en', 'ru')),
  telegram_user jsonb,
  total numeric(12, 2) not null default 0 check (total >= 0),
  status text not null default 'new' check (status in ('new', 'contacted', 'fulfilled', 'cancelled')),
  created_at timestamp without time zone not null default timezone('Asia/Shanghai', now()),
  updated_at timestamp without time zone not null default timezone('Asia/Shanghai', now())
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id text not null references public.orders(id) on delete cascade,
  product_id text references public.products(id) on delete set null,
  product_name text not null,
  language text not null check (language in ('zh', 'en', 'ru')),
  price numeric(12, 2) not null check (price >= 0),
  image text,
  specs jsonb not null default '[]'::jsonb,
  quantity integer not null check (quantity > 0),
  subtotal numeric(12, 2) not null check (subtotal >= 0),
  created_at timestamp without time zone not null default timezone('Asia/Shanghai', now())
);

create table if not exists public.admin_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null default '',
  role text not null default 'admin' check (role in ('admin')),
  is_active boolean not null default true,
  created_at timestamp without time zone not null default timezone('Asia/Shanghai', now()),
  updated_at timestamp without time zone not null default timezone('Asia/Shanghai', now())
);

create index if not exists categories_active_sort_idx on public.categories (is_active, sort_order);
create index if not exists products_active_sort_idx on public.products (is_active, sort_order);
create index if not exists products_category_idx on public.products (category_id);
create index if not exists orders_status_created_idx on public.orders (status, created_at desc);
create index if not exists orders_source_created_idx on public.orders (source, created_at desc);
create index if not exists order_items_order_id_idx on public.order_items (order_id);
create index if not exists admin_profiles_user_id_idx on public.admin_profiles (user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('Asia/Shanghai', now());
  return new;
end;
$$;

drop trigger if exists set_categories_updated_at on public.categories;
create trigger set_categories_updated_at
before update on public.categories
for each row execute function public.set_updated_at();

drop trigger if exists set_products_updated_at on public.products;
create trigger set_products_updated_at
before update on public.products
for each row execute function public.set_updated_at();

drop trigger if exists set_orders_updated_at on public.orders;
create trigger set_orders_updated_at
before update on public.orders
for each row execute function public.set_updated_at();

drop trigger if exists set_admin_profiles_updated_at on public.admin_profiles;
create trigger set_admin_profiles_updated_at
before update on public.admin_profiles
for each row execute function public.set_updated_at();
