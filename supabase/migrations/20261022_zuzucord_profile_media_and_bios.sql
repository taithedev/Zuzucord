-- Profile customization for Windows ZuzuCord, preserving all existing accounts.
alter table public.zuzucord_profiles
 add column if not exists banner_path text,
 add column if not exists bio text not null default '',
 add column if not exists pronouns text not null default '',
 add column if not exists profile_accent text not null default '#a978ff';
alter table public.zuzucord_profiles
 drop constraint if exists zuzucord_profile_banner_path_safe,
 drop constraint if exists zuzucord_profile_bio_safe,
 drop constraint if exists zuzucord_profile_pronouns_safe,
 drop constraint if exists zuzucord_profile_accent_safe;
alter table public.zuzucord_profiles
 add constraint zuzucord_profile_banner_path_safe check (banner_path is null or
 banner_path ~ '^[0-9a-f-]{36}/(banner|avatar)-[0-9a-f-]{36}[.](png|jpg|webp)$'),
 add constraint zuzucord_profile_bio_safe check (char_length(bio)<=450),
 add constraint zuzucord_profile_pronouns_safe check (char_length(pronouns)<=40),
 add constraint zuzucord_profile_accent_safe check (profile_accent ~ '^#[0-9a-fA-F]{6}$');
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values ('zuzucord-profile-media','zuzucord-profile-media',false,5242880,array['image/png','image/jpeg','image/webp'])
 on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists zuzucord_profile_media_upload on storage.objects;
create policy zuzucord_profile_media_upload on storage.objects for insert to authenticated
 with check(bucket_id='zuzucord-profile-media' and
 (storage.foldername(name))[1]=(select auth.uid())::text and (select public.zuzucord_my_account_active()));
drop policy if exists zuzucord_profile_media_read on storage.objects;
create policy zuzucord_profile_media_read on storage.objects for select to authenticated
 using(bucket_id='zuzucord-profile-media' and (select public.zuzucord_my_account_active())
 and ((storage.foldername(name))[1]=(select auth.uid())::text or
 exists(select 1 from public.zuzucord_profiles p where p.avatar_url=name or p.banner_path=name)));
drop policy if exists zuzucord_profile_media_delete on storage.objects;
create policy zuzucord_profile_media_delete on storage.objects for delete to authenticated
 using(bucket_id='zuzucord-profile-media' and (storage.foldername(name))[1]=(select auth.uid())::text);