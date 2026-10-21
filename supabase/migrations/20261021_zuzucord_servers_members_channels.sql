-- ZuzuCord v0.5: user-created servers with RLS, membership, moderation.
-- This is the reproducible schema for the deployment that already received this migration.
-- Requires existing auth.users, zuzucord_accounts and zuzucord_my_account_active().

create table if not exists public.zuzucord_servers (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 name text not null check (char_length(name) between 2 and 48),
 description text not null default '' check (char_length(description)<=300),
 invite_code text not null unique default substr(replace(gen_random_uuid()::text,'-',''),1,16),
 created_at timestamptz not null default now()
);
create table if not exists public.zuzucord_server_members (
 server_id uuid not null references public.zuzucord_servers(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 role text not null default 'member' check (role in ('owner','admin','member')),
 joined_at timestamptz not null default now(),
 primary key(server_id,user_id)
);
create table if not exists public.zuzucord_server_channels (
 id uuid primary key default gen_random_uuid(),
 server_id uuid not null references public.zuzucord_servers(id) on delete cascade,
 name text not null check(name ~ '^[a-z0-9_-]{2,32}$'),
 description text not null default '' check(char_length(description)<=200),
 position integer not null default 0,
 created_at timestamptz not null default now(),
 unique(server_id,name)
);
create table if not exists public.zuzucord_server_messages (
 id uuid primary key default gen_random_uuid(),
 channel_id uuid not null references public.zuzucord_server_channels(id) on delete cascade,
 author_id uuid not null references auth.users(id) on delete cascade,
 content text not null check(char_length(content) between 1 and 2000),
 created_at timestamptz not null default now()
);
create index if not exists zuzucord_servers_owner_idx on public.zuzucord_servers(owner_id);
create index if not exists zuzucord_server_members_user_idx on public.zuzucord_server_members(user_id);
create index if not exists zuzucord_server_channels_server_idx on public.zuzucord_server_channels(server_id,position);
create index if not exists zuzucord_server_messages_channel_time_idx on public.zuzucord_server_messages(channel_id,created_at desc);
create index if not exists zuzucord_server_messages_author_idx on public.zuzucord_server_messages(author_id);
alter table public.zuzucord_servers enable row level security;
alter table public.zuzucord_server_members enable row level security;
alter table public.zuzucord_server_channels enable row level security;
alter table public.zuzucord_server_messages enable row level security;
revoke all on public.zuzucord_servers,public.zuzucord_server_members,
 public.zuzucord_server_channels,public.zuzucord_server_messages from anon,authenticated;
-- Members may see public server metadata but not the join code.
grant select(id,name,description,owner_id,created_at) on public.zuzucord_servers to authenticated;
grant select on public.zuzucord_server_members,public.zuzucord_server_channels,
 public.zuzucord_server_messages to authenticated;
grant insert on public.zuzucord_server_messages to authenticated;

create or replace function public.zuzucord_is_server_member(p_server uuid)
returns boolean language sql stable security definer set search_path=''
as $$
 select (select auth.uid()) is not null
 and (select public.zuzucord_my_account_active())
 and exists (select 1 from public.zuzucord_server_members m
             where m.server_id=p_server and m.user_id=(select auth.uid()));
$$;
revoke all on function public.zuzucord_is_server_member(uuid) from public,anon;
grant execute on function public.zuzucord_is_server_member(uuid) to authenticated;
drop policy if exists zuzucord_servers_members_read on public.zuzucord_servers;
create policy zuzucord_servers_members_read on public.zuzucord_servers for select to authenticated
 using ((select public.zuzucord_is_server_member(id)));
drop policy if exists zuzucord_server_members_self on public.zuzucord_server_members;
create policy zuzucord_server_members_self on public.zuzucord_server_members for select to authenticated
 using (user_id=(select auth.uid()) and (select public.zuzucord_my_account_active()));
drop policy if exists zuzucord_server_channels_members_read on public.zuzucord_server_channels;
create policy zuzucord_server_channels_members_read on public.zuzucord_server_channels for select to authenticated
 using ((select public.zuzucord_is_server_member(server_id)));
drop policy if exists zuzucord_server_messages_member_read on public.zuzucord_server_messages;
create policy zuzucord_server_messages_member_read on public.zuzucord_server_messages for select to authenticated
 using (exists (select 1 from public.zuzucord_server_channels c
 where c.id=channel_id and (select public.zuzucord_is_server_member(c.server_id))));
drop policy if exists zuzucord_server_messages_member_send on public.zuzucord_server_messages;
create policy zuzucord_server_messages_member_send on public.zuzucord_server_messages for insert to authenticated
 with check (author_id=(select auth.uid())
 and exists (select 1 from public.zuzucord_server_channels c where c.id=channel_id
 and (select public.zuzucord_is_server_member(c.server_id))));

create or replace function public.zuzucord_create_server(p_name text,p_description text default '')
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if (select auth.uid()) is null or not (select public.zuzucord_my_account_active())
 then raise exception 'Sign in to an active ZuzuCord account.' using errcode='P0001'; end if;
 p_name:=btrim(p_name); p_description:=btrim(coalesce(p_description,''));
 if char_length(p_name) not between 2 and 48 or char_length(p_description)>300
 then raise exception 'Server name must be 2–48 characters and description 300 maximum.' using errcode='22023'; end if;
 if not exists(select 1 from public.zuzucord_accounts where user_id=(select auth.uid()))
 then raise exception 'Finish ZuzuCord account setup.' using errcode='P0001'; end if;
 if (select count(*) from public.zuzucord_servers where owner_id=(select auth.uid()))>=10
 then raise exception 'Maximum 10 owned servers.' using errcode='P0001'; end if;
 insert into public.zuzucord_servers(owner_id,name,description)
 values((select auth.uid()),p_name,p_description) returning id into v_id;
 insert into public.zuzucord_server_members(server_id,user_id,role)
 values(v_id,(select auth.uid()),'owner');
 insert into public.zuzucord_server_channels(server_id,name,description)
 values(v_id,'general','General conversation');
 return v_id;
end; $$;
revoke all on function public.zuzucord_create_server(text,text) from public,anon;
grant execute on function public.zuzucord_create_server(text,text) to authenticated;

create or replace function public.zuzucord_join_server(p_invite text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if (select auth.uid()) is null or not (select public.zuzucord_my_account_active())
 then raise exception 'Sign in to an active ZuzuCord account.' using errcode='P0001'; end if;
 if p_invite !~ '^[a-f0-9]{16}$'
 then raise exception 'Invalid invite code.' using errcode='22023'; end if;
 select id into v_id from public.zuzucord_servers where invite_code=p_invite;
 if v_id is null then raise exception 'Invite not found.' using errcode='P0001'; end if;
 if not exists(select 1 from public.zuzucord_accounts where user_id=(select auth.uid()))
 then raise exception 'Finish account setup first.' using errcode='P0001'; end if;
 if (select count(*) from public.zuzucord_server_members where user_id=(select auth.uid()))>=100
 then raise exception 'Maximum 100 server memberships.' using errcode='P0001'; end if;
 insert into public.zuzucord_server_members(server_id,user_id,role)
 values(v_id,(select auth.uid()),'member') on conflict do nothing;
 return v_id;
end; $$;
revoke all on function public.zuzucord_join_server(text) from public,anon;
grant execute on function public.zuzucord_join_server(text) to authenticated;

create or replace function public.zuzucord_create_channel(p_server uuid,p_name text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if (select auth.uid()) is null or not (select public.zuzucord_my_account_active())
 then raise exception 'Active account required.' using errcode='P0001'; end if;
 if not exists(select 1 from public.zuzucord_server_members where server_id=p_server
 and user_id=(select auth.uid()) and role in ('owner','admin'))
 then raise exception 'Owners and admins only.' using errcode='42501'; end if;
 p_name:=lower(btrim(p_name));
 if p_name !~ '^[a-z0-9_-]{2,32}$'
 then raise exception 'Channel name must be 2-32 safe characters.' using errcode='22023'; end if;
 if (select count(*) from public.zuzucord_server_channels where server_id=p_server)>=30
 then raise exception 'Maximum 30 channels.' using errcode='P0001'; end if;
 insert into public.zuzucord_server_channels(server_id,name,position)
 values(p_server,p_name,(select coalesce(max(position),0)+1 from public.zuzucord_server_channels where server_id=p_server))
 returning id into v_id;
 return v_id;
end; $$;
revoke all on function public.zuzucord_create_channel(uuid,text) from public,anon;
grant execute on function public.zuzucord_create_channel(uuid,text) to authenticated;

create or replace function public.zuzucord_server_invite(p_server uuid)
returns text language sql stable security definer set search_path='' as $$
 select s.invite_code from public.zuzucord_servers s
 where s.id=p_server and s.owner_id=(select auth.uid())
 and (select public.zuzucord_my_account_active()) limit 1;
$$;
revoke all on function public.zuzucord_server_invite(uuid) from public,anon;
grant execute on function public.zuzucord_server_invite(uuid) to authenticated;

create or replace function public.zuzucord_list_server_members(p_server uuid)
returns table(user_id uuid,username text,role text,joined_at timestamptz)
language sql stable security definer set search_path='' as $$
 select m.user_id,coalesce(a.username,'member')::text,m.role,m.joined_at
 from public.zuzucord_server_members m
 left join public.zuzucord_accounts a on a.user_id=m.user_id
 where m.server_id=p_server and (select public.zuzucord_is_server_member(p_server))
 order by case m.role when 'owner' then 0 when 'admin' then 1 else 2 end,m.joined_at;
$$;
revoke all on function public.zuzucord_list_server_members(uuid) from public,anon;
grant execute on function public.zuzucord_list_server_members(uuid) to authenticated;

create or replace function public.zuzucord_change_member_role(p_server uuid,p_target uuid,p_role text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if p_role not in ('admin','member') then raise exception 'Choose admin/member.' using errcode='22023'; end if;
 if not (select public.zuzucord_my_account_active()) or not exists(
 select 1 from public.zuzucord_server_members where server_id=p_server
 and user_id=(select auth.uid()) and role='owner')
 then raise exception 'Owner only.' using errcode='42501'; end if;
 if p_target=(select auth.uid()) then raise exception 'Cannot change owner role.' using errcode='42501'; end if;
 update public.zuzucord_server_members set role=p_role
 where server_id=p_server and user_id=p_target and role<>'owner';
 if not found then raise exception 'Member not found.' using errcode='P0001'; end if;
end; $$;
revoke all on function public.zuzucord_change_member_role(uuid,uuid,text) from public,anon;
grant execute on function public.zuzucord_change_member_role(uuid,uuid,text) to authenticated;

create or replace function public.zuzucord_remove_server_member(p_server uuid,p_target uuid)
returns void language plpgsql security definer set search_path='' as $$
declare actor_role text; target_role text;
begin
 if (select auth.uid()) is null or not (select public.zuzucord_my_account_active())
 then raise exception 'Active account required.' using errcode='42501'; end if;
 select role into actor_role from public.zuzucord_server_members where server_id=p_server and user_id=(select auth.uid());
 select role into target_role from public.zuzucord_server_members where server_id=p_server and user_id=p_target;
 if target_role is null then raise exception 'Member not found.' using errcode='P0001'; end if;
 if target_role='owner' then raise exception 'Owner cannot be removed.' using errcode='42501'; end if;
 if p_target<>(select auth.uid()) and (actor_role is null or actor_role='member' or
 (actor_role='admin' and target_role='admin')) then raise exception 'Not authorized.' using errcode='42501'; end if;
 delete from public.zuzucord_server_members where server_id=p_server and user_id=p_target;
end; $$;
revoke all on function public.zuzucord_remove_server_member(uuid,uuid) from public,anon;
grant execute on function public.zuzucord_remove_server_member(uuid,uuid) to authenticated;
