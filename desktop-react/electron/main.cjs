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
ipcMain.handle('update:check', () => updates.lookupUpdate());
ipcMain.handle('update:download', (_event, release) => updates.downloadUpdate(release));
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
    if (app.isPackaged) {
      updates.lookupUpdate()
        .then(release => { if (release && !windowRef?.isDestroyed()) windowRef?.webContents.send('update:available', release); })
        .catch(() => { /* manual Update check can show network errors */ });
    }
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
