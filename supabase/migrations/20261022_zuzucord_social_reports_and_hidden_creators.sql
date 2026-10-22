-- Additive migration for reporting and hiding creators in ZuzuCord Socials.
-- Hiding is personal feed filtering, not a platform-wide block on all messages.
create table if not exists public.zuzucord_social_reports(
 id uuid primary key default gen_random_uuid(),
 post_id uuid not null references public.zuzucord_social_posts(id) on delete cascade,
 reporter_id uuid not null references auth.users(id) on delete cascade,
 reason text not null check(char_length(btrim(reason)) between 8 and 500),
 created_at timestamptz not null default now(),
 reviewed_at timestamptz,
 unique(post_id,reporter_id)
);
create table if not exists public.zuzucord_social_hidden_creators(
 user_id uuid not null references auth.users(id) on delete cascade,
 hidden_user_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(user_id,hidden_user_id),
 check(user_id<>hidden_user_id)
);
alter table public.zuzucord_social_reports enable row level security;
alter table public.zuzucord_social_hidden_creators enable row level security;
revoke all on public.zuzucord_social_reports,public.zuzucord_social_hidden_creators from public,anon,authenticated;
grant select,insert on public.zuzucord_social_reports to authenticated;
grant select,insert,delete on public.zuzucord_social_hidden_creators to authenticated;
drop policy if exists social_report_own_read on public.zuzucord_social_reports;
create policy social_report_own_read on public.zuzucord_social_reports for select to authenticated
 using(reporter_id=(select auth.uid()) or (select public.zuzucord_has_role('owner')));
drop policy if exists social_report_create on public.zuzucord_social_reports;
create policy social_report_create on public.zuzucord_social_reports for insert to authenticated
 with check(reporter_id=(select auth.uid()) and (select public.zuzucord_my_account_active()));
drop policy if exists social_hidden_read on public.zuzucord_social_hidden_creators;
create policy social_hidden_read on public.zuzucord_social_hidden_creators for select to authenticated
 using(user_id=(select auth.uid()));
drop policy if exists social_hidden_create on public.zuzucord_social_hidden_creators;
create policy social_hidden_create on public.zuzucord_social_hidden_creators for insert to authenticated
 with check(user_id=(select auth.uid()) and (select public.zuzucord_my_account_active()));
drop policy if exists social_hidden_remove on public.zuzucord_social_hidden_creators;
create policy social_hidden_remove on public.zuzucord_social_hidden_creators for delete to authenticated
 using(user_id=(select auth.uid()));
