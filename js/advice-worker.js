import {analyzeDefeat} from './advice.js';
self.onmessage=({data})=>{
  try{self.postMessage({id:data.id,result:analyzeDefeat(data.fight)});}
  catch{self.postMessage({id:data.id,error:'No se pudo completar la comparación. Puedes repetir un nivel superado y reunir recursos.'});}
};
