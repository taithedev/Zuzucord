const { app, BrowserWindow, ipcMain, safeStorage, shell, nativeTheme } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const updates = require('./updates.cjs');
let windowRef;
const memorySecrets = new Map();
const goodKey = (key) => typeof key === 'string' && /^sb-[a-z0-9_-]+-auth-token$/.test(key) && key.length < 130;
function secretPath(key) {
  const digest = crypto.createHash('sha256').update(key).digest('hex');
  return path.join(app.getPath('userData'), 'session-' + digest + '.bin');
}
ipcMain.handle('secret:get', (_ev, key) => {
  if (!goodKey(key)) return null;
  if (!safeStorage.isEncryptionAvailable()) return memorySecrets.get(key) ?? null;
  try { return safeStorage.decryptString(fs.readFileSync(secretPath(key))); }
  catch { return null; }
});
ipcMain.handle('secret:set', (_ev, key, value) => {
  if (!goodKey(key) || typeof value !== 'string' || value.length > 20000) throw Error('Invalid session data');
  if (!safeStorage.isEncryptionAvailable()) { memorySecrets.set(key, value); return false; }
  const dest = secretPath(key), temp = dest + '.tmp';
  const encrypted = safeStorage.encryptString(value);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(temp, encrypted);
  fs.renameSync(temp, dest);
  return true;
});
ipcMain.handle('secret:remove', (_ev, key) => {
  if (!goodKey(key)) return;
  memorySecrets.delete(key);
  try { fs.unlinkSync(secretPath(key)); } catch {}
});
ipcMain.handle('win:action', (_ev, action) => {
  if (!windowRef || windowRef.isDestroyed()) return;
  if (action === 'minimize') windowRef.minimize();
  if (action === 'maximize') windowRef.isMaximized() ? windowRef.unmaximize() : windowRef.maximize();
  if (action === 'close') windowRef.close();
});
ipcMain.handle('app:version', () => app.getVersion());
ipcMain.handle('update:state', () => updates.currentState());
ipcMain.handle('update:check', () => updates.checkForUpdates());
ipcMain.handle('update:install', () => updates.restartAndInstall());
const fixedTargets = Object.freeze({
  supabase: 'https://wfqudstuncdldsvxqveu.supabase.co/auth/v1/health',
  releases: 'https://api.github.com/repos/taithedev/Zuzucord/releases/latest'
});
ipcMain.handle('system:startup:get', () => {
  if (process.platform !== 'win32' || !app.isPackaged) return { available:false, enabled:false };
  return { available:true, enabled:app.getLoginItemSettings().openAtLogin };
});
ipcMain.handle('system:startup:set', (_event, enabled) => {
  if (typeof enabled !== 'boolean') throw Error('Invalid startup preference');
  if (process.platform !== 'win32' || !app.isPackaged) throw Error('Requires installed Windows app');
  app.setLoginItemSettings({openAtLogin:enabled,enabled,name:'ZuzuCord'});
  return {available:true,enabled:app.getLoginItemSettings().openAtLogin};
});
ipcMain.handle('system:network', async () => {
  const targets = {};
  for (const [name,url] of Object.entries(fixedTargets)) {
    const start=Date.now();
    try {
      const controller=new AbortController();
      const timeout=setTimeout(()=>controller.abort(),6500);
      try {
        const response=await require('electron').net.fetch(url,{
          method:'GET',signal:controller.signal,
          headers:{'User-Agent':'ZuzuCord-Network-Diagnostics'}
        });
        targets[name]={reachable:true,httpStatus:response.status,latencyMs:Date.now()-start};
      } finally {clearTimeout(timeout);}
    } catch(error) {
      targets[name]={reachable:false,latencyMs:null,
        error:error?.name==='AbortError'?'Timed out':'Connection failed'};
    }
  }
  return { checkedAt:new Date().toISOString(),targets };
});
ipcMain.handle('system:openExternal', async (_event, target) => {
  // Never accept an arbitrary renderer-supplied URL or local file path.
  const allowlist={
    releases:'https://github.com/taithedev/Zuzucord/releases',
    docs:'https://github.com/taithedev/Zuzucord/blob/main/README.md'
  };
  if (!Object.prototype.hasOwnProperty.call(allowlist,target)) throw Error('Unsupported destination');
  await shell.openExternal(allowlist[target]);
  return true;
});
function makeWindow() {
  nativeTheme.themeSource = 'dark';
  windowRef = new BrowserWindow({
    width: 1450, height: 910, minWidth: 950, minHeight: 620,
    backgroundColor: '#09050f', show: false, autoHideMenuBar: true,
    title: 'ZuzuCord', frame: false,
    icon: path.join(__dirname, '../assets/zuzucord.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false, contextIsolation: true,
      sandbox: true, webSecurity: true,
      devTools: !app.isPackaged
    }
  });
  windowRef.once('ready-to-show', () => {
    windowRef?.show();
    updates.startAutoUpdates();
    const updateState = updates.currentState();
    if (updateState.phase !== 'idle') windowRef?.webContents.send('update:status', updateState);
  });
  if (process.env.ZUZUCORD_DEV_URL && !app.isPackaged) windowRef.loadURL(process.env.ZUZUCORD_DEV_URL);
  else windowRef.loadFile(path.join(__dirname, '../dist/index.html'));
  windowRef.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  windowRef.webContents.on('will-navigate', (e, url) => {
    if (url !== windowRef.webContents.getURL()) e.preventDefault();
  });
}
app.whenReady().then(() => {
  makeWindow();
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) makeWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
