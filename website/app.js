/* ZuzuCord V2 — public, read-only GitHub statistics. No secret token needed. */
(() => {
  'use strict';
  const REPO = 'taithedev/Zuzucord';
  const API = 'https://api.github.com/repos/' + REPO;
  const BUILDS = 'https://github.com/' + REPO + '/actions/workflows/react-desktop.yml';
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
    if (!release || !/^v[0-9]/.test(release.tag_name || '') || !Array.isArray(release.assets)) return null;
    return release.assets.find(asset =>
      /^ZuzuCord-React-\d+\.\d+\.\d+-x64\.exe$/i.test(asset.name) &&
      asset.browser_download_url?.startsWith('https://github.com/taithedev/Zuzucord/releases/download/')) || null;
  }
  function updatePlatformDownloads(release) {
    const assets = Array.isArray(release?.assets) ? release.assets : [];
    const platforms = [
      { id: 'download-win', expression: /^ZuzuCord-React-\\d+\\.\\d+\\.\\d+-x64\\.exe$/i, label: 'Download Windows installer ↗' },
      { id: 'download-mac-intel', expression: /^ZuzuCord-Mac-\\d+\\.\\d+\\.\\d+-x64\\.dmg$/i, label: 'Download Intel DMG ↗' },
      { id: 'download-mac-arm', expression: /^ZuzuCord-Mac-\\d+\\.\\d+\\.\\d+-arm64\\.dmg$/i, label: 'Download Apple Silicon DMG ↗' },
      { id: 'download-linux-appimage', expression: /^ZuzuCord-Linux-\\d+\\.\\d+\\.\\d+-x64\\.AppImage$/i, label: 'Download AppImage ↗' },
      { id: 'download-linux-deb', expression: /^ZuzuCord-Linux-\\d+\\.\\d+\\.\\d+-x64\\.deb$/i, label: 'Download DEB ↗' }
    ];
    for (const platform of platforms) {
      const element = $(platform.id);
      if (!element) continue;
      const asset = assets.find(a => platform.expression.test(a.name)
        && a.browser_download_url?.startsWith('https://github.com/taithedev/Zuzucord/releases/download/'));
      element.href = asset ? asset.browser_download_url : release?.html_url || RELEASES;
      element.textContent = asset ? platform.label : 'View available builds ↗';
      element.dataset.available = String(Boolean(asset));
    }
  }
  async function load() {
    const refresh = $('refresh-stats');
    refresh.disabled = true;
    set('updated-at', 'Refreshing live GitHub data…');
    const results = await Promise.allSettled([api(API), api(API + '/releases?per_page=100'), api(API + '/actions/workflows/windows-build.yml/runs?per_page=1')]);
    const [repo, releases, runs] = results.map(item => item.status === 'fulfilled' ? item.value : null);
    if (repo) set('stat-stars', format(repo.stargazers_count));
    if (Array.isArray(releases)) {
      const published = releases.filter(item => !item.draft && /^v[0-9]/.test(item.tag_name || ''));
      const count = published.reduce((acc, release) => acc + (release.assets || []).reduce((total, asset) => total + (asset.download_count || 0), 0), 0);
      set('stat-downloads', format(count));
      set('stat-releases', format(published.length));
      const latest = published.find(item => downloadableAsset(item)) || published[0];
      const asset = downloadableAsset(latest);
      updatePlatformDownloads(latest);
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

  // Community totals come from a deliberately aggregate-only PostgreSQL RPC.
  // Neither user lists, identifiers nor moderation reasons are exposed here.
  const SUPABASE_URL = 'https://wfqudstuncdldsvxqveu.supabase.co';
  const PUBLIC_KEY = 'sb_publishable_LsAzcgmeAp3fBCtdU6eQzw_u5PPJjar';
  async function loadCommunity() {
    try {
      const response = await fetch(SUPABASE_URL + '/rest/v1/rpc/zuzucord_public_stats', {
        method: 'POST', headers: { 'apikey': PUBLIC_KEY, 'Content-Type':'application/json' }, body: '{}', cache:'no-store'
      });
      if(!response.ok) throw new Error('HTTP ' + response.status);
      const d = await response.json();
      set('community-users', format(Number(d.total_users)));
      set('community-today', format(Number(d.created_today)));
      set('community-banned', format(Number(d.banned_users)));
      set('community-banned-today', format(Number(d.banned_today)));
      set('community-messages', format(Number(d.total_messages)));
      set('community-servers', format(Number(d.total_servers)));
      set('community-boosts', format(Number(d.total_boosts)));
      set('community-updated', 'Source: ZuzuCord Supabase database · Updated ' + new Date().toLocaleString() + ' · Today starts 00:00 UTC. GitHub statistics are separate.');
    } catch {
      set('community-updated', 'Community statistics are temporarily unavailable. No counts are being estimated.');
    }
  }

  function setupRegistration() {
    const form = $('register-form');
    const feedback = $('reg-result');
    if (!form || !feedback) return;
    const userInput = $('reg-username');
    const updateAlias = () => {
      const value = (userInput.value || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 24);
      set('alias-preview', (value || 'your_username') + '@zuzucord.com');
    };
    userInput.addEventListener('input', updateAlias);
    updateAlias();
    const reveal = $('password-toggle');
    reveal?.addEventListener('click', () => {
      const password = $('reg-password');
      const showing = password.type === 'password';
      password.type = showing ? 'text' : 'password';
      reveal.setAttribute('aria-pressed', String(showing));
      reveal.setAttribute('aria-label', showing ? 'Hide password' : 'Show password');
      reveal.textContent = showing ? 'Hide' : 'Show';
    });
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const username = $('reg-username').value.trim().toLowerCase();
      const password = $('reg-password').value;
      const confirm = $('reg-confirm').value;
      const btn = $('reg-submit');
      feedback.className = 'form-result';
      if(!/^[a-z0-9_]{3,24}$/.test(username)) {
        feedback.textContent = 'Use 3–24 letters, numbers, or underscores.'; feedback.classList.add('error'); return;
      }
      if(password !== confirm) { feedback.textContent='Passwords do not match.'; feedback.classList.add('error'); return; }
      if(password.length < 10 || password.length > 128) { feedback.textContent='Use a password with 10–128 characters.'; feedback.classList.add('error'); return; }
      if(!$('reg-terms').checked) { feedback.textContent='Please read and accept the account notice.'; feedback.classList.add('error'); return; }
      btn.disabled = true; feedback.textContent = 'Creating account securely…';
      try {
        const response = await fetch(SUPABASE_URL + '/functions/v1/zuzucord-register', {
          method: 'POST',
          headers: { 'apikey': PUBLIC_KEY, 'Content-Type':'application/json' },
          body: JSON.stringify({ username, password })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.success) {
          const fallback = response.status === 429
            ? 'Too many attempts. Wait a while before trying again.'
            : response.status >= 500
              ? 'Account registration is temporarily unavailable. Your username may still be available.'
              : 'Could not create the account. Please review your details.';
          throw new Error(typeof data.error === 'string' ? data.error : fallback);
        }
        const login = typeof data.login === 'string' ? data.login : username + '@zuzucord.com';
        feedback.textContent = 'Account created. Sign in to the Windows app with ' + login + '. This is an account ID, not an email inbox.';
        feedback.classList.add('ok');
        form.reset();
        updateAlias();
        $('reg-password').type = 'password';
        if (reveal) { reveal.textContent = 'Show'; reveal.setAttribute('aria-pressed', 'false'); }
        loadCommunity();
      } catch (error) {
        feedback.textContent = error instanceof Error ? error.message : 'Could not create your account. Please retry.';
        feedback.classList.add('error');
      } finally { btn.disabled=false; }
    });
  }

  function setupDemo() {
    const wrap = $('interactive-preview');
    const win = wrap?.querySelector('.preview-window');
    if(!wrap || !win) return;
    const demo = {
      general: ['Welcome to your space.', 'Public channels bring your community together.'],
      introductions: ['Meet the community.', 'A place to introduce yourself and say hello.'],
      development: ['Share what you build.', 'Talk projects, coding, and new ideas.']
    };
    for(const btn of wrap.querySelectorAll('[data-demo-channel]')) {
      btn.addEventListener('click', () => {
        wrap.querySelectorAll('[data-demo-channel]').forEach(b=>b.classList.toggle('active', b===btn));
        const key = btn.dataset.demoChannel;
        const parts=demo[key];
        if(!parts) return;
        $('demo-channel-title').textContent='# ' + key;
        $('demo-heading').textContent=parts[0];
        $('demo-description').textContent=parts[1];
        $('demo-compose').firstChild.textContent='Message #' + key + ' ';
      });
    }
    if(window.matchMedia('(prefers-reduced-motion: reduce)').matches || window.matchMedia('(pointer: coarse)').matches) return;
    let frame=0;
    wrap.addEventListener('pointermove',e=>{
      const r=wrap.getBoundingClientRect();
      const x=(e.clientX-r.left)/r.width-.5, y=(e.clientY-r.top)/r.height-.5;
      if(frame) cancelAnimationFrame(frame);
      frame=requestAnimationFrame(()=>{
        win.style.setProperty('--tilt-x',(-y*8).toFixed(2)+'deg');
        win.style.setProperty('--tilt-y',(x*10).toFixed(2)+'deg');
      });
    });
    wrap.addEventListener('pointerleave',()=>{
      if(frame) cancelAnimationFrame(frame);
      win.style.removeProperty('--tilt-x');
      win.style.removeProperty('--tilt-y');
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    $('refresh-stats').addEventListener('click', () => { load(); loadCommunity(); });
    load(); loadCommunity(); setupRegistration(); setupDemo();
    // Refresh community totals even if the GitHub API is rate limited.
    window.setInterval(loadCommunity, 60000);
  });
})();
