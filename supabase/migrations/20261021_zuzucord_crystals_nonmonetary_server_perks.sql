-- ZuzuCord Crystals: nonmonetary promotional points, redeemable only for server boosts.
-- Existing ServerBoostCredits remain spendable: 1 legacy credit = 100 Crystal equivalent.
-- Applied to project wfqudstuncdldsvxqveu. Run only after the earlier boost schema.
alter table public.zuzucord_boost_wallets
 add column if not exists crystals integer not null default 0 check(crystals between 0 and 100000);

create table if not exists public.zuzucord_crystal_transactions(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 amount integer not null check(amount<>0 and amount between -1000 and 1000),
 reason text not null check(reason in ('developer_grant','server_boost')),
 server_id uuid references public.zuzucord_servers(id) on delete set null,
 granted_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 check((reason='server_boost' and amount=-100 and server_id is not null)
    or (reason='developer_grant' and amount>0 and server_id is null and granted_by is not null))
);
create index if not exists zuzucord_crystal_tx_user_created
 on public.zuzucord_crystal_transactions(user_id,created_at desc);
alter table public.zuzucord_crystal_transactions enable row level security;
revoke all on public.zuzucord_crystal_transactions from public,anon,authenticated;
grant select on public.zuzucord_crystal_transactions to authenticated;
drop policy if exists zuzucord_crystal_transactions_self_read on public.zuzucord_crystal_transactions;
create policy zuzucord_crystal_transactions_self_read
 on public.zuzucord_crystal_transactions for select to authenticated
 using(user_id=(select auth.uid()));

alter table public.zuzucord_servers
 add column if not exists accent_color text not null default '#a978ff'
 check(accent_color ~ '^#[0-9a-fA-F]{6}$'),
 add column if not exists gradient_color text not null default '#0c0715'
 check(gradient_color ~ '^#[0-9a-fA-F]{6}$');
grant select(accent_color,gradient_color) on public.zuzucord_servers to authenticated;

create or replace function public.zuzucord_grant_crystals(p_user uuid,p_amount integer)
returns integer language plpgsql security definer set search_path=''
as $$
declare result integer;
begin
 if not (select public.zuzucord_has_role('developer')) then
  raise exception 'Developer authorization required' using errcode='42501'; end if;
 if p_amount is null or p_amount not between 1 and 1000 then
  raise exception 'Grant 1 to 1,000 Crystals at a time' using errcode='22023'; end if;
 if not exists(select 1 from public.zuzucord_accounts where user_id=p_user) then
  raise exception 'ZuzuCord account not found' using errcode='P0001'; end if;
 insert into public.zuzucord_boost_wallets(user_id,credits,crystals)
 values(p_user,0,p_amount)
 on conflict(user_id) do update set
  crystals=public.zuzucord_boost_wallets.crystals+excluded.crystals,
  updated_at=now()
 returning crystals into result;
 insert into public.zuzucord_crystal_transactions(user_id,amount,reason,granted_by)
 values(p_user,p_amount,'developer_grant',(select auth.uid()));
 return result;
end;$$;
revoke all on function public.zuzucord_grant_crystals(uuid,integer) from public,anon;
grant execute on function public.zuzucord_grant_crystals(uuid,integer) to authenticated;

create or replace function public.zuzucord_boost_server(p_server uuid)
returns integer language plpgsql security definer set search_path=''
as $$
declare levels integer;spent integer;older integer;
begin
 if not (select public.zuzucord_my_account_active()) or not
 (select public.zuzucord_is_server_member(p_server)) then
  raise exception 'Join this server to boost it' using errcode='42501'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_server::text));
 select count(*) into levels from public.zuzucord_server_boosts where server_id=p_server;
 if levels>=3 then raise exception 'Server has already reached level 3' using errcode='P0001'; end if;
 insert into public.zuzucord_boost_wallets(user_id,credits,crystals)
 values((select auth.uid()),0,0) on conflict(user_id) do nothing;
 update public.zuzucord_boost_wallets set crystals=crystals-100,updated_at=now()
 where user_id=(select auth.uid()) and crystals>=100 returning crystals into spent;
 if spent is not null then
  insert into public.zuzucord_crystal_transactions(user_id,amount,reason,server_id)
  values((select auth.uid()),-100,'server_boost',p_server);
 else
  update public.zuzucord_boost_wallets set credits=credits-1,updated_at=now()
  where user_id=(select auth.uid()) and credits>=1 returning credits into older;
  if older is null then
   raise exception 'A server boost costs 100 Crystals; your balance is too low' using errcode='P0001'; end if;
 end if;
 insert into public.zuzucord_server_boosts(server_id,user_id)
 values(p_server,(select auth.uid()));
 return levels+1;
end;$$;
revoke all on function public.zuzucord_boost_server(uuid) from public,anon;
grant execute on function public.zuzucord_boost_server(uuid) to authenticated;

create or replace function public.zuzucord_customize_boosted_server(p_server uuid,p_accent text,p_gradient text)
returns void language plpgsql security definer set search_path=''
as $$
declare boost_level integer;
begin
 if not exists(select 1 from public.zuzucord_servers where id=p_server and owner_id=(select auth.uid()))
 then raise exception 'Only the server owner can customize branding' using errcode='42501'; end if;
 if p_accent !~ '^#[0-9a-fA-F]{6}$' or p_gradient !~ '^#[0-9a-fA-F]{6}$'
 then raise exception 'Use six-digit hex colors' using errcode='22023'; end if;
 select count(*) into boost_level from public.zuzucord_server_boosts where server_id=p_server;
 if boost_level<1 then raise exception 'Level 1 boosts unlock custom accent color' using errcode='42501'; end if;
 if boost_level<2 and p_gradient<>(select gradient_color from public.zuzucord_servers where id=p_server)
 then raise exception 'Level 2 boosts unlock server gradients' using errcode='42501'; end if;
 update public.zuzucord_servers set accent_color=p_accent,gradient_color=p_gradient where id=p_server;
end;$$;
revoke all on function public.zuzucord_customize_boosted_server(uuid,text,text) from public,anon;
grant execute on function public.zuzucord_customize_boosted_server(uuid,text,text) to authenticated;

-- Public aggregate-only counts; never expose wallets or the private transaction ledger.
create or replace function public.zuzucord_public_stats()
returns jsonb language sql stable security definer set search_path='' as $$
select jsonb_build_object(
 'total_users',(select count(*) from public.zuzucord_accounts),
 'created_today',(select count(*) from public.zuzucord_accounts where
 created_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC'),
 'banned_users',(select count(*) from public.zuzucord_bans where expires_at is null or expires_at>now()),
 'banned_today',(select count(*) from public.zuzucord_bans
 where banned_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC'),
 'total_messages',((select count(*) from public.zuzucord_messages)+
 (select count(*) from public.zuzucord_server_messages)),
 'total_channels',((select count(*) from public.zuzucord_rooms where is_public=true)+
 (select count(*) from public.zuzucord_server_channels)),
 'total_servers',(select count(*) from public.zuzucord_servers),
 'total_boosts',(select count(*) from public.zuzucord_server_boosts),
 'as_of',now());
$$;
revoke all on function public.zuzucord_public_stats() from public;
grant execute on function public.zuzucord_public_stats() to anon,authenticated;
