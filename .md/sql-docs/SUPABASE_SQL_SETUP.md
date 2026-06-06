# EastShop Supabase SQL 操作文档

本文档用于在 Supabase SQL Editor 中手动执行，完成 EastShop 第一版所需的数据库表、索引、RLS 策略和管理员授权。

执行位置：

```text
Supabase Dashboard -> SQL Editor -> New query
```

建议按顺序执行：

1. 执行“建表 SQL”
2. 执行“RLS 策略 SQL”
3. 在 Supabase Auth 手动创建管理员用户
4. 执行“管理员授权 SQL”
5. 执行“检查 SQL”

注意：

- 不要把 `service_role` key、Telegram Bot Token、腾讯云 SecretKey、Geoapify key、飞书 webhook 或飞书签名密钥提交到 GitHub。
- `orders` 和 `order_items` 不给普通前端直接 insert 权限，正式下单必须通过 `submit-order` Edge Function。
- 如果重复执行策略创建语句，可能出现 policy 已存在错误。可先执行本文的清理语句，或手动删除旧 policy。
- 本文所有业务时间字段使用北京时间本地时间：`timestamp without time zone default timezone('Asia/Shanghai', now())`。

## 1. 建表 SQL

```sql
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
  cover_image text,
  cover_images jsonb not null default '[]'::jsonb,
  images jsonb not null default '[]'::jsonb,
  specs jsonb not null default '[]'::jsonb,
  variants jsonb not null default '[]'::jsonb,
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
  telegram_user_id text,
  total numeric(12, 2) not null default 0 check (total >= 0),
  status text not null default 'new' check (status in ('new', 'contacted', 'fulfilled', 'cancelled')),
  created_at timestamp without time zone not null default timezone('Asia/Shanghai', now()),
  updated_at timestamp without time zone not null default timezone('Asia/Shanghai', now())
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id text not null references public.orders(id) on delete cascade,
  product_id text references public.products(id) on delete set null,
  variant_id text,
  variant_name text,
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

create table if not exists public.notification_settings (
  id text primary key default 'default',
  feishu_enabled boolean not null default false,
  feishu_webhook text not null default '',
  feishu_secret text,
  created_at timestamp without time zone not null default timezone('Asia/Shanghai', now()),
  updated_at timestamp without time zone not null default timezone('Asia/Shanghai', now()),
  constraint notification_settings_singleton check (id = 'default')
);

create index if not exists categories_active_sort_idx on public.categories (is_active, sort_order);
create index if not exists products_active_sort_idx on public.products (is_active, sort_order);
create index if not exists products_category_idx on public.products (category_id);
create index if not exists orders_status_created_idx on public.orders (status, created_at desc);
create index if not exists orders_source_created_idx on public.orders (source, created_at desc);
create index if not exists orders_telegram_user_id_idx on public.orders (telegram_user_id) where telegram_user_id is not null;
create index if not exists order_items_order_id_idx on public.order_items (order_id);
create index if not exists admin_profiles_user_id_idx on public.admin_profiles (user_id);
```

## 2. updated_at 自动更新时间

```sql
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

drop trigger if exists set_notification_settings_updated_at on public.notification_settings;
create trigger set_notification_settings_updated_at
before update on public.notification_settings
for each row execute function public.set_updated_at();
```

## 2.1 如果旧表已经创建，改成北京时间字段

如果你已经执行过旧版本 SQL，表里的时间字段可能是 `timestamptz default now()`。可以执行下面 SQL，把时间字段改为北京时间本地时间。

注意：这会把已有时间值按北京时间重新写入 `timestamp without time zone`。如果你已经有正式订单数据，执行前建议先备份。

```sql
alter table public.categories
  alter column created_at type timestamp without time zone using created_at at time zone 'Asia/Shanghai',
  alter column created_at set default timezone('Asia/Shanghai', now()),
  alter column updated_at type timestamp without time zone using updated_at at time zone 'Asia/Shanghai',
  alter column updated_at set default timezone('Asia/Shanghai', now());

alter table public.products
  alter column created_at type timestamp without time zone using created_at at time zone 'Asia/Shanghai',
  alter column created_at set default timezone('Asia/Shanghai', now()),
  alter column updated_at type timestamp without time zone using updated_at at time zone 'Asia/Shanghai',
  alter column updated_at set default timezone('Asia/Shanghai', now());

alter table public.orders
  alter column created_at type timestamp without time zone using created_at at time zone 'Asia/Shanghai',
  alter column created_at set default timezone('Asia/Shanghai', now()),
  alter column updated_at type timestamp without time zone using updated_at at time zone 'Asia/Shanghai',
  alter column updated_at set default timezone('Asia/Shanghai', now());

alter table public.order_items
  alter column created_at type timestamp without time zone using created_at at time zone 'Asia/Shanghai',
  alter column created_at set default timezone('Asia/Shanghai', now());

alter table public.admin_profiles
  alter column created_at type timestamp without time zone using created_at at time zone 'Asia/Shanghai',
  alter column created_at set default timezone('Asia/Shanghai', now()),
  alter column updated_at type timestamp without time zone using updated_at at time zone 'Asia/Shanghai',
  alter column updated_at set default timezone('Asia/Shanghai', now());

alter table public.notification_settings
  alter column created_at type timestamp without time zone using created_at at time zone 'Asia/Shanghai',
  alter column created_at set default timezone('Asia/Shanghai', now()),
  alter column updated_at type timestamp without time zone using updated_at at time zone 'Asia/Shanghai',
  alter column updated_at set default timezone('Asia/Shanghai', now());

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('Asia/Shanghai', now());
  return new;
end;
$$;
```

## 3. 启用 RLS

```sql
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.admin_profiles enable row level security;
alter table public.notification_settings enable row level security;
```

## 4. 管理员判断函数

这个函数用于 RLS 判断当前登录用户是否是启用的管理员。

```sql
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
```

## 4.1 表访问权限

RLS 负责判断“哪些行可以访问”，但表本身还需要授予基础访问权限。否则前端通过 Supabase REST 查询时，可能在命中 RLS 策略前直接返回 `403 Forbidden`。

```sql
grant usage on schema public to anon, authenticated;

grant select on public.categories to anon, authenticated;
grant select on public.products to anon, authenticated;
grant select on public.admin_profiles to authenticated;
grant select, insert, update on public.notification_settings to authenticated;

grant select, insert, update, delete on public.categories to authenticated;
grant select, insert, update, delete on public.products to authenticated;
grant select, update on public.orders to authenticated;
grant select on public.order_items to authenticated;

-- Edge Functions 使用 service_role key 执行服务端校验、订单写入和后台权限校验。
grant select on public.products to service_role;
grant select on public.admin_profiles to service_role;
grant select, insert, delete on public.orders to service_role;
grant select, insert on public.order_items to service_role;
grant select on public.notification_settings to service_role;
```

## 5. 如需重建策略，先清理旧策略

首次执行可以跳过本段。如果你已经创建过同名 policy，再执行下面语句清理。

```sql
drop policy if exists "public read active categories" on public.categories;
drop policy if exists "admins manage categories" on public.categories;

drop policy if exists "public read active products" on public.products;
drop policy if exists "admins manage products" on public.products;

drop policy if exists "admins read orders" on public.orders;
drop policy if exists "admins update orders" on public.orders;

drop policy if exists "admins read order items" on public.order_items;

drop policy if exists "users read own admin profile" on public.admin_profiles;
drop policy if exists "admins read admin profiles" on public.admin_profiles;
drop policy if exists "admins read notification settings" on public.notification_settings;
drop policy if exists "admins write notification settings" on public.notification_settings;
```

## 6. RLS 策略 SQL

### categories

```sql
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
```

### products

```sql
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
```

### orders

前端不直接插入订单。订单创建应由 `submit-order` Edge Function 使用服务端权限完成。

```sql
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
```

### order_items

```sql
create policy "admins read order items"
on public.order_items
for select
to authenticated
using (public.is_admin());
```

### admin_profiles

```sql
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
```

### notification_settings

```sql
create policy "admins read notification settings"
on public.notification_settings
for select
to authenticated
using (public.is_admin());

create policy "admins write notification settings"
on public.notification_settings
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

insert into public.notification_settings (id, feishu_enabled, feishu_webhook, feishu_secret)
values ('default', false, '', null)
on conflict (id) do nothing;
```

## 7. 创建管理员账号

先在 Supabase Dashboard 创建 Auth 用户：

```text
Authentication -> Users -> Add user
```

创建后复制该用户的 UUID，然后执行：

```sql
insert into public.admin_profiles (
  user_id,
  email,
  display_name,
  role,
  is_active
)
values (
  '替换成 Supabase Auth 用户 UUID',
  'admin@example.com',
  '管理员',
  'admin',
  true
)
on conflict (user_id) do update
set
  email = excluded.email,
  display_name = excluded.display_name,
  role = excluded.role,
  is_active = excluded.is_active,
  updated_at = timezone('Asia/Shanghai', now());
```

## 8. 插入测试分类和商品

可选。如果你还没导入真实商品，可以先执行下面数据，用来测试前台和后台。

项目已提供完整测试数据文件：

```text
supabase/seed.sql
```

该文件包含：

- 3 个分类：工业地面、安全装备、仓储工具。
- 10 条商品测试数据。
- 商品三语名称、简介、详情、规格、标签、价格、排序、推荐状态和上下架状态。
- `on conflict` 更新逻辑，可重复执行。

如果你只想快速验证，可以直接复制 `supabase/seed.sql` 全部内容到 Supabase SQL Editor 执行。

执行后检查：

```sql
select count(*) as category_count from public.categories;
select count(*) as product_count from public.products;
select id, name_zh, variants, is_featured, is_active, sort_order
from public.products
order by sort_order;
```

下面保留一条最小示例，完整数据以 `supabase/seed.sql` 为准。

```sql
insert into public.categories (id, name_zh, name_en, name_ru, sort_order, is_active)
values
  ('11111111-1111-4111-8111-111111111111', '工业地面', 'Industrial flooring', 'Промышленные полы', 1, true),
  ('22222222-2222-4222-8222-222222222222', '安全装备', 'Safety equipment', 'Средства защиты', 2, true),
  ('33333333-3333-4333-8333-333333333333', '仓储工具', 'Warehouse tools', 'Складские инструменты', 3, true)
on conflict (id) do update
set
  name_zh = excluded.name_zh,
  name_en = excluded.name_en,
  name_ru = excluded.name_ru,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active,
  updated_at = timezone('Asia/Shanghai', now());

insert into public.products (
  id,
  category_id,
  name_zh,
  name_en,
  name_ru,
  description_zh,
  description_en,
  description_ru,
  detail_zh,
  detail_en,
  detail_ru,
  variants,
  cover_image,
  images,
  specs,
  tags,
  sort_order,
  is_featured,
  is_active
)
values (
  'esd-floor-tile-600',
  '11111111-1111-4111-8111-111111111111',
  'PVC 防静电地板 600x600',
  'PVC ESD Floor Tile 600x600',
  'ПВХ антистатическая плитка 600x600',
  '适合电子厂、机房和洁净车间的耐磨防静电地面材料。',
  'Durable anti-static flooring for electronics plants, server rooms, and clean workshops.',
  'Износостойкое антистатическое покрытие для электроники, серверных и чистых помещений.',
  '高密度 PVC 材质，表面易清洁，支持批量铺装。建议配合导电胶和接地系统使用。',
  'High-density PVC with an easy-clean surface. Recommended with conductive adhesive and grounding.',
  'Плотный ПВХ с поверхностью, простой в уборке. Рекомендуется монтаж с токопроводящим клеем и заземлением.',
  12.80,
  '/mock/images/esd-floor-tile.svg',
  '["/mock/images/esd-floor-tile.svg"]'::jsonb,
  '[]'::jsonb,
  '["ESD", "PVC", "flooring"]'::jsonb,
  1,
  true,
  true
)
on conflict (id) do update
set
  category_id = excluded.category_id,
  name_zh = excluded.name_zh,
  name_en = excluded.name_en,
  name_ru = excluded.name_ru,
  description_zh = excluded.description_zh,
  description_en = excluded.description_en,
  description_ru = excluded.description_ru,
  detail_zh = excluded.detail_zh,
  detail_en = excluded.detail_en,
  detail_ru = excluded.detail_ru,
  variants = excluded.variants,
  cover_image = excluded.cover_image,
  images = excluded.images,
  specs = excluded.specs,
  tags = excluded.tags,
  sort_order = excluded.sort_order,
  is_featured = excluded.is_featured,
  is_active = excluded.is_active,
  updated_at = timezone('Asia/Shanghai', now());
```

## 9. 检查 SQL

检查 RLS 是否启用：

```sql
select
  schemaname,
  tablename,
  rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('categories', 'products', 'orders', 'order_items', 'admin_profiles', 'notification_settings');
```

检查 policy 是否存在：

```sql
select
  schemaname,
  tablename,
  policyname,
  cmd,
  roles
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
```

检查管理员授权：

```sql
select
  user_id,
  email,
  display_name,
  role,
  is_active
from public.admin_profiles;
```

检查商品和分类：

```sql
select id, name_zh, is_active, sort_order from public.categories order by sort_order;
select id, name_zh, variants, is_featured, is_active, sort_order from public.products order by sort_order;
```

## 10. 前端环境变量

项目根目录 `.env.local` 需要配置：

```env
VITE_SUPABASE_URL=https://你的项目ref.supabase.co
VITE_SUPABASE_ANON_KEY=你的 Supabase anon key
```

不要把 `.env.local` 提交到 GitHub。

地址反查使用 Supabase Edge Function 代理 Geoapify，Geoapify key 不放在前端环境变量中。部署时执行：

```powershell
supabase secrets set GEOAPIFY_API_KEY=你的 Geoapify API key
supabase functions deploy reverse-geocode --no-verify-jwt
```

## 11. 商品图片 Storage bucket

商品图片 bucket 名称：`product-images`。

执行版本化 SQL：

```sql
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'product-images',
  'product-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "public read product images" on storage.objects;
drop policy if exists "admins upload product images" on storage.objects;
drop policy if exists "admins update product images" on storage.objects;
drop policy if exists "admins delete product images" on storage.objects;

create policy "public read product images"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'product-images');

create policy "admins upload product images"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'product-images'
  and public.is_admin()
);

create policy "admins update product images"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'product-images'
  and public.is_admin()
)
with check (
  bucket_id = 'product-images'
  and public.is_admin()
);

create policy "admins delete product images"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'product-images'
  and public.is_admin()
);
```

校验 bucket：

```sql
select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets
where id = 'product-images';
```

校验 Storage policy：

```sql
select policyname, cmd, roles
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
  and policyname like '%product images%'
order by policyname;
```

当前策略含义：

- `anon` 和 `authenticated` 可以读取商品图片。
- 已授权管理员可以上传、更新、删除商品图片。
- 单文件大小限制为 5 MB。
- 允许格式：JPEG、PNG、WebP、GIF。

## 12. 后续还要补的后端内容

- 部署并验证 `submit-order` Edge Function，并在 Supabase secrets 配置 `TELEGRAM_BOT_TOKEN`；可选配置 `TELEGRAM_INIT_DATA_MAX_AGE_SECONDS`，默认 86400 秒
- 部署并验证 `reverse-geocode` Edge Function，并在 Supabase secrets 配置 `GEOAPIFY_API_KEY`
- 部署并验证 `translate-text` Edge Function，并在 Supabase secrets 配置 `TENCENTCLOUD_SECRET_ID`、`TENCENTCLOUD_SECRET_KEY` 和 `TENCENT_TRANSLATE_REGION`
- 执行并验证 `007_notification_settings.sql`
- 执行并验证 `008_product_variants.sql`
- 执行并验证 `009_store_settings.sql`，用于后台店铺配置和前台手机号前缀下拉选项
- 执行并验证 `011_social_platform_settings.sql`，用于后台配置社媒平台来源下拉选项，并在订单中保存 `social_platform`
- 执行并验证 `012_telegram_order_identity.sql`，用于保存和回填 `orders.telegram_user_id`，支持 Telegram Mini App “我的订单”按验签身份自动查询
- 执行并验证 `013_order_duplicate_guard.sql`，用于保存 `orders.cart_fingerprint`，并用数据库触发器阻止同手机号、来源、金额、商品/规格/数量指纹在 5 分钟内重复下单
- 使用 Telegram Mini App 真机或 Telegram WebApp 环境验证 `initData` 验签通过，普通 Web 伪造 `source=telegram` 时应返回 `INVALID_TELEGRAM_INIT_DATA`

### 12.1 订单重复提交防护

`submit-order` 已增加下单安全防护：隐藏 honeypot、IP 级限流、手机号级限流，以及 5 分钟重复订单检测。重复订单按手机号、来源、金额和商品/规格/数量指纹判断。

为了避免 Edge Function 多实例、并发提交或前置查询漏判，还需要执行数据库迁移：

```sql
-- 在 Supabase SQL Editor 执行：
-- supabase/migrations/013_order_duplicate_guard.sql
```

该迁移会新增 `orders.cart_fingerprint`，创建索引和 `prevent_recent_duplicate_order` 触发器，在数据库插入层阻止 5 分钟内重复订单。重复提交时，`submit-order` 应返回 `409 DUPLICATE_ORDER`。

执行迁移后，还需要重新部署函数：

```bash
supabase functions deploy submit-order --no-verify-jwt
```

如果只更新前端，或只执行 SQL 但未部署新版 `submit-order`，重复订单保护可能不会完整生效。

## 13. 常见错误：invalid input syntax for type uuid

如果插入分类时报错：

```text
ERROR: 22P02: invalid input syntax for type uuid: "industrial-flooring"
```

说明你插入了字符串分类 ID，但当前项目已改为 `categories.id uuid`。

分类 ID 必须使用 UUID，例如：

```text
11111111-1111-4111-8111-111111111111
22222222-2222-4222-8222-222222222222
33333333-3333-4333-8333-333333333333
```

当前字段要求：

```sql
categories.id uuid
products.category_id uuid
products.id text
orders.id text
order_items.order_id text
order_items.product_id text
```

先检查当前字段类型：

```sql
select
  table_name,
  column_name,
  data_type
from information_schema.columns
where table_schema = 'public'
  and table_name in ('categories', 'products', 'orders', 'order_items')
  and column_name in ('id', 'category_id', 'order_id', 'product_id')
order by table_name, ordinal_position;
```

如果你刚开始配置，还没有正式数据，最简单的修复方式是删除旧表后重新执行本文“建表 SQL”：

```sql
drop table if exists public.order_items cascade;
drop table if exists public.orders cascade;
drop table if exists public.notification_settings cascade;
drop table if exists public.products cascade;
drop table if exists public.categories cascade;
drop table if exists public.admin_profiles cascade;
drop function if exists public.is_admin() cascade;
drop function if exists public.set_updated_at() cascade;
```

然后重新从第 1 节开始执行：

1. 建表 SQL
2. updated_at 自动更新时间
3. 启用 RLS
4. 管理员判断函数
5. RLS 策略 SQL
6. 管理员授权 SQL

如果你已经有正式数据，不要直接 drop 表。需要先备份数据，再设计字段迁移。

## 13. 常见错误：登录后查询 admin_profiles 返回 403

如果管理员登录页控制台出现类似错误：

```text
GET /rest/v1/admin_profiles?... 403 (Forbidden)
```

这说明 Supabase Auth 登录可能已经成功，但前端查询 `admin_profiles` 时被数据库权限或 RLS 拦截。

先执行第 4.1 节“表访问权限”，然后确认当前登录邮箱在 `auth.users` 和 `admin_profiles` 中都有记录。

查询 Auth 用户 UUID：

```sql
select id, email
from auth.users
where email = '582587966@qq.com';
```

把查到的 `id` 填入下面 SQL：

```sql
insert into public.admin_profiles (
  user_id,
  email,
  display_name,
  role,
  is_active
)
values (
  '替换成上一步查到的 auth.users.id',
  '582587966@qq.com',
  '管理员',
  'admin',
  true
)
on conflict (user_id) do update
set
  email = excluded.email,
  display_name = excluded.display_name,
  role = excluded.role,
  is_active = true,
  updated_at = timezone('Asia/Shanghai', now());
```

确认管理员资料：

```sql
select
  user_id,
  email,
  display_name,
  role,
  is_active
from public.admin_profiles
where email = '582587966@qq.com';
```

如果仍然 403，重新执行第 3、4、4.1、5、6 节，确保 RLS、函数、表权限和策略都存在。
