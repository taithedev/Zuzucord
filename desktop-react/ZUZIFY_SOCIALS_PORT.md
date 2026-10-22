# ZuzifySocials → ZuzuCord native Windows migration

The source repository is **taithedev/ZuzifySocials**. It is a separate static HTML/JavaScript application with profiles, Moments, messaging, games, Zuz Edit, themes, creator tools and owner management. It uses Supabase project `iaqxhbpsakuducnacaih`.

ZuzuCord uses its own Supabase project `wfqudstuncdldsvxqveu` and ships a React/TypeScript + Electron **installed Windows app**. Instead of embedding the old website or silently moving credentials, this migration adapts features into native React screens and stores new content in `zuzucord_` tables.

## Implemented in this migration

- New **Socials** navigation entry in the Windows app with full-width feed and native OLED design
- Text posts and Moments with optional photo or short video uploads (PNG, JPEG, WebP, GIF, MP4 or WebM, 25 MB maximum)
- A private Supabase media bucket; files can be viewed by signed-in members through time-limited authorized URLs
- Socials feeds for **For You**, **Moments**, **Following**, **Saved**, **Discover**, and **Hidden**
- Social media likes, threaded post comments (single level), private bookmarks, and creator following
- Search within recent posts, newest/most-liked sorting, and a creator-discovery list
- Per-user **Hide creator** preference; can be reversed from the Hidden tab
- Content reporting, server-checked Owner deletion, and a separate Owner moderation queue with reviewed status
- Posting rate limits and RLS on every new data table, with user-specific write authorization
- The production website now explains Socials and Moments alongside existing servers, friends, roles and Crystals

## Already offered by ZuzuCord

- Existing ZuzuCord accounts, saved Windows sign-in, profiles and status
- Public and server channels, private friends and DMs
- Server roles, bots, official announcements and boosts
- OLED themes/gradients, the settings screen, auto-update, and production website sync

## Still not ported

This does **not** replicate all ZuzifySocials features yet. Not migrated: old Socials account data and posts, legacy Stories, music overlay and audio catalog, the Games Hub, Zuz Edit visual programming and game runtime, creator marketplace and publishing, experimental modules, the legacy paid/subscription logic, legacy owner dashboards, or legacy direct and voice communication data. These systems require scoped rewrites and matching server-side RLS/migration rather than copying the older `app.js` wholesale.

The app intentionally retains the ZuzuCord database and **does not** expose or transport passwords, refresh tokens, private messages, or records from the old Supabase project.

## Verification

The migration scripts are `supabase/migrations/20261022_zuzucord_socials_native_port.sql`, `20261022_zuzucord_social_reports_and_hidden_creators.sql` and `20261022_zuzucord_social_owner_reports_review.sql`.

Review project SQL permissions and bucket policy with Supabase's security advisor after applying. Validate signup, post publishing, upload, commenting, likes, hiding, reporting, and Owner removal with separate real test accounts before a wide public release. A GitHub Actions build passing doesn't establish end-to-end live-user testing.

The social feed currently retrieves **100 recent posts**. Full pagination, global user discovery, upload editing, notification fan-out and large-scale content moderation remain future work.
