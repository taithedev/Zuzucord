-- Native ZuzifySocials feature port for ZuzuCord (October 2026).
-- This migration is additive; it does NOT copy accounts from the old
-- ZuzifySocials Supabase instance into the ZuzuCord instance.
create table if not exists public.zuzucord_social_posts (
 id uuid primary key default gen_random_uuid(),
 author_id uuid not null references auth.users(id) on delete cascade,
 kind text not null default 'post' check(kind in ('post','moment')),
 content text not null default '' check(char_length(content)<=2000),
 media_path text check(media_path is null or
   (char_length(media_path)<200 and media_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|jpeg|png|webp|gif|mp4|webm)$')),
 media_type text check(media_type is null or media_type in ('image','video')),
 created_at timestamptz not null default now(),
 check(char_length(btrim(content))>0 or media_path is not null),
 check((media_path is null and media_type is null) or(media_path is not null and media_type is not null))
);
create index if not exists zuzucord_social_posts_recent on public.zuzucord_social_posts(created_at desc);
create index if not exists zuzucord_social_posts_author on public.zuzucord_social_posts(author_id,created_at desc);
create table if not exists public.zuzucord_social_likes (
 post_id uuid not null references public.zuzucord_social_posts(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(post_id,user_id)
);
create table if not exists public.zuzucord_social_bookmarks (
 post_id uuid not null references public.zuzucord_social_posts(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(post_id,user_id)
);
create table if not exists public.zuzucord_social_comments (
 id uuid primary key default gen_random_uuid(),
 post_id uuid not null references public.zuzucord_social_posts(id) on delete cascade,
 author_id uuid not null references auth.users(id) on delete cascade,
 content text not null check(char_length(btrim(content)) between 1 and 1000),
 created_at timestamptz not null default now()
);
create index if not exists zuzucord_social_comments_post on public.zuzucord_social_comments(post_id,created_at);
create table if not exists public.zuzucord_social_follows (
 follower_id uuid not null references auth.users(id) on delete cascade,
 followed_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(follower_id,followed_id),
 check(follower_id<>followed_id)
);
create index if not exists zuzucord_social_follows_target on public.zuzucord_social_follows(followed_id);

alter table public.zuzucord_social_posts enable row level security;
alter table public.zuzucord_social_likes enable row level security;
alter table public.zuzucord_social_comments enable row level security;
alter table public.zuzucord_social_bookmarks enable row level security;
alter table public.zuzucord_social_follows enable row level security;
revoke all on public.zuzucord_social_posts,public.zuzucord_social_likes,
 public.zuzucord_social_comments,public.zuzucord_social_bookmarks,
 public.zuzucord_social_follows from public,anon,authenticated;
grant select,insert,delete on public.zuzucord_social_posts,public.zuzucord_social_likes,
 public.zuzucord_social_comments,public.zuzucord_social_bookmarks,
 public.zuzucord_social_follows to authenticated;

drop policy if exists social_post_read on public.zuzucord_social_posts;
create policy social_post_read on public.zuzucord_social_posts for select to authenticated
 using((select public.zuzucord_my_account_active()));
drop policy if exists social_post_create on public.zuzucord_social_posts;
create policy social_post_create on public.zuzucord_social_posts for insert to authenticated
 with check(author_id=(select auth.uid()) and (select public.zuzucord_my_account_active()));
drop policy if exists social_post_delete on public.zuzucord_social_posts;
create policy social_post_delete on public.zuzucord_social_posts for delete to authenticated
 using((author_id=(select auth.uid()) or (select public.zuzucord_has_role('owner'))) and (select public.zuzucord_my_account_active()));

drop policy if exists social_likes_read on public.zuzucord_social_likes;
create policy social_likes_read on public.zuzucord_social_likes for select to authenticated
 using((select public.zuzucord_my_account_active()));
drop policy if exists social_likes_insert on public.zuzucord_social_likes;
create policy social_likes_insert on public.zuzucord_social_likes for insert to authenticated
 with check(user_id=(select auth.uid()) and (select public.zuzucord_my_account_active()));
drop policy if exists social_likes_delete on public.zuzucord_social_likes;
create policy social_likes_delete on public.zuzucord_social_likes for delete to authenticated
 using(user_id=(select auth.uid()));

drop policy if exists social_bookmarks_read on public.zuzucord_social_bookmarks;
create policy social_bookmarks_read on public.zuzucord_social_bookmarks for select to authenticated
 using(user_id=(select auth.uid()));
drop policy if exists social_bookmarks_insert on public.zuzucord_social_bookmarks;
create policy social_bookmarks_insert on public.zuzucord_social_bookmarks for insert to authenticated
 with check(user_id=(select auth.uid()) and (select public.zuzucord_my_account_active()));
drop policy if exists social_bookmarks_delete on public.zuzucord_social_bookmarks;
create policy social_bookmarks_delete on public.zuzucord_social_bookmarks for delete to authenticated
 using(user_id=(select auth.uid()));

drop policy if exists social_comments_read on public.zuzucord_social_comments;
create policy social_comments_read on public.zuzucord_social_comments for select to authenticated
 using((select public.zuzucord_my_account_active()));
drop policy if exists social_comments_insert on public.zuzucord_social_comments;
create policy social_comments_insert on public.zuzucord_social_comments for insert to authenticated
 with check(author_id=(select auth.uid()) and (select public.zuzucord_my_account_active()));
drop policy if exists social_comments_delete on public.zuzucord_social_comments;
create policy social_comments_delete on public.zuzucord_social_comments for delete to authenticated
 using(author_id=(select auth.uid()) or (select public.zuzucord_has_role('owner')));

drop policy if exists social_follows_read on public.zuzucord_social_follows;
create policy social_follows_read on public.zuzucord_social_follows for select to authenticated
 using((select public.zuzucord_my_account_active()));
drop policy if exists social_follows_insert on public.zuzucord_social_follows;
create policy social_follows_insert on public.zuzucord_social_follows for insert to authenticated
 with check(follower_id=(select auth.uid()) and (select public.zuzucord_my_account_active()));
drop policy if exists social_follows_delete on public.zuzucord_social_follows;
create policy social_follows_delete on public.zuzucord_social_follows for delete to authenticated
 using(follower_id=(select auth.uid()));

create or replace function public.zuzucord_social_rate_limit()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(new.author_id::text));
 if (select count(*) from public.zuzucord_social_posts
   where author_id=new.author_id and created_at>now()-interval '60 seconds') >=6
 then raise exception 'Posting too quickly. Try again in a minute.' using errcode='P0001'; end if;
 return new;
end;$$;
drop trigger if exists zuzucord_social_posts_limit on public.zuzucord_social_posts;
create trigger zuzucord_social_posts_limit before insert on public.zuzucord_social_posts
 for each row execute function public.zuzucord_social_rate_limit();
revoke all on function public.zuzucord_social_rate_limit() from public,anon,authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('zuzucord-social-media','zuzucord-social-media',false,26214400,
 array['image/png','image/jpeg','image/webp','image/gif','video/mp4','video/webm'])
on conflict(id) do update set file_size_limit=excluded.file_size_limit,
 allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists zuzucord_social_storage_upload on storage.objects;
create policy zuzucord_social_storage_upload on storage.objects for insert to authenticated
 with check(bucket_id='zuzucord-social-media' and
 (storage.foldername(name))[1]=(select auth.uid())::text and (select public.zuzucord_my_account_active()));
drop policy if exists zuzucord_social_storage_read on storage.objects;
create policy zuzucord_social_storage_read on storage.objects for select to authenticated
 using(bucket_id='zuzucord-social-media' and (select public.zuzucord_my_account_active()) and
 ((storage.foldername(name))[1]=(select auth.uid())::text or
 exists(select 1 from public.zuzucord_social_posts p where p.media_path=name)));
drop policy if exists zuzucord_social_storage_delete on storage.objects;
create policy zuzucord_social_storage_delete on storage.objects for delete to authenticated
 using(bucket_id='zuzucord-social-media' and (storage.foldername(name))[1]=(select auth.uid())::text);
