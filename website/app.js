/* ZuzuCord V2 — public, read-only GitHub statistics. No secret token needed. */
(() => {
  'use strict';
  const REPO = 'taithedev/Zuzucord';
  const API = 'https://api.github.com/repos/' + REPO;
  const BUILDS = 'https://github.com/' + REPO + '/actions/workflows/windows-build.yml';
  const RELEASES = 'https://github.com/' + REPO + '/releases';
  const $ = id => document.getElementById(id);
  const format = count => Number.isFinite(count) ? new Intl.NumberFormat().format(count) : '—';
  const set = (id, value) => { const element = $(id); if (element) element.textContent = String(value); };
  const api = async (url) => {
    const response = await fetch(url, { headers: { Accept: 'application/vnd.github+json' }, cache: 'no-store' });
    if (!response.ok) throw new Error('GitHub API HTTP ' + response.status);
    return response.json();
  };
  function downloadableAsset(release) {
    if (!release || !Array.isArray(release.assets)) return null;
    return release.assets.find(asset => /\.(?:exe|msix|msi|zip)$/i.test(asset.name) && asset.browser_download_url?.startsWith('https://github.com/')) || null;
  }
  async function load() {
    const refresh = $('refresh-stats');
    refresh.disabled = true;
    set('updated-at', 'Refreshing live GitHub data…');
    const results = await Promise.allSettled([api(API), api(API + '/releases?per_page=100'), api(API + '/actions/workflows/windows-build.yml/runs?per_page=1')]);
    const [repo, releases, runs] = results.map(item => item.status === 'fulfilled' ? item.value : null);
    if (repo) set('stat-stars', format(repo.stargazers_count));
    if (Array.isArray(releases)) {
      const published = releases.filter(item => !item.draft);
      const count = published.reduce((acc, release) => acc + (release.assets || []).reduce((total, asset) => total + (asset.download_count || 0), 0), 0);
      set('stat-downloads', format(count));
      set('stat-releases', format(published.length));
      const latest = published.find(item => !item.prerelease) || published[0];
      const asset = downloadableAsset(latest);
      if (latest) set('release-label', 'Latest: ' + latest.tag_name + (latest.prerelease ? ' · preview' : ''));
      const link = $('release-download');
      const primary = $('main-download');
      if (asset) {
        for (const el of [link, primary]) {
          el.href = asset.browser_download_url;
          el.removeAttribute('target');
          el.setAttribute('rel', 'noreferrer');
        }
        link.textContent = 'Download ' + asset.name + ' ↗';
        primary.textContent = 'Download for Windows ↗';
        set('download-availability', 'The download links to a published GitHub release asset.');
      } else {
        link.href = latest ? latest.html_url : BUILDS;
        link.textContent = latest ? 'View latest release ↗' : 'View build artifacts ↗';
        primary.href = latest ? latest.html_url : BUILDS;
        primary.textContent = latest ? 'View latest release ↗' : 'View Windows builds ↗';
        set('download-availability', latest ? 'No Windows installer asset is attached to the latest release.' : 'No Windows installer release yet. Development builds may be available via GitHub Actions.');
      }
    }
    const run = runs && Array.isArray(runs.workflow_runs) && runs.workflow_runs[0];
    if (run) {
      const display = run.status !== 'completed' ? 'Building' : run.conclusion === 'success' ? 'Passing' : run.conclusion === 'failure' ? 'Failed' : run.conclusion === 'cancelled' ? 'Cancelled' : 'Unknown';
      set('stat-build', display);
      set('build-detail', run.status === 'completed' ? 'Latest workflow: ' + (run.conclusion || 'unknown') : 'Latest workflow: ' + run.status);
      const el = $('stat-build');
      el.title = 'Verified from the latest GitHub Actions workflow run';
    } else if (runs) {
      set('stat-build', 'No runs');
      set('build-detail', 'Windows build has not run yet');
    }
    const valid = results.filter(item => item.status === 'fulfilled').length;
    set('updated-at', valid > 0 ? 'Updated ' + new Date().toLocaleString() + ' · GitHub public API' + (valid < 3 ? ' · Some metrics unavailable' : '') : 'GitHub data unavailable. Retry later; API rate limiting may apply.');
    refresh.disabled = false;
  }
  document.addEventListener('DOMContentLoaded', () => {
    $('refresh-stats').addEventListener('click', load);
    load();
  });
})();
