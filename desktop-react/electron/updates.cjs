'use strict';
// First install is handled by NSIS. Subsequent versions are downloaded in
// the background and installed over the existing app by electron-updater.
// The only allowed feed is the official public taithedev/Zuzucord GitHub repo.
const { app, net, BrowserWindow } = require('electron');
const { validateRelease } = require('./update-policy.cjs');
const { autoUpdater } = require('electron-updater');

const RELEASE_URL = 'https://api.github.com/repos/taithedev/Zuzucord/releases/latest';
const RETRY_INTERVAL_MS = 4 * 60 * 60 * 1000;
const state = { phase: 'idle', version: app.getVersion(), percent: 0, message: '' };
let checking = null;
let started = false;
let timer = null;
let lastProgress = -1;

autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;
autoUpdater.allowPrerelease = false;
autoUpdater.allowDowngrade = false;
autoUpdater.fullChangelog = false;

function send(next) {
  Object.assign(state, next);
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send('update:status', { ...state });
  }
}
function currentState() { return { ...state }; }
async function confirmedUpdate() {
  const response = await net.fetch(RELEASE_URL, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'ZuzuCord-Desktop-AutoUpdater'
    }
  });
  if (!response.ok) {
    if (response.status === 404) return null;
    throw Error('GitHub update lookup failed (HTTP ' + response.status + ')');
  }
  return validateRelease(await response.json(), app.getVersion());
}

autoUpdater.on('checking-for-update', () => send({ phase:'checking', message:'Checking for updates…' }));
autoUpdater.on('update-available', info => send({
  phase:'downloading', version:info.version, percent:0, message:'Downloading update in the background…'
}));
autoUpdater.on('download-progress', progress => {
  const percent = Math.min(100, Math.max(0, Math.round(progress.percent)));
  if (percent === lastProgress) return;
  lastProgress = percent;
  send({ phase:'downloading', percent,
    message:'Downloading update in the background (' + percent + '%)…' });
});
autoUpdater.on('update-downloaded', info => send({
  phase:'ready', version:info.version, percent:100,
  message:'Update downloaded. It will install automatically when you close ZuzuCord, or restart now.'
}));
autoUpdater.on('update-not-available', () => {
  if (state.phase !== 'ready') send({ phase:'current', version:app.getVersion(),
    message:'You have the latest ZuzuCord version.' });
});
autoUpdater.on('error', error => {
  send({ phase:'error', message: String(error?.message || error).slice(0,240) });
});

async function checkForUpdates() {
  if (!app.isPackaged || process.platform !== 'win32') {
    send({ phase:'unavailable', message:'Auto updates run in the installed Windows application only.' });
    return currentState();
  }
  if (state.phase === 'ready' || state.phase === 'downloading') return currentState();
  if (checking) return checking;
  checking = (async () => {
    try {
      send({ phase:'checking', message:'Checking official GitHub releases…' });
      const allowed = await confirmedUpdate();
      if (!allowed) {
        send({ phase:'current', version:app.getVersion(),
          message:'You have the latest ZuzuCord version.' });
        return currentState();
      }
      // electron-updater uses the embedded app-update.yml GitHub provider
      // plus electron-builder's latest.yml SHA-512 metadata for verification.
      // The pre-check only authorizes v-prefixed published stable releases.
      await autoUpdater.checkForUpdates();
    } catch (error) {
      send({ phase:'error', message:String(error?.message || error).slice(0,240) });
    } finally {
      checking = null;
    }
    return currentState();
  })();
  return checking;
}

function restartAndInstall() {
  if (state.phase !== 'ready') throw Error('No fully downloaded update is ready.');
  // NSIS starts silently and relaunches the updated ZuzuCord app.
  setImmediate(() => autoUpdater.quitAndInstall(true, true));
  return { ok:true };
}
function startAutoUpdates() {
  if (started) return;
  started = true;
  if (!app.isPackaged || process.platform !== 'win32') return;
  // Don't interrupt sign-in or an unsent message. Install on normal app exit;
  // the in-app "Restart now" button can apply it sooner.
  setTimeout(() => void checkForUpdates(), 8000).unref();
  timer = setInterval(() => void checkForUpdates(), RETRY_INTERVAL_MS);
  timer.unref();
}
module.exports = { currentState, checkForUpdates, restartAndInstall,
  startAutoUpdates, validateRelease };
