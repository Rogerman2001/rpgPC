import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {freshState} from '../js/save.js';
import {milestone} from './helpers.js';
import {Huge} from '../js/numbers.js';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_PATH).href);
const gameURL=process.env.GAME_URL||'http://localhost:4173';
const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL||'chrome'});
const context=await browser.newContext({viewport:{width:1440,height:1050}});
const page=await context.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('cavernaburx.save.v2')));
async function importState(s){
  await page.locator('footer button').click();
  await page.setInputFiles('#import',{name:'test.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(s))});
  await page.waitForFunction(()=>document.querySelector('#toast').textContent==='Partida importada.');
  await page.waitForTimeout(100);
}
try{
  await page.goto(gameURL);await page.waitForSelector('.boss-choice');
  assert.equal(await page.locator('.nav').count(),2);assert.equal(await page.locator('.boss-choice').count(),6);assert.equal(await page.locator('.boss-choice.locked').count(),3);
  assert.equal(await page.locator('#repeat').isDisabled(),true);
  await page.click('[data-boss="critical"]');assert.equal(await page.locator('#fight').isDisabled(),true);assert.match(await page.locator('#unlock-detail').textContent(),/50.*25/);
  await page.click('[data-boss="attack"]');await page.selectOption('#speed','4');await page.click('#fight');
  await page.waitForFunction(()=>document.querySelector('#result').textContent.startsWith('Victoria'));
  let s=await read();assert.equal(s.bosses.attack.highest,1);assert.equal(s.items.attack.level,1);assert.equal(s.selectedBoss,'attack');
  await page.click('#repeat');await page.waitForFunction(()=>document.querySelector('#result').textContent.includes('Repetición:'));
  s=await read();assert.equal(s.bosses.attack.highest,1);assert.equal(s.items.attack.level,1);assert.equal(s.bosses.attack.repeats,1);assert.equal(await page.locator('#combat-summary').isVisible(),true);
  await page.reload();await page.waitForSelector('.boss-choice');assert.equal((await read()).bosses.attack.highest,1);await page.click('[data-tab="character"]');await page.selectOption('#style','defensive');await page.reload();await page.waitForSelector('.boss-choice');assert.equal((await read()).style,'defensive');
  await page.click('[data-tab="character"]');await page.click('[data-buy="attack"][data-count="1"]');assert.match(await page.locator('#upgrade-list').textContent(),/NV. 1/);
  await page.click('[data-tab="character"]');assert.equal(await page.locator('.item-card').count(),6);assert.equal(await page.locator('.item-card:not(.unowned)').count(),1);
  await page.screenshot({path:'character-check.png',fullPage:true,animations:'disabled'});
  await page.click('[data-tab="cavern"]');await page.click('[data-subtab="combat"]');await page.screenshot({path:'desktop-check.png',fullPage:true,animations:'disabled'});
  for(const width of [390,320]){
    await page.setViewportSize({width,height:844});
    for(const tab of ['cavern','character']){await page.click(`[data-tab="${tab}"]`);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${tab} overflow at ${width}`);}
  }
  await page.setViewportSize({width:390,height:844});await page.click('[data-tab="cavern"]');await page.click('[data-subtab="combat"]');await page.screenshot({path:'mobile-check.png',fullPage:true,animations:'disabled'});
  const charged=freshState();charged.selectedBoss='health';charged.style='defensive';charged.speed=1;
  await importState(charged);await page.click('[data-tab="cavern"]');await page.click('[data-subtab="combat"]');
  assert.equal(await page.locator('#ultimate-track').getAttribute('aria-valuenow'),'0');
  await page.click('#fight');await page.waitForFunction(()=>document.querySelector('#ultimate-track').getAttribute('aria-valuenow')==='33');
  assert.ok(await page.locator('#combat-style').isDisabled());
  await page.waitForFunction(()=>document.querySelector('#ultimate-track').classList.contains('ultimate-active'));
  assert.match(await page.locator('#ultimate-state').textContent(),/Bastión Inquebrantable.*activa/);
  await page.selectOption('#speed','4');await page.waitForFunction(()=>document.querySelector('#result').textContent.startsWith('Victoria'));
  assert.equal(await page.locator('#ultimate-track').getAttribute('aria-valuenow'),'0');
  assert.equal(await page.locator('.ultimate-active').count(),0);
  await page.selectOption('#combat-style','aggressive');assert.match(await page.locator('#ultimate-state').textContent(),/Furia Desatada/);
  const doomed=freshState();milestone(doomed,'attack',15);doomed.speed=4;
  await importState(doomed);await page.click('[data-tab="cavern"]');await page.click('[data-subtab="combat"]');await page.click('#fight');
  await page.waitForFunction(()=>!document.querySelector('#combat-advice').hidden&&!document.querySelector('#advice-recommendation').textContent.includes('Comparando'));
  assert.match(await page.locator('#advice-diagnosis').textContent(),/Supervivencia/);
  assert.match(await page.locator('#advice-recommendation').textContent(),/garantiza/);
  assert.ok(await page.locator('#combat-summary').isVisible());
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:'advice-check.png',fullPage:true,animations:'disabled'});
  const weak=freshState();milestone(weak,'attack',15);weak.gold=Huge.of(10000);weak.speed=4;weak.afk.unlocked=true;
  await importState(weak);await page.click('[data-tab="cavern"]');await page.click('[data-subtab="afk"]');await page.click('#afk-toggle');
  await page.waitForFunction(()=>document.querySelector('#afk-status').textContent.includes('repetición'));
  await page.waitForFunction(()=>document.querySelector('#afk-status').textContent.includes('Preparado'));
  s=await read();assert.equal(s.afk.bossId,'attack');assert.equal(s.bosses.attack.highest,15);assert.equal(s.items.attack.level,15);assert.ok(s.gold<4);
  // AFK can win successive levels of the selected boss without changing identity.
  const strong=freshState();strong.levels={attack:30,health:30,defense:30};strong.gold=Huge.of(10000);strong.speed=4;strong.afk.unlocked=true;strong.selectedBoss='defense';
  await importState(strong);await page.click('[data-tab="cavern"]');await page.click('[data-subtab="afk"]');await page.click('#afk-toggle');
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('cavernaburx.save.v2')).bosses.defense.highest>=2);
  await page.click('#afk-toggle');await page.reload();await page.waitForSelector('.boss-choice');s=await read();assert.equal(s.afk.active,false);assert.equal(s.items.defense.level,s.bosses.defense.highest);assert.equal(s.bosses.attack.highest,0);
  const special=freshState();milestone(special,'attack',99);special.levels={attack:300,health:300,defense:300};special.speed=4;
  await importState(special);await page.click('[data-tab="cavern"]');await page.click('[data-subtab="combat"]');
  assert.ok(await page.locator('#special-detail').isVisible());await page.click('#fight');await page.waitForFunction(()=>document.querySelector('#result').textContent.includes('Premio de hito cobrado'));
  assert.deepEqual((await read()).milestones.attack.claimed,[100]);await page.click('#repeat');await page.waitForFunction(()=>document.querySelector('#result').textContent.includes('Repetición:'));
  assert.deepEqual((await read()).milestones.attack.claimed,[100]);assert.equal((await read()).items.attack.level,100);
  await page.reload();await page.waitForSelector('.boss-choice');assert.equal(await page.locator('#special-detail').isVisible(),false);
  const other=await context.newPage();await other.goto(gameURL);await other.waitForFunction(()=>document.querySelector('#migration-notice').textContent.includes('otra pestaña'));assert.ok(await other.locator('#fight').isDisabled());await other.close();
  await page.locator('footer button').click();const dp=page.waitForEvent('download');await page.click('#export');assert.match((await dp).suggestedFilename(),/v2/);
  assert.deepEqual(errors,[]);
  const migratedContext=await browser.newContext();const m=await migratedContext.newPage();
  const v1={version:1,gold:3,levels:{attack:4,health:3,defense:2},highest:1,wins:{1:1},items:[{boss:1,family:0,level:1,xp:0}],afk:{unlocked:false,active:false,mode:'progress'},speed:1};
  await m.addInitScript(v=>{if(!localStorage.getItem('cavernaburx.save.v1'))localStorage.setItem('cavernaburx.save.v1',JSON.stringify(v));},v1);
  await m.goto(gameURL);await m.waitForFunction(()=>document.querySelector('#migration-notice').textContent.includes('migrada'));
  assert.ok(await m.evaluate(()=>localStorage.getItem('cavernaburx.save.v1')));await m.reload();await m.waitForSelector('.boss-choice');assert.equal(await m.evaluate(()=>JSON.parse(localStorage.getItem('cavernaburx.save.v2')).items.attack.level),1);
  console.log('Browser OK: ultimate charge/active/reset/style, worker advice, six bosses, locked details, challenge/repeat, upgrades, inventory, reload, AFK, single-tab lock, export/import, migration, mobile 390/320; no JS errors.');
}finally{await browser.close();}
