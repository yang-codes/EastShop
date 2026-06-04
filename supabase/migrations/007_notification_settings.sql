-- Notification settings for order alerts.
-- Webhooks and secrets are admin-only configuration values.

create table if not exists public.notification_settings (
  id text primary key default 'default',
  feishu_enabled boolean not null default false,
  feishu_webhook text not null default '',
  feishu_secret text,
  created_at timestamp without time zone not null default timezone('Asia/Shanghai', now()),
  updated_at timestamp without time zone not null default timezone('Asia/Shanghai', now()),
  constraint notification_settings_singleton check (id = 'default')
);

drop trigger if exists set_notification_settings_updated_at on public.notification_settings;
create trigger set_notification_settings_updated_at
before update on public.notification_settings
for each row execute function public.set_updated_at();

alter table public.notification_settings enable row level security;

grant select, insert, update on public.notification_settings to authenticated;
grant select on public.notification_settings to service_role;

drop policy if exists "admins read notification settings" on public.notification_settings;
drop policy if exists "admins write notification settings" on public.notification_settings;

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

notify pgrst, 'reload schema';
