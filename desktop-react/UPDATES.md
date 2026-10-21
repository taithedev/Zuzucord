# Windows release update policy

**Source:** the public GitHub releases API for `taithedev/Zuzucord`.

ZuzuCord checks automatically when the packaged application launches. It accepts only GitHub release **tags starting with lowercase `v` followed immediately by a digit**, such as `v1`, `v2.3`, or `v0.8.0-react.60`. It ignores drafts, older versions and release assets that are not the official `ZuzuCord-React-X.Y.Z-x64.exe` installer. The installed tag is embedded into each CI-built application.

When a newer qualifying release exists, the app shows an update banner. The user can choose **Download installer**. The main process independently rechecks GitHub, validates the official download URL, limits file size, compares a GitHub release SHA-256 digest if published and places the installer in Downloads. It then opens the file's folder.

**It does not silently execute unsigned executables.** Fully unattended replacement requires code signing, a verified update feed (e.g. electron-updater with signing), and safe rollback. The project is currently an unsigned preview; download/installation remain opt-in. Never install random EXEs or use arbitrary release asset URLs.

Regression tests live in `electron/versions.test.cjs` and run during GitHub Actions Windows builds with `node --test electron/versions.test.cjs`.
