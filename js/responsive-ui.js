// Layout only. Existing elements, game listeners and statistic renderers stay authoritative.
const $=id=>document.getElementById(id);
const combat=$('combat'),roster=$('boss-roster');
const make=(tag,cls,html='')=>{const node=document.createElement(tag);node.className=cls;node.innerHTML=html;return node;};
const toolbar=make('div','combat-toolbar','<span class="eyebrow">EL DESCENSO / COMBATE</span><button id="toggle-statistics" class="secondary" aria-controls="statistics-panel" aria-expanded="true">Estadísticas</button>');
const grid=make('div','combat-layout');
const selector=make('details','cavern-selector','<summary id="selected-cavern">Cavernas</summary>');selector.open=true;selector.append(roster);
const center=make('div','combat-center');
center.append(combat.querySelector('.combat-card'),combat.querySelector('.below-arena'));
const statsHost=make('div','statistics-host');
const statistics=make('section','statistics-panel','<h2 id="statistics-title">Estadísticas</h2><h3>Jugador</h3>');statistics.id='statistics-panel';
statistics.append(center.querySelector('#player-stats'));
const heading=make('h3','','Boss');statistics.append(heading,center.querySelector('#boss-stats'));
statsHost.append(statistics);grid.append(selector,center,statsHost);
combat.querySelector('.page-title').remove();combat.append(toolbar,grid);
// Preserve the secondary tip without consuming combat height.
const tip=center.querySelector('.hint'),help=make('details','combat-help','<summary>Progreso y reliquias</summary>');help.append(tip);selector.append(help);
const resultPanel=center.querySelector('.result-panel');
const rewardDetails=make('details','reward-details','<summary>Recompensas previstas</summary>');rewardDetails.append($('reward-preview'));resultPanel.append(rewardDetails);
const detail=make('details','battle-details','<summary>Registro y análisis del combate</summary>');
const analysisContent=make('div','analysis-content');
for(const id of ['battle-log','combat-summary'])analysisContent.append($(id));
const advice=$('combat-advice');resultPanel.append(advice);detail.append(analysisContent);resultPanel.append(detail);
const analysisButton=make('button','secondary analysis-trigger','Ver análisis del combate');analysisButton.id='open-analysis';analysisButton.setAttribute('aria-haspopup','dialog');analysisButton.setAttribute('aria-controls','analysis-modal');resultPanel.append(analysisButton);
const analysisModal=make('dialog','statistics-modal analysis-modal','<div class="settings-heading"><h2 id="analysis-title">Análisis del combate</h2><button id="close-analysis" class="secondary" autofocus>Cerrar</button></div><div id="analysis-modal-body"></div>');analysisModal.id='analysis-modal';analysisModal.setAttribute('aria-labelledby','analysis-title');document.body.append(analysisModal);
analysisButton.onclick=()=>{$('analysis-modal-body').append(analysisContent,advice);analysisModal.showModal();};
$('close-analysis').onclick=()=>analysisModal.close();
analysisModal.addEventListener('close',()=>{detail.append(analysisContent);resultPanel.insertBefore(advice,detail);});
const modal=make('dialog','statistics-modal','<div class="settings-heading"><h2 id="statistics-modal-title">Estadísticas</h2><button id="close-statistics" class="secondary" autofocus>Cerrar</button></div><div id="statistics-modal-body"></div>');
modal.setAttribute('aria-labelledby','statistics-modal-title');modal.id='statistics-modal';document.body.append(modal);
const mq=matchMedia('(min-width: 1100px)');let collapsed=false;
function fitWorkspace(){
 if(!grid.getClientRects().length)return;
 const remaining=innerHeight-(grid.getBoundingClientRect().top+scrollY)-document.querySelector('footer').getBoundingClientRect().height-20;
 grid.style.setProperty('--workspace-height',Math.max(260,remaining)+'px');
}
window.addEventListener('resize',()=>requestAnimationFrame(fitWorkspace));
document.addEventListener('display-scale-changed',()=>requestAnimationFrame(fitWorkspace));
new ResizeObserver(()=>requestAnimationFrame(fitWorkspace)).observe(document.querySelector('.account-tools'));
const pageObserver=new MutationObserver(()=>requestAnimationFrame(fitWorkspace));
for(const page of document.querySelectorAll('.page'))pageObserver.observe(page,{attributes:true,attributeFilter:['class']});
function layout(){
 if(modal.open)modal.close();if(analysisModal.open)analysisModal.close();
 statsHost.append(statistics);selector.open=mq.matches;$('selected-cavern').tabIndex=mq.matches?-1:0;
 grid.classList.toggle('stats-collapsed',mq.matches&&collapsed);
 $('toggle-statistics').setAttribute('aria-expanded',String(mq.matches&&!collapsed));
 $('toggle-statistics').textContent=mq.matches&&!collapsed?'Plegar estadísticas':'Estadísticas';requestAnimationFrame(fitWorkspace);
}
$('toggle-statistics').onclick=()=>{
 if(mq.matches){collapsed=!collapsed;layout();}
 else{$('statistics-modal-body').append(statistics);modal.showModal();$('toggle-statistics').setAttribute('aria-expanded','true');}
};
$('close-statistics').onclick=()=>modal.close();
modal.addEventListener('close',()=>{statsHost.append(statistics);$('toggle-statistics').setAttribute('aria-expanded','false');});
selector.addEventListener('toggle',()=>{if(mq.matches&&!selector.open)selector.open=true;});
mq.addEventListener('change',layout);layout();
function selected(){const chosen=roster.querySelector('.chosen');if(chosen)$('selected-cavern').textContent=chosen.querySelector('strong').textContent+' · '+chosen.querySelector('.boss-choice-level').textContent;}
new MutationObserver(selected).observe(roster,{childList:true});
roster.addEventListener('click',event=>{if(!mq.matches&&event.target.closest('button:not(:disabled)'))selector.open=false;});
const nav=document.querySelector('.layout > aside nav');nav.classList.add('game-navigation');
const settings=make('button','nav','⚙ <span>Ajustes</span>');settings.id='nav-settings';settings.onclick=()=>$('open-account-settings').click();nav.append(settings);
const security=make('button','secondary','Seguridad de la partida');security.id='settings-security';
security.onclick=()=>{$('account-settings').close();document.querySelector('[data-tab="settings"]').click();};
document.querySelector('.settings-actions').append(security);
document.addEventListener('account-ended',()=>{if(modal.open)modal.close();if(analysisModal.open)analysisModal.close();});

new MutationObserver(()=>{
 const opened=$('account-settings').open;
 for(const button of nav.querySelectorAll('.nav')){
  const active=opened?button===settings:button.dataset.tab===document.querySelector('.page.active')?.id;
  button.classList.toggle('active',active);
  if(active)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');
 }
}).observe($('account-settings'),{attributes:true,attributeFilter:['open']});
