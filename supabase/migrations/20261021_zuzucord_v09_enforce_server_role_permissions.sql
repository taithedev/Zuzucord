-- Permission-aware operations used by custom roles (Owner retains full control).
create or replace function public.zuzucord_create_channel(p_server uuid,p_name text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;channel_limit integer;
begin
 if not (select public.zuzucord_can_server_action(p_server,'manage_channels'))
 then raise exception 'Manage Channels permission required' using errcode='42501'; end if;
 p_name:=lower(btrim(coalesce(p_name,'')));
 if p_name !~ '^[a-z0-9_-]{2,32}$' then raise exception 'Invalid channel name (2-32 characters)' using errcode='22023'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_server::text));
 select 30 + 10*least(count(*)::integer,3) into channel_limit
 from public.zuzucord_server_boosts where server_id=p_server;
 if (select count(*) from public.zuzucord_server_channels where server_id=p_server)>=channel_limit
 then raise exception 'Channel limit reached; boost your server for more' using errcode='P0001';end if;
 insert into public.zuzucord_server_channels(server_id,name,position)
 values(p_server,p_name,(select coalesce(max(position),0)+1 from public.zuzucord_server_channels where server_id=p_server))
 returning id into v_id;
 return v_id;
end;$$;
revoke all on function public.zuzucord_create_channel(uuid,text) from public,anon;
grant execute on function public.zuzucord_create_channel(uuid,text) to authenticated;

create or replace function public.zuzucord_set_bot_enabled(p_server uuid,p_enabled boolean)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 if not (select public.zuzucord_can_server_action(p_server,'manage_bots'))
 then raise exception 'Manage Bots permission required' using errcode='42501'; end if;
 insert into public.zuzucord_server_bots(server_id,enabled,updated_at)
 values(p_server,p_enabled,now()) on conflict(server_id)
 do update set enabled=excluded.enabled,updated_at=now();
 return p_enabled;
end;$$;
revoke all on function public.zuzucord_set_bot_enabled(uuid,boolean) from public,anon;
grant execute on function public.zuzucord_set_bot_enabled(uuid,boolean) to authenticated;

create or replace function public.zuzucord_remove_server_member(p_server uuid,p_target uuid)
returns void language plpgsql security definer set search_path='' as $$
declare actor_role text;target_role text;
begin
 if not (select public.zuzucord_my_account_active()) then
 raise exception 'Active account required' using errcode='42501';end if;
 select role into actor_role from public.zuzucord_server_members
 where server_id=p_server and user_id=(select auth.uid());
 select role into target_role from public.zuzucord_server_members
 where server_id=p_server and user_id=p_target;
 if target_role is null then raise exception 'Member not found' using errcode='P0001';end if;
 if target_role='owner' then raise exception 'Server owner cannot be removed' using errcode='42501';end if;
 if p_target<>(select auth.uid()) then
   if not (select public.zuzucord_can_server_action(p_server,'manage_members'))
   or (target_role='admin' and actor_role<>'owner') then
    raise exception 'Manage Members permission required; admins are protected' using errcode='42501';
   end if;
 end if;
 delete from public.zuzucord_server_members where server_id=p_server and user_id=p_target;
end;$$;
revoke all on function public.zuzucord_remove_server_member(uuid,uuid) from public,anon;
grant execute on function public.zuzucord_remove_server_member(uuid,uuid) to authenticated;
