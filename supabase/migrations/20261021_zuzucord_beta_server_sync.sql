-- Applied to the existing Zuzify Supabase project for beta app ↔ website syncing.
alter table public.zuzucord_beta_sync
 add column if not exists last_server_id uuid references public.zuzucord_servers(id) on delete set null;

drop policy if exists zuzucord_beta_sync_insert on public.zuzucord_beta_sync;
drop policy if exists zuzucord_beta_sync_update on public.zuzucord_beta_sync;
create policy zuzucord_beta_sync_insert on public.zuzucord_beta_sync for insert to authenticated
 with check(user_id=(select auth.uid()) and (select public.zuzucord_is_beta_tester())
 and (last_server_id is null or (select public.zuzucord_is_server_member(last_server_id))));
create policy zuzucord_beta_sync_update on public.zuzucord_beta_sync for update to authenticated
 using(user_id=(select auth.uid()) and (select public.zuzucord_is_beta_tester()))
 with check(user_id=(select auth.uid()) and (select public.zuzucord_is_beta_tester())
 and (last_server_id is null or (select public.zuzucord_is_server_member(last_server_id))));

create or replace function public.zuzucord_public_stats()
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
 'total_users',(select count(*) from public.zuzucord_accounts),
 'created_today',(select count(*) from public.zuzucord_accounts a
    where a.created_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC'),
 'banned_users',(select count(*) from public.zuzucord_bans b
    where b.expires_at is null or b.expires_at>now()),
 'total_messages',((select count(*) from public.zuzucord_messages)+
    (select count(*) from public.zuzucord_server_messages)),
 'total_channels',((select count(*) from public.zuzucord_rooms where is_public=true)+
    (select count(*) from public.zuzucord_server_channels)),
 'total_servers',(select count(*) from public.zuzucord_servers),
 'as_of',now());
$$;
revoke all on function public.zuzucord_public_stats() from public;
grant execute on function public.zuzucord_public_stats() to anon,authenticated;
