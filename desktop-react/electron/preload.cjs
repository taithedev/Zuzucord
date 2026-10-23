const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('zuzuDesktop', Object.freeze({
  platform: process.platform,
  secureGet: key => ipcRenderer.invoke('secret:get', key),
  secureSet: (key, value) => ipcRenderer.invoke('secret:set', key, value),
  secureRemove: key => ipcRenderer.invoke('secret:remove', key),
  windowAction: action => ipcRenderer.invoke('win:action', action),
  version: () => ipcRenderer.invoke('app:version'),
  getStartup: () => ipcRenderer.invoke('system:startup:get'),
  setStartup: enabled => ipcRenderer.invoke('system:startup:set',enabled),
  checkNetwork: () => ipcRenderer.invoke('system:network'),
  openOfficialLink: id => ipcRenderer.invoke('system:openExternal',id),
  checkUpdates: () => ipcRenderer.invoke('update:check'),
  updateState: () => ipcRenderer.invoke('update:state'),
  restartToUpdate: () => ipcRenderer.invoke('update:install'),
  onUpdateStatus: callback => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('update:status', listener);
    return () => ipcRenderer.removeListener('update:status', listener);
  }
}));