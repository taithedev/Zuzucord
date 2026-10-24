-- Extend existing member-protected tables without changing membership or message policies.
alter table public.zuzucord_servers add column if not exists icon_url text not null default '';
alter table public.zuzucord_server_channels add column if not exists category text not null default 'Text channels';

create or replace function public.zuzucord_owner_accounts(p_search text default '', p_page integer default 0)
returns table(user_id uuid,username text,created_at timestamptz,roles text[])
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.zuzucord_has_role('owner') then
  raise exception 'Owner authorization required' using errcode='42501';
 end if;
 return query select a.user_id,a.username,a.created_at,
  array(select r.role from public.zuzucord_user_roles r where r.user_id=a.user_id order by r.role)
 from public.zuzucord_accounts a
 where strpos(lower(a.username),lower(left(coalesce(p_search,''),48)))>0
 order by a.created_at desc,a.user_id limit 50 offset greatest(0,least(coalesce(p_page,0),100000))*50;
end;$$;
revoke all on function public.zuzucord_owner_accounts(text,integer) from public,anon;
grant execute on function public.zuzucord_owner_accounts(text,integer) to authenticated;
-- Owner may observe account insertions for the live directory. No auth.users access is granted.
create policy zuzucord_accounts_owner_read on public.zuzucord_accounts for select to authenticated
 using ((select public.zuzucord_has_role('owner')));

create or replace function public.zuzucord_update_server(p_server uuid,p_name text,p_description text,p_icon text,p_accent text,p_gradient text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.zuzucord_my_account_active() or not exists(
  select 1 from public.zuzucord_servers s where s.id=p_server and s.owner_id=auth.uid()) then
  raise exception 'Server owner authorization required' using errcode='42501';
 end if;
 if length(trim(p_name)) not between 2 and 48 or length(p_description)>240 or
  length(p_icon)>40000 or (p_icon<>'' and p_icon !~ '^data:image/webp;base64,[A-Za-z0-9+/=]+$') or
  p_accent !~ '^#[0-9a-fA-F]{6}$' or p_gradient !~ '^#[0-9a-fA-F]{6}$' or
  p_name is null or p_description is null or p_icon is null or p_accent is null or p_gradient is null then
  raise exception 'Invalid server name, icon or colors' using errcode='22023';
 end if;
 update public.zuzucord_servers set name=trim(p_name),description=p_description,icon_url=p_icon,
  accent_color=p_accent,gradient_color=p_gradient where id=p_server;
end;$$;
revoke all on function public.zuzucord_update_server(uuid,text,text,text,text,text) from public,anon;
grant execute on function public.zuzucord_update_server(uuid,text,text,text,text,text) to authenticated;

create or replace function public.zuzucord_update_channel(p_channel uuid,p_name text,p_description text,p_category text,p_position integer)
returns void language plpgsql security definer set search_path='' as $$
declare v_server uuid;
begin
 select c.server_id into v_server from public.zuzucord_server_channels c where c.id=p_channel;
 if auth.uid() is null or not coalesce(public.zuzucord_can_server_action(v_server,'manage_channels'),false) then
  raise exception 'Channel management authorization required' using errcode='42501';
 end if;
 if p_name is null or p_name !~ '^[a-z0-9][a-z0-9_-]{0,47}$' or
  p_description is null or length(p_description)>240 or p_category is null or
  length(trim(p_category)) not between 1 and 48 or p_position is null or p_position not between 0 and 999 then
  raise exception 'Invalid channel name, topic, category or position' using errcode='22023';
 end if;
 update public.zuzucord_server_channels set name=p_name,description=p_description,category=trim(p_category),position=p_position where id=p_channel;
end;$$;
revoke all on function public.zuzucord_update_channel(uuid,text,text,text,integer) from public,anon;
grant execute on function public.zuzucord_update_channel(uuid,text,text,text,integer) to authenticated;

-- Postgres Changes still authorizes every event using each table's existing RLS.
-- Never publish bot tokens, signup records, wallets or other unrelated applications.
do $$ declare t text; begin
 foreach t in array array['zuzucord_accounts','zuzucord_servers','zuzucord_server_channels',
  'zuzucord_server_members','zuzucord_server_messages','zuzucord_messages','zuzucord_rooms',
  'zuzucord_direct_messages','zuzucord_friend_requests','zuzucord_friend_presence',
  'zuzucord_server_roles','zuzucord_member_custom_roles','zuzucord_user_roles',
  'zuzucord_beta_sync','zuzucord_feature_rules','zuzucord_official_announcements',
  'zuzucord_social_posts','zuzucord_social_comments','zuzucord_social_likes','zuzucord_social_reposts',
  'zuzucord_social_follows','zuzucord_social_hidden_creators','zuzucord_social_bookmarks'] loop
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
   execute format('alter publication supabase_realtime add table public.%I',t);
  end if;
 end loop;
end $$;
