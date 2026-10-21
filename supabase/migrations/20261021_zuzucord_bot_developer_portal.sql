
create table if not exists public.zuzucord_bot_apps (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 name text not null check(char_length(name) between 3 and 40),
 description text not null default '' check(char_length(description)<=240),
 created_at timestamptz not null default now(),
 disabled boolean not null default false
);
alter table public.zuzucord_bot_apps enable row level security;
revoke all on public.zuzucord_bot_apps from public,anon,authenticated;
grant select,insert,update on public.zuzucord_bot_apps to authenticated;
drop policy if exists zuzucord_bot_apps_read on public.zuzucord_bot_apps;
create policy zuzucord_bot_apps_read on public.zuzucord_bot_apps for select to authenticated
 using(not disabled or owner_id=(select auth.uid()));
drop policy if exists zuzucord_bot_apps_create on public.zuzucord_bot_apps;
create policy zuzucord_bot_apps_create on public.zuzucord_bot_apps for insert to authenticated
 with check(owner_id=(select auth.uid()) and disabled=false
 and (select public.zuzucord_has_role('developer')));
drop policy if exists zuzucord_bot_apps_edit on public.zuzucord_bot_apps;
create policy zuzucord_bot_apps_edit on public.zuzucord_bot_apps for update to authenticated
 using(owner_id=(select auth.uid()) and (select public.zuzucord_has_role('developer')))
 with check(owner_id=(select auth.uid()) and (select public.zuzucord_has_role('developer')));
-- The API token hash cannot be queried by a normal signed-in client.
create table if not exists public.zuzucord_bot_keys(
 id uuid primary key default gen_random_uuid(),
 bot_id uuid not null references public.zuzucord_bot_apps(id) on delete cascade,
 token_hash text not null unique check(token_hash ~ '^[0-9a-f]{64}$'),
 created_at timestamptz not null default now(),
 revoked_at timestamptz
);
alter table public.zuzucord_bot_keys enable row level security;
revoke all on public.zuzucord_bot_keys from public,anon,authenticated;
grant select,insert,update on public.zuzucord_bot_keys to service_role;
create index if not exists zuzucord_bot_keys_bot_idx on public.zuzucord_bot_keys(bot_id);
create table if not exists public.zuzucord_server_bot_installs(
 server_id uuid not null references public.zuzucord_servers(id) on delete cascade,
 bot_id uuid not null references public.zuzucord_bot_apps(id) on delete cascade,
 installed_at timestamptz not null default now(),
 primary key(server_id,bot_id)
);
alter table public.zuzucord_server_bot_installs enable row level security;
revoke all on public.zuzucord_server_bot_installs from public,anon,authenticated;
grant select on public.zuzucord_server_bot_installs to authenticated;
drop policy if exists zuzucord_bot_installs_visible on public.zuzucord_server_bot_installs;
create policy zuzucord_bot_installs_visible on public.zuzucord_server_bot_installs for select to authenticated
 using((select public.zuzucord_is_server_member(server_id)));
create or replace function public.zuzucord_install_bot(p_server uuid,p_bot uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.zuzucord_server_members where
 server_id=p_server and user_id=(select auth.uid()) and role='owner')
 then raise exception 'Only server owners can install bots' using errcode='42501'; end if;
 if not exists(select 1 from public.zuzucord_bot_apps where id=p_bot and not disabled)
 then raise exception 'Bot application unavailable' using errcode='P0001'; end if;
 insert into public.zuzucord_server_bot_installs(server_id,bot_id) values(p_server,p_bot)
 on conflict do nothing;
end;$$;
revoke all on function public.zuzucord_install_bot(uuid,uuid) from public,anon;
grant execute on function public.zuzucord_install_bot(uuid,uuid) to authenticated;

alter table public.zuzucord_server_messages
 add column if not exists external_bot_id uuid references public.zuzucord_bot_apps(id) on delete set null;
-- Ordinary members can only create untagged messages. Third-party bots use
-- a server-validated service-role endpoint.
drop policy if exists zuzucord_server_messages_member_send on public.zuzucord_server_messages;
create policy zuzucord_server_messages_member_send on public.zuzucord_server_messages
 for insert to authenticated with check(author_id=(select auth.uid())
 and bot_name is null and external_bot_id is null and
 exists(select 1 from public.zuzucord_server_channels c where c.id=channel_id and
 (select public.zuzucord_is_server_member(c.server_id))));
create table if not exists public.zuzucord_bot_message_limits (
 bot_id uuid primary key references public.zuzucord_bot_apps(id) on delete cascade,
 last_sent_at timestamptz,
 day_date date not null default (now() at time zone 'UTC')::date,
 day_count integer not null default 0
);
alter table public.zuzucord_bot_message_limits enable row level security;
revoke all on public.zuzucord_bot_message_limits from public,anon,authenticated;
create or replace function public.zuzucord_post_external_bot_message(p_bot uuid,p_channel uuid,p_content text)
returns uuid language plpgsql security definer set search_path='' as $$
declare server_id uuid;reply uuid;elapsed timestamptz;today date;
begin
 if current_user<>'service_role' then
 raise exception 'Server API only' using errcode='42501'; end if;
 if not exists(select 1 from public.zuzucord_bot_apps where id=p_bot and not disabled)
 then raise exception 'Bot unavailable' using errcode='P0001'; end if;
 select c.server_id into server_id from public.zuzucord_server_channels c where c.id=p_channel;
 if not exists(select 1 from public.zuzucord_server_bot_installs
 where bot_id=p_bot and zuzucord_server_bot_installs.server_id=server_id)
 then raise exception 'Bot not installed in this server' using errcode='42501'; end if;
 if char_length(btrim(coalesce(p_content,''))) not between 1 and 1500
 then raise exception 'Bot messages must contain 1-1500 characters' using errcode='22023'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_bot::text));
 today:=(now() at time zone 'UTC')::date;
 select last_sent_at into elapsed from public.zuzucord_bot_message_limits where bot_id=p_bot;
 if elapsed is not null and elapsed>now()-interval '3 seconds'
 then raise exception 'Bot rate limit: wait three seconds' using errcode='P0001'; end if;
 insert into public.zuzucord_bot_message_limits(bot_id,last_sent_at,day_date,day_count)
 values(p_bot,now(),today,1)
 on conflict(bot_id) do update set
 last_sent_at=now(), day_date=today,
 day_count=case when public.zuzucord_bot_message_limits.day_date=today
 then public.zuzucord_bot_message_limits.day_count+1 else 1 end;
 if (select day_count from public.zuzucord_bot_message_limits where bot_id=p_bot)>200
 then raise exception 'Daily bot message limit reached' using errcode='P0001'; end if;
 insert into public.zuzucord_server_messages(channel_id,author_id,content,external_bot_id)
 select p_channel,a.owner_id,btrim(p_content),p_bot from public.zuzucord_bot_apps a where a.id=p_bot
 returning id into reply;
 return reply;
end;$$;
revoke all on function public.zuzucord_post_external_bot_message(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.zuzucord_post_external_bot_message(uuid,uuid,text) to service_role;

create or replace function public.zuzucord_set_user_badge(p_target uuid,p_role text,p_enabled boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not (select public.zuzucord_has_role('developer')) then
 raise exception 'Developer authorization required' using errcode='42501'; end if;
 if p_role not in ('verified','beta_tester')
 then raise exception 'Only verified and beta_tester badges can be assigned here' using errcode='42501'; end if;
 if not exists(select 1 from public.zuzucord_accounts where user_id=p_target)
 then raise exception 'Unknown ZuzuCord account' using errcode='P0001';end if;
 if p_enabled then
 insert into public.zuzucord_user_roles(user_id,role) values(p_target,p_role)
 on conflict do nothing;
 else delete from public.zuzucord_user_roles where user_id=p_target and role=p_role;
 end if;
end;$$;
revoke all on function public.zuzucord_set_user_badge(uuid,text,boolean) from public,anon;
grant execute on function public.zuzucord_set_user_badge(uuid,text,boolean) to authenticated;
