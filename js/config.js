// Central balance configuration. Advanced curves are intentionally much steeper.
const initial = (id,name,item,rune,base,growth,ability,description) => ({
  id,name,item,rune,label:{attack:'Ataque',defense:'Defensa',health:'Vida'}[id],
  base,growth,anchor:1,rewardBase:28,rewardGrowth:1.30,ability,description
});
export const CONFIG = {
  version:2,initialGold:35,criticalChance:.12,criticalDamage:1.75,
  upgrades:{
    attack:{name:'Ataque',icon:'⚔',base:12,growth:1.15,cost:15,costGrowth:1.18},
    health:{name:'Vida',icon:'♡',base:110,growth:1.15,cost:12,costGrowth:1.18},
    defense:{name:'Defensa',icon:'◇',base:3,growth:1.15,cost:10,costGrowth:1.18}
  },
  combat:{minimumDamage:.08,maxTurns:2000},
  styles:{
    balanced:{name:'Equilibrado',attack:1,health:1,defense:1,description:'Sin modificadores'},
    aggressive:{name:'Ofensivo',attack:1.25,health:.85,defense:.8,description:'+25% ataque · −15% vida · −20% defensa'},
    defensive:{name:'Defensivo',attack:.85,health:1.2,defense:1.35,description:'−15% ataque · +20% vida · +35% defensa'}
  },
  caverns:{attack:'Fosa de la Furia',defense:'Bastión de Hierro',health:'Santuario de la Vitalidad',critical:'Umbral del Verdugo',penetration:'Cripta del Perforador',vampirism:'Altar Carmesí'},
  ultimates:{
    enabled:true,durationActions:6,
    aggressive:{name:'Furia Desatada',chargeAttacks:3,critPoints:.35,critRelative:0,attack:1,mitigationStrength:0},
    defensive:{name:'Bastión Inquebrantable',chargeAttacks:3,critPoints:0,critRelative:0,attack:1,mitigationStrength:.5},
    balanced:{name:'Armonía del Guerrero',chargeAttacks:3,critPoints:0,critRelative:0,attack:1.12,mitigationStrength:.2}
  },
  analysis:{seeds:12,upgradeCount:3,maxActions:2000},
  milestones:{
    enabled:true,
    attack:{interval:100,health:1.7,attack:1.4,defense:1.2,gold:2,ability:{enrageEvery:3,enrageMultiplier:1.5},description:'Cada tercer ataque inflige ×1,5 daño'},
    defense:{interval:100,health:1.8,attack:1.25,defense:1.5,gold:2,ability:{resistance:.3},description:'Resistencia aumentada al 30%'},
    health:{interval:100,health:2,attack:1.25,defense:1.2,gold:2,ability:{regeneration:.025},description:'Regenera 2,5% por turno propio'},
    critical:{interval:50,health:1.7,attack:1.35,defense:1.2,gold:2,ability:{criticalChance:.4,criticalDamage:2.3},description:'40% de crítico · daño crítico ×2,3'},
    penetration:{interval:25,health:1.7,attack:1.35,defense:1.3,gold:2,ability:{penetration:.8},description:'Ignora el 80% de defensa'},
    vampirism:{interval:10,health:1.8,attack:1.35,defense:1.25,gold:2,ability:{vampirism:.3},description:'Recupera el 30% del daño infligido'}
  },
  bossScaling:{anchorGrowth:1.26},
  items:{statPerLevel:.025,criticalPerLevel:.025,penetrationPerLevel:.005,vampirismPerLevel:.004},
  economy:{repeatRate:.8,anchorRewardGrowth:1.30},
  afk:{unlock:200,rewardRate:.05,feeRate:.005,delay:1200},
  bosses:{
    attack:initial('attack','El Vigía de Ceniza','Ojo de ceniza','◈',
      {health:48,attack:12,defense:1},{health:1.25,attack:1.38,defense:1.18},{},'Ofensiva explosiva · vida y armadura más lentas'),
    defense:initial('defense','El Caballero Hueco','Sello del vacío','♜',
      {health:80,attack:4,defense:12},{health:1.30,attack:1.30,defense:1.42},{resistance:.25},'Armadura creciente · resistencia 25% · combate de desgaste'),
    health:initial('health','La Madre de Piedra','Corazón de basalto','⬡',
      {health:100,attack:5,defense:2},{health:1.40,attack:1.19,defense:1.12},{regeneration:.005},'Vida creciente · regenera 0,5% por turno propio'),
    critical:{id:'critical',label:'Crítico',name:'La Tejedora de Ecos',item:'Hilo del abismo',rune:'✧',
      unlock:{any:50,all:25},anchor:55,base:{health:60,attack:8,defense:1},
      growth:{health:2.4,attack:2.4,defense:2.3},rewardBase:28,rewardGrowth:2.8,
      ability:{criticalChance:.3,criticalDamage:2},description:'30% de crítico · golpes al 200% · defensa baja'},
    penetration:{id:'penetration',label:'Penetración',name:'El Devorador de Luz',item:'Ascua perforante',rune:'☼',
      unlock:{any:150,all:75},anchor:165,base:{health:65,attack:9,defense:3},
      growth:{health:16.3,attack:16.3,defense:15},rewardBase:28,rewardGrowth:27,
      ability:{penetration:.65},description:'Ignora el 65% de tu defensa'},
    vampirism:{id:'vampirism',label:'Vampirismo',name:'El Rey Sepultado',item:'Corona carmesí',rune:'♛',
      unlock:{any:350,all:175},anchor:380,base:{health:75,attack:10,defense:3},
      growth:{health:100000,attack:100000,defense:90000},rewardBase:28,rewardGrowth:800000,
      ability:{vampirism:.2},description:'Recupera el 20% del daño real que inflige'}
  }
};
export const BOSS_IDS=Object.keys(CONFIG.bosses);
export const INITIAL_IDS=['attack','defense','health'];
