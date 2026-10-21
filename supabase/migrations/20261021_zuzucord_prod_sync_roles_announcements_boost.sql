
-- ZuzuCord production identities, announcements, synced UI, and nonmonetary boosts.
create table if not exists public.zuzucord_user_roles(
 user_id uuid not null references auth.users(id) on delete cascade,
 role text not null check(role in ('developer','verified','beta_tester')),
 granted_at timestamptz not null default now(),
 primary key(user_id,role)
);
alter table public.zuzucord_user_roles enable row level security;
revoke all on public.zuzucord_user_roles from public,anon,authenticated;
grant select on public.zuzucord_user_roles to authenticated;
drop policy if exists zuzucord_roles_visible on public.zuzucord_user_roles;
create policy zuzucord_roles_visible on public.zuzucord_user_roles
 for select to authenticated using(true);
create or replace function public.zuzucord_has_role(p_role text)
returns boolean language sql stable security definer set search_path=''
as $$ select (select auth.uid()) is not null and
 exists(select 1 from public.zuzucord_user_roles r
 where r.user_id=(select auth.uid()) and r.role=p_role) $$;
revoke all on function public.zuzucord_has_role(text) from public,anon;
grant execute on function public.zuzucord_has_role(text) to authenticated;

create table if not exists public.zuzucord_user_sync(
 user_id uuid primary key references auth.users(id) on delete cascade,
 theme text not null default 'oled' check(theme in ('oled','graphite','midnight')),
 accent text not null default '#a978ff' check(accent ~ '^#[0-9a-fA-F]{6}$'),
 gradient_enabled boolean not null default true,
 gradient_start text not null default '#25083f' check(gradient_start ~ '^#[0-9a-fA-F]{6}$'),
 gradient_end text not null default '#09050f' check(gradient_end ~ '^#[0-9a-fA-F]{6}$'),
 glass_strength integer not null default 64 check(glass_strength between 0 and 100),
 motion_enabled boolean not null default true,
 sync_enabled boolean not null default false,
 last_server_id uuid references public.zuzucord_servers(id) on delete set null,
 updated_at timestamptz not null default now(),
 constraint zuzucord_sync_server_access check(true)
);
alter table public.zuzucord_user_sync enable row level security;
revoke all on public.zuzucord_user_sync from public,anon,authenticated;
grant select,insert,update on public.zuzucord_user_sync to authenticated;
drop policy if exists zuzucord_user_sync_read on public.zuzucord_user_sync;
create policy zuzucord_user_sync_read on public.zuzucord_user_sync
 for select to authenticated using(user_id=(select auth.uid()));
drop policy if exists zuzucord_user_sync_insert on public.zuzucord_user_sync;
create policy zuzucord_user_sync_insert on public.zuzucord_user_sync
 for insert to authenticated with check(user_id=(select auth.uid())
 and (select public.zuzucord_my_account_active())
 and (last_server_id is null or (select public.zuzucord_is_server_member(last_server_id))));
drop policy if exists zuzucord_user_sync_update on public.zuzucord_user_sync;
create policy zuzucord_user_sync_update on public.zuzucord_user_sync
 for update to authenticated using(user_id=(select auth.uid()))
 with check(user_id=(select auth.uid()) and (select public.zuzucord_my_account_active())
 and (last_server_id is null or (select public.zuzucord_is_server_member(last_server_id))));
-- Import existing beta prefs for testers, not their beta-only entitlement.
insert into public.zuzucord_user_sync(
 user_id,theme,accent,gradient_enabled,gradient_start,gradient_end,glass_strength,
 motion_enabled,sync_enabled,last_server_id,updated_at)
 select user_id,theme,accent,gradient_enabled,gradient_start,gradient_end,glass_strength,
 motion_enabled,sync_enabled,last_server_id,updated_at from public.zuzucord_beta_sync
 on conflict(user_id) do nothing;

create table if not exists public.zuzucord_official_announcements(
 id uuid primary key default gen_random_uuid(),
 author_id uuid not null references auth.users(id),
 title text not null check(char_length(title) between 3 and 90),
 content text not null check(char_length(content) between 2 and 1500),
 created_at timestamptz not null default now()
);
alter table public.zuzucord_official_announcements enable row level security;
revoke all on public.zuzucord_official_announcements from public,anon,authenticated;
grant select on public.zuzucord_official_announcements to authenticated;
drop policy if exists zuzucord_announcements_read on public.zuzucord_official_announcements;
create policy zuzucord_announcements_read on public.zuzucord_official_announcements
 for select to authenticated using((select public.zuzucord_my_account_active()));
create or replace function public.zuzucord_publish_announcement(p_title text,p_content text)
returns uuid language plpgsql security definer set search_path=''
as $$
declare out_id uuid;
begin
 if not (select public.zuzucord_has_role('developer')) then
 raise exception 'Developer authorization required' using errcode='42501'; end if;
 p_title:=btrim(coalesce(p_title,''));p_content:=btrim(coalesce(p_content,''));
 if char_length(p_title) not between 3 and 90 or char_length(p_content) not between 2 and 1500
 then raise exception 'Invalid announcement length' using errcode='22023'; end if;
 -- Cap platform-wide broadcasts to one per 30 minutes.
 perform pg_catalog.pg_advisory_xact_lock(771231);
 if exists(select 1 from public.zuzucord_official_announcements
 where created_at>now()-interval '30 minutes') then
 raise exception 'An announcement was published recently. Try again later.' using errcode='P0001'; end if;
 insert into public.zuzucord_official_announcements(author_id,title,content)
 values((select auth.uid()),p_title,p_content) returning id into out_id;
 return out_id;
end;$$;
revoke all on function public.zuzucord_publish_announcement(text,text) from public,anon;
grant execute on function public.zuzucord_publish_announcement(text,text) to authenticated;

create table if not exists public.zuzucord_boost_wallets(
 user_id uuid primary key references auth.users(id) on delete cascade,
 credits integer not null default 0 check(credits between 0 and 10000),
 updated_at timestamptz not null default now()
);
create table if not exists public.zuzucord_server_boosts(
 id uuid primary key default gen_random_uuid(),
 server_id uuid not null references public.zuzucord_servers(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now()
);
create index if not exists zuzucord_server_boosts_server_idx on public.zuzucord_server_boosts(server_id);
alter table public.zuzucord_boost_wallets enable row level security;
alter table public.zuzucord_server_boosts enable row level security;
revoke all on public.zuzucord_boost_wallets,public.zuzucord_server_boosts from public,anon,authenticated;
grant select on public.zuzucord_boost_wallets,public.zuzucord_server_boosts to authenticated;
drop policy if exists zuzucord_wallet_self on public.zuzucord_boost_wallets;
create policy zuzucord_wallet_self on public.zuzucord_boost_wallets
 for select to authenticated using(user_id=(select auth.uid()));
drop policy if exists zuzucord_boosts_member_read on public.zuzucord_server_boosts;
create policy zuzucord_boosts_member_read on public.zuzucord_server_boosts
 for select to authenticated using((select public.zuzucord_is_server_member(server_id)));

create or replace function public.zuzucord_issue_boost_credits(p_user uuid,p_amount integer)
returns integer language plpgsql security definer set search_path=''
as $$
declare balance integer;
begin
 if not (select public.zuzucord_has_role('developer')) then
 raise exception 'Developer authorization required' using errcode='42501'; end if;
 if p_amount not between 1 and 100 then raise exception 'Amount must be 1-100' using errcode='22023'; end if;
 if not exists(select 1 from public.zuzucord_accounts where user_id=p_user)
 then raise exception 'Unknown ZuzuCord user' using errcode='P0001'; end if;
 insert into public.zuzucord_boost_wallets(user_id,credits)
 values(p_user,p_amount) on conflict(user_id) do update
 set credits=public.zuzucord_boost_wallets.credits+excluded.credits,updated_at=now()
 returning credits into balance;
 return balance;
end;$$;
revoke all on function public.zuzucord_issue_boost_credits(uuid,integer) from public,anon;
grant execute on function public.zuzucord_issue_boost_credits(uuid,integer) to authenticated;

create or replace function public.zuzucord_boost_server(p_server uuid)
returns integer language plpgsql security definer set search_path=''
as $$
declare remaining integer;boosts integer;
begin
 if not (select public.zuzucord_my_account_active()) or not
 (select public.zuzucord_is_server_member(p_server)) then
 raise exception 'Join this server first' using errcode='42501'; end if;
 select count(*) into boosts from public.zuzucord_server_boosts where server_id=p_server;
 if boosts>=3 then raise exception 'Server already has maximum 3 boost levels' using errcode='P0001'; end if;
 insert into public.zuzucord_boost_wallets(user_id,credits)
 values((select auth.uid()),0) on conflict(user_id) do nothing;
 update public.zuzucord_boost_wallets
 set credits=credits-1,updated_at=now()
 where user_id=(select auth.uid()) and credits>=1 returning credits into remaining;
 if remaining is null then raise exception 'You need a ServerBoostCredit' using errcode='P0001'; end if;
 insert into public.zuzucord_server_boosts(server_id,user_id) values(p_server,(select auth.uid()));
 return boosts+1;
end;$$;
revoke all on function public.zuzucord_boost_server(uuid) from public,anon;
grant execute on function public.zuzucord_boost_server(uuid) to authenticated;

-- Before release, existing server-create-channel RPC will be updated to honor boosts.
