# ZuzuCord beta website (Vercel root)

This folder is self-contained and ready to deploy as a separate Vercel site.

**Vercel settings:** GitHub repository `taithedev/Zuzucord`, production branch `main`, Root Directory `beta-website`, Framework Preset `Other`, no build command. Static files are served from this folder.

- `index.html`: experimental download/registration site.
- `sync.html`: approved-tester-only website-to-Windows appearance sync.
- `sync.js`: Supabase Auth sign-in and authorized RLS access.
- `beta.css`: OLED interface and responsive beta controls.
- `app.js`: GitHub statistics, Supabase aggregate counts and web-only account registration.
- `vercel.json`: static hosting defaults.

## Security

The public beta website can be viewed by anyone; **only approved testers can sign in and use app theme sync**. Beta access is off by default. Approve a ZuzuCord username in the existing Zuzify Supabase project using its privileged SQL Editor:

```sql
insert into public.zuzucord_beta_testers (user_id, enabled)
select user_id, true from public.zuzucord_accounts where username = 'tester_username'
on conflict (user_id) do update set enabled = excluded.enabled;
```

The `zuzucord_is_beta_tester` RPC and RLS on `zuzucord_beta_sync` validate actual JWT identity; no website checkbox grants access. The Windows user also opts into beta sync in **Appearance**. The feature synchronizes theme preset, accent and selected home server—not passwords, private chat history or Windows credentials.

Website access tokens stay in memory only. Reloading requires sign-in again; passwords are never stored in the website. Only publishable Supabase keys are exposed. Do not deploy service-role keys in frontend code.

For independent deploys of stable and beta, configure separate Vercel projects with distinct root directories (`website` and `beta-website`).

## Shared community servers

Approved beta testers can create or join servers from `sync.html`. This uses the same `zuzucord_create_server` and `zuzucord_join_server` database RPCs as the Windows app. Server membership and messages are always shared through Supabase; the additional beta-specific sync saves the current selected server to the RLS-protected `zuzucord_beta_sync.last_server_id`. The app refreshes its server list roughly once per minute. Only joined servers appear in the beta server selector.
