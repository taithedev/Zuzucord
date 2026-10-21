-- v0.9 platform Owner privilege is reserved for the verified developer account.
alter table public.zuzucord_user_roles drop constraint zuzucord_user_roles_role_check;
alter table public.zuzucord_user_roles
add constraint zuzucord_user_roles_role_check
check(role in ('owner','developer','verified','beta_tester'));

insert into public.zuzucord_user_roles(user_id,role)
select a.user_id,'owner'
from public.zuzucord_accounts a
where a.username='taithedev'
and exists (select 1 from public.zuzucord_user_roles r where r.user_id=a.user_id and r.role='developer')
on conflict(user_id,role) do nothing;

create or replace function public.zuzucord_has_role(p_role text)
returns boolean language sql stable security definer set search_path=''
as $$
 select (select auth.uid()) is not null and
 exists(select 1 from public.zuzucord_user_roles r where r.user_id=(select auth.uid())
 and (r.role=p_role or (r.role='owner' and p_role='developer')))
$$;
revoke all on function public.zuzucord_has_role(text) from public,anon;
grant execute on function public.zuzucord_has_role(text) to authenticated;

create or replace function public.zuzucord_manage_platform_role(p_target uuid,p_role text,p_enabled boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not (select public.zuzucord_has_role('owner')) then
 raise exception 'Owner authorization required' using errcode='42501'; end if;
 if p_role not in ('developer','verified','beta_tester') then
 raise exception 'The Owner role cannot be delegated using this API' using errcode='42501'; end if;
 if p_target=(select auth.uid()) and p_role='developer' and not p_enabled then
 raise exception 'You cannot revoke your own developer role' using errcode='42501'; end if;
 if not exists(select 1 from public.zuzucord_accounts where user_id=p_target)
 then raise exception 'Unknown ZuzuCord account' using errcode='P0001'; end if;
 if p_enabled then
  insert into public.zuzucord_user_roles(user_id,role) values(p_target,p_role) on conflict do nothing;
 else
  delete from public.zuzucord_user_roles where user_id=p_target and role=p_role;
 end if;
end;$$;
revoke all on function public.zuzucord_manage_platform_role(uuid,text,boolean) from public,anon;
grant execute on function public.zuzucord_manage_platform_role(uuid,text,boolean) to authenticated;
