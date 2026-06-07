-- Add Uzbek text fields for storefront product and category localization.

alter table public.categories
  add column if not exists name_uz text not null default '';

alter table public.products
  add column if not exists name_uz text not null default '',
  add column if not exists description_uz text not null default '',
  add column if not exists detail_uz text not null default '';

update public.categories
set name_uz = name_zh
where name_uz = '';

update public.products
set
  name_uz = name_zh,
  description_uz = description_zh,
  detail_uz = detail_zh
where name_uz = ''
  or description_uz = ''
  or detail_uz = '';
