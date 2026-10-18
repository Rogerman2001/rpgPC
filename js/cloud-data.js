import {decode} from './save.js';
import {stats} from './upgrades.js';
import {applyStyle} from './strategy.js';
export const MAX_SAVE_BYTES=20*1024*1024;
export function totalPower(state){const p=applyStyle(stats(state),state.style);return p.attack.mul(10).add(p.health).add(p.defense.mul(10));}
export function encodeCloud(state){
  const payload=JSON.stringify(state);decode(payload);
  if(new TextEncoder().encode(payload).length>MAX_SAVE_BYTES)throw Error('La partida supera 20 MB. Exporta una copia.');
  return {format:1,numeric_encoding:'log10-binary64-v1',payload};
}
export function decodeCloud(data){
  if(data?.format!==1||data.numeric_encoding!=='log10-binary64-v1'||typeof data.payload!=='string'||new TextEncoder().encode(data.payload).length>MAX_SAVE_BYTES)throw Error('Partida de nube incompatible.');
  return decode(data.payload);
}
export function validateName(name){return /^[A-Za-z0-9_]{3,20}$/.test(name)&&!['admin','administrator','moderator','support','cavernaburx'].includes(name.toLowerCase());}
export function describeSave(state){return `Oro ${state.gold.format()} · Poder ${totalPower(state).format()} · Cavernas ${Object.values(state.bosses).map(b=>b.highest).join(' / ')}`;}
