-- Optional, user-controlled profile photo. Only a URL/reference lives in
-- Postgres — the image itself lives in Supabase Storage, not this table
-- (same "don't hoard blobs in the metadata DB" instinct as everything else
-- here, even though this isn't message content). Nullable and never
-- required: users with no avatar_url keep the existing initials/hue avatar
-- (see src/components/Avatar.tsx), same as before this migration.
alter table public.users add column if not exists avatar_url text;

-- 'avatars' bucket: public read (avatar images are already effectively
-- public — username/display_name/avatar_hue are public-for-discovery via
-- users_select_by_username_lookup above), writes restricted to the owning
-- user via a <user_id>/... path convention.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy avatars_public_read on storage.objects
  for select using (bucket_id = 'avatars');

create policy avatars_owner_insert on storage.objects
  for insert with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy avatars_owner_update on storage.objects
  for update using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy avatars_owner_delete on storage.objects
  for delete using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
