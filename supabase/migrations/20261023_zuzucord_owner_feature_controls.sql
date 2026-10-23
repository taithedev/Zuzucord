-- Owner-managed, per-feature feature flags. User override takes precedence over global value.
create table if not exists public.zuzucord_feature_rules(
 feature text not null check (feature in ('attachments','direct_messages','friend_requests','server_messages','social_posts')),
 target_user uuid references auth.users(id) on delete cascade,
 enabled boolean not null,
 updated_by uuid references auth.users(id) on delete set null,
 updated_at timestamptz not null default now(),
 unique nulls not distinct(feature,target_user)
);
alter table public.zuzucord_feature_rules enable row level security;
revoke all on public.zuzucord_feature_rules from public,anon,authenticated;
grant select on public.zuzucord_feature_rules to authenticated;
drop policy if exists zuzucord_owner_feature_rules_read on public.zuzucord_feature_rules;
create policy zuzucord_owner_feature_rules_read on public.zuzucord_feature_rules
 for select to authenticated using ((select public.zuzucord_has_role('owner')));

create or replace function public.zuzucord_feature_allowed(p_feature text)
returns boolean language sql stable security definer set search_path='' as $$
 select (select auth.uid()) is not null and coalesce(
 (select r.enabled from public.zuzucord_feature_rules r
  where r.feature=p_feature and r.target_user=(select auth.uid())),
 (select r.enabled from public.zuzucord_feature_rules r
  where r.feature=p_feature and r.target_user is null),true);
$$;
revoke all on function public.zuzucord_feature_allowed(text) from public,anon;
grant execute on function public.zuzucord_feature_allowed(text) to authenticated;

create or replace function public.zuzucord_set_feature_rule(
 p_feature text,p_target uuid,p_enabled boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
 if (select auth.uid()) is null or not (select public.zuzucord_has_role('owner'))
 then raise exception 'Platform Owner access required' using errcode='42501'; end if;
 if p_feature not in ('attachments','direct_messages','friend_requests','server_messages','social_posts')
 then raise exception 'Unknown feature' using errcode='22023';end if;
 if p_enabled is null then
  delete from public.zuzucord_feature_rules
   where feature=p_feature and target_user is not distinct from p_target;
 else
  insert into public.zuzucord_feature_rules(feature,target_user,enabled,updated_by)
  values(p_feature,p_target,p_enabled,(select auth.uid()))
  on conflict (feature,target_user) do update
    set enabled=excluded.enabled,updated_by=excluded.updated_by,updated_at=now();
 end if;
end;$$;
revoke all on function public.zuzucord_set_feature_rule(text,uuid,boolean) from public,anon;
grant execute on function public.zuzucord_set_feature_rule(text,uuid,boolean) to authenticated;

create or replace function public.zuzucord_check_feature_write()
returns trigger language plpgsql security invoker set search_path='' as $$
declare selected_feature text;
begin
 if (select auth.uid()) is null then return new; end if;
 selected_feature:=case tg_table_name
  when 'zuzucord_friend_requests' then 'friend_requests'
  when 'zuzucord_direct_messages' then 'direct_messages'
  when 'zuzucord_server_messages' then 'server_messages'
  when 'zuzucord_social_posts' then 'social_posts'
  else null end;
 if selected_feature is not null
    and not (select public.zuzucord_feature_allowed(selected_feature))
 then raise exception 'This feature has been disabled by ZuzuCord staff' using errcode='42501';end if;
 if tg_table_name in ('zuzucord_direct_messages','zuzucord_server_messages')
    and new.attachment_path is not null
    and not (select public.zuzucord_feature_allowed('attachments'))
 then raise exception 'File attachments are currently disabled' using errcode='42501';end if;
 return new;
end;$$;
drop trigger if exists zuzucord_dm_feature_guard on public.zuzucord_direct_messages;
create trigger zuzucord_dm_feature_guard before insert on public.zuzucord_direct_messages
 for each row execute function public.zuzucord_check_feature_write();
drop trigger if exists zuzucord_server_feature_guard on public.zuzucord_server_messages;
create trigger zuzucord_server_feature_guard before insert on public.zuzucord_server_messages
 for each row execute function public.zuzucord_check_feature_write();
drop trigger if exists zuzucord_friend_feature_guard on public.zuzucord_friend_requests;
create trigger zuzucord_friend_feature_guard before insert on public.zuzucord_friend_requests
 for each row execute function public.zuzucord_check_feature_write();
drop trigger if exists zuzucord_social_feature_guard on public.zuzucord_social_posts;
create trigger zuzucord_social_feature_guard before insert on public.zuzucord_social_posts
 for each row execute function public.zuzucord_check_feature_write();
drop trigger if exists zuzucord_public_feature_guard on public.zuzucord_messages;
create trigger zuzucord_public_feature_guard before insert on public.zuzucord_messages
 for each row execute function public.zuzucord_check_feature_write();

-- Replace the upload policy with the same scope checks plus platform feature enforcement.
drop policy if exists zuzucord_message_files_write on storage.objects;
create policy zuzucord_message_files_write on storage.objects for insert to authenticated
with check (
 bucket_id='zuzucord-message-files'
 and (select public.zuzucord_feature_allowed('attachments'))
 and (storage.foldername(name))[3]=(select auth.uid())::text
 and (
  ((storage.foldername(name))[1]='server' and exists(
   select 1 from public.zuzucord_server_channels c
   where c.id::text=(storage.foldername(name))[2]
   and (select public.zuzucord_is_server_member(c.server_id))))
  or ((storage.foldername(name))[1]='public' and exists(
   select 1 from public.zuzucord_rooms r
   where r.id::text=(storage.foldername(name))[2] and r.is_public=true))
  or ((storage.foldername(name))[1]='dm'
   and (select public.zuzucord_are_friends(((storage.foldername(name))[2])::uuid)))
 )
);
