const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('zuzucord',Object.freeze({continue:()=>ipcRenderer.invoke('continue'),exit:()=>ipcRenderer.invoke('exit')}));
