import {writeFile} from 'node:fs/promises';
import {performance} from 'node:perf_hooks';
import assert from 'node:assert/strict';
import {CONFIG as C,BOSS_IDS,INITIAL_IDS} from '../js/config.js';
import {freshState} from '../js/save.js';
import {Huge} from '../js/numbers.js';
import {buy,maxBuy,stats} from '../js/upgrades.js';
import {getBoss} from '../js/bosses.js';
import {createEncounter,stepCombat} from '../js/combat.js';
import {analyzeDefeat,packFight,diagnose} from '../js/advice.js';
import {encounter,seedRandom,milestone} from './helpers.js';
const weights={offensive:{attack:.995,health:.005,defense:0},defensive:{attack:.02,health:.48,defense:.5},balanced:{attack:1/3,health:1/3,defense:1/3}};
const styles=Object.keys(C.styles),stages=[3,8,25,150],started=performance.now();
function invest(s,build){
  const budget=s.gold;for(const key of INITIAL_IDS){const allowance=budget.mul(weights[build][key]);const n=maxBuy({...s,gold:allowance},key);if(n)buy(s,key,n);}
  return budget.sub(s.gold);
}
function fixedBudget(build,style,logBudget,seed=73){
  const s=freshState();s.gold=new Huge(logBudget);s.style=style;const spent=invest(s,build),rng=seedRandom(seed);
  const r={build,style,logBudget,seed,spent:spent.format(),upgrades:{...s.levels},battles:0,wins:0,turns:0,ultimateActivations:0,playerAttacks:0,survivalSum:0,damage:new Huge(),causes:{},capped:false};
  // Earn relics and unlocks normally. Rewards are recorded but not reinvested:
  // all builds retain the same investment ceiling for this controlled comparison.
  for(let pass=0;pass<3;pass++){
    let changed=false;
    for(const id of BOSS_IDS){if(!s.bosses[id].unlocked)continue;let losses=0;
      for(let i=0;i<4000&&losses<3;i++){
        const f=encounter(s,id,'progress',false,rng);r.battles++;r.turns+=f.turn;r.ultimateActivations+=f.ultimate.activations;r.playerAttacks+=f.summary.playerAttacks;r.damage=r.damage.add(f.summary.dealt);
        if(f.won){r.wins++;changed=true;r.survivalSum+=f.playerHP.ratio(f.player.health);losses=0;}
        else{losses++;const code=diagnose(f).code;r.causes[code]=(r.causes[code]||0)+1;}
        if(i===3999)r.capped=true;
      }
    }if(!changed)break;
  }
  r.levels=Object.fromEntries(BOSS_IDS.map(id=>[id,s.bosses[id].highest]));r.averageWinnerLife=r.wins?r.survivalSum/r.wins:0;
  r.damage=r.damage.format();r.unspentAndEarned=s.gold.format();r.goldEarned=s.gold.add(spent).sub(new Huge(logBudget)).format();delete r.survivalSum;return r;
}
function campaign(build,budget=6000){
  const s=freshState(),rng=seedRandom(641),preferred={offensive:'aggressive',defensive:'defensive',balanced:'balanced'}[build];s.style=preferred;
  let spent=invest(s,build),gold=new Huge(),repeated=new Huge(),turns=0,wins=0,losses=0,repeats=0;const failed={};
  const r={build,battles:budget,unlocks:{},milestones:0,ultimates:0};
  for(let i=0;i<budget;i++){
    const unlocked=BOSS_IDS.filter(id=>s.bosses[id].unlocked),id=unlocked[i%unlocked.length];
    let mode=failed[id]&&s.bosses[id].highest&&i%8!==0?'repeat':'progress';
    const f=encounter(s,id,mode,false,rng);turns+=f.turn;r.ultimates+=f.ultimate.activations;
    if(f.won){wins++;gold=gold.add(f.reward);if(mode==='repeat'){repeated=repeated.add(f.reward);repeats++;}else failed[id]=false;
      for(const key of f.unlocked||[])r.unlocks[key]=i+1;if(f.milestoneClaimed)r.milestones++;
      spent=spent.add(invest(s,build));
    }else{losses++;failed[id]=true;}
  }
  return {...r,levels:Object.fromEntries(BOSS_IDS.map(id=>[id,s.bosses[id].highest])),turns,wins,losses,repeats,spent:spent.format(),gold:gold.format(),repeatGold:repeated.format(),modelSeconds:turns*.1625+budget,goldPerModelSecond:gold.mul(1/(turns*.1625+budget)).format()};
}
function ultimateTrials(){
  const output={};
  for(const style of styles){const row={fights:0,wins:0,withoutWins:0,activations:0,attacks:0,activatedFights:0,shortFights:0,shortActivations:0,specialFights:0,specialWins:0,turns:0};
    for(const id of BOSS_IDS)for(const special of [false,true]){
      const level=special?C.milestones[id].interval:INITIAL_IDS.includes(id)?20:1;
      const b=getBoss(freshState(),id,level);
      const center=Math.ceil((b.health.log-Math.log10(48))/Math.log10(1.15));
      for(let delta=-8;delta<=8;delta+=2)for(let seed=1;seed<=8;seed++){
        const s=freshState();s.levels={attack:Math.max(0,center+delta),health:Math.max(0,center+delta),defense:Math.max(0,center+delta)};
        const base=stats(s),f=createEncounter(base,b,style),random=seedRandom(seed);
        while(!f.done)stepCombat(null,f,random);
        C.ultimates.enabled=false;const no=createEncounter(base,b,style),random2=seedRandom(seed);
        try{while(!no.done)stepCombat(null,no,random2);}finally{C.ultimates.enabled=true;}
        row.fights++;row.wins+=Number(f.won);row.withoutWins+=Number(no.won);row.activations+=f.ultimate.activations;row.attacks+=f.summary.playerAttacks;row.turns+=f.turn;row.activatedFights+=Number(f.ultimate.activations>0);
        if(f.summary.playerAttacks<3){row.shortFights++;row.shortActivations+=f.ultimate.activations;}
        if(special){row.specialFights++;row.specialWins+=Number(f.won);}
      }
    }output[style]=row;
  }return output;
}
const fixed=[];
for(const logBudget of stages){for(const build of Object.keys(weights))for(const style of styles)fixed.push(fixedBudget(build,style,logBudget));console.log('Equal budget complete: 1e'+logBudget);}
const intermediate=build=>fixed.find(r=>r.logBudget===8&&r.build===build&&r.style==='balanced');
assert.ok(intermediate('offensive').levels.attack>=intermediate('defensive').levels.attack+8);
assert.ok(intermediate('defensive').levels.defense>=intermediate('offensive').levels.defense+4);
assert.ok(fixed.every(r=>!r.capped),'Every progression reaches a measured wall');
const robustness=[11,22,33].flatMap(seed=>Object.keys(weights).map(build=>fixedBudget(build,'balanced',8,seed)));
const current=structuredClone(C.bosses);let previousCurves;
try{
  Object.assign(C.bosses.attack,{base:{health:48,attack:10,defense:1},growth:{health:1.26,attack:1.26,defense:1.25}});
  Object.assign(C.bosses.defense,{base:{health:65,attack:6,defense:7},growth:{health:1.26,attack:1.25,defense:1.27},ability:{resistance:.15}});
  Object.assign(C.bosses.health,{growth:{health:1.27,attack:1.25,defense:1.25},ability:{regeneration:.015}});
  C.bosses.penetration.growth={health:16,attack:16,defense:15};
  previousCurves=[8,25].flatMap(logBudget=>Object.keys(weights).map(build=>fixedBudget(build,'balanced',logBudget)));
}finally{C.bosses=current;}
const campaigns=Object.keys(weights).map(build=>campaign(build));console.log('Campaigns',JSON.stringify(campaigns.map(({build,levels})=>({build,levels}))));
const ultimates=ultimateTrials();
const absolute=C.ultimates.aggressive.critPoints;let relative;
try{C.ultimates.aggressive.critPoints=0;C.ultimates.aggressive.critRelative=.35;relative=ultimateTrials().aggressive;}
finally{C.ultimates.aggressive.critPoints=absolute;C.ultimates.aggressive.critRelative=0;}
const originalCharges=Object.fromEntries(styles.map(k=>[k,C.ultimates[k].chargeAttacks]));let slower;
try{for(const id of styles)C.ultimates[id].chargeAttacks=5;slower=ultimateTrials();}finally{for(const id of styles)C.ultimates[id].chargeAttacks=originalCharges[id];}
const durationComparison={};
try{for(const duration of [4,8]){C.ultimates.durationActions=duration;durationComparison[duration]=ultimateTrials();}}finally{C.ultimates.durationActions=6;}
const originalUltimates=structuredClone(C.ultimates),magnitudeComparison={};
try{
  for(const [name,crit,mitigation,attack,hybrid] of [['lower',.25,.35,1.08,.15],['higher',.45,.75,1.16,.3]]){
    C.ultimates.aggressive.critPoints=crit;C.ultimates.defensive.mitigationStrength=mitigation;
    C.ultimates.balanced.attack=attack;C.ultimates.balanced.mitigationStrength=hybrid;
    magnitudeComparison[name]=ultimateTrials();
  }
}finally{C.ultimates=originalUltimates;}
const examples=[];
for(const id of BOSS_IDS){const s=freshState();s.levels={attack:25,health:20,defense:15};milestone(s,id,INITIAL_IDS.includes(id)?20:0);const f=encounter(s,id);if(f&&!f.won)examples.push({id,level:f.boss.level,advice:analyzeDefeat(packFight(f),{maxMillis:10000})});}
// Find a genuine close loss, without editing combat telemetry.
outer:for(let upgrades=0;upgrades<30;upgrades++)for(let level=1;level<40;level++){
  const s=freshState();s.levels={attack:upgrades,health:upgrades,defense:upgrades};milestone(s,'attack',level-1);
  const f=encounter(s,'attack','progress',false,seedRandom(7));
  if(!f.won&&diagnose(f).code==='close'){examples.push({id:'attack',level,upgrades,advice:analyzeDefeat(packFight(f),{maxMillis:10000})});break outer;}
}
const result={seed:73,weights,stages,method:'Equal initial wallet, no initial relics, actual geometric purchases. Real earned relics and unlocks, rewards escrowed (not reinvested). Three attempts at a wall, three passes. Separate earned-income campaigns start at 35 gold.',fixed,robustness,previousCurves,campaigns,ultimates,relativeCritComparison:relative,charge5Comparison:slower,durationComparison,magnitudeComparison,examples,runtimeSeconds:(performance.now()-started)/1000};
await writeFile('tests/build-results.json',JSON.stringify(result,null,2));console.log('Written build-results.json',result.runtimeSeconds);
