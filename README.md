# ZuzuCord V2

## New React Windows Desktop (v0.8 preview)

**New primary UI direction:** `desktop-react/` is a separate, packaged Windows app using **React 19 + TypeScript + Electron**, with a dark OLED Discord-inspired friends/community layout based on the provided screenshot. It is a **Windows application**, not a browser tab or a discord.com wrapper.

- Dual server/navigation rails, Friends tabs, accepted-friend DMs and real privacy-scoped online presence
- Native window controls, community channels, editable profiles, bot messages and activities drawn from existing Supabase data
- Reworked Appearance editor for colors, OLED/Graphite/Midnight, two-stop gradients, ambient glow, motion and compact UI
- Secure saved login using Windows Electron `safeStorage` with an OS-account encrypted token
- Production account sync for all registered users via `website/sync.html`, including gradient, accent, motion, glass and preferred server
- Existing C# WinForms app remains in `src/ZuzuCord/` as the legacy preview while the new desktop UI is validated

**Build on Windows**: `cd desktop-react && npm install && npm run build:win`. The new installer and ZIP are produced in `desktop-react/release/` and published through `.github/workflows/react-desktop.yml`. Read `desktop-react/README.md` for implementation and known feature limits.

The React interface is a ZuzuCord app inspired by common chat-app layout patterns, **not an official Discord client**. Voice/video, file attachments and custom third-party bot hosting are not yet built.

ZuzuCord is an independent social messaging project, with a **native C#/.NET 8 Windows app using Siticone NetCore UI** and a black-and-white **download website**. It uses the existing Zuzify Supabase project while storing its own feature data under the `zuzucord_` prefix.

ZuzuCord **is not Discord**, does not use Discord user tokens, and is not affiliated with Discord Inc.

## Status

**Beta / preview software (v0.6).** GitHub Actions builds the .NET application; website CI checks syntax and local assets. Build success does not prove every runtime path works. Voice/video calls, media uploads, full guild moderation, push notifications, and exact ZuzifySocials UI parity are not yet implemented.

## What is implemented

- Native Windows Forms app with OLED Black default, responsive server navigation, channel list, message search, profile editing, custom accent colors, setup, and protected remembered sign-in
- Supabase email/password sign-in and **username-only accounts** (created through a server-side registration function)
- Public channels and messages, private DMs, friend requests, custom servers, member-only server channels, invite codes, server member management, owner/admin roles
- RLS-protected `zuzucord_` tables, trusted first-party ZuzuBot commands and live aggregated Supabase community stats (registered today, banned today, active bans, users, servers, messages)
- Website with user-provided brand art, interactive UI preview, GitHub downloads, and live account/ban/server/message totals
- A Vercel-ready `beta-website/` folder on `main` and the earlier experimental `beta-website` branch
- Automated Windows x64 compilation, artifact verification and public preview ZIP release

## Windows first-run setup and saved login

On first launch ZuzuCord shows a saved setup wizard for OLED Black (default), Graphite or Midnight, plus an opt-in to remember the session. Every launch retains the startup notice.

When Remember Login is enabled, the app saves only the Supabase **refresh token**, encrypted under Windows DPAPI CurrentUser at `%LOCALAPPDATA%\\ZuzuCord\\login.bin`. It never saves passwords as text. Refresh-token rotation updates the encrypted vault. Signing out deletes the saved token. Settings and custom accent are saved locally in `%LOCALAPPDATA%\\ZuzuCord\\settings.json`.

The **Appearance** window provides built-in dark themes, a native accent-color picker, Reset Defaults and optional beta-only synchronization.

## Beta website sync

The separate `beta-website/` folder contains a static site, `vercel.json`, branding, and `sync.html`. To deploy a new Vercel project, set Root Directory to **`beta-website`** and Framework Preset to **Other**. The stable website remains in `website/`.

Only manually approved `zuzucord_beta_testers` may synchronize theme and accent colors between the website and Windows. Eligibility is checked through Supabase Auth and RLS policies on `zuzucord_beta_sync`; **no public signup automatically grants beta access**. Users must opt into syncing in the Windows Appearance screen as well. The app checks for web changes about once a minute. Website sign-in tokens are held only in browser memory.

To approve a username, run in the Supabase project's privileged SQL editor:

```sql
insert into public.zuzucord_beta_testers (user_id, enabled)
select user_id, true from public.zuzucord_accounts where username = 'tester_username'
on conflict (user_id) do update set enabled = excluded.enabled;
```

Sync includes theme, accent and preferred server. Created/joined servers are always stored in Supabase, while beta-only default-server synchronization requires tester access. It does **not** sync passwords, private tokens or arbitrary files.

## Compatibility / Windhawk

The app uses native WinForms windows and standard Windows window chrome; it does not inject or install shell hooks. This is a compatibility-conscious design for Windows 10/11 and Visual Studio's .NET desktop tooling, **not a guarantee that every Windhawk mod is compatible**. Test specific mods with the unsigned preview build before release. Windhawk is separate third-party software.

## ZuzuCord ID and authentication

The account table stores a generated `login_alias` such as `someone@zuzucord.com`. Users can enter that alias, their bare username, or a pre-existing account email in the Windows app.

**Important:** This is a login alias, not a working email inbox. Supabase Auth continues to use a reserved `@users.zuzucord.invalid` identifier for username-only accounts. This avoids inventing verified addresses at a potentially unconfigured domain and keeps existing accounts working. Deliverable email addresses require verified domain ownership, email provider configuration, and safe account migration. Email-based password recovery is not available for username-only users.

## Siticone UI

The application references `Siticone.NetCore.UI` version 2026.9.9. The new `SiticoneShell` builds native Siticone navigation controls and an OLED accent panel, and falls back gracefully to WinForms controls if the runtime cannot load a component. Existing login, friends, messages and profile forms use the shared OLED styles. For third-party package terms and updates, see [Siticone](https://www.siticoneframework.com/) and NuGet.

## Windows application

Open `src/ZuzuCord/ZuzuCord.csproj` in Visual Studio 2026 with the **.NET desktop development** workload. Requires .NET 8 SDK.

```powershell
dotnet run --project src/ZuzuCord/ZuzuCord.csproj
```

To make a portable self-contained build:

```powershell
dotnet publish src/ZuzuCord/ZuzuCord.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -o dist/windows
```

After a successful push-triggered Windows build, the workflow publishes an **unsigned preview release ZIP** to GitHub Releases. Extract it and run `ZuzuCord.exe`. Windows SmartScreen may prompt for an unsigned application; verify the release and publisher yourself before running.

## Website and registration

`website/index.html` is the stable source. `beta-website/` is a fully separate Vercel-ready folder, while a legacy `beta-website` Git branch also exists. Its username-only signup form calls the Supabase Edge Function `zuzucord-register`, which creates a confirmed Supabase Auth account using an internal non-deliverable login identifier. Registration is rate limited, stores no plaintext passwords in custom tables, and only creates accounts—not signed-in web sessions.

The Windows client accepts either an existing email address or a ZuzuCord username as the login identifier. Username-only accounts **cannot recover their passwords through email**; this is an important limitation. Do not lose the password.

The website's statistics come from the public, aggregate-only Supabase RPC `zuzucord_public_stats`:
- `total_users` — rows in `zuzucord_accounts` only
- `created_today` — new ZuzuCord accounts since midnight UTC
- `banned_users` — currently active ZuzuCord ban records
- `total_messages` — messages stored in public chat rooms

Shared Zuzify Auth accounts are included only after joining ZuzuCord. Nothing from other apps' account tables is included.

The 3D preview is an **illustrative local demo**; its messages and channel switching are not live conversations. Public GitHub release download totals count downloadable release assets, not unique installations.

## Project layout

- `src/ZuzuCord/` — native Windows application source
- `website/` — static download, statistics, signup website
- `beta-website/` — separately deployable beta download site and tester-only appearance sync
- `website/assets/` — web-optimized versions of the supplied ZuzuCord icon and banner
- `.github/workflows/windows-build.yml` — Windows build and preview release
- `.github/workflows/website-check.yml` — validates stable and beta website branches
- `.github/workflows/website-pages.yml` — optional manual Pages publish
- `BRANCHING.md` — release/beta workflow and naming

See `website/privacy.html`, `website/terms.html`, and SECURITY.md for safety and limitations.

## Deployment

GitHub source changes do **not** automatically make the download site public. GitHub Pages requires an enabled Pages setup and a successful publish workflow; Vercel requires project creation and repository permissions. No live website URL is claimed until confirmed by the host.


## Community servers and permissions (v0.5)

The Windows application includes a **Servers** rail. Any signed-in active ZuzuCord user can create a server (limited to 10 owned servers), receive an owner-only invite code, join a server through an invite code, send messages in joined server channels, and manage member lists. Owners and admins can create channels; owners can assign admin/member roles. Owners/admins can remove members according to their privilege, and non-owner members can leave.

Every new database table uses the `zuzucord_` prefix. The server schema comprises `zuzucord_servers`, `zuzucord_server_members`, `zuzucord_server_channels`, and `zuzucord_server_messages`. Messages and channels are protected by membership-aware RLS, while administrative operations run through authenticated, permission-checked PostgreSQL RPCs. Anonymous users cannot create or join servers.

In the separate `beta-website/sync.html` page, approved testers can create/join servers, choose their preferred server, and sync that selection to the Windows app alongside OLED theme colors. When sync is enabled, Windows checks for new memberships and preferences approximately once per minute.

This is **a ZuzuCord community platform inspired by chat apps**, not a complete replica of Discord. Voice/video, file attachments, threaded discussions, event scheduling, web-based full messaging, moderation reports and production end-to-end tests remain future work. Don't claim feature parity or zero errors just from successful builds.


## ZuzuBot (v0.6)

Inside a server text channel, type `/help` to list the built-in commands:
`/ping`, `/rules`, `/members`, `/roll`, and `/time`. The slash command is processed through the authenticated Supabase RPC `zuzucord_run_bot_command`; it posts a command and a labeled **ZuzuBot [BOT]** response that everyone in the channel can see. Server owners can disable or enable the bot in the Windows **ZuzuBot** panel.

The bot cannot be impersonated by directly inserting `bot_name` from a client because the regular-message RLS policy prohibits it. Commands require server membership and active account status and have a 3-second per-user/channel cooldown. It is a fixed-command first-party bot, **not** an AI model, a customizable scripting sandbox, or an official Discord bot.

## Real website account and moderation statistics

The main and beta websites place account totals first and request `public.zuzucord_public_stats()` directly from Supabase every minute. Counts cover **ZuzuCord-specific** registered users, accounts created today (UTC), currently active bans, bans recorded today, community servers and messages. GitHub is used **only** for downloads, releases and build status. The stats RPC returns anonymous aggregate counts only; it does not expose user lists or ban reasons.

The repository migration `supabase/migrations/20261021_zuzucord_v06_bot_and_live_stats.sql` records the exact bot and stats backend. Website automated tests simulate GitHub outages and verify Supabase counters still load. For production deployment, validate the workflows on real Windows machines and verify account, moderation and server behavior with approved test accounts.

## ZuzuCord v0.10: Crystals and server perks

Crystals are free, server-managed points, granted by developers and spent on permanent server boosts (100 per level). Boost levels unlock channel capacity, a custom accent, a gradient and an upgraded-server badge. The desktop application has a Crystals wallet and ledger; the redesigned OLED website explains the tiers without advertising paid currency. Legacy credits remain usable. The implementation and security controls are documented in `desktop-react/README.md` and `supabase/migrations/20261021_zuzucord_crystals_nonmonetary_server_perks.sql`.

## Native ZuzifySocials features for Windows (October 2026)

The first migration of [ZuzifySocials](https://github.com/taithedev/ZuzifySocials) into the ZuzuCord **React Windows app** adds a native **Socials** area. Signed-in members can create posts and Moments with photos or short videos, like and comment, follow creators, save posts, search recent updates and view the Discover feed. Creators can be hidden from the personal feed, and members can submit reports. ZuzuCord platform Owners can review reports and remove offending posts. Media lives in a private Supabase Storage bucket with signed URLs and a maximum upload size of 25 MB.

The original ZuzifySocials site uses a **different Supabase project**, so no legacy login records, passwords, posts or private conversations have been silently copied. The Windows app continues to use its own `zuzucord_` backend, including Row Level Security and its existing accounts.

**This is an initial native feature port, not yet full feature parity.** Legacy Stories, the full Games Hub, Zuz Edit game editor/runtime, creator marketplace, music library and advanced creator/owner tools require separate work. See [the feature migration status](desktop-react/ZUZIFY_SOCIALS_PORT.md) for what is operational and what still needs porting.
