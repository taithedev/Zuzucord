-- ZuzuCord chat attachments: private objects, channel-scoped reads, and one attachment per message.
-- Storage RLS allows uploads only to rooms/conversations the sender can access.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('zuzucord-message-files','zuzucord-message-files',false,10485760,
  array['image/png','image/jpeg','image/webp','image/gif','text/plain',
  'application/pdf','audio/mpeg','audio/ogg','video/mp4'])
on conflict (id) do nothing;

alter table public.zuzucord_messages
 add column if not exists attachment_path text,
 add column if not exists attachment_name text,
 add column if not exists attachment_type text,
 add column if not exists attachment_size integer;
alter table public.zuzucord_server_messages
 add column if not exists attachment_path text,
 add column if not exists attachment_name text,
 add column if not exists attachment_type text,
 add column if not exists attachment_size integer;
alter table public.zuzucord_direct_messages
 add column if not exists attachment_path text,
 add column if not exists attachment_name text,
 add column if not exists attachment_type text,
 add column if not exists attachment_size integer;

alter table public.zuzucord_messages
 add constraint zuzucord_public_file_scope check (attachment_path is null or
 (attachment_path like 'public/' || room_id::text || '/' || author_id::text || '/%'
 and char_length(attachment_name) between 1 and 180
 and attachment_size between 1 and 10485760
 and attachment_type in ('image/png','image/jpeg','image/webp','image/gif','text/plain',
                         'application/pdf','audio/mpeg','audio/ogg','video/mp4')));
alter table public.zuzucord_server_messages
 add constraint zuzucord_server_file_scope check (attachment_path is null or
 (attachment_path like 'server/' || channel_id::text || '/' || author_id::text || '/%'
 and char_length(attachment_name) between 1 and 180
 and attachment_size between 1 and 10485760
 and attachment_type in ('image/png','image/jpeg','image/webp','image/gif','text/plain',
                         'application/pdf','audio/mpeg','audio/ogg','video/mp4')));
alter table public.zuzucord_direct_messages
 add constraint zuzucord_dm_file_scope check (attachment_path is null or
 (attachment_path like 'dm/' || recipient_id::text || '/' || sender_id::text || '/%'
 and char_length(attachment_name) between 1 and 180
 and attachment_size between 1 and 10485760
 and attachment_type in ('image/png','image/jpeg','image/webp','image/gif','text/plain',
                         'application/pdf','audio/mpeg','audio/ogg','video/mp4')));

create index if not exists zuzucord_public_attachment_idx
 on public.zuzucord_messages(attachment_path) where attachment_path is not null;
create index if not exists zuzucord_server_attachment_idx
 on public.zuzucord_server_messages(attachment_path) where attachment_path is not null;
create index if not exists zuzucord_dm_attachment_idx
 on public.zuzucord_direct_messages(attachment_path) where attachment_path is not null;

drop policy if exists zuzucord_message_files_write on storage.objects;
create policy zuzucord_message_files_write on storage.objects for insert to authenticated
with check (
 bucket_id='zuzucord-message-files'
 and (select auth.uid()) is not null
 and (storage.foldername(name))[3]=(select auth.uid())::text
 and (
  ((storage.foldername(name))[1]='server' and exists (
    select 1 from public.zuzucord_server_channels c
    where c.id::text=(storage.foldername(name))[2]
      and (select public.zuzucord_is_server_member(c.server_id))))
  or ((storage.foldername(name))[1]='public' and exists (
    select 1 from public.zuzucord_rooms r
    where r.id::text=(storage.foldername(name))[2] and r.is_public=true))
  or ((storage.foldername(name))[1]='dm'
     and (select public.zuzucord_are_friends(((storage.foldername(name))[2])::uuid)))
 )
);
drop policy if exists zuzucord_message_files_read on storage.objects;
create policy zuzucord_message_files_read on storage.objects for select to authenticated
using (
 bucket_id='zuzucord-message-files' and (
  exists(select 1 from public.zuzucord_messages m where m.attachment_path=name)
  or exists(select 1 from public.zuzucord_server_messages m where m.attachment_path=name)
  or exists(select 1 from public.zuzucord_direct_messages m where m.attachment_path=name)
 )
);
drop policy if exists zuzucord_message_files_cleanup on storage.objects;
create policy zuzucord_message_files_cleanup on storage.objects for delete to authenticated
using (
 bucket_id='zuzucord-message-files'
 and (storage.foldername(name))[3]=(select auth.uid())::text
 and not exists(select 1 from public.zuzucord_messages m where m.attachment_path=name)
 and not exists(select 1 from public.zuzucord_server_messages m where m.attachment_path=name)
 and not exists(select 1 from public.zuzucord_direct_messages m where m.attachment_path=name)
);
