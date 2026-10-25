const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('ticketData',()=>ipcRenderer.invoke('ticket:read'));
