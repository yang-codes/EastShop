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

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('Asia/Shanghai', now());
  return new;
end;
$$;
