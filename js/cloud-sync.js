import {encodeCloud,decodeCloud} from './cloud-data.js';
export const backupKey=uid=>'cavernaburx.account.'+uid;
// One writer per account/tab; CAS in PostgreSQL handles other devices.
export class CloudSync {
  constructor({uid,revision='0',state,storage,write,onStatus=()=>{},delay=1200}){
    Object.assign(this,{uid,revision:String(revision),state,storage,write,onStatus,delay});
    this.latest=null;this.running=null;this.timer=null;this.active=true;this.conflict=false;this.serial=0;this.retryDelay=5000;
  }
  status(text){if(this.active)this.onStatus(text);}
  backup(){this.storage.setItem(backupKey(this.uid),JSON.stringify({uid:this.uid,revision:this.revision,pending:!!this.latest,data:this.latest||encodeCloud(this.state)}));}
  queue(state){
    if(!this.active)throw Error('La sesión ha cambiado.');
    this.state=state;this.latest=encodeCloud(state);this.serial++;this.backup();
    this.status('Cambios pendientes de sincronizar');clearTimeout(this.timer);
    if(!this.conflict)this.timer=setTimeout(()=>this.flush(),this.delay);
  }
  flush(){
    clearTimeout(this.timer);
    if(this.running)return this.running;
    if(!this.active||this.conflict||!this.latest)return Promise.resolve(!this.latest);
    this.running=this.drain().finally(()=>{this.running=null;});return this.running;
  }
  async drain(){
    while(this.active&&this.latest&&!this.conflict){
      const data=this.latest,serial=this.serial,revision=this.revision;this.status('Guardando…');
      try{
        const result=await this.write(data,revision,this.uid);
        if(!this.active)return false;
        this.revision=String(result.revision);
        this.retryDelay=5000;
        if(serial===this.serial)this.latest=null;
        this.backup();this.status(this.latest?'Cambios pendientes de sincronizar':'Guardado');
      }catch(error){
        if(!this.active)return false;
        if(error.code==='40001'){this.conflict=true;this.status('Conflicto entre dispositivos. Exporta tu copia y vuelve a entrar para elegir.');}
        else{this.status('Error al guardar / sin conexión. Copia local pendiente.');this.timer=setTimeout(()=>this.flush(),this.retryDelay);this.retryDelay=Math.min(60000,this.retryDelay*2);}
        return false;
      }
    }return !this.latest;
  }
  stop(){this.active=false;clearTimeout(this.timer);}
}
export function readBackup(storage,uid){
  const raw=storage.getItem(backupKey(uid));if(!raw)return null;
  const b=JSON.parse(raw);if(b.uid!==uid||!/^\d+$/.test(b.revision)||typeof b.pending!=='boolean')throw Error('Respaldo local incompatible.');
  return {...b,state:decodeCloud(b.data)};
}
