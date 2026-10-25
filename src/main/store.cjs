const fs = require('node:fs/promises');
const path = require('node:path');
class Store {
  constructor(file, safeStorage) { this.file=file; this.crypto=safeStorage; this.state={connection:null,routes:[],jobs:[],stations:[],lang:'en'}; }
  async load() {
    try {
      const saved=JSON.parse(await fs.readFile(this.file,'utf8'));
      if (!saved || !Array.isArray(saved.routes) || !Array.isArray(saved.jobs)) throw new Error('Invalid saved state');
      this.state=saved;
      if(saved.connection) {
        const decoded=await this.crypto.decryptStringAsync(Buffer.from(saved.connection.secret,'base64'));
        this.state.connection={...saved.connection,token:decoded.result};
      }
    } catch(error) { if(error.code!=='ENOENT') throw new Error('Cannot read the saved connection. Keep the data file and contact Mindu support.'); }
    for(const job of this.state.jobs) if(job.status==='processing') {job.status='unknown';job.message='Interrupted. Check the printer before reprinting.';job.acknowledged=false;}
    await this.save();
  }
  async save() {
    const data=structuredClone(this.state);
    if(data.connection) {
      if(!await this.crypto.isAsyncEncryptionAvailable())throw new Error('Windows credential protection is unavailable.');
      data.connection.secret=(await this.crypto.encryptStringAsync(data.connection.token)).toString('base64');
      delete data.connection.token;
    }
    await fs.mkdir(path.dirname(this.file),{recursive:true});
    await fs.writeFile(this.file+'.tmp',JSON.stringify(data),'utf8');
    await fs.rename(this.file+'.tmp',this.file);
  }
}
module.exports=Store;
