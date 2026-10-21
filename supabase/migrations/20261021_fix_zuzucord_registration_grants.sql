-- ZuzuCord registration hotfix (2026-10-21).
-- Root cause: the Edge Function's Supabase Auth admin call worked, but PostgREST
-- returned "permission denied for table zuzucord_accounts" when the service-role
-- client tried to link the new Auth user to their ZuzuCord username.
--
-- The service_role bypasses RLS but still requires Postgres table grants.
-- Only grant the backend what this workflow needs; never share its secret key.
grant usage on schema public to service_role;
grant select, insert on table public.zuzucord_accounts to service_role;
grant execute on function public.zuzucord_claim_signup_slot(text) to service_role;

-- Keep anonymous registration inserts blocked; public registration must pass
-- through the checked, rate-limited zuzucord-register Edge Function.
revoke insert, update, delete on table public.zuzucord_accounts from anon;
