// Local HTTP-contract mocks, NOT a test of Google's or hosted Supabase's configuration.
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {freshState} from '../js/save.js';
import {encodeCloud,totalPower,decodeCloud} from '../js/cloud-data.js';
import {milestone} from './helpers.js';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_PATH).href);
const browser=await chromium.launch({headless:true,channel:'chrome'}),base=process.env.GAME_URL||'http://localhost:4174';
const a='00000000-0000-0000-0000-000000000001',b='00000000-0000-0000-0000-000000000002';
const users=new Map([[a,{name:null,save:null}],[b,{name:'Second_Player',save:{data:encodeCloud(freshState()),revision:'1'}}]]);
const errors=[];let offline=false,readFail=false,denyName=true,oauthRequested=false;
const user=uid=>({id:uid,aud:'authenticated',role:'authenticated',app_metadata:{provider:'google',providers:['google']},user_metadata:{},created_at:new Date().toISOString()});
const session=uid=>{const exp=Math.floor(Date.now()/1000)+3600,payload=Buffer.from(JSON.stringify({sub:uid,exp,role:'authenticated'})).toString('base64url');return {access_token:'eyJhbGciOiJIUzI1NiJ9.'+payload+'.test',refresh_token:'test-refresh',token_type:'bearer',expires_in:3600,expires_at:exp,user:user(uid)};};
async function context(uid=null,legacy=null){
 const c=await browser.newContext({viewport:{width:1440,height:1000}});
 if(uid)await c.addInitScript(({token,legacy,origin})=>{if(location.origin!==origin)return;if(!sessionStorage.getItem('test-seeded')){localStorage.setItem('sb-testing-auth-token',JSON.stringify(token));if(legacy)localStorage.setItem('cavernaburx.save.v2',legacy);sessionStorage.setItem('test-seeded','1');}},{token:session(uid),legacy,origin:new URL(base).origin});
 await c.route('https://testing.supabase.co/**',async route=>{
  const req=route.request(),url=new URL(req.url()),token=req.headers().authorization?.slice(7);let id;
  try{id=JSON.parse(Buffer.from(token.split('.')[1],'base64url')).sub;}catch{}
  const current=users.get(id),json=(obj,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(obj)});
  if(url.pathname.endsWith('/authorize')){oauthRequested=url.searchParams.get('provider')==='google';return route.fulfill({contentType:'text/html',body:'OAuth simulado, sin conexión a Google'});}
  if(url.pathname.endsWith('/user'))return json(user(id));
  if(url.pathname.endsWith('/logout'))return route.fulfill({status:204});
  if(!current)return json({message:'Unauthorized'},401);
  if(url.pathname.endsWith('/player_profiles'))return json(current.name?[{username:current.name}]:[]);
  const name=url.pathname.split('/').pop(),body=req.postDataJSON();
  if(name==='register_player'){if(denyName){denyName=false;return json({code:'23505',message:'duplicate'},409);}current.name=body.p_username;return json(current.name);}
  if(name==='read_player_save'){if(readFail)return json({message:'Connection unavailable'},503);return json(current.save);}
  if(name==='commit_player_save'){
   if(offline)return route.abort('internetdisconnected');
   if(body.p_owner!==id)return json({code:'42501',message:'Account changed'},403);
   if(body.p_revision!==(current.save?.revision||'0'))return json({code:'40001',message:'SAVE_CONFLICT'},409);
   current.save={data:body.p_data,revision:String(Number(body.p_revision)+1),updated_at:new Date().toISOString()};return json({revision:current.save.revision});
  }
  if(name==='leaderboard_page'||name==='my_rank'){
   const rows=[...users.entries()].filter(([,v])=>v.save&&v.name).map(([key,v],i)=>({position:String(i+1),username:v.name,power_log:String(totalPower(decodeCloud(v.save.data)).log),is_self:key===id,verified:false,updated_at:new Date().toISOString()}));
   return json(name==='my_rank'?rows.find(r=>r.is_self)||null:rows.slice(body.p_offset,body.p_offset+100));
  }
  return json({message:'Unexpected endpoint '+name},400);
 });
 c.on('page',p=>{p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept());});return c;
}
try{
 const anonymous=await context(),login=await anonymous.newPage();await login.goto(base);await login.waitForFunction(()=>document.querySelector('#account-message').textContent.includes('Inicia sesión'));assert.ok(await login.locator('.shell').isHidden());await login.click('#google-login');await login.waitForURL(/testing.supabase.co/);assert.ok(oauthRequested);await login.goto(base+'/?error=access_denied');await login.waitForFunction(()=>document.querySelector('#account-message').textContent.includes('cancelado'));await anonymous.close();
 const legacy=freshState();legacy.levels.attack=5;const original=JSON.stringify(legacy),c=await context(a,original),p=await c.newPage();await p.goto(base);await p.waitForSelector('#profile-form',{state:'visible'});
 await p.fill('#username','Admin');assert.ok(await p.locator('#confirm-name').isDisabled());await p.fill('#username','Taken_Name');await p.click('#confirm-name');await p.waitForFunction(()=>document.querySelector('#account-message').textContent.includes('ocupado'));await p.fill('#username','Test_Warrior');await p.click('#confirm-name');
 await p.waitForSelector('#account-decision',{state:'visible'});assert.match(await p.locator('#decision-description').textContent(),/Copia local/);await p.getByRole('button',{name:'Restaurar copia local (recuperación avanzada)',exact:true}).click();await p.waitForSelector('.shell:not([hidden])');await p.waitForSelector('.boss-choice',{state:'attached'});assert.equal(await p.locator('#account-name').textContent(),'Test_Warrior');assert.equal(await p.evaluate(()=>localStorage.getItem('cavernaburx.save.v2')),original);
 // Display preferences affect only presentation and survive reload.
 await p.waitForFunction(()=>document.querySelector('#cloud-status').textContent==='Guardado en la nube');
 const progressBeforeScale=users.get(a).save.data.payload;
 for(const [width,height,expected] of [[1366,768,.9],[1920,1080,1],[2560,1440,1.25],[3840,2160,1.5],[1024,768,1],[390,844,1],[360,800,1],[320,568,1]]){
  await p.setViewportSize({width,height});await p.waitForFunction(expected=>Number(getComputedStyle(document.documentElement).getPropertyValue('--ui-scale'))===expected,expected);
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  if(width>=1100){const ratios=await p.locator('.combat-layout').evaluate(el=>{const w=[...el.children].map(x=>x.getBoundingClientRect().width),sum=w.reduce((a,b)=>a+b);return w.map(n=>n/sum);});[.2,.55,.25].forEach((n,i)=>assert.ok(Math.abs(ratios[i]-n)<.002));}
  if(width===1920||width===2560)await p.screenshot({path:`display-${width}.png`,fullPage:true});
 }
 await p.setViewportSize({width:1366,height:768});await p.click('#open-account-settings');await p.locator('#display-settings > summary').click();await p.selectOption('#display-mode','manual');
 for(let scale=75;scale<=150;scale+=5){
  await p.locator('#display-manual').evaluate((el,value)=>{el.value=String(value);el.dispatchEvent(new Event('input',{bubbles:true}));},scale);
  assert.equal(await p.locator('#display-percentage').textContent(),scale+' %');assert.equal(await p.evaluate(()=>Number(document.documentElement.style.getPropertyValue('--ui-scale'))),scale/100);
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.ok(await p.locator('#account-settings').evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight;}));
 }
 for(const scale of [90,100,125,150]){await p.click(`[data-scale="${scale}"]`);assert.equal(await p.locator('#display-mode').inputValue(),'manual');assert.equal(await p.locator('#display-manual').inputValue(),String(scale));}
 await p.click('[data-scale="125"]');await p.reload();await p.waitForSelector('.boss-choice',{state:'attached'});assert.equal(await p.locator('#display-mode').inputValue(),'manual');assert.equal(await p.locator('#display-manual').inputValue(),'125');
 await p.click('#open-account-settings');await p.locator('#display-settings > summary').click();await p.click('#display-reset');assert.equal(await p.locator('#display-mode').inputValue(),'auto');assert.equal(await p.locator('#display-manual').inputValue(),'100');await p.click('#close-account-settings');
 assert.equal(users.get(a).save.data.payload,progressBeforeScale);
 // Responsive presentation uses the same roster/statistic nodes at every size.
 for(const width of [320,360,390,430,768,1024,1366,1920]){
  await p.setViewportSize({width,height:width>=1900?1080:width>=1100?768:844});
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`overflow at ${width}`);
  if(width>=1100){
   const fractions=await p.locator('.combat-layout').evaluate(el=>{const cols=[...el.children].map(n=>n.getBoundingClientRect().width),sum=cols.reduce((a,b)=>a+b,0);return cols.map(n=>n/sum);});
   for(const [i,expected]of [.2,.55,.25].entries())assert.ok(Math.abs(fractions[i]-expected)<.002);
   assert.ok(await p.locator('#fight').evaluate(el=>el.getBoundingClientRect().bottom<innerHeight));await p.waitForTimeout(100);assert.ok(await p.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+2),`page scroll at ${width}: ${await p.evaluate(()=>JSON.stringify({h:innerHeight,scroll:document.documentElement.scrollHeight,grid:document.querySelector('.combat-layout').getBoundingClientRect().toJSON(),footer:document.querySelector('footer').getBoundingClientRect().toJSON()}))}`);
   const before=await p.locator('.combat-center').evaluate(el=>el.getBoundingClientRect().width);
   await p.click('#toggle-statistics');assert.ok(await p.locator('.statistics-host').isHidden());assert.ok(await p.locator('.combat-center').evaluate(el=>el.getBoundingClientRect().width)>before);await p.click('#toggle-statistics');
  }else{
   await p.waitForFunction(()=>!document.querySelector('.cavern-selector').open);assert.ok(await p.locator('#boss-roster').isHidden());
   await p.click('#toggle-statistics');await p.waitForSelector('#statistics-modal[open]');
   assert.match(await p.locator('#player-stats').textContent(),/Ataque.*Defensa.*Prob. crítica.*Daño crítico/);
   assert.ok(await p.locator('#statistics-modal #boss-stats').isVisible());assert.ok(await p.locator('#statistics-modal #player-stats').isVisible());
   await p.keyboard.press('Escape');assert.ok(await p.locator('#statistics-modal').isHidden());
   assert.ok(await p.locator('#toggle-statistics').evaluate(el=>el===document.activeElement));
   await p.locator('.cavern-selector > summary').click();await p.click('[data-boss="health"]');await p.waitForFunction(()=>!document.querySelector('.cavern-selector').open);assert.ok(await p.locator('#boss-roster').isHidden());
   await p.click('#toggle-statistics');assert.match(await p.locator('#boss-stats').textContent(),/Regeneración.*por acción propia/);await p.click('#close-statistics');
   await p.locator('.cavern-selector > summary').click();await p.click('[data-boss="attack"]');
  }
  if(width===390||width===1920)await p.screenshot({path:`responsive-${width}.png`,fullPage:true});
 }
 await p.setViewportSize({width:1440,height:1000});
 // Settings is presentation-only: same export contents, native close paths and focus.
 assert.ok(await p.locator('#export-pending').isHidden());assert.ok(await p.locator('#logout').isHidden());
 await p.click('#open-account-settings');assert.equal(await p.locator('#settings-player-name').textContent(),'Test_Warrior');
 assert.equal(await p.locator('#settings-cloud-status').textContent(),await p.locator('#cloud-status').textContent());
 const exported=p.waitForEvent('download');await p.click('#export-pending');const downloaded=await exported;
 const backup=JSON.parse(await readFile(await downloaded.path(),'utf8'));assert.equal(backup.uid,a);assert.equal(decodeCloud(backup.data).levels.attack,5);
 await p.click('#close-account-settings');assert.ok(await p.locator('#account-settings').isHidden());assert.ok(await p.locator('#open-account-settings').evaluate(el=>el===document.activeElement));
 await p.click('#open-account-settings');await p.keyboard.press('Escape');assert.ok(await p.locator('#account-settings').isHidden());
 for(const width of [390,320]){await p.setViewportSize({width,height:844});await p.click('#open-account-settings');assert.ok(await p.locator('#account-settings').evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.height<=innerHeight;}));await p.click('#back-to-game');}
 await p.setViewportSize({width:1440,height:1000});
 await p.selectOption('#speed','4');await p.click('#fight');await p.setViewportSize({width:390,height:844});await p.waitForFunction(()=>!document.querySelector('.cavern-selector').open);await p.click('#toggle-statistics');await p.waitForFunction(()=>document.querySelector('#result').textContent.startsWith('Victoria'));assert.ok(await p.locator('#statistics-modal').isVisible());await p.click('#close-statistics');await p.setViewportSize({width:1440,height:1000});await p.waitForFunction(()=>document.querySelector('#cloud-status').textContent==='Guardado en la nube');assert.equal(decodeCloud(users.get(a).save.data).bosses.attack.highest,1);await p.click('#repeat');await p.waitForFunction(()=>document.querySelector('#result').textContent.startsWith('Victoria'));assert.match(await p.locator('#result').textContent(),/Repetición/);
 await p.setViewportSize({width:390,height:844});
 const logBefore=await p.locator('#battle-log').textContent(),summaryBefore=await p.locator('#combat-summary').textContent();
 await p.click('#open-analysis');assert.equal(await p.locator('#analysis-modal #battle-log').textContent(),logBefore);assert.equal(await p.locator('#analysis-modal #combat-summary').textContent(),summaryBefore);
 assert.equal(await p.evaluate(()=>getComputedStyle(document.body).overflow),'hidden');
 await p.screenshot({path:'analysis-mobile.png',fullPage:true});await p.keyboard.press('Escape');assert.ok(await p.locator('#analysis-modal').isHidden());assert.ok(await p.locator('#open-analysis').evaluate(el=>el===document.activeElement));
 await p.click('#open-analysis');await p.click('#close-analysis');assert.match(await p.locator('#result').textContent(),/Victoria.*oro/);
 await p.screenshot({path:'combat-mobile-final.png',fullPage:true});await p.setViewportSize({width:1920,height:1080});await p.screenshot({path:'combat-desktop-final.png',fullPage:true});await p.setViewportSize({width:1440,height:1000});

 await p.click('[data-tab="character"]');assert.ok((await p.locator('[data-player-name]').allTextContents()).every(s=>s==='Test_Warrior'));await p.click('[data-buy="attack"][data-count="1"]');await p.waitForFunction(()=>document.querySelector('#cloud-status').textContent==='Guardado en la nube');assert.equal(decodeCloud(users.get(a).save.data).levels.attack,6);
 await p.click('[data-tab="ranking"]');await p.waitForFunction(()=>document.querySelector('#ranking-body').children.length>0);assert.match(await p.locator('#my-rank').textContent(),/Test_Warrior/);assert.match(await p.locator('#ranking-message').textContent(),/no verificadas/);
 for(const width of [390,320]){await p.setViewportSize({width,height:844});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
 await p.reload();await p.waitForSelector('.boss-choice',{state:'attached'});assert.equal(await p.locator('#profile-form').isHidden(),true);await p.waitForFunction(()=>document.querySelector('#cloud-status').textContent==='Guardado en la nube');
 const extra=await c.newPage();await extra.goto(base);await extra.waitForSelector('#retry-account',{state:'visible'});assert.match(await extra.locator('#account-message').textContent(),/otra pestaña/);await extra.close();
 // Offline edits stay local; reconnect confirms them.
 offline=true;await p.click('[data-tab="character"]');await p.selectOption('#style','defensive');await p.waitForFunction(()=>document.querySelector('#cloud-status').textContent.includes('Sin conexión')).catch(async e=>{console.log(await p.locator('#cloud-status').textContent(),await p.locator('#migration-notice').textContent(),errors);throw e;});assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('cavernaburx.account.00000000-0000-0000-0000-000000000001')).pending),true);await p.click('#open-account-settings');assert.equal(await p.locator('#settings-cloud-status').textContent(),await p.locator('#cloud-status').textContent());await p.click('#back-to-game');offline=false;await p.evaluate(()=>dispatchEvent(new Event('online')));await p.waitForFunction(()=>document.querySelector('#cloud-status').textContent==='Guardado en la nube');
 // Another device advances the revision: no automatic overwrite, recoverable choice.
 users.get(a).save.revision=String(Number(users.get(a).save.revision)+1);await p.selectOption('#style','balanced');await p.waitForSelector('#resolve-conflict',{state:'visible'});assert.ok(await p.locator('#fight').isDisabled());await p.click('#resolve-conflict');await p.waitForSelector('#account-decision',{state:'visible'});await p.getByRole('button',{name:'Cargar progreso oficial',exact:true}).click();await p.waitForSelector('.boss-choice',{state:'attached'});await p.waitForFunction(()=>document.querySelector('#cloud-status').textContent==='Guardado en la nube');offline=true;await p.click('[data-tab="character"]');await p.selectOption('#style','aggressive');await p.click('#open-account-settings');await p.click('#logout');await p.waitForSelector('#google-login',{state:'visible'});assert.ok(await p.locator('.shell').isHidden());assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('cavernaburx.account.00000000-0000-0000-0000-000000000001')).pending),true);offline=false;await p.evaluate(token=>localStorage.setItem('sb-testing-auth-token',JSON.stringify(token)),session(b));await p.reload();await p.waitForSelector('.boss-choice',{state:'attached'});assert.equal(await p.locator('#account-name').textContent(),'Second_Player');assert.ok(await p.locator('#account-decision').isHidden());await c.close();
 // A/B: stale confirmed mobile backup loads cloud without a recovery selector.
 const mobile=await context(a),mobilePage=await mobile.newPage();
 await mobile.addInitScript(({uid,data})=>localStorage.setItem('cavernaburx.account.'+uid,JSON.stringify({uid,revision:'1',pending:false,data})),{uid:a,data:encodeCloud(freshState())});
 await mobilePage.goto(base);await mobilePage.waitForSelector('.boss-choice',{state:'attached'});assert.ok(await mobilePage.locator('#account-decision').isHidden());await mobile.close();
 const advanced=freshState();advanced.levels.attack=100000;for(const id of ['attack','health','defense'])milestone(advanced,id,350);for(const id of ['critical','penetration','vampirism'])milestone(advanced,id,1);users.get(b).save.data=encodeCloud(advanced);
 const second=await context(b),other=await second.newPage();await other.goto(base);await other.waitForSelector('.boss-choice',{state:'attached'});assert.equal(await other.locator('#account-name').textContent(),'Second_Player');assert.ok(!(await other.locator('.shell').textContent()).includes('Test_Warrior'));
 for(const [id,label]of [['health','Regeneración'],['critical','Daño crítico'],['penetration','Penetración'],['vampirism','Robo de vida']]){if(!await other.locator('.cavern-selector').evaluate(el=>el.open))await other.locator('.cavern-selector > summary').click();await other.click(`[data-boss="${id}"]`);assert.match(await other.locator('#boss-stats').textContent(),new RegExp(label));}
 assert.match(await other.locator('#player-stats').textContent(),/Daño crítico.*Penetración.*Robo de vida/);
 await other.setViewportSize({width:320,height:844});assert.ok(await other.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await other.screenshot({path:'accounts-check.png',fullPage:true});await other.waitForFunction(()=>document.querySelector('#cloud-status').textContent==='Guardado en la nube');// J: recovery must re-read the official revision after explicit selection.
 await other.click('#open-account-settings');await other.click('#settings-security');await other.click('#advanced-recovery');
 const recovery=JSON.stringify({uid:b,data:encodeCloud(freshState())});
 await other.locator('#import').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(recovery)});
 await other.waitForSelector('#account-decision',{state:'visible'});
 const beforeRecovery=users.get(b).save.data;
 users.get(b).save.revision=String(BigInt(users.get(b).save.revision)+1n);
 await other.getByRole('button',{name:'Restaurar esta copia',exact:true}).click();
 await other.waitForSelector('#retry-account',{state:'visible'});assert.deepEqual(users.get(b).save.data,beforeRecovery);
 assert.ok(await other.evaluate(()=>Object.keys(localStorage).some(k=>k.includes('.recovery.'))));
 await other.reload();await other.waitForSelector('.boss-choice',{state:'attached'});await other.click('#open-account-settings');await other.click('#settings-security');await other.click('#advanced-recovery');
 await other.locator('#import').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(recovery)});
 await other.waitForSelector('#account-decision',{state:'visible'});await other.getByRole('button',{name:'Restaurar esta copia',exact:true}).click();
 await other.waitForFunction(()=>!document.querySelector('.shell').hidden&&document.querySelector('#highest').textContent==='0');assert.equal(decodeCloud(users.get(b).save.data).bosses.attack.highest,0);
 await second.close();
 // A genuine defeat still shows its advice without opening the analysis modal.
 const weak=freshState();milestone(weak,'attack',50);users.get(b).save.data=encodeCloud(weak);
 const defeatContext=await context(b),defeatPage=await defeatContext.newPage();await defeatPage.setViewportSize({width:390,height:844});await defeatPage.goto(base);await defeatPage.waitForSelector('.boss-choice',{state:'attached'});await defeatPage.selectOption('#speed','4');await defeatPage.click('#fight');
 await defeatPage.waitForFunction(()=>document.querySelector('#result').textContent.startsWith('Derrota'));
 assert.ok(await defeatPage.locator('#combat-advice').isVisible());assert.ok((await defeatPage.locator('#advice-diagnosis').textContent()).length>0);
 await defeatPage.click('#open-analysis');assert.ok(await defeatPage.locator('#analysis-modal #combat-advice').isVisible());await defeatPage.click('#close-analysis');await defeatPage.locator('.result-panel > #combat-advice').waitFor({state:'visible'});await defeatContext.close();
 const revisionBeforeFailure=users.get(b).save.revision;readFail=true;const broken=await context(b),failure=await broken.newPage();await failure.goto(base);await failure.waitForSelector('#retry-account',{state:'visible'});assert.ok(await failure.locator('.shell').isHidden());assert.equal(users.get(b).save.revision,revisionBeforeFailure);await broken.close();
 assert.deepEqual(errors,[]);console.log('Account browser contracts passed (including display auto/manual 75–150%, profiles/reset/persistence, eight responsive widths, 20/55/25 proportions, desktop fold, live combat statistics modal, compact cavern selector, settings modal, export contents, close/Escape/focus, mobile layout and original logout): gate, Google redirect, cancellation, profile, duplicate, local migration, confirmed saves, reload, combat, names, ranking, mobile, offline/retry, conflict, logout, account isolation, stale mobile backup, failed load, manual restore and concurrent restore rejection. Hosted OAuth is NOT tested.');
}finally{await browser.close();}
