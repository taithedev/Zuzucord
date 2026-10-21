# ZuzuCord V2

ZuzuCord V2 is a community messaging application with a native **C# / .NET 8 Windows client**, a standalone download website, and Supabase-backed account authentication and public chat rooms.

**This is ZuzuCord's own social app. It is not a Discord client and is not affiliated with Discord Inc.**

## Directories

| Folder | Purpose |
| --- | --- |
| `src/ZuzuCord/` | Native Windows Forms desktop client (.NET 8; opens in Visual Studio 2026) |
| `website/` | Public downloads landing page and real GitHub project statistics |
| `.github/workflows/windows-build.yml` | Compiles and publishes Windows x64 ZIP artifact |
| `.github/workflows/website-check.yml` | Tests the static download website |
| `.github/workflows/website-pages.yml` | Optional manual GitHub Pages deployment |

## Running the Windows app

Install .NET 8 SDK and open `src/ZuzuCord/ZuzuCord.csproj` in Visual Studio with the .NET desktop development workload. Press F5.

Or use PowerShell:

```powershell
dotnet run --project src/ZuzuCord/ZuzuCord.csproj
```

Build a portable self-contained Windows package:

```powershell
dotnet publish src/ZuzuCord/ZuzuCord.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -o dist/windows
```

Use the **Actions > ZuzuCord V2 Windows Build** workflow to obtain a build artifact once CI passes. Artifacts are not public releases; creating a release with a signed installer is a separate distribution step.

## What works in this native version

- Startup notice that requires consent on every launch
- Email/password sign-in and registration via Supabase Auth
- Public rooms (`general`, `introductions`, `development`)
- Read recent messages and send messages in authorized rooms
- Automatic message refresh every 15 seconds
- Access-token refresh, request errors and a dark Windows UI
- Secrets are not written to local files; only a **public Supabase publishable key** is shipped in the source

All newly created database tables start with `zuzucord_`. The existing `zuzify_` data has not been renamed or deleted.

**Limitations:** This is not yet a pixel-perfect copy of the older ZuzifySocials web interface. The Windows client has basic text chat and authentication; it does not yet include calls, file uploads, moderation dashboard, or complete ZuzifySocials feature parity. Visual Studio/CI compilation does not prove that all runtime flows are error-free.

The separate [ZuzifySocials repository](https://github.com/taithedev/ZuzifySocials) contains an earlier Windows build that bundles the full website UI; keep it for the UI reference and migration work.

## Download website

The `website/` directory is a self-contained static website and can be deployed on Vercel or GitHub Pages. It displays actual GitHub API statistics: stars, release downloads, published releases and latest Windows build status. Its primary download button links to a Windows release asset only when an actual asset is published.

If no release exists, it links to GitHub Actions instead and clearly labels the build as a development artifact.

## Security / policy

Do not commit private credentials, service-role keys, or personal Discord account tokens. A public Supabase publishable key is designed for distribution. Access to chat and user records is enforced by Supabase row-level security. Users are responsible for following the service's rules. See [SECURITY.md](SECURITY.md).
