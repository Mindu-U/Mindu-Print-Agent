const {app,BrowserWindow,ipcMain,session,safeStorage,Tray,Menu,nativeImage}=require('electron');
const path=require('node:path');
const os=require('node:os');
const {pathToFileURL}=require('node:url');
const Store=require('./store.cjs');
const {Connector,parsePairing}=require('./connection.cjs');
const {createPrinter,testDocument}=require('./printing.cjs');
let window,tray,connector,quitting=false;
const uiPath=path.join(__dirname,'../renderer/index.html');
const uiUrl=pathToFileURL(uiPath).href;
const icon=path.join(__dirname,'../../assets/logo.png');
function handle(channel,fn){ipcMain.handle(channel,async(event,...args)=>{
 if(event.sender!==window?.webContents||event.senderFrame!==window.webContents.mainFrame||event.senderFrame.url!==uiUrl)throw new Error('Unauthorized request');
 return fn(...args);
});}
function show(){window.show();if(window.isMinimized())window.restore();window.focus();}
if(!app.requestSingleInstanceLock())app.quit();
else{
 app.on('second-instance',()=>window&&show());
 app.on('before-quit',()=>{quitting=true;connector?.stop();});
 app.whenReady().then(async()=>{
  session.defaultSession.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));
  session.defaultSession.setPermissionCheckHandler(()=>false);
  session.defaultSession.webRequest.onBeforeRequest((details,callback)=>callback({cancel:!details.url.startsWith('file:')&& !details.url.startsWith('devtools:')}));
  const store=new Store(path.join(app.getPath('userData'),'connection.json'),safeStorage);await store.load();
  window=new BrowserWindow({show:!process.argv.includes('--background'),width:920,height:760,minWidth:720,minHeight:600,icon,autoHideMenuBar:true,backgroundColor:'#0e121c',webPreferences:{preload:path.join(__dirname,'../preload/index.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  window.webContents.setWindowOpenHandler(()=>({action:'deny'}));window.webContents.on('will-navigate',e=>e.preventDefault());
  window.on('close',e=>{if(!quitting&&tray){e.preventDefault();window.hide();}});
  const printers=async()=>(await window.webContents.getPrintersAsync()).map(p=>({name:p.name,displayName:p.displayName||p.name}));
  const print=createPrinter({BrowserWindow,ipcMain});connector=new Connector(store,printers,print);
  handle('agent:status',async()=>({
    connected:!!store.state.connection,online:connector.online,error:connector.error,
    server:store.state.connection?.server||'',name:store.state.connection?.name||os.hostname(),
    stations:store.state.stations,routes:store.state.routes,jobs:[...store.state.jobs].reverse().slice(0,20),
    printers:await printers(),lang:store.state.lang||'en',canAutoStart:app.isPackaged,
    autoStart:app.isPackaged&&app.getLoginItemSettings({path:process.execPath,args:['--background']}).openAtLogin
  }));
  handle('agent:inspect',code=>parsePairing(code).server);
  handle('agent:pair',(code,name)=>connector.run(async()=>{if(!await safeStorage.isAsyncEncryptionAvailable())throw new Error('Windows credential protection is unavailable.');return connector.pair(code,typeof name==='string'?name.slice(0,80):os.hostname());}));
  handle('agent:disconnect',()=>connector.run(()=>connector.disconnect()));
  handle('agent:routes',routes=>connector.run(()=>connector.routes(routes)));
  handle('agent:test',selection=>connector.run(async()=>{
    if(!(await printers()).some(p=>p.name===selection?.printer))throw new Error('Printer unavailable');
    await print({printer:selection.printer,width:selection.width,document:testDocument});
  }));
  handle('agent:language',lang=>connector.run(async()=>{
    if(!['en','ka','ru'].includes(lang))throw new Error('Unsupported language');
    store.state.lang=lang;await store.save();
  }));
  handle('agent:startup',enabled=>{
    if(!app.isPackaged||typeof enabled!=='boolean')throw new Error('Install the packaged app to enable Windows startup.');
    app.setLoginItemSettings({openAtLogin:enabled,path:process.execPath,args:['--background']});
  });
  tray=new Tray(nativeImage.createFromPath(icon).resize({width:24,height:24}));
  tray.setToolTip('Mindu Print');
  tray.setContextMenu(Menu.buildFromTemplate([{label:'Open Mindu Print',click:show},{type:'separator'},{label:'Quit',click:()=>app.quit()}]));
  tray.on('double-click',show);
  await window.loadFile(uiPath);connector.start();
 }).catch(error=>{require('electron').dialog.showErrorBox('Mindu Print',error.message);app.quit();});
 app.on('window-all-closed',()=>{if(!tray)app.quit();});
}
