'use strict';
// Used by the Windows release gate against the installed application.
const { app } = require('electron');
const fs = require('node:fs');
function verifyLaunch(window, reportPath) {
  let finished = false;
  const finish = (ok, detail) => {
    if (finished) return;
    finished = true;
    clearTimeout(timeout);
    fs.writeFileSync(reportPath, JSON.stringify({ ok, version: app.getVersion(), detail }));
    app.exit(ok ? 0 : 1);
  };
  const timeout = setTimeout(() => finish(false, 'Installed application did not render within 30 seconds'), 30000);
  window.webContents.on('did-fail-load', (_event, code, reason, _url, mainFrame) => {
    if (mainFrame) finish(false, `Page load failed: ${code} ${reason}`);
  });
  window.webContents.on('render-process-gone', (_event, details) => finish(false, details.reason));
  window.webContents.once('did-finish-load', async () => {
    try {
      const result = await window.webContents.executeJavaScript(`(async () => {
        const deadline = Date.now() + 20000;
        while (Date.now() < deadline) {
          if (document.querySelector('#zuzu-login-name') && document.querySelector('#zuzu-login-password')) {
            const bridge = window.zuzuDesktop;
            if (!bridge) throw Error('Desktop preload bridge is missing');
            const version = await bridge.version();
            const key = 'sb-smoke-auth-token';
            const value = 'zuzucord-release-storage-check';
            const previous = await bridge.secureGet(key);
            if (previous !== null && previous !== value) throw Error('Saved session changed during reinstall');
            if (!await bridge.secureSet(key, value)) throw Error('Windows session encryption unavailable');
            if (await bridge.secureGet(key) !== value) throw Error('Encrypted session read/write failed');
            return { version, title: document.title, signIn: true, encryptedStorage: true, restored: previous === value };
          }
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        throw Error('Sign-in screen did not render');
      })()`);
      finish(result.signIn && result.version === app.getVersion(), result);
    } catch (error) { finish(false, String(error.message || error)); }
  });
}
module.exports = { verifyLaunch };
