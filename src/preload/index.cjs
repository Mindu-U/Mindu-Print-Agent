const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('mindu',Object.freeze({
 status:()=>ipcRenderer.invoke('agent:status'),
 inspect:code=>ipcRenderer.invoke('agent:inspect',code),
 pair:(code,name)=>ipcRenderer.invoke('agent:pair',code,name),
 disconnect:()=>ipcRenderer.invoke('agent:disconnect'),
 routes:rows=>ipcRenderer.invoke('agent:routes',rows),
 test:selection=>ipcRenderer.invoke('agent:test',selection),
 language:lang=>ipcRenderer.invoke('agent:language',lang),
 startup:enabled=>ipcRenderer.invoke('agent:startup',enabled)
}));
