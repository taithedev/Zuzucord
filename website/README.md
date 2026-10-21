# ZuzuCord V2 download website

Standalone static landing site with live statistics. Open `website/index.html` or deploy the entire folder to GitHub Pages, Vercel, or another static host.

## Live data

Public GitHub API for `taithedev/Zuzucord`:
- repository stars (`stargazers_count`);
- total public release asset downloads (up to the first 100 releases);
- published release count (up to 100);
- latest GitHub Actions `windows-build.yml` status.

If an actual Windows `.exe`, `.msi`, `.msix`, or `.zip` release asset is published, the primary download button links directly to that GitHub asset. Otherwise it links to GitHub release/build pages and explains the download status. No download totals or online users are fabricated.

The website works without credentials, but GitHub API rate limits may temporarily hide some statistics. Release download counts are totals across public assets, not unique installations. Stats are not linked to Supabase profiles.

### GitHub Pages

Workflow `.github/workflows/website-pages.yml` deploys this folder when Pages is configured for GitHub Actions in the repository's Settings > Pages.

## Deployment note

This is a download website, not the ZuzuCord messaging service. Keep Supabase keys and secrets out of it.
