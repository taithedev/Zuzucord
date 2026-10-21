-- ZuzuCord React friend online presence (applied to Zuzify project).
-- Only accepted friends can read the last-seen heartbeat; no publicly enumerable user list.
create table if not exists public.zuzucord_friend_presence (
 user_id uuid primary key references auth.users(id) on delete cascade,
 last_seen_at timestamptz not null default now()
);
alter table public.zuzucord_friend_presence enable row level security;
revoke all on public.zuzucord_friend_presence from anon,authenticated;
grant select on public.zuzucord_friend_presence to authenticated;

create or replace function public.zuzucord_are_friends(p_user uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select (select auth.uid()) is not null
 and exists(select 1 from public.zuzucord_friend_requests r
 where r.status='accepted' and (
 (r.from_user=(select auth.uid()) and r.to_user=p_user) or
 (r.to_user=(select auth.uid()) and r.from_user=p_user)));
$$;
revoke all on function public.zuzucord_are_friends(uuid) from public,anon;
grant execute on function public.zuzucord_are_friends(uuid) to authenticated;

drop policy if exists zuzucord_presence_friends_only on public.zuzucord_friend_presence;
create policy zuzucord_presence_friends_only on public.zuzucord_friend_presence
 for select to authenticated using(
 user_id=(select auth.uid()) or (select public.zuzucord_are_friends(user_id)));

create or replace function public.zuzucord_presence_heartbeat()
returns void language plpgsql security definer set search_path='' as $$
begin
 if (select auth.uid()) is null or not (select public.zuzucord_my_account_active())
 then raise exception 'Active account required' using errcode='42501'; end if;
 insert into public.zuzucord_friend_presence(user_id,last_seen_at)
 values((select auth.uid()),now())
 on conflict(user_id) do update set last_seen_at=now();
end; $$;
revoke all on function public.zuzucord_presence_heartbeat() from public,anon;
grant execute on function public.zuzucord_presence_heartbeat() to authenticated;
