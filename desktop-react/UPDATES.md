# ZuzuCord installed Windows app: automatic updates (v0.11+)

**First install:** download the ZuzuCord Windows NSIS `.exe` and run setup once. This adds the installed desktop application, Start Menu shortcut, and normal Windows uninstall/repair controls.

**After installation:** the ZuzuCord app itself checks the official [GitHub Releases](https://github.com/taithedev/Zuzucord/releases) on startup (about eight seconds after opening) and every four hours while running.

* Only a newer **published stable GitHub release** tagged `vMAJOR.MINOR.PATCH` (for example `v0.11.60` or `v1.0.0`) is eligible. Drafts, prereleases and manually named tags such as `installer` or `v0.9.0-installer` are ignored by the automatic updater.
* Eligible releases must include an official matching Windows installer, `latest.yml` SHA-512 metadata and the NSIS blockmap produced by electron-builder. Release downloads are restricted to `taithedev/Zuzucord`; electron-updater verifies each downloaded file against the manifest.
* **Downloads are automatic and happen in the background.** The app shows progress without interrupting use.
* Once fully downloaded, ZuzuCord shows **Restart & update**. If the user keeps working, the update is **applied automatically on normal app exit** and installed over the existing program. Windows may require permission for all-users installations. Saved Supabase sessions and settings remain in the user-data folder.
* The normal **Check updates** control is available for manual checks; users never need to download and launch a second installer for standard v0.11+ updates.
* The portable ZIP is for use outside the installed NSIS workflow and should not be expected to self-update.

## Release pipeline

The [Windows GitHub Actions workflow](../.github/workflows/react-desktop.yml) assigns a unique monotonically increasing patch version `0.11.<run-number>` for each main-branch build. It generates `latest.yml`/blockmap metadata, validates the version and publishes a **stable** release tagged `v0.11.<run-number>` with the matching setup exe and portable ZIP. The app's `app-update.yml` points to GitHub. Future release versions must be larger than the installed version (for example `1.0.0` is larger than `0.11.70`).

**Old builds cannot gain the new updater retroactively.** Users who already installed v0.10 or older need to install v0.11 once; from that point forward automatic updates apply. Copying new installers into the old manual `installer` release does not replace the auto-update feed or metadata.

## Quality and security

Electron-builder/electron-updater handles NSIS update downloads and SHA-512 verification. It should be **code signed** before public distribution, and updated through end-to-end testing: install version A on Windows, publish version B with `latest.yml`, let the installed app download, close/restart, and verify version B launches with sessions preserved. An automated CI package build is not proof of a full update round-trip.

The current builds are **unsigned previews**. Do not silently force-close a running client with unsent messages. The implementation offers an immediate restart button but otherwise waits for the user to exit the app before installation.

Tests: `node --test electron/versions.test.cjs electron/update-policy.test.cjs`.
