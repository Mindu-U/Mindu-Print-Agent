const {test}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {createPrinter,testDocument}=require('../src/main/printing.cjs');
test('printer module accepts only the ticket frame and submits the selected device/width once',async()=>{
 let handler,options,count=0,latest;
 class Window{
  constructor(){latest=this;this.webContents={id:1,mainFrame:{url:pathToFileURL(path.resolve(__dirname,'../src/renderer/ticket.html')).href},setWindowOpenHandler(){},on(){},executeJavaScript:async()=>300,print:(opts,cb)=>{count++;options=opts;cb(true);}};}
  async loadFile(){assert.throws(()=>handler({sender:{id:2,mainFrame:{}},senderFrame:{}}),/Unauthorized/);const payload=handler({sender:this.webContents,senderFrame:this.webContents.mainFrame});assert.equal(payload.document.lang,'ka');}
  isDestroyed(){return !!this.dead;}destroy(){this.dead=true;}
 }
 const print=createPrinter({BrowserWindow:Window,ipcMain:{handle:(name,fn)=>handler=fn}});
 await print({printer:'Kitchen Printer',width:58,document:testDocument});
 assert.equal(options.deviceName,'Kitchen Printer');assert.equal(options.pageSize.width,58000);assert.equal(options.silent,true);assert.equal(count,1);assert.equal(latest.dead,true);
 await assert.rejects(print({printer:'Kitchen',width:120,document:testDocument}),/Invalid printer/);
 assert.equal(count,1);
});

