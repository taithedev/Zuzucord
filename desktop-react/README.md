# ZuzuCord React Desktop (Windows)

This is the **new Windows-native desktop interface** using **React 19 + TypeScript + Electron**, following the supplied Discord interface layout reference: dual navigation rails, Friends and DMs, communities, channels, chat and an optional right activity sidebar. It does **not** embed discord.com and is not the Discord client. It connects directly to **your own ZuzuCord Supabase backend**.

The existing working **C# / Siticone WinForms project remains in `src/ZuzuCord`** during this UI transition. Both clients share the existing `zuzucord_` backend tables and authorization rules, but they are separate executables.

## Windows setup

Open this folder in **Visual Studio Code** or **Visual Studio 2026** with Node.js/TypeScript tooling. Install Node.js 22+.

```powershell
npm install
npm start
```

This builds the React UI, then launches the Electron desktop app locally. To package Windows:

```powershell
npm run build:win
```

The packaging script creates a valid 256×256 Windows icon from your existing `website/assets/zuzucord-icon.webp` using Sharp, then builds an NSIS setup and portable ZIP under `release/`. GitHub Actions builds the same targets from `.github/workflows/react-desktop.yml`.

## Appearance controls

Open **Themes** or the left palette icon. Customize OLED/Graphite/Midnight, six accent swatches or a color picker, a two-stop radial gradient, glass/glow strength, compact view and animated ambient background. UI changes save in the desktop user profile. **Every registered ZuzuCord user** can sync preferences and preferred server with the separate beta website; production preferences are stored in `zuzucord_user_sync` with per-user RLS; the original beta table remains separate.

Use the Windows system's reduced-motion preference to disable animation.

## Security

- Electron uses `contextIsolation`, sandboxing, disabled Node integration and no arbitrary navigation.
- Supabase keys in the renderer are **public/publishable**, never service-role credentials.
- Supabase Auth refresh sessions use `electron.safeStorage` through a minimal preload interface. On Windows this encrypts persistent session data with the OS account. If OS encryption is unavailable, storage falls back to memory only.
- Accounts, friend requests, chat, bot commands and server membership use the existing Supabase row-level security checks.
- Bot commands run server-side through a restricted RPC.
- `username@zuzucord.com` is a **login alias, not an email inbox**.

## Working feature scope

Sign in, username registration, user profile, public text channels, member-only servers, create/join servers, create channels, friend requests, accepted-friend DMs, server members, owner/admin role changes, ZuzuBot commands, active activity summaries, optional beta appearance sync, and Windows UI personalization.

**Not implemented**: Discord API interoperability, official Discord identity, voice/video calls, live games/activities, attachments, platform-wide public presence, notifications, and a bot hosting platform. The Friends > Online tab displays real check-ins from active ZuzuCord React users, visible only to accepted friends through Supabase RLS. No synthetic active users are shown. The Activity sidebar uses only actual ZuzuCord server/friend data.

The app is a **preview**. Type checking and packaging in CI do not replace real Windows UI testing, Supabase multi-user testing, accessibility checks, and signing the release before wide distribution.

## Online presence and privacy

The React client sends a heartbeat approximately every 45 seconds and considers accepted friends online while their last heartbeat is under roughly 135 seconds old. The `zuzucord_friend_presence` table enforces read access for the account owner and **accepted friends only**. Online status is not a public directory and does not describe other clients that do not implement the heartbeat. The table and access rules are in `supabase/migrations/20261021_zuzucord_friend_presence.sql`.

The screenshot-informed UI intentionally follows a familiar communities/friends/activity layout, with original ZuzuCord branding and theme controls rather than using Discord's proprietary icons or claiming official integration.

## ZuzuCord 0.8 developer ecosystem

Official announcements are a read-only global inbox available to every registered user; developer publishing is rate-limited server-side. User roles (developer, verified, beta tester) are stored in server-managed records, with regular user as the default. ServerBoostCredits are granted by developers only and expand a boosted server's channel capacity from 30 to 40, 50 or 60. Server owners may install approved ZuzuCord bot applications whose tokens are generated and stored hashed by the dedicated Edge API. The separate `zuzucorddevportal` folder is deployable as a Vercel site; a privileged administrator must explicitly provision its developer role.

The packaged app checks official GitHub releases for `v`-prefixed tags. Users may download a qualifying Windows installer through the application, but unsigned EXEs are never silently executed. See `UPDATES.md`.
