-- Add purchasable product variants with per-variant pricing.

alter table public.products
  add column if not exists variants jsonb not null default '[]'::jsonb;

alter table public.order_items
  add column if not exists variant_id text,
  add column if not exists variant_name text;

alter table public.products
  drop column if exists price;

notify pgrst, 'reload schema';
