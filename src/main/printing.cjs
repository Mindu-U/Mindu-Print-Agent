const path=require('node:path');
const {pathToFileURL}=require('node:url');
function validateDocument(doc){
  if(!doc||!['en','ka','ru'].includes(doc.lang)||!Array.isArray(doc.blocks)||doc.blocks.length>400)throw new Error('Invalid ticket');
  for(const block of doc.blocks){
    if(!block||!['heading','text','pair','rule'].includes(block.type))throw new Error('Invalid ticket block');
    if(block.type!=='rule'&&(typeof block.text!=='string'||block.text.length>2000))throw new Error('Invalid ticket text');
    if(block.type==='pair'&&(typeof block.right!=='string'||block.right.length>2000))throw new Error('Invalid ticket value');
  }
  if(JSON.stringify(doc).length>64000)throw new Error('Ticket too large');
  return doc;
}
function createPrinter({BrowserWindow,ipcMain}) {
  const payloads=new Map();
  const ticketPath=path.join(__dirname,'../renderer/ticket.html'),ticketUrl=pathToFileURL(ticketPath).href;
  ipcMain.handle('ticket:read',event=>{
    const payload=payloads.get(event.sender.id);
    if(!payload||event.senderFrame!==event.sender.mainFrame||event.senderFrame.url!==ticketUrl)throw new Error('Unauthorized ticket request');
    return payload;
  });
  return async function print(job){
    if(![58,80].includes(job.width)||typeof job.printer!=='string'||!job.printer)throw new Error('Invalid printer');
    validateDocument(job.document);
    const ticket=new BrowserWindow({show:false,webPreferences:{preload:path.join(__dirname,'../preload/ticket.cjs'),sandbox:true,contextIsolation:true,nodeIntegration:false}});
    ticket.webContents.setWindowOpenHandler(()=>({action:'deny'}));
    ticket.webContents.on('will-navigate',e=>e.preventDefault());
    payloads.set(ticket.webContents.id,{width:job.width,document:job.document});
    try{
      await ticket.loadFile(ticketPath);
      const height=await ticket.webContents.executeJavaScript('window.ticketReady.then(() => document.fonts.ready).then(() => Math.ceil(document.documentElement.getBoundingClientRect().height))');
      if(!Number.isFinite(height)||height<1||height>18000)throw new Error('Unsupported ticket height');
      await new Promise((resolve,reject)=>{
        const timer=setTimeout(()=>reject(new Error('Printer response uncertain. Check Windows queue before reprinting.')),45000);
        try{ticket.webContents.print({silent:true,deviceName:job.printer,printBackground:true,color:false,copies:1,margins:{marginType:'none'},pageSize:{width:job.width*1000,height:Math.max(40000,Math.ceil(height*25400/96)+2000)}},(ok,message)=>{
          clearTimeout(timer);ok?resolve():reject(new Error(message||'Printer response uncertain'));
        });}catch(error){clearTimeout(timer);reject(error);}
      });
    }finally{payloads.delete(ticket.webContents.id);if(!ticket.isDestroyed())ticket.destroy();}
  };
}
const testDocument={lang:'ka',title:'Mindu test',blocks:[{type:'heading',text:'mindu',center:true},{type:'text',text:'სატესტო ბეჭდვა · Test print · Тест печати',center:true},{type:'rule'},{type:'text',text:'ქართული ტექსტი იბეჭდება სწორად.\nEnglish text prints clearly.\nРусский текст печатается правильно.'},{type:'pair',text:'ყავა / Coffee',right:'2 × 5.00'},{type:'pair',text:'ჩაი / Tea',right:'1 × 4.00'},{type:'rule'},{type:'pair',text:'სულ / Total',right:'14.00 GEL',bold:true},{type:'text',text:'TEST ONLY · NOT A PAYMENT',center:true},{type:'text',text:'Made with care by the Mindu team ♡',center:true}]};
module.exports={createPrinter,validateDocument,testDocument};
