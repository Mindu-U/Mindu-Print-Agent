const {spawn}=require('node:child_process');
const path=require('node:path');
function raster(bitmap,width,height){
 if(!Number.isInteger(width)||width<8||width>832||width%8||!Number.isInteger(height)||height<1||height>1024||bitmap.length!==width*height*4)throw new Error('Invalid receipt raster');
 const stride=width/8,data=Buffer.alloc(stride*height);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const p=(y*width+x)*4,alpha=bitmap[p+3]/255;
  const luminance=(0.114*bitmap[p]+0.587*bitmap[p+1]+0.299*bitmap[p+2])*alpha+255*(1-alpha);
  if(luminance<180)data[y*stride+(x>>3)]|=0x80>>(x&7);
 }
 return Buffer.concat([Buffer.from([0x1d,0x76,0x30,0,stride&255,stride>>8,height&255,height>>8]),data]);
}
function receipt(bands,width){
 if(![384,576].includes(width)||!bands.length)throw new Error('Invalid ESC/POS receipt');
 return Buffer.concat([Buffer.from([0x1b,0x40,0x1b,0x61,0,0x1d,0x4c,0,0,0x1d,0x57,width&255,width>>8]),...bands,Buffer.from([0x1b,0x64,4,0x1d,0x56,0])]);
}
function sendRaw(printer,bytes){
 if(process.platform!=='win32')return Promise.reject(new Error('ESC/POS mode requires Windows.'));
 if(typeof printer!=='string'||!printer||printer.length>512||bytes.length>4*1024*1024)return Promise.reject(new Error('Invalid raw print job'));
 return new Promise((resolve,reject)=>{
  const exe=path.join(process.env.SystemRoot||'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe');
  const child=spawn(exe,['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(__dirname.replace(/app\.asar(?=[\\/])/,'app.asar.unpacked'),'raw-print.ps1')],{windowsHide:true,stdio:['pipe','pipe','pipe']});
  let error='',done=false;
  const finish=e=>{if(done)return;done=true;clearTimeout(timer);e?reject(e):resolve();};
  const timer=setTimeout(()=>{child.kill();finish(new Error('Print result uncertain. Check the printer before reprinting.'));},60000);
  child.stderr.on('data',b=>{error=(error+b.toString()).slice(-2000);});child.stdout.resume();
  child.on('error',finish);child.stdin.on('error',finish);
  child.on('close',code=>finish(code===0?null:new Error(error.trim()||'Raw print result uncertain. Check the printer.')));
  child.stdin.end(JSON.stringify({printer,data:bytes.toString('base64')}));
 });
}
module.exports={raster,receipt,sendRaw};
