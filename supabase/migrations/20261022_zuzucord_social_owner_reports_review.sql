-- Owner-only report review, maintaining reporter privacy and row-level security.
grant update(reviewed_at) on public.zuzucord_social_reports to authenticated;
drop policy if exists social_report_owner_review on public.zuzucord_social_reports;
create policy social_report_owner_review on public.zuzucord_social_reports
 for update to authenticated
 using((select public.zuzucord_has_role('owner')) and (select public.zuzucord_my_account_active()))
 with check((select public.zuzucord_has_role('owner')) and (select public.zuzucord_my_account_active()));
