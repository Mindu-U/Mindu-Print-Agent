function parsePairing(value) {
  if(typeof value!=='string' || value.length>3000)throw new Error('Invalid connection code');
  let decoded;
  try { decoded=JSON.parse(Buffer.from(value.trim(),'base64url').toString('utf8')); } catch {throw new Error('Invalid connection code');}
  const url=new URL(decoded.server);
  if((url.protocol!=='https:' && !(url.protocol==='http:' && ['localhost','127.0.0.1','[::1]'].includes(url.hostname))) || url.username || url.password || url.search || url.hash || !/^[\w-]{32}$/.test(decoded.code))throw new Error('Invalid connection code');
  return {server:url.href.replace(/\/$/,''),code:decoded.code};
}
async function request(connection,endpoint,body) {
  const res=await fetch(connection.server+'/print-agent'+endpoint,{method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),headers:{'Content-Type':'application/json',...(connection.token?{Authorization:'Bearer '+connection.token}:{})},body:JSON.stringify(body||{})});
  const raw=await res.text();
  if(raw.length>300000)throw new Error('Unexpected server response');
  let payload;try{payload=JSON.parse(raw);}catch{throw new Error('Cannot reach the Mindu print service. Check the backend update.');}
  if(!res.ok || !payload.ok){const error=new Error(payload.message||'Connection unavailable');error.status=res.status;throw error;}
  return payload.data;
}
class Connector {
  constructor(store,printers,print) {this.store=store;this.printers=printers;this.print=print;this.online=false;this.error='';this.chain=Promise.resolve();this.paused=false;}
  run(fn){const task=this.chain.then(fn);this.chain=task.catch(()=>{});return task;}
  async pair(code,name) {
    if(this.store.state.connection)throw new Error('Disconnect before pairing another project.');
    const data=parsePairing(code);
    const reply=await request(data,'/pair',{code:data.code,name});
    this.store.state.connection={server:data.server,token:reply.token,binding:reply.binding,projectId:reply.projectId,name};
    this.store.state.routes=[];this.store.state.jobs=[];this.store.state.stations=reply.stations;
    await this.store.save();this.error='';this.paused=false;await this.tick();
  }
  async disconnect() {
    const c=this.store.state.connection;
    if(c) {try{await request(c,'/disconnect');}catch(error){if(error.status!==401)throw error;}}
    this.store.state.connection=null;this.store.state.routes=[];this.store.state.jobs=[];this.store.state.stations=[];
    await this.store.save();this.online=false;this.error='';this.paused=false;
  }
  async routes(routes) {
    const stations=new Set(this.store.state.stations.map(s=>s._id)),seen=new Set(),printers=await this.printers();
    if(!Array.isArray(routes)||routes.length>21)throw new Error('Invalid printer assignments');
    for(const r of routes){
      if(!stations.has(r.station)||seen.has(r.station)||!printers.some(p=>p.name===r.printer)||(![58,80].includes(r.width)||!['windows','escpos'].includes(r.mode||'windows')))throw new Error('Choose an available printer for each station.');
      seen.add(r.station);
    }
    this.store.state.routes=routes.map(({station,printer,width,mode})=>({station,printer,width,mode:mode||'windows'}));
    await this.store.save();await this.tick();
  }
  async tick() {
    const c=this.store.state.connection;
    if(!c||this.paused)return;
    try {
      const printers=await this.printers();
      const data=await request(c,'/heartbeat',{printers:printers.map(p=>p.name),routes:this.store.state.routes.filter(r=>this.store.state.stations.some(s=>s._id===r.station))});
      this.store.state.stations=data.stations;this.online=true;this.error='';
      // Acknowledgment retries never repeat physical printing.
      for(const job of this.store.state.jobs.filter(j=>!j.acknowledged)) {
        if(job.status==='processing')continue;
        try {await request(c,'/jobs/'+job.id+'/ack',{status:job.status,message:job.message});}
        catch(error){if(error.status!==404)throw error;}
        job.acknowledged=true;await this.store.save();
      }
      const {job}=await request(c,'/claim');
      if(!job)return;
      if(this.store.state.jobs.some(j=>j.id===job.id))throw new Error('Duplicate job blocked. Check the printer.');
      const entry={id:job.id,title:job.title,printer:job.printer,status:'processing',message:'',time:new Date().toISOString(),acknowledged:false};
      this.store.state.jobs=this.store.state.jobs.filter(j=>!j.acknowledged).concat(this.store.state.jobs.filter(j=>j.acknowledged).slice(-49),entry);
      await this.store.save(); // Durable marker BEFORE handing anything to Windows.
      try {
        if(!printers.some(p=>p.name===job.printer)){entry.status='failed';entry.message='Assigned printer unavailable';}
        else { await this.print({...job,mode:this.store.state.routes.find(r=>r.station===job.station&&r.printer===job.printer)?.mode||'windows'});entry.status='submitted';entry.message='Sent to Windows print queue'; }
      } catch(error) {entry.status='unknown';entry.message=String(error.message).slice(0,300);}
      await this.store.save();
      await request(c,'/jobs/'+entry.id+'/ack',{status:entry.status,message:entry.message});
      entry.acknowledged=true;await this.store.save();
    } catch(error) {
      this.online=false;this.error=error.message;
      if(error.status===401||error.status===403)this.paused=true;
    }
  }
  start(){this.stopped=false;const loop=()=>this.run(()=>this.tick()).finally(()=>{if(!this.stopped)this.timer=setTimeout(loop,4000);});loop();}
  stop(){this.stopped=true;clearTimeout(this.timer);}
}
module.exports={Connector,parsePairing,request};
