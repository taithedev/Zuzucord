# ZuzuCord V2 — Website

The standalone static website includes:
- true-black OLED color palette;
- user-supplied icon and banner, optimized to WebP for web delivery;
- mouse-follow tilt and clickable channel preview (**illustrative, no real messages sent**);
- GitHub release downloads and repository/build statistics;
- real **ZuzuCord-only** account count, accounts registered since 00:00 UTC, active bans, and public message totals, fetched via an aggregate Supabase RPC;
- email-free **username + password registration**, via the server-side `zuzucord-register` Edge Function;
- privacy overview and community guidelines.

### Important account details

The website **only creates accounts**. Users sign into the Windows application to access chats. Username-only users have an internal non-deliverable identifier, so **email password recovery is unavailable**. Signup requests are rate limited; passwords are sent only to the registration function and Supabase Auth over HTTPS, not to GitHub or the static host.

Never put Supabase service-role keys or private credentials in website code. The included publishable key is intended for public browser use; all data access must be restricted by RLS and server-side function authorization.

### Host

Deploy the `website/` folder to a static host (Vercel root directory `website`, or GitHub Pages). GitHub Actions currently provides an optional manual Pages workflow. Creating/updating repository files alone does not publish a website URL.

### Beta testers

Branch `beta-website` has an experimental UI and bug-report links. Keep its deployment separate from main to avoid overwriting the stable site.

## Public login alias

ZuzuCord sign-in IDs are shown as `username@zuzucord.com`. These are **aliases, not actual mailboxes**. The Supabase database generates the alias from each unique username; the Auth service retains its internal reserved identifier so earlier accounts are not invalidated. Password recovery by email is not available for this flow.

## v0.6 statistics

Community statistics load from Supabase RPC `zuzucord_public_stats` and refresh once per minute, independent of GitHub. This reports registered ZuzuCord accounts, new accounts today, active bans, bans recorded today, messages and servers. GitHub API counts remain development-only. The `website/community-stats.smoke.test.mjs` exercise verifies counters remain available during GitHub API outages.
