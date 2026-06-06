-- Store the cart fingerprint on orders and block identical orders inside a 5-minute window.

alter table public.orders
  add column if not exists cart_fingerprint text;

create index if not exists orders_duplicate_guard_idx
  on public.orders (phone, source, total, cart_fingerprint, created_at desc)
  where cart_fingerprint is not null;

create or replace function public.prevent_recent_duplicate_order()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.cart_fingerprint is null or btrim(new.cart_fingerprint) = '' then
    return new;
  end if;

  if exists (
    select 1
    from public.orders existing
    where existing.phone = new.phone
      and existing.source = new.source
      and existing.total = new.total
      and existing.cart_fingerprint = new.cart_fingerprint
      and existing.created_at >= new.created_at - interval '5 minutes'
      and existing.created_at <= new.created_at
    limit 1
  ) then
    raise exception 'DUPLICATE_ORDER'
      using errcode = '23505',
            detail = 'A matching order was submitted recently.';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_recent_duplicate_order on public.orders;
create trigger prevent_recent_duplicate_order
before insert on public.orders
for each row execute function public.prevent_recent_duplicate_order();

grant execute on function public.prevent_recent_duplicate_order() to service_role;

notify pgrst, 'reload schema';
