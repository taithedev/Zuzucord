const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('zuzuDesktop', Object.freeze({
  secureGet: key => ipcRenderer.invoke('secret:get', key),
  secureSet: (key, value) => ipcRenderer.invoke('secret:set', key, value),
  secureRemove: key => ipcRenderer.invoke('secret:remove', key),
  windowAction: action => ipcRenderer.invoke('win:action', action),
  version: () => ipcRenderer.invoke('app:version')
}));