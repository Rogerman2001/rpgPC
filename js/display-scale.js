// Device-local presentation preferences. Never part of a game save or cloud payload.
export const DISPLAY_KEY='cavernaburx.display.v1';
export const defaultDisplay=()=>({version:1,mode:'auto',manual:100});
export function validateDisplay(value){
 return value?.version===1&&['auto','manual'].includes(value.mode)&&Number.isInteger(value.manual)&&value.manual>=75&&value.manual<=150&&value.manual%5===0?{version:1,mode:value.mode,manual:value.manual}:defaultDisplay();
}
export function automaticScale(width,height){
 if(width<1100)return 1;
 return Math.round(Math.max(.9,Math.min(1.5,1+.75*(Math.min(width/1920,height/1080)-1)))*100)/100;
}
export function displayScale(preferences,width,height){return width<1100?1:preferences.mode==='manual'?preferences.manual/100:automaticScale(width,height);}
