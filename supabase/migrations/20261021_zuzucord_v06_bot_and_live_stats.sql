-- ZuzuCord v0.6: trusted, first-party server bot and live community counters.
-- Applied to the Zuzify Supabase project. All app tables are prefixed zuzucord_.
-- A ZuzuBot message retains the invoking member as author_id for an audit trail.
-- bot_name is displayed as ZuzuBot, and users cannot impersonate it under RLS.

alter table public.zuzucord_server_messages add column if not exists bot_name text;
alter table public.zuzucord_server_messages
  add constraint zuzucord_bot_name_valid check(bot_name is null or bot_name='ZuzuBot');

create table if not exists public.zuzucord_server_bots (
 server_id uuid primary key references public.zuzucord_servers(id) on delete cascade,
 enabled boolean not null default true,
 updated_at timestamptz not null default now()
);
alter table public.zuzucord_server_bots enable row level security;
revoke all on public.zuzucord_server_bots from anon,authenticated;
grant select on public.zuzucord_server_bots to authenticated;
drop policy if exists zuzucord_bot_settings_members_read on public.zuzucord_server_bots;
create policy zuzucord_bot_settings_members_read on public.zuzucord_server_bots
 for select to authenticated using ((select public.zuzucord_is_server_member(server_id)));

create table if not exists public.zuzucord_bot_cooldowns (
 user_id uuid not null references auth.users(id) on delete cascade,
 channel_id uuid not null references public.zuzucord_server_channels(id) on delete cascade,
 last_called_at timestamptz not null default now(),
 primary key(user_id,channel_id)
);
create index if not exists zuzucord_bot_cooldowns_called_idx on public.zuzucord_bot_cooldowns(last_called_at);
alter table public.zuzucord_bot_cooldowns enable row level security;
revoke all on public.zuzucord_bot_cooldowns from anon,authenticated;

drop policy if exists zuzucord_server_messages_member_send on public.zuzucord_server_messages;
create policy zuzucord_server_messages_member_send on public.zuzucord_server_messages
 for insert to authenticated with check(
 author_id=(select auth.uid()) and bot_name is null and
 exists(select 1 from public.zuzucord_server_channels c where c.id=channel_id
 and (select public.zuzucord_is_server_member(c.server_id)))
);

create or replace function public.zuzucord_set_bot_enabled(p_server uuid,p_enabled boolean)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 if (select auth.uid()) is null or not (select public.zuzucord_my_account_active())
 then raise exception 'Sign in to an active account' using errcode='42501'; end if;
 if not exists(select 1 from public.zuzucord_server_members m where m.server_id=p_server
 and m.user_id=(select auth.uid()) and m.role='owner')
 then raise exception 'Server owner only' using errcode='42501'; end if;
 insert into public.zuzucord_server_bots(server_id,enabled,updated_at)
 values(p_server,p_enabled,now()) on conflict(server_id)
 do update set enabled=excluded.enabled,updated_at=now();
 return p_enabled;
end; $$;
revoke all on function public.zuzucord_set_bot_enabled(uuid,boolean) from public,anon;
grant execute on function public.zuzucord_set_bot_enabled(uuid,boolean) to authenticated;

create or replace function public.zuzucord_run_bot_command(p_channel uuid,p_command text)
returns text language plpgsql security definer set search_path='' as $$
declare v_server uuid;v_text text;v_reply text;v_time timestamptz;v_members integer;v_enabled boolean;
begin
 if (select auth.uid()) is null or not (select public.zuzucord_my_account_active())
 then raise exception 'Active account required' using errcode='42501'; end if;
 select c.server_id into v_server from public.zuzucord_server_channels c where c.id=p_channel;
 if v_server is null or not (select public.zuzucord_is_server_member(v_server))
 then raise exception 'Join server first' using errcode='42501'; end if;
 select coalesce(b.enabled,true) into v_enabled from (select true) q
 left join public.zuzucord_server_bots b on b.server_id=v_server;
 if not v_enabled then raise exception 'ZuzuBot is disabled' using errcode='42501'; end if;
 v_text:=lower(btrim(coalesce(p_command,'')));
 if char_length(v_text) not between 2 and 80 or
 v_text not in ('/help','/ping','/rules','/members','/roll','/time')
 then raise exception 'Unknown command; use /help' using errcode='22023'; end if;

 perform pg_catalog.pg_advisory_xact_lock(
 pg_catalog.hashtext((select auth.uid())::text),pg_catalog.hashtext(p_channel::text));
 select last_called_at into v_time from public.zuzucord_bot_cooldowns
 where user_id=(select auth.uid()) and channel_id=p_channel;
 if v_time is not null and v_time>now()-interval '3 seconds'
 then raise exception 'Wait 3 seconds before another command' using errcode='P0001'; end if;
 insert into public.zuzucord_bot_cooldowns(user_id,channel_id,last_called_at)
 values((select auth.uid()),p_channel,now()) on conflict(user_id,channel_id)
 do update set last_called_at=now();

 case v_text
 when '/help' then v_reply:='ZuzuBot commands: /help • /ping • /rules • /members • /roll • /time. Server owners can turn the bot off.';
 when '/ping' then v_reply:='Pong! ZuzuBot is responding.';
 when '/rules' then v_reply:='Be respectful, avoid harassment or spam, protect privacy and follow server rules.';
 when '/members' then
 select count(*) into v_members from public.zuzucord_server_members where server_id=v_server;
 v_reply:='This server has '||v_members||' member(s).';
 when '/roll' then v_reply:='You rolled a '||(1+floor(random()*6))::integer||' (1–6).';
 when '/time' then v_reply:='Server time (UTC): '||to_char(now() at time zone 'UTC','YYYY-MM-DD HH24:MI')||'.';
 end case;
 insert into public.zuzucord_server_messages(channel_id,author_id,content)
 values(p_channel,(select auth.uid()),v_text);
 insert into public.zuzucord_server_messages(channel_id,author_id,content,bot_name)
 values(p_channel,(select auth.uid()),v_reply,'ZuzuBot');
 return v_reply;
end; $$;
revoke all on function public.zuzucord_run_bot_command(uuid,text) from public,anon;
grant execute on function public.zuzucord_run_bot_command(uuid,text) to authenticated;

-- Statistics are aggregate-only, including the current and today's ban totals.
create or replace function public.zuzucord_public_stats()
returns jsonb language sql stable security definer set search_path='' as $$
select jsonb_build_object(
 'total_users',(select count(*) from public.zuzucord_accounts),
 'created_today',(select count(*) from public.zuzucord_accounts
 where created_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC'),
 'banned_users',(select count(*) from public.zuzucord_bans
 where expires_at is null or expires_at>now()),
 'banned_today',(select count(*) from public.zuzucord_bans
 where banned_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC'),
 'total_messages',((select count(*) from public.zuzucord_messages)+
 (select count(*) from public.zuzucord_server_messages)),
 'total_channels',((select count(*) from public.zuzucord_rooms where is_public=true)+
 (select count(*) from public.zuzucord_server_channels)),
 'total_servers',(select count(*) from public.zuzucord_servers),
 'as_of',now());
$$;
revoke all on function public.zuzucord_public_stats() from public;
grant execute on function public.zuzucord_public_stats() to anon,authenticated;
