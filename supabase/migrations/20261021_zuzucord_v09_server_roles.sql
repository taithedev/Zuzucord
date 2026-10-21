
create table if not exists public.zuzucord_server_roles (
 id uuid primary key default gen_random_uuid(),
 server_id uuid not null references public.zuzucord_servers(id) on delete cascade,
 name text not null check(char_length(name) between 2 and 32),
 color text not null default '#a978ff' check(color ~ '^#[0-9A-Fa-f]{6}$'),
 position integer not null default 0 check(position between 0 and 100),
 manage_channels boolean not null default false,
 manage_members boolean not null default false,
 manage_bots boolean not null default false,
 created_at timestamptz not null default now(),
 unique(server_id,name),
 unique(id,server_id)
);
create table if not exists public.zuzucord_member_custom_roles(
 server_id uuid not null,
 user_id uuid not null,
 role_id uuid not null,
 granted_at timestamptz not null default now(),
 primary key(server_id,user_id,role_id),
 foreign key(server_id,user_id) references public.zuzucord_server_members(server_id,user_id) on delete cascade,
 foreign key(role_id,server_id) references public.zuzucord_server_roles(id,server_id) on delete cascade
);
alter table public.zuzucord_server_roles enable row level security;
alter table public.zuzucord_member_custom_roles enable row level security;
revoke all on public.zuzucord_server_roles,public.zuzucord_member_custom_roles from public,anon,authenticated;
grant select on public.zuzucord_server_roles,public.zuzucord_member_custom_roles to authenticated;
drop policy if exists zuzucord_server_roles_read on public.zuzucord_server_roles;
create policy zuzucord_server_roles_read on public.zuzucord_server_roles
 for select to authenticated using((select public.zuzucord_is_server_member(server_id)));
drop policy if exists zuzucord_member_custom_roles_read on public.zuzucord_member_custom_roles;
create policy zuzucord_member_custom_roles_read on public.zuzucord_member_custom_roles
 for select to authenticated using((select public.zuzucord_is_server_member(server_id)));

create or replace function public.zuzucord_can_server_action(p_server uuid,p_action text)
returns boolean language sql stable security definer set search_path='' as $$
select
  (select auth.uid()) is not null
  and (select public.zuzucord_my_account_active())
  and (
   exists(select 1 from public.zuzucord_server_members m
    where m.server_id=p_server and m.user_id=(select auth.uid())
    and (m.role='owner' or (
      m.role='admin' and p_action in ('manage_channels','manage_members','manage_bots','send_messages')
    ) or p_action='send_messages'))
   or exists(
    select 1 from public.zuzucord_member_custom_roles a
    join public.zuzucord_server_roles r on r.id=a.role_id and r.server_id=a.server_id
    where a.server_id=p_server and a.user_id=(select auth.uid()) and
    ((p_action='manage_channels' and r.manage_channels) or
     (p_action='manage_members' and r.manage_members) or
     (p_action='manage_bots' and r.manage_bots))
   )
  ) and p_action in ('manage_channels','manage_members','manage_bots','send_messages');
$$;
revoke all on function public.zuzucord_can_server_action(uuid,text) from public,anon;
grant execute on function public.zuzucord_can_server_action(uuid,text) to authenticated;

create or replace function public.zuzucord_save_server_role(
 p_server uuid,p_role uuid,p_name text,p_color text,
 p_manage_channels boolean,p_manage_members boolean,p_manage_bots boolean
) returns uuid language plpgsql security definer set search_path='' as $$
declare new_id uuid;owned boolean;
begin
 owned:=exists(select 1 from public.zuzucord_server_members
 where server_id=p_server and user_id=(select auth.uid()) and role='owner');
 if not owned or not (select public.zuzucord_my_account_active())
 then raise exception 'Only the server owner can configure roles' using errcode='42501';end if;
 p_name:=btrim(coalesce(p_name,''));
 if char_length(p_name) not between 2 and 32
 or p_color !~ '^#[0-9A-Fa-f]{6}$'
 then raise exception 'Invalid role name or color' using errcode='22023';end if;
 if p_role is null then
  if (select count(*) from public.zuzucord_server_roles where server_id=p_server)>=30
   then raise exception 'Server has maximum 30 custom roles' using errcode='P0001';end if;
  insert into public.zuzucord_server_roles(server_id,name,color,position,manage_channels,manage_members,manage_bots)
  values(p_server,p_name,p_color,0,coalesce(p_manage_channels,false),coalesce(p_manage_members,false),coalesce(p_manage_bots,false))
  returning id into new_id;
 else
  update public.zuzucord_server_roles set name=p_name,color=p_color,
  manage_channels=coalesce(p_manage_channels,false),
  manage_members=coalesce(p_manage_members,false),
  manage_bots=coalesce(p_manage_bots,false)
  where id=p_role and server_id=p_server returning id into new_id;
  if new_id is null then raise exception 'Role not found in this server' using errcode='P0001';end if;
 end if;
 return new_id;
end;$$;
revoke all on function public.zuzucord_save_server_role(uuid,uuid,text,text,boolean,boolean,boolean) from public,anon;
grant execute on function public.zuzucord_save_server_role(uuid,uuid,text,text,boolean,boolean,boolean) to authenticated;

create or replace function public.zuzucord_assign_server_role(
 p_server uuid,p_target uuid,p_role uuid,p_grant boolean
) returns void language plpgsql security definer set search_path='' as $$
begin
 if not (select public.zuzucord_my_account_active())
 or not exists(select 1 from public.zuzucord_server_members m
 where m.server_id=p_server and m.user_id=(select auth.uid()) and m.role='owner')
 then raise exception 'Only server owner can assign custom roles' using errcode='42501';end if;
 if not exists(select 1 from public.zuzucord_server_roles r
 where r.server_id=p_server and r.id=p_role)
 then raise exception 'Role does not exist in this server' using errcode='P0001';end if;
 if not exists(select 1 from public.zuzucord_server_members m
 where m.server_id=p_server and m.user_id=p_target)
 then raise exception 'Target is not a server member' using errcode='P0001';end if;
 if p_grant then
 insert into public.zuzucord_member_custom_roles(server_id,user_id,role_id)
 values(p_server,p_target,p_role) on conflict do nothing;
 else delete from public.zuzucord_member_custom_roles
 where server_id=p_server and user_id=p_target and role_id=p_role;
 end if;
end;$$;
revoke all on function public.zuzucord_assign_server_role(uuid,uuid,uuid,boolean) from public,anon;
grant execute on function public.zuzucord_assign_server_role(uuid,uuid,uuid,boolean) to authenticated;

create or replace function public.zuzucord_delete_server_role(
 p_server uuid,p_role uuid
) returns void language plpgsql security definer set search_path='' as $$
begin
 if not (select public.zuzucord_my_account_active())
 or not exists(select 1 from public.zuzucord_server_members m
 where m.server_id=p_server and m.user_id=(select auth.uid()) and m.role='owner')
 then raise exception 'Only server owner can delete roles' using errcode='42501';end if;
 delete from public.zuzucord_server_roles where id=p_role and server_id=p_server;
end;$$;
revoke all on function public.zuzucord_delete_server_role(uuid,uuid) from public,anon;
grant execute on function public.zuzucord_delete_server_role(uuid,uuid) to authenticated;
