alter table public.zuzucord_beta_sync
  add column if not exists gradient_middle text not null default '#140b25' check (gradient_middle ~ '^#[A-Fa-f0-9]{6}$'),
  add column if not exists gradient_accent text not null default '#070913' check (gradient_accent ~ '^#[A-Fa-f0-9]{6}$'),
  add column if not exists gradient_angle integer not null default 135 check (gradient_angle between 0 and 360),
  add column if not exists glow_position integer not null default 25 check (glow_position between 0 and 100);
alter table public.zuzucord_user_sync
  add column if not exists gradient_middle text not null default '#140b25' check (gradient_middle ~ '^#[A-Fa-f0-9]{6}$'),
  add column if not exists gradient_accent text not null default '#070913' check (gradient_accent ~ '^#[A-Fa-f0-9]{6}$'),
  add column if not exists gradient_angle integer not null default 135 check (gradient_angle between 0 and 360),
  add column if not exists glow_position integer not null default 25 check (glow_position between 0 and 100);
create table if not exists public.zuzucord_social_reposts (
 post_id uuid not null references public.zuzucord_social_posts(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(post_id,user_id)
);
create index if not exists zuzucord_social_reposts_recent on public.zuzucord_social_reposts(created_at desc);
alter table public.zuzucord_social_reposts enable row level security;
revoke all on public.zuzucord_social_reposts from public,anon,authenticated;
grant select,insert,delete on public.zuzucord_social_reposts to authenticated;
drop policy if exists zuzucord_social_repost_read on public.zuzucord_social_reposts;
create policy zuzucord_social_repost_read on public.zuzucord_social_reposts
for select to authenticated using ((select public.zuzucord_my_account_active()));
drop policy if exists zuzucord_social_repost_add on public.zuzucord_social_reposts;
create policy zuzucord_social_repost_add on public.zuzucord_social_reposts
for insert to authenticated with check (user_id = (select auth.uid()) and (select public.zuzucord_my_account_active()));
drop policy if exists zuzucord_social_repost_remove on public.zuzucord_social_reposts;
create policy zuzucord_social_repost_remove on public.zuzucord_social_reposts
for delete to authenticated using (user_id=(select auth.uid()));