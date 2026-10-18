// Local HTTP-contract mocks, NOT a test of Google's or hosted Supabase's configuration.
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
 await p.waitForSelector('#account-decision',{state:'visible'});assert.match(await p.locator('#decision-description').textContent(),/Copia local/);await p.getByRole('button',{name:'Usar copia local (confirmo que es mía)',exact:true}).click();await p.waitForSelector('.shell:not([hidden])');await p.waitForSelector('.boss-choice');assert.equal(await p.locator('#account-name').textContent(),'Test_Warrior');assert.equal(await p.evaluate(()=>localStorage.getItem('cavernaburx.save.v2')),original);
 await p.selectOption('#speed','4');await p.click('#fight');await p.waitForFunction(()=>document.querySelector('#result').textContent.startsWith('Victoria'));await p.waitForFunction(()=>document.querySelector('#cloud-status').textContent==='Guardado');assert.equal(decodeCloud(users.get(a).save.data).bosses.attack.highest,1);
 await p.click('[data-tab="character"]');assert.ok((await p.locator('[data-player-name]').allTextContents()).every(s=>s==='Test_Warrior'));await p.click('[data-buy="attack"][data-count="1"]');await p.waitForFunction(()=>document.querySelector('#cloud-status').textContent==='Guardado');assert.equal(decodeCloud(users.get(a).save.data).levels.attack,6);
 await p.click('[data-tab="ranking"]');await p.waitForFunction(()=>document.querySelector('#ranking-body').children.length>0);assert.match(await p.locator('#my-rank').textContent(),/Test_Warrior/);assert.match(await p.locator('#ranking-message').textContent(),/no verificadas/);
 for(const width of [390,320]){await p.setViewportSize({width,height:844});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
 await p.reload();await p.waitForSelector('.boss-choice');assert.equal(await p.locator('#profile-form').isHidden(),true);await p.waitForFunction(()=>document.querySelector('#cloud-status').textContent==='Guardado');
 const extra=await c.newPage();await extra.goto(base);await extra.waitForSelector('#retry-account',{state:'visible'});assert.match(await extra.locator('#account-message').textContent(),/otra pestaña/);await extra.close();
 // Offline edits stay local; reconnect confirms them.
 offline=true;await p.click('[data-tab="character"]');await p.selectOption('#style','defensive');await p.waitForFunction(()=>document.querySelector('#cloud-status').textContent.includes('sin conexión'));assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('cavernaburx.account.00000000-0000-0000-0000-000000000001')).pending),true);offline=false;await p.evaluate(()=>dispatchEvent(new Event('online')));await p.waitForFunction(()=>document.querySelector('#cloud-status').textContent==='Guardado');
 // Another device advances the revision: no automatic overwrite, recoverable choice.
 users.get(a).save.revision=String(Number(users.get(a).save.revision)+1);await p.selectOption('#style','balanced');await p.waitForSelector('#resolve-conflict',{state:'visible'});assert.ok(await p.locator('#fight').isDisabled());await p.click('#resolve-conflict');await p.waitForSelector('#account-decision',{state:'visible'});await p.getByRole('button',{name:'Usar nube',exact:true}).click();await p.waitForSelector('.boss-choice');await p.waitForFunction(()=>document.querySelector('#cloud-status').textContent==='Guardado');offline=true;await p.click('[data-tab="character"]');await p.selectOption('#style','aggressive');await p.click('#logout');await p.waitForSelector('#google-login',{state:'visible'});assert.ok(await p.locator('.shell').isHidden());assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('cavernaburx.account.00000000-0000-0000-0000-000000000001')).pending),true);offline=false;await p.evaluate(token=>localStorage.setItem('sb-testing-auth-token',JSON.stringify(token)),session(b));await p.reload();await p.waitForSelector('.boss-choice');assert.equal(await p.locator('#account-name').textContent(),'Second_Player');assert.ok(await p.locator('#account-decision').isHidden());await c.close();
 const advanced=freshState();for(const id of ['attack','health','defense'])milestone(advanced,id,350);for(const id of ['critical','penetration','vampirism'])milestone(advanced,id,1);users.get(b).save.data=encodeCloud(advanced);
 const second=await context(b),other=await second.newPage();await other.goto(base);await other.waitForSelector('.boss-choice');assert.equal(await other.locator('#account-name').textContent(),'Second_Player');assert.ok(!(await other.locator('.shell').textContent()).includes('Test_Warrior'));
 for(const [id,label]of [['health','Regeneración'],['critical','Daño crítico'],['penetration','Penetración'],['vampirism','Robo de vida']]){await other.click(`[data-boss="${id}"]`);assert.match(await other.locator('#boss-stats').textContent(),new RegExp(label));}
 assert.match(await other.locator('#player-stats').textContent(),/Daño crítico.*Penetración.*Robo de vida/);
 await other.setViewportSize({width:320,height:844});assert.ok(await other.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await other.screenshot({path:'accounts-check.png',fullPage:true});await other.waitForFunction(()=>document.querySelector('#cloud-status').textContent==='Guardado');await second.close();
 const revisionBeforeFailure=users.get(b).save.revision;readFail=true;const broken=await context(b),failure=await broken.newPage();await failure.goto(base);await failure.waitForSelector('#retry-account',{state:'visible'});assert.ok(await failure.locator('.shell').isHidden());assert.equal(users.get(b).save.revision,revisionBeforeFailure);await broken.close();
 assert.deepEqual(errors,[]);console.log('Account browser contracts passed: gate, Google redirect, cancellation, profile, duplicate, local migration, confirmed saves, reload, combat, names, ranking, mobile, offline/retry, conflict, logout, account isolation, failed load. Hosted OAuth is NOT tested.');
}finally{await browser.close();}
