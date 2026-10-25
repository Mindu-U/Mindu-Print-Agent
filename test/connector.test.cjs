const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {Connector,parsePairing}=require('../src/main/connection.cjs');
const Store=require('../src/main/store.cjs');
const {validateDocument}=require('../src/main/printing.cjs');
const doc={lang:'ka',title:'მაგიდა',blocks:[{type:'text',text:'ყავა'}]};
test('pairing accepts HTTPS or localhost and rejects insecure/credential URLs',()=>{
 for(const server of ['https://api.mindu.agency','http://localhost:5000'])assert.equal(parsePairing(Buffer.from(JSON.stringify({server,code:'A'.repeat(32)})).toString('base64url')).server,server);
 for(const server of ['http://example.com','file:///tmp/x','https://user:pass@example.com','https://example.com/#secret'])assert.throws(()=>parsePairing(Buffer.from(JSON.stringify({server,code:'A'.repeat(32)})).toString('base64url')));
 assert.throws(()=>parsePairing('bad'));
});
test('only typed plain-text document blocks are accepted',()=>{
 assert.equal(validateDocument(doc),doc);
 for(const document of [{...doc,blocks:[{type:'html',text:'<script>'}]},{...doc,blocks:[{type:'pair',text:'item'}]}])assert.throws(()=>validateDocument(document));
});
test('encrypted credential persistence and interrupted-job recovery',async()=>{
 const dir=await fs.mkdtemp(path.join(__dirname,'state-'));
 const crypto={isAsyncEncryptionAvailable:async()=>true,encryptStringAsync:async value=>Buffer.from(value.split('').reverse().join('')),decryptStringAsync:async buffer=>({result:buffer.toString().split('').reverse().join('')})};
 const file=path.join(dir,'state.json');
 try{
  const store=new Store(file,crypto);await store.load();
  store.state.connection={token:'private-device-token',server:'https://api.mindu.agency'};
  store.state.jobs=[{id:'1',status:'processing'}];await store.save();
  assert.ok(!(await fs.readFile(file,'utf8')).includes('private-device-token'));
  const restored=new Store(file,crypto);await restored.load();
  assert.equal(restored.state.connection.token,'private-device-token');
  assert.equal(restored.state.jobs[0].status,'unknown');
  assert.equal(restored.state.jobs[0].acknowledged,false);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
test('lost acknowledgment retries only the acknowledgment, never physical printing',async()=>{
 const original=global.fetch;let prints=0,claims=0,acks=0;
 const state={connection:{server:'https://api.test',token:'token'},routes:[],stations:[],jobs:[]};
 const store={state,save:async()=>{}};
 global.fetch=async url=>{
  if(url.endsWith('/heartbeat'))return {ok:true,text:async()=>JSON.stringify({ok:true,data:{stations:[]}})};
  if(url.endsWith('/claim'))return {ok:true,text:async()=>JSON.stringify({ok:true,data:{job:claims++===0?{id:'1',title:'Test',printer:'Kitchen',width:80,document:doc}:null}})};
  if(url.endsWith('/ack')){if(acks++===0)throw new Error('Network lost');return {ok:true,text:async()=>JSON.stringify({ok:true,data:{}})};}
  throw new Error('Unexpected request');
 };
 try{
  const connector=new Connector(store,async()=>[{name:'Kitchen'}],async()=>{assert.equal(state.jobs[0].status,'processing');prints++;});
  await connector.tick();assert.equal(prints,1);assert.equal(state.jobs[0].acknowledged,false);
  await connector.tick();assert.equal(prints,1);assert.equal(acks,2);assert.equal(state.jobs[0].acknowledged,true);
 }finally{global.fetch=original;}
});
test('missing local printer is failed without calling print',async()=>{
 const original=global.fetch;let prints=0,ack;
 const store={state:{connection:{server:'https://api.test'},routes:[],stations:[],jobs:[]},save:async()=>{}};
 global.fetch=async(url,options)=>({ok:true,text:async()=>{
  let data={};
  if(url.endsWith('/heartbeat'))data={stations:[]};
  if(url.endsWith('/claim'))data={job:{id:'missing',printer:'Gone',title:'Test',width:80,document:doc}};
  if(url.endsWith('/ack'))ack=JSON.parse(options.body);
  return JSON.stringify({ok:true,data});
 }});
 try{const c=new Connector(store,async()=>[],async()=>prints++);await c.tick();assert.equal(prints,0);assert.equal(ack.status,'failed');}
 finally{global.fetch=original;}
});

