const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('zuzuDesktop', Object.freeze({
  secureGet: key => ipcRenderer.invoke('secret:get', key),
  secureSet: (key, value) => ipcRenderer.invoke('secret:set', key, value),
  secureRemove: key => ipcRenderer.invoke('secret:remove', key),
  windowAction: action => ipcRenderer.invoke('win:action', action),
  version: () => ipcRenderer.invoke('app:version'),
  checkUpdates: () => ipcRenderer.invoke('update:check'),
  updateState: () => ipcRenderer.invoke('update:state'),
  restartToUpdate: () => ipcRenderer.invoke('update:install'),
  onUpdateStatus: callback => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('update:status', listener);
    return () => ipcRenderer.removeListener('update:status', listener);
  }
}));