-- Add multi-cover support while keeping cover_image as the primary thumbnail.

alter table public.products
  add column if not exists cover_images jsonb not null default '[]'::jsonb;

update public.products
set cover_images = jsonb_build_array(cover_image)
where cover_image is not null
  and cover_image <> ''
  and jsonb_array_length(cover_images) = 0;

notify pgrst, 'reload schema';
