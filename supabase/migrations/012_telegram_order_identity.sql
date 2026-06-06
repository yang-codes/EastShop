-- Persist verified Telegram user IDs for Mini App order lookup.

alter table public.orders
  add column if not exists telegram_user_id text;

update public.orders
set telegram_user_id = telegram_user #>> '{user,id}'
where telegram_user_id is null
  and telegram_user #>> '{user,id}' is not null;

create index if not exists orders_telegram_user_id_idx
  on public.orders (telegram_user_id)
  where telegram_user_id is not null;

notify pgrst, 'reload schema';
