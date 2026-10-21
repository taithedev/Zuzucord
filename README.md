# ZuzuCord V2

ZuzuCord is an independent social messaging project, with a **native C#/.NET 8 Windows app** and a black-and-white **download website**. It uses the existing Zuzify Supabase project while storing its own feature data under the `zuzucord_` prefix.

ZuzuCord **is not Discord**, does not use Discord user tokens, and is not affiliated with Discord Inc.

## Status

**Beta / preview software.** GitHub Actions builds the .NET application; website CI checks syntax and local assets. Build success does not prove every runtime path works. Voice/video calls, media uploads, full guild moderation, push notifications, and exact ZuzifySocials UI parity are not yet implemented.

## What is implemented

- Native Windows Forms app with dark OLED-style theme, channel list, refresh, local message search, profile editing, sign in/out
- Supabase email/password sign-in and **username-only accounts** (created through a server-side registration function)
- Public channels, messaging, a friends list, friend requests, and direct messages between accepted friends
- Isolated RLS-protected `zuzucord_` tables and aggregate community stats
- Website with user-provided brand art, 3D-tilt/channel-switching demo, GitHub downloads, and live account/ban/message totals
- A `beta-website` branch with experimental styling and feedback links
- Automated Windows x64 compilation, artifact verification and public preview ZIP release

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

`website/index.html` is the stable source. `beta-website` has a separate beta-only presentation. Its username-only signup form calls the Supabase Edge Function `zuzucord-register`, which creates a confirmed Supabase Auth account using an internal non-deliverable login identifier. Registration is rate limited, stores no plaintext passwords in custom tables, and only creates accounts—not signed-in web sessions.

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
- `website/assets/` — web-optimized versions of the supplied ZuzuCord icon and banner
- `.github/workflows/windows-build.yml` — Windows build and preview release
- `.github/workflows/website-check.yml` — validates stable and beta website branches
- `.github/workflows/website-pages.yml` — optional manual Pages publish
- `BRANCHING.md` — release/beta workflow and naming

See `website/privacy.html`, `website/terms.html`, and SECURITY.md for safety and limitations.

## Deployment

GitHub source changes do **not** automatically make the download site public. GitHub Pages requires an enabled Pages setup and a successful publish workflow; Vercel requires project creation and repository permissions. No live website URL is claimed until confirmed by the host.
