-- Applied to Zuzify Supabase for React desktop and beta website personalization.
-- Existing beta tester RLS remains unchanged.
alter table public.zuzucord_beta_sync
 add column if not exists gradient_enabled boolean not null default false,
 add column if not exists gradient_start text not null default '#170826',
 add column if not exists gradient_end text not null default '#320d50',
 add column if not exists glass_strength integer not null default 55,
 add column if not exists motion_enabled boolean not null default true;
alter table public.zuzucord_beta_sync
 add constraint zuzucord_gradient_start_hex check (gradient_start ~ '^#[0-9a-fA-F]{6}$'),
 add constraint zuzucord_gradient_end_hex check (gradient_end ~ '^#[0-9a-fA-F]{6}$'),
 add constraint zuzucord_glass_strength_bounds check (glass_strength between 0 and 100);
