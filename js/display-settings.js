import {DISPLAY_KEY,defaultDisplay,validateDisplay,displayScale} from './display-scale.js';
const $=id=>document.getElementById(id);
let preference=defaultDisplay();
try{const raw=localStorage.getItem(DISPLAY_KEY);if(raw)preference=validateDisplay(JSON.parse(raw));}catch{/* Keep display usable if storage is unavailable. */}
const panel=document.createElement('details');panel.className='display-settings';panel.id='display-settings';
panel.innerHTML=`<summary>Pantalla</summary><label for="display-mode">Adaptación</label><select id="display-mode"><option value="auto">Automática (recomendada)</option><option value="manual">Personalizada</option></select><label for="display-manual">Escala personalizada <output id="display-percentage" for="display-manual">100 %</output></label><input id="display-manual" type="range" min="75" max="150" step="5" value="100"><div class="display-presets" role="group" aria-label="Perfiles de escala"><button type="button" data-scale="90">Compacto · 90 %</button><button type="button" data-scale="100">Normal · 100 %</button><button type="button" data-scale="125">Grande · 125 %</button><button type="button" data-scale="150">Muy grande · 150 %</button></div><p id="display-effective" role="status"></p><button id="display-reset" type="button" class="secondary">Restablecer configuración de pantalla</button><p id="display-storage" role="status"></p>`;
document.querySelector('.settings-actions').before(panel);
function apply(){
 const factor=displayScale(preference,innerWidth,innerHeight);
 document.documentElement.style.setProperty('--ui-scale',String(factor));
 $('display-mode').value=preference.mode;$('display-manual').value=preference.manual;$('display-manual').disabled=preference.mode==='auto';
 $('display-percentage').textContent=preference.manual+' %';
 $('display-effective').textContent=innerWidth<1100?'En esta ventana se mantiene el diseño móvil/tablet. La preferencia se aplica a partir de 1100 px.':`Escala aplicada: ${Math.round(factor*100)} % · ${preference.mode==='auto'?'adaptación automática':'personalizada'}`;
 for(const button of panel.querySelectorAll('[data-scale]'))button.setAttribute('aria-pressed',String(preference.mode==='manual'&&Number(button.dataset.scale)===preference.manual));
 document.dispatchEvent(new Event('display-scale-changed'));
}
function save(){try{localStorage.setItem(DISPLAY_KEY,JSON.stringify(preference));$('display-storage').textContent='Preferencia guardada en este navegador.';}catch{$('display-storage').textContent='Aplicado temporalmente; el navegador no permite guardar esta preferencia.';}apply();}
$('display-mode').onchange=()=>{preference.mode=$('display-mode').value;save();};
$('display-manual').oninput=()=>{preference.manual=Number($('display-manual').value);preference.mode='manual';save();};
for(const button of panel.querySelectorAll('[data-scale]'))button.onclick=()=>{preference.mode='manual';preference.manual=Number(button.dataset.scale);save();};
$('display-reset').onclick=()=>{preference=defaultDisplay();save();};
let frame;function resized(){cancelAnimationFrame(frame);frame=requestAnimationFrame(apply);}
window.addEventListener('resize',resized);window.visualViewport?.addEventListener('resize',resized);document.addEventListener('fullscreenchange',resized);
window.addEventListener('storage',event=>{if(event.key!==DISPLAY_KEY)return;try{preference=event.newValue?validateDisplay(JSON.parse(event.newValue)):defaultDisplay();apply();}catch{}});
apply();
