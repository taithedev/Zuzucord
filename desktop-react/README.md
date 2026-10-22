# ZuzuCord React Desktop (Windows)

This is the **new Windows-native desktop interface** using **React 19 + TypeScript + Electron**, following the supplied Discord interface layout reference: dual navigation rails, Friends and DMs, communities, channels, chat and an optional right activity sidebar. It does **not** embed discord.com and is not the Discord client. It connects directly to **your own ZuzuCord Supabase backend**.

The existing working **C# / Siticone WinForms project remains in `src/ZuzuCord`** during this UI transition. Both clients share the existing `zuzucord_` backend tables and authorization rules, but they are separate executables.


## Windows installer: install, repair and uninstall (v0.9)

ZuzuCord's Windows NSIS setup uses an assisted wizard (`oneClick: false`) and a custom include at `build/installer.nsh`. When it recognizes an existing installation's `Uninstall ZuzuCord.exe`, it offers:

- **Yes — Repair/Reinstall:** continue through the installer, replace application files, and preserve local sign-in/preferences.
- **No — Uninstall:** run the existing standard ZuzuCord uninstaller. The app is also listed in Windows Settings → Apps → Installed apps.
- **Cancel:** leave the installation unchanged.

If an older installer uses a different installation directory or uninstaller name, its installation may not be auto-detected; uninstall from Windows Settings in that case. Do not use Windows Installer's repair command for the portable ZIP version, which is not an installed application. This is a preview that needs testing on real Windows machines.

## Community roles and ZuzuCord Owner

Server owners can now open **Manage server roles** to create colored custom roles (up to 30 per server), grant **Manage Channels, Manage Members, Manage Bots**, edit roles and assign them to users. Member lists display colored custom-role badges. Native owner/admin/member roles remain, and custom moderation permissions are enforced by Supabase RPCs, not by UI-only checks. Custom moderators cannot remove the server owner or administrators. Per-server role settings are stored in `zuzucord_server_roles` and `zuzucord_member_custom_roles`.

The ZuzuCord platform's verified `taithedev` account also has the **Owner** role. The Owner console can grant/revoke developer, verified and beta-tester status for existing users, but **cannot grant additional platform Owner roles**. Server Owner is a separate permission held by a server's creator.

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

Open **Themes** or the left palette icon. Customize OLED/Graphite/Midnight, six accent swatches or a color picker, a two-stop radial gradient, glass/glow strength, compact view and animated ambient background. UI changes save in the desktop user profile. **Every registered ZuzuCord user** can sync preferences and preferred server with the main production website; production preferences are stored in `zuzucord_user_sync` with per-user RLS; the original beta table remains separate.

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

Starting with v0.11, the installed NSIS app checks for newer **published stable v-prefixed versions**, automatically downloads the updater's SHA-512-verified setup package, and installs it over the existing application when the user closes ZuzuCord. **Restart & update** applies it sooner. Earlier v0.10 builds require one new installation to acquire the updater. See `UPDATES.md` for release metadata, limitations and required code signing.

## Crystals economy (v0.10)

Crystals are **nonmonetary, non-purchasable ZuzuCord virtual points**. A developer can grant 1–1,000 Crystals to an existing registered account through the ZuzuCord developer portal. Grants are checked against the developer role on Supabase and recorded in an owner-only transaction ledger. Members can see their current balance and transaction history from the Windows app's **Crystals** rail. Members cannot mint, transfer, purchase, cash out or edit their own balances.

Each permanent server boost costs **100 Crystals** and requires server membership. Upgrades are capped at three levels:

- Level 1: 40 channels plus an owner-selected server accent color.
- Level 2: 50 channels plus a two-color server gradient.
- Level 3: 60 channels plus a visible Level 3 boosted-server badge.

The server checks balance and level, locks concurrent upgrades, debits the wallet, records the transaction and adds the boost in **one database transaction**. Existing ServerBoostCredits are **preserved and spendable** at one legacy credit per boost (equivalent to 100 Crystals) rather than being duplicated or deleted. These legacy credits show as Crystal-equivalent spendable balance in the new UI. They remain distinct database units for older app compatibility.

The public website also displays the **real total number of server boosts** from aggregate Supabase statistics. No individual wallet details or transaction histories are public.

## Installed-app automatic updater (v0.11+)

The Windows `.exe` is installed **once**. After installation, ZuzuCord automatically checks its official GitHub release feed on startup and about every four hours, downloads updates in the background, displays progress, and installs the downloaded update automatically on normal app exit. **Restart & update** is available when the download completes. The update metadata `latest.yml`, matching NSIS setup installer, and `.blockmap` are uploaded together with a stable tag (such as `v0.11.77`). This workflow does not apply to portable ZIP usage; see [UPDATES.md](UPDATES.md). Unsigned preview installer updates still need signing and real Windows end-to-end tests.
