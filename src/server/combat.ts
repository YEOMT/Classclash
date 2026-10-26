import balance from '../shared/balance.js';
import { HERO_BY_ID, SKILLS, heroStats, type SkillDefinition } from '../shared/heroes.js';
import type { Lane, OwnedHero, Team } from '../shared/types.js';
import type { Action, CombatEvent, CombatState, CombatStats, CombatUnit, HitPayload, PersistentEffect, Point, Projectile, Source, UnitKind } from '../shared/combat-types.js';
import { clamp, circleHits, clearSegment, coneHits, direction, distance, findLocalPath, gap, inLane, isStructure, laneProgress, living, nearestWalkable, pointOnPath, rectangleHits, safeMove, segmentDistance, SpatialHash, teamDirection, walkable } from './combat-geometry.js';
export type { CombatState, CombatUnit, CombatEvent } from '../shared/combat-types.js';
export { gap, inLane } from './combat-geometry.js';
export const TICK_MS=50;
export const ticks=(milliseconds:number)=>Math.ceil(milliseconds/TICK_MS);
const hardTypes=new Set(['stun','airborne']);
const negativeTypes=new Set(['stun','airborne','root','slow','taunt','silence']);
const initiativeRanks=new WeakMap<CombatUnit,number>();
const zeroStats=():CombatStats=>({heroDamage:0,minionDamage:0,structureDamage:0,healing:0,shielding:0,damageTaken:0,ccSeconds:0,kills:0,assists:0,deaths:0,towerKills:0});
const hash=(text:string)=>{let h=2166136261;for(const c of new TextEncoder().encode(text)){h^=c;h=Math.imul(h,16777619);}return h>>>0;};
const serialId=(s:CombatState,prefix:string)=>`${s.matchId}:${prefix}:${++s.entitySeq}`;
const sourceOf=(u:CombatUnit):Source=>({entityId:u.entityId,deploymentId:u.deploymentId,playerId:u.ownerPlayerId,ownedHeroInstanceId:u.ownedHeroInstanceId,heroDefinitionId:u.heroDefinitionId,team:u.team,kind:u.kind,power:u.power,maxHp:u.maxHp});
const allUnits=(s:CombatState)=>[...s.units,...s.structures];
const stat=(s:CombatState,id:string|undefined)=>id?(s.stats[id]??=zeroStats()):undefined;
const hasStatus=(u:CombatUnit,type:string,tick:number)=>u.statuses.some(x=>x.type===type&&x.untilTick>tick);
const hardCc=(u:CombatUnit,tick:number)=>u.statuses.some(x=>hardTypes.has(x.type)&&x.untilTick>tick);
const minion=(u:CombatUnit)=>u.kind.endsWith('MINION');
const inSameBattleLane=(a:CombatUnit,b:CombatUnit)=>(a.lane===b.lane||a.x<320&&b.x<350||a.x>1216&&b.x>1186||b.lane===null);
function emit(s:CombatState,type:string,source:Source|CombatUnit|null,targets:string[],point:Point,effectId:string,actionId='',params:Record<string,number|string>={}):CombatEvent{
  const e={eventId:`${s.matchId}:event:${++s.eventSeq}`,eventSeq:s.eventSeq,matchId:s.matchId,tick:s.tick,type,sourceEntityId:source?.entityId??null,targetEntityIds:targets,actionId,effectId,x:point.x,y:point.y,params};
  s.events.push(e);return e;
}
function unitBase(s:CombatState,kind:UnitKind,team:Team,lane:Lane|null,x:number,y:number,stats:{hp:number;power:number;armor:number;speed:number;range:number;radius:number;attackIntervalMs:number;windupMs:number;projectileSpeed?:number;recoveryMs?:number},id?:string):CombatUnit{
  const entityId=id??serialId(s,'unit');
  return {entityId,deploymentId:serialId(s,'life'),kind,team,lane,x,y,previousX:x,previousY:y,vx:0,vy:0,level:1,role:kind==='MELEE_MINION'?'melee':'ranged',hp:stats.hp,maxHp:stats.hp,armor:stats.armor,power:stats.power,range:stats.range,speed:stats.speed,radius:stats.radius,attackIntervalMs:stats.attackIntervalMs,windupMs:stats.windupMs,recoveryMs:stats.recoveryMs??Math.min(300,.2*stats.attackIntervalMs),projectileSpeed:stats.projectileSpeed??0,facingX:teamDirection(team),facingY:0,state:'SPAWNING',createdTick:s.tick,shield:0,statuses:[],shields:[],protected:false,action:null,actionId:null,actionStartTick:s.tick,impactTick:0,recoveryEndTick:0,targetId:null,targetChosenTick:s.tick,nextBasicReadyTick:s.tick,nextAiTick:s.tick+7,skillReadyAt:{},goal:null,path:[],pathGoal:null,pathPlannedTick:0,lateral:0,progress:0,slotIndex:-1,slotUntilTick:0,engageX:x,tacticalUntilTick:0,retreatDistance:0,debugReason:'등장',ccChainStartTick:-100,lastHardCcActiveTick:-100,hardCcImmuneUntilTick:0,forcedMove:null,damageLedger:[],recentDamage:[],supportLedger:[],marks:{},towerTargetId:null,towerStreak:0,lastAttackTick:-100,lastProgressTick:s.tick,lastProgressX:x,lastProgressY:y,stalledTicks:0};
}
export function createCombat(matchId:string,seed:number|string,tick=0):CombatState{
  const state:CombatState={matchId,seed:typeof seed==='number'?seed:hash(seed),tick,battleStartTick:tick,nextWaveTick:tick,units:[],structures:[],projectiles:[],effects:[],events:[],eventSeq:0,entitySeq:0,actionSeq:0,wave:0,winner:null,teamKills:{A:0,B:0},stats:{},cooldowns:{},scheduled:[],metrics:{firstHitTick:null,destroyed:[],wavesSpawned:0,spawnedMinions:0,maxUnits:0,stalledEvents:0,invalidPositions:0,tickCount:0,stalls:[]}};
  for(const def of balance.map.structures){
    const kind=def.kind as 'OUTER'|'INNER'|'GUARD'|'NEXUS',base=balance.structureStats[kind];
    const u=unitBase(state,kind,def.team as Team,def.lane as Lane|null,def.x,def.y,{...base,speed:0,attackIntervalMs:base.attackIntervalMs??0,windupMs:base.windupMs??0,projectileSpeed:base.projectileSpeed??0},`${matchId}:${def.id}`);
    u.state='HOLD';u.role='structure';u.nextAiTick=tick;state.structures.push(u);
  }
  updateStructureProtection(state);spawnWave(state);return state;
}
function placeSpawn(s:CombatState,u:CombatUnit,preferred:Point):void{
  const lane=u.lane??'TOP';
  for(let ring=0;ring<10;ring++)for(let i=0;i<(ring?16:1);i++){
    const angle=i*Math.PI/8,p={x:preferred.x+Math.cos(angle)*ring*16,y:preferred.y+Math.sin(angle)*ring*16};
    if(walkable(s,p,u.radius,lane)&&s.units.every(v=>!living(v)||distance(p,v)>=u.radius+v.radius+1)){
      u.x=p.x;u.y=p.y;u.previousX=p.x;u.previousY=p.y;u.lastProgressX=p.x;u.lastProgressY=p.y;return;
    }
  }
  // Never omit a legitimate wave. The normal separation solver clears rare crowded spawn areas.
  u.x=preferred.x;u.y=preferred.y;
}
export function deployHero(s:CombatState,args:{playerId:string;team:Team;lane:Lane;hero:OwnedHero;sharedSkillReadyAt:Record<string,number>}):CombatUnit{
  if(s.winner)throw new Error('MATCH_FINISHED');
  const existing=s.units.find(u=>living(u)&&u.ownerPlayerId===args.playerId);if(existing)throw new Error('HERO_ALREADY_ACTIVE');
  const {hero,playerId,team,lane}=args,def=HERO_BY_ID[hero.heroDefinitionId];if(!def)throw new Error('INVALID_HERO');
  const stats=heroStats(def.id,hero.level,hero.powerEnhancements,hero.vitalityEnhancements),spawn=balance.map.spawn[team];
  const u=unitBase(s,'HERO',team,lane,spawn[0]!,spawn[1]!,{...stats,projectileSpeed:stats.projectileSpeed??0});
  u.ownerPlayerId=playerId;u.ownedHeroInstanceId=hero.ownedHeroInstanceId;u.heroDefinitionId=def.id;u.level=hero.level;u.role=def.role;
  const cd=s.cooldowns[playerId]??={instance:{},shared:{...args.sharedSkillReadyAt}};
  cd.instance[hero.ownedHeroInstanceId]??={...hero.skillReadyAt};
  for(const [id,at] of Object.entries(args.sharedSkillReadyAt))cd.shared[id]=Math.max(at,cd.shared[id]??0);
  for(const id of def.skillIds)u.skillReadyAt[id]=Math.max(cd.instance[hero.ownedHeroInstanceId]![id]??0,cd.shared[id]??0);
  u.lateral=((hash(`${s.seed}/${playerId}/${lane}`)%7)-3)*14;
  placeSpawn(s,u,{x:spawn[0]!,y:spawn[1]!+(lane==='TOP'?-24:24)});u.engageX=u.x;
  s.units.push(u);stat(s,playerId);emit(s,'SPAWN',u,[u.entityId],u,'spawn');return u;
}
export function spawnWave(s:CombatState):void{
  s.wave++;s.metrics.wavesSpawned++;const spawnTick=s.tick;
  for(const team of ['A','B'] as Team[])for(const lane of ['TOP','BOTTOM'] as Lane[]){
    for(const kind of ['MELEE_MINION','RANGED_MINION'] as const){
      const base=kind==='MELEE_MINION'?balance.minions.melee:balance.minions.ranged;
      const laterals=kind==='MELEE_MINION'?[-28,0,28]:[-42,-14,14,42];
      for(const lateral of laterals){
        const p=pointOnPath(kind==='MELEE_MINION'?48:18,lane,team,lateral+(lane==='TOP'?-22:22));
        const u=unitBase(s,kind,team,lane,p.x,p.y,base);u.lateral=lateral;u.nextAiTick=spawnTick+1;
        placeSpawn(s,u,p);s.units.push(u);s.metrics.spawnedMinions++;
      }
    }
  }
  s.nextWaveTick=spawnTick+ticks(balance.minions.waveIntervalSeconds*1000);
  emit(s,'WAVE',null,[],{x:768,y:384},'wave','',{wave:s.wave});
}
export function updateStructureProtection(s:CombatState):void{
  for(const team of ['A','B'] as Team[]){
    const structures=s.structures.filter(u=>u.team===team);
    const laneOpen=(lane:Lane)=>!structures.some(u=>u.lane===lane&&living(u));
    const guardsOpen=laneOpen('TOP')||laneOpen('BOTTOM');
    const nexusOpen=!structures.some(u=>u.kind==='GUARD'&&living(u));
    for(const u of structures){u.protected=u.kind==='INNER'?structures.some(v=>v.kind==='OUTER'&&v.lane===u.lane&&living(v)):u.kind==='GUARD'?!guardsOpen:u.kind==='NEXUS'?!nexusOpen:false;}
  }
}
export function minionSiegeMultiplier(s:CombatState):number{
  const elapsed=(s.tick-s.battleStartTick)/20;
  let multiplier=1;for(const phase of balance.minions.structureDamagePhases)if(elapsed>=phase.fromBattleSecond)multiplier=phase.multiplier;
  return multiplier;
}
interface Impact { source:Source;target:CombatUnit;payload:HitPayload;actionId:string;point:Point;seq:number;healing?:number;shield?:number;shieldDuration?:number;cleanse?:boolean;removeSlow?:boolean;buff?:{type:string;magnitude:number;durationMs:number}; }
interface SkillPlan {skill:SkillDefinition;targets:CombatUnit[];point:Point;score:number;}
const frontierCaches=new WeakMap<CombatState,{tick:number;units:Map<string,CombatUnit|undefined>;reservations:Map<string,number>}>();

function frontier(s:CombatState,u:CombatUnit):CombatUnit|undefined{
  let cache=frontierCaches.get(s);
  if(!cache||cache.tick!==s.tick){
    cache={tick:s.tick,units:new Map(),reservations:new Map()};
    for(const a of s.units)if(living(a)&&a.range<40&&a.targetId)cache.reservations.set(a.targetId,(cache.reservations.get(a.targetId)??0)+1);
    frontierCaches.set(s,cache);
  }
  if(cache.units.has(u.entityId))return cache.units.get(u.entityId);
  const candidates=s.structures.filter(t=>t.team!==u.team&&living(t)&&!t.protected&&(t.lane===u.lane||t.lane===null));
  const result=candidates.sort((a,b)=>{
    const count=(target:CombatUnit)=>cache!.reservations.get(target.entityId)??0;
    const score=(target:CombatUnit)=>distance(u,target)+count(target)*22+(target.kind==='GUARD'?target.hp/target.maxHp*40:0);
    return score(a)-score(b);
  })[0];cache.units.set(u.entityId,result);return result;
}
function targetValid(s:CombatState,u:CombatUnit,t:CombatUnit):boolean{
  if(!living(t)||t.team===u.team||t.protected||!inSameBattleLane(u,t))return false;
  if(isStructure(t))return t.lane===u.lane||t.lane===null;
  const f=frontier(s,u),sign=teamDirection(u.team);
  if(f&&(t.x-f.x)*sign>f.radius+64)return false;
  if(u.targetId===t.entityId&&s.tick-u.targetChosenTick>50&&(t.x-u.engageX)*sign>160)return false;
  return true;
}
function threatToBackline(t:CombatUnit,allies:CombatUnit[]):boolean{
  return allies.some(a=>living(a)&&['ranged','mage','support'].includes(a.role)&&(t.targetId===a.entityId||gap(t,a)<50));
}
function towerTarget(s:CombatState,tower:CombatUnit,index:Map<string,CombatUnit>,space:SpatialHash):CombatUnit|undefined{
  const enemies=space.nearby(tower,tower.range+tower.radius+20).filter(u=>u.team!==tower.team&&gap(tower,u)<=tower.range);
  const defenders=space.nearby(tower,tower.range+tower.radius+40).filter(u=>u.kind==='HERO'&&u.team===tower.team);
  const aggro=enemies.filter(u=>u.kind==='HERO').map(u=>({u,damage:defenders.reduce((sum,a)=>sum+a.recentDamage.filter(d=>d.sourceId===u.entityId&&s.tick-d.tick<=60).reduce((n,d)=>n+d.value,0),0)})).filter(x=>x.damage>0).sort((a,b)=>b.damage-a.damage||gap(tower,a.u)-gap(tower,b.u));
  if(aggro[0])return aggro[0].u;
  const current=tower.targetId?index.get(tower.targetId):undefined;if(current&&enemies.includes(current))return current;
  return enemies.sort((a,b)=>({MELEE_MINION:0,RANGED_MINION:1,HERO:2}[a.kind as 'HERO']??3)-({MELEE_MINION:0,RANGED_MINION:1,HERO:2}[b.kind as 'HERO']??3)||gap(tower,a)-gap(tower,b))[0];
}
function chooseTarget(s:CombatState,u:CombatUnit,index:Map<string,CombatUnit>,space:SpatialHash):CombatUnit|undefined{
  const taunt=u.statuses.find(x=>x.type==='taunt'&&x.untilTick>s.tick);
  if(taunt){const t=index.get(taunt.sourceId);if(t&&targetValid(s,u,t))return t;}
  const detect=minion(u)?(u.kind==='MELEE_MINION'?220:240):300;
  const foes=space.nearby(u,detect+u.radius).filter(t=>targetValid(s,u,t));
  const f=frontier(s,u);if(f)foes.push(f);
  const allies=space.nearby(u,220).filter(t=>t.team===u.team);
  const score=(t:CombatUnit)=>{
    const g=gap(u,t),crowd=s.units.filter(a=>a.team===u.team&&a.targetId===t.entityId&&a.range<40&&living(a)).length;
    let value=30*clamp(1-g/300,0,1)+(g<=u.range?25:0)+(u.targetId===t.entityId?18:0)+10*(1-t.hp/t.maxHp)-Math.max(0,crowd-4)*5;
    if(t.kind==='HERO')value+=u.role==='melee'?10:8;
    if(threatToBackline(t,allies))value+=u.role==='tank'?33:18;
    if(isStructure(t)){value-=18;if(t.kind==='NEXUS'&&g<=u.range+60)value+=50;if(g>u.range+100&&foes.some(x=>!isStructure(x)&&gap(u,x)<130))value-=40;}
    if(u.heroDefinitionId==='assassin'&&t.kind==='HERO'&&['mage','support','ranged'].includes(t.role)&&g<=110)value+=16;
    if(u.heroDefinitionId==='rune_mage'&&t.marks[`rune:${u.ownedHeroInstanceId}`])value+=7;
    if(u.heroDefinitionId==='ancient_one'&&t.marks[`sigil:${u.ownedHeroInstanceId}`])value+=8;
    return value;
  };
  foes.sort((a,b)=>score(b)-score(a)||distance(u,a)-distance(u,b));
  let chosen=foes[0];const current=u.targetId?index.get(u.targetId):undefined;
  if(current&&targetValid(s,u,current)&&distance(u,current)<detect+120&&chosen&&chosen!==current&&score(chosen)<score(current)*1.2&&s.tick-u.targetChosenTick<50)chosen=current;
  if(current&&living(current)&&chosen!==current&&s.tick-u.targetChosenTick<6&&targetValid(s,u,current))chosen=current;
  if(chosen?.entityId!==u.targetId){u.targetId=chosen?.entityId??null;u.targetChosenTick=s.tick;u.engageX=u.x;u.slotIndex=-1;u.path=[];u.pathGoal=null;}
  return chosen;
}

function findSkill(s:CombatState,u:CombatUnit,index:Map<string,CombatUnit>,space:SpatialHash):SkillPlan|undefined{
  if(u.kind!=='HERO'||!u.heroDefinitionId||hardCc(u,s.tick)||hasStatus(u,'silence',s.tick))return;
  const enemies=space.nearby(u,300).filter(t=>targetValid(s,u,t));
  const objective=frontier(s,u);if(objective&&gap(u,objective)<=260)enemies.push(objective);
  const allies=space.nearby(u,260).filter(t=>t.team===u.team&&!isStructure(t));
  const allyHeroes=allies.filter(t=>t.kind==='HERO');
  const threatened=(a:CombatUnit)=>enemies.some(t=>!isStructure(t)&&(t.targetId===a.entityId&&gap(t,a)<t.range+t.speed*.8||gap(t,a)<50))||s.projectiles.some(p=>p.targetId===a.entityId&&distance(p,a)/p.speed<=.8);
  const engaged=(a:CombatUnit)=>threatened(a)||a.targetId!==null&&a.state!=='ADVANCE';
  const byHp=(a:CombatUnit,b:CombatUnit)=>a.hp/a.maxHp-b.hp/b.maxHp;
  const options:SkillPlan[]=[];
  for(const skill of HERO_BY_ID[u.heroDefinitionId]!.skills){
    if(u.level<skill.unlockLevel||(u.skillReadyAt[skill.id]??0)>s.tick)continue;
    if(u.action&&!(skill.allowDuringBasicRecovery&&u.action.skillId===null&&s.tick>=u.impactTick))continue;
    let candidates=enemies.filter(t=>gap(u,t)<=skill.range).sort((a,b)=>(a.entityId===u.targetId?-20:0)-(b.entityId===u.targetId?-20:0)+(a.kind==='HERO'?-15:0)-(b.kind==='HERO'?-15:0)+gap(u,a)-gap(u,b));
    let targets:CombatUnit[]=[],point:Point={x:u.x,y:u.y},ok=false,score=50;
    const bestCluster=(friends=false):{members:CombatUnit[];center:Point}=>{
      const pool=friends?allyHeroes:candidates;let best:CombatUnit[]=[],center:Point=u;
      for(const t of pool){
        const dir=direction(u,t),group=(friends?allyHeroes:enemies).filter(v=>skill.kind==='persistent_rectangle'?rectangleHits(t,dir,skill.depth??40,skill.width??110,v,true):circleHits(t,skill.radius??50,v));
        const value=(a:CombatUnit[])=>a.reduce((n,v)=>n+(v.kind==='HERO'?3:1)+(friends?(1-v.hp/v.maxHp)*4:0),0);
        if(value(group)>value(best)){best=group;center={x:t.x,y:t.y};}
      }
      return {members:best,center};
    };
    const countCondition=(group:CombatUnit[])=>group.filter(t=>t.kind==='HERO').length>=Number(skill.trigger.minHeroes??999)||group.length>=Number(skill.trigger.minEnemies??999);
    switch(skill.id){
      case 'paladin.shield_bash':case 'brawler.flurry':case 'ancient_one.shatter_sigil':
        targets=candidates.slice(0,1);ok=targets.length>0;break;
      case 'brawler.uppercut':
        targets=candidates.filter(t=>isStructure(t)||t.hardCcImmuneUntilTick<=s.tick).slice(0,1);ok=targets.length>0;score=65;break;
      case 'paladin.sanctuary_shield':{
        const group=allyHeroes.filter(a=>circleHits(u,110,a));ok=group.filter(engaged).length>=2||group.some(a=>a.hp/a.maxHp<=.4&&threatened(a));
        targets=group.filter(threatened).sort(byHp).slice(0,4);ok&&=targets.length>0;score=110;break;
      }
      case 'swordsman.parry':
        targets=enemies.filter(t=>!isStructure(t)&&t.projectileSpeed===0&&gap(u,t)<=45&&t.action?.skillId===null&&t.action.targetIds.includes(u.entityId)&&t.impactTick>s.tick&&t.impactTick-s.tick<=7).slice(0,1);ok=targets.length>0;score=150;break;
      case 'swordsman.flash_cut':{
        const t=candidates[0];if(t){targets=enemies.filter(v=>rectangleHits(u,direction(u,t),85,26,v));ok=countCondition(targets);point={x:u.x+direction(u,t).x*80,y:u.y+direction(u,t).y*80};}break;
      }
      case 'archer.piercing_arrow':case 'crossbowman.steel_bolt':{
        for(const t of candidates){const line=enemies.filter(v=>rectangleHits(u,direction(u,t),skill.maxDistance!,skill.width!,v));
          if(line.length>=2||skill.id.startsWith('archer')&&t.kind==='HERO'&&t.hp/t.maxHp<=.3||skill.id.startsWith('crossbowman')&&t.armor>=20){targets=[t];ok=true;break;}}
        break;
      }
      case 'archer.arrow_rain':case 'pyromancer.fire_burst':case 'pyromancer.flame_wall':case 'stormcaller.thunder_strike':case 'cryomancer.ice_prison':{
        const cluster=bestCluster();targets=cluster.members;point=cluster.center;ok=countCondition(targets);
        if(skill.id==='cryomancer.ice_prison')ok||=targets.some(t=>t.kind==='HERO'&&threatToBackline(t,allies));
        if(skill.id==='pyromancer.flame_wall'&&s.effects.some(e=>e.source.entityId===u.entityId&&e.effectId==='flame_wall'&&distance(e,point)<70))ok=false;
        if(skill.id==='pyromancer.fire_burst')targets=candidates.filter(t=>circleHits(point,52,t)).slice(0,1);
        break;
      }
      case 'cryomancer.frost_fan':case 'bard.dissonance':{
        for(const t of candidates){const group=enemies.filter(v=>coneHits(u,direction(u,t),skill.range,skill.angle!,v));
          if(group.length>=2||group.some(v=>threatToBackline(v,allies))){targets=group;point=t;ok=true;break;}}
        score=75;break;
      }
      case 'priest.healing_light':
        targets=allyHeroes.filter(a=>gap(u,a)<=165&&a.hp/a.maxHp<=.7&&a.maxHp-a.hp>=.8*u.power).sort(byHp).slice(0,1);
        if(!targets.length)targets=allies.filter(a=>minion(a)&&a.hp/a.maxHp<=.4&&gap(u,a)<=165).sort(byHp).slice(0,1);
        ok=targets.length>0;score=130;break;
      case 'priest.healing_prayer':{
        const cluster=bestCluster(true);targets=cluster.members.filter(a=>gap(u,a)<=245);point=cluster.center;
        ok=targets.filter(a=>a.hp/a.maxHp<=.8).length>=3||targets.filter(a=>a.hp/a.maxHp<=.5).length>=2;score=140;break;
      }
      case 'barbarian.spin_slash':case 'guardian_golem.earth_slam':
        targets=enemies.filter(t=>circleHits(u,skill.radius!,t));ok=countCondition(targets);break;
      case 'barbarian.leap_slam':{
        candidates=candidates.filter(t=>gap(u,t)>=55);const cluster=bestCluster();targets=cluster.members;point=cluster.center;
        ok=targets.length>=2||targets.some(t=>t.kind==='HERO'&&t.hp/t.maxHp<=.35);break;
      }
      case 'monk.repelling_staff':
        targets=candidates.filter(t=>threatToBackline(t,allies.filter(a=>distance(a,u)<=70))||t.targetId===u.entityId||((u.x-t.x)*t.vx+(u.y-t.y)*t.vy)>0).slice(0,1);ok=targets.length>0;score=100;break;
      case 'monk.cleansing_bell':{
        const group=allyHeroes.filter(a=>circleHits(u,115,a));
        ok=group.some(a=>a.statuses.some(x=>['stun','airborne','root'].includes(x.type)))||group.filter(a=>a.statuses.some(x=>x.type==='slow'&&x.magnitude>=.3)).length>=2;
        const priority=(a:CombatUnit)=>a.statuses.some(x=>hardTypes.has(x.type))?0:a.statuses.some(x=>x.type==='root')?1:a.statuses.some(x=>['taunt','silence'].includes(x.type))?2:3;
        targets=group.filter(a=>a.statuses.some(x=>negativeTypes.has(x.type))).sort((a,b)=>priority(a)-priority(b)||byHp(a,b)).slice(0,4);score=160;break;
      }
      case 'iron_knight.armored_charge':
        targets=candidates.filter(t=>!isStructure(t)&&gap(u,t)>=35).slice(0,1);
        ok=targets.length>0&&u.hp/u.maxHp>=.4&&allies.filter(a=>a!==u&&distance(a,u)<=150&&(a.x-u.x)*teamDirection(u.team)<0).length>=2;break;
      case 'iron_knight.iron_wall':
        targets=[u];ok=u.recentDamage.filter(d=>s.tick-d.tick<=40).reduce((sum,d)=>sum+d.value,0)>=u.maxHp*.15||enemies.filter(t=>!isStructure(t)&&gap(u,t)<=100).length>=3;score=135;break;
      case 'guardian_golem.guard_roar':
        targets=enemies.filter(t=>t.kind==='HERO'&&circleHits(u,100,t));ok=targets.length>=2||targets.some(t=>threatToBackline(t,allies));targets=targets.slice(0,4);score=105;break;
      case 'assassin.shadow_leap':
        targets=candidates.filter(t=>t.kind==='HERO'&&gap(u,t)>=35).slice(0,1);ok=targets.length>0&&u.hp/u.maxHp>=.35;break;
      case 'assassin.vital_combo':
        targets=candidates.filter(t=>t.kind==='HERO').sort(byHp).slice(0,1);ok=targets.length>0;score=70;break;
      case 'crossbowman.binding_bolt':
        targets=candidates.filter(t=>t.kind==='HERO'&&(Math.hypot(t.vx,t.vy)>.1||threatToBackline(t,allies))).slice(0,1);ok=targets.length>0;score=90;break;
      case 'stormcaller.chain_lightning':
        targets=candidates.filter(t=>t.hp/t.maxHp<=.25||enemies.some(v=>v!==t&&!isStructure(v)&&distance(t,v)<=70+v.radius)).slice(0,1);ok=targets.length>0;break;
      case 'bard.marching_melody':
        targets=allyHeroes.filter(a=>circleHits(u,120,a)&&engaged(a));ok=targets.length>=2;targets=targets.slice(0,5);score=90;break;
      case 'rune_mage.triple_rune':
        targets=candidates.sort((a,b)=>Number(Boolean(a.marks[`rune:${u.ownedHeroInstanceId}`]))-Number(Boolean(b.marks[`rune:${u.ownedHeroInstanceId}`]))||gap(u,a)-gap(u,b)).slice(0,3);ok=targets.length>0;break;
      case 'rune_mage.rune_resonance':
        targets=candidates.filter(t=>t.marks[`rune:${u.ownedHeroInstanceId}`]?.untilTick>s.tick).slice(0,3);ok=targets.length>=2||targets.some(t=>t.kind==='HERO'&&t.hp/t.maxHp<=.35);score=100;break;
      case 'ancient_one.primordial_fissure':{
        const t=candidates[0];if(t){targets=enemies.filter(v=>rectangleHits(u,direction(u,t),145,38,v));point=t;ok=countCondition(targets)||targets.some(v=>v.kind==='HERO'&&gap(u,v)<=25&&v.hp/v.maxHp<=.3);}break;
      }
      case 'guardian_spirit.soul_guard':
        targets=allyHeroes.filter(a=>gap(u,a)<=110&&a.hp/a.maxHp<=.6&&threatened(a)).sort(byHp).slice(0,1);ok=targets.length>0;score=140;break;
      case 'guardian_spirit.guardian_barrier':
        targets=allyHeroes.filter(a=>circleHits(u,105,a));ok=targets.filter(engaged).length>=3||targets.filter(a=>a.hp/a.maxHp<=.45&&threatened(a)).length>=2;score=120;break;
    }
    if(!ok)continue;
    if(targets[0]&&point.x===u.x&&point.y===u.y&&!['self_area','shield_area','cleanse_area','buff_area','defense','taunt','barrier','parry'].includes(skill.kind))point={x:targets[0].x,y:targets[0].y};
    if(['dash_line','leap_area','charge','leap_single'].includes(skill.kind)){
      const target=targets[0];if(!target)continue;
      const d=direction(u,skill.kind==='leap_area'?point:target),max=Math.min(skill.maxDistance??80,distance(u,target)-u.radius-target.radius-2);
      point={x:u.x+d.x*Math.max(0,max),y:u.y+d.y*Math.max(0,max)};
      if(skill.kind==='leap_single'){
        const side=((hash(u.entityId)%2)*2-1);point.x+=-d.y*18*side;point.y+=d.x*18*side;
      }
      if(!walkable(s,point,u.radius,u.lane!)||!clearSegment(s,u,point,u.radius,u.lane!))continue;
      if(skill.kind==='charge'&&allies.some(a=>a!==u&&segmentDistance(a,u,point)<a.radius+u.radius))continue;
    }
    options.push({skill,targets,point,score:score+targets.filter(t=>t.kind==='HERO').length*3});
  }
  return options.sort((a,b)=>b.score-a.score)[0];
}

function startAction(s:CombatState,u:CombatUnit,target:CombatUnit|undefined,plan?:SkillPlan):void{
  const skill=plan?.skill,targets=plan?.targets??(target?[target]:[]),point=plan?.point??target??u;
  const dir=direction(u,point),id=`${s.matchId}:action:${++s.actionSeq}`;
  const impactTimes=skill?skill.hitTimesMs:[u.windupMs];
  // Persistent fields survive independently; their future pulses do not hold the caster still.
  const persistent=skill&&['persistent_area','persistent_rectangle','heal_area','chain'].includes(skill.kind);
  let lock=skill?.totalLockMs??((persistent?impactTimes[0]!:impactTimes[impactTimes.length-1]!)+(skill?.recoveryMs??u.recoveryMs));
  if(skill?.kind==='dash_line')lock+=skill.travelMs??0;
  const action:Action={id,skillId:skill?.id??null,targetIds:targets.map(t=>t.entityId),point:{x:point.x,y:point.y},origin:{x:u.x,y:u.y},direction:dir,startTick:s.tick,impactTicks:impactTimes.map(t=>s.tick+ticks(t)),recoveryEndTick:s.tick+ticks(lock),processedHits:[],hitIds:[],source:sourceOf(u),reservedPoints:Object.fromEntries(targets.map(t=>[t.entityId,{x:t.x,y:t.y}]))};
  u.action=action;u.actionId=id;u.actionStartTick=s.tick;u.impactTick=action.impactTicks[0]!;u.recoveryEndTick=action.recoveryEndTick;u.state='WINDUP';u.goal=null;u.path=[];u.facingX=dir.x;u.facingY=dir.y;
  if(skill){
    const ready=s.tick+ticks(skill.cooldownMs);u.skillReadyAt[skill.id]=ready;
    const cd=s.cooldowns[u.ownerPlayerId!];cd.instance[u.ownedHeroInstanceId!]![skill.id]=ready;cd.shared[skill.id]=ready;
    emit(s,'SKILL_CAST',u,action.targetIds,action.point,skill.effect,id,{skillId:skill.id,kind:skill.kind,radius:skill.radius??0,width:skill.width??0,depth:skill.depth??0,angle:skill.angle??0,range:skill.range,directionX:dir.x,directionY:dir.y,startTick:s.tick,impactTick:u.impactTick,recoveryEndTick:u.recoveryEndTick,originX:u.x,originY:u.y});
  }else{
    const haste=Math.max(0,...u.statuses.filter(x=>x.type==='attackHaste').map(x=>x.magnitude));
    u.nextBasicReadyTick=s.tick+ticks(Math.round(u.attackIntervalMs*(1-haste)));u.lastAttackTick=s.tick;
    if(isStructure(u)){if(u.towerTargetId===target?.entityId)u.towerStreak=Math.min(3,u.towerStreak+1);else u.towerStreak=0;u.towerTargetId=target?.entityId??null;}
    emit(s,'ATTACK_START',u,action.targetIds,u,u.heroDefinitionId?`${u.heroDefinitionId}.basic`:u.kind.toLowerCase(),id,{startTick:s.tick,impactTick:u.impactTick,recoveryEndTick:u.recoveryEndTick,targetX:point.x,targetY:point.y});
  }
}

function reserveSlot(s:CombatState,u:CombatUnit,target:CombatUnit):Point|null{
  const count=isStructure(target)?16:8,ring=u.radius+target.radius+Math.max(0,u.range-3);
  const reservations=s.units.filter(v=>v!==u&&living(v)&&v.team===u.team&&v.targetId===target.entityId&&v.slotUntilTick>s.tick);
  const scored:{i:number;p:Point;value:number}[]=[];
  for(let i=0;i<count;i++){
    const a=i*2*Math.PI/count,p={x:target.x+Math.cos(a)*ring,y:target.y+Math.sin(a)*ring};
    if(!walkable(s,p,u.radius,u.lane!))continue;
    if(reservations.some(v=>v.slotIndex===i||distance(v,p)<u.radius+v.radius-2&&v.action))continue;
    const back=(p.x-target.x)*teamDirection(u.team)>8?35:0;
    const crowd=s.units.filter(v=>v!==u&&living(v)&&distance(v,p)<u.radius+v.radius+3).length;
    const value=-distance(u,p)-crowd*20-back+(i===u.slotIndex?18:0)+(hash(`${s.seed}/${u.entityId}/${i}`)%100)*.001;
    scored.push({i,p,value});
  }
  const choice=scored.sort((a,b)=>b.value-a.value)[0];if(!choice)return null;
  u.slotIndex=choice.i;u.slotUntilTick=s.tick+12;return choice.p;
}
function tacticalGoal(s:CombatState,u:CombatUnit,target:CombatUnit|undefined,space:SpatialHash,index:Map<string,CombatUnit>):Point|null{
  if(!u.lane)return null;
  const sign=teamDirection(u.team),allies=space.nearby(u,280).filter(a=>a.team===u.team&&a!==u&&a.lane===u.lane);
  const front=allies.filter(a=>a.role==='tank'||a.role==='melee'||a.kind==='MELEE_MINION').map(a=>laneProgress(a,u.lane!,u.team)).sort((a,b)=>a-b);
  const frontProgress=front.length?front[Math.floor((front.length-1)*(front.length>2?.7:.5))]!:u.progress;
  const backline=u.role==='support'||u.role==='mage'||u.role==='ranged';
  if(target&&isStructure(target)&&gap(u,target)>340){
    let progress=u.progress+64;
    if(backline&&front.length)progress=Math.min(progress,Math.max(u.progress,frontProgress-(u.role==='support'?85:75)));
    if(progress<=u.progress+4){u.state='HOLD';u.debugReason='아군 전열 이동 대기';return null;}
    u.state='ADVANCE';u.debugReason=backline?'전열 뒤 배정 라인 이동':'배정 라인 전진';
    return pointOnPath(progress,u.lane,u.team,u.lateral);
  }
  if(target&&isStructure(target)&&target.kind!=='NEXUS'&&target.power>0&&u.kind==='HERO'){
    const towerGap=gap(u,target),alliedTank=index.get(target.targetId??'');
    const safeTank=alliedTank&&alliedTank.team===u.team&&living(alliedTank)&&alliedTank!==u;
    const together=allies.filter(a=>a.kind==='HERO'&&gap(a,target)<target.range+80).length;
    const canLead=u.role==='tank'&&u.hp/u.maxHp>=.55&&together>=2;
    const finish=target.hp<=u.power*2&&u.hp>target.power*2;
    if(!safeTank&&!canLead&&!finish&&towerGap<target.range+20){
      const d=direction(target,u);u.state='HOLD';u.debugReason='미니언 / 전열 공성 대기';
      if(towerGap<target.range+12){u.state='RETREAT';u.tacticalUntilTick=Math.max(u.tacticalUntilTick,s.tick+10);return {x:target.x+d.x*(target.radius+u.radius+target.range+18),y:target.y+d.y*(target.radius+u.radius+target.range+18)};}
      return null;
    }
    if(target.targetId===u.entityId&&u.hp<target.power*2*100/(100+u.armor)&&!finish){
      u.state='RETREAT';u.debugReason='타워 다음 두 발 위험';u.tacticalUntilTick=s.tick+10;
      return {x:u.x-sign*90,y:u.y};
    }
  }
  if(target&&backline&&u.range>55){
    const threat=space.nearby(u,100).find(e=>e.team!==u.team&&e.range<40&&gap(u,e)<Math.max(55,e.speed*.7+e.range)&&!allies.some(a=>(a.role==='tank'||a.role==='melee')&&segmentDistance(a,e,u)<a.radius+10&&distance(a,e)<distance(u,e)));
    if(threat&&s.tick>=u.tacticalUntilTick&&u.retreatDistance<110){
      const away=direction(threat,u);u.state='REPOSITION';u.debugReason='근접 위협으로부터 사거리 확보';u.tacticalUntilTick=s.tick+24;u.retreatDistance+=40;
      return {x:u.x+away.x*35-sign*10,y:u.y+away.y*35};
    }
    if(s.tick<u.tacticalUntilTick&&u.state==='REPOSITION'&&u.goal)return u.goal;
  }
  if(target){
    if(gap(u,target)<=u.range){u.state='HOLD';u.debugReason='사거리 내 다음 공격 대기';return null;}
    if(u.role==='support'){
      const escort=allies.filter(a=>a.kind==='HERO'&&['ranged','mage','support'].includes(a.role)).sort((a,b)=>distance(u,a)-distance(u,b))[0];
      if(u.heroDefinitionId==='monk'&&escort&&distance(target,escort)>90){u.state='HOLD';u.debugReason='후열 호위';return {x:escort.x+sign*28,y:escort.y+u.lateral*.3};}
      if(u.range>50&&front.length&&laneProgress(target,u.lane,u.team)>frontProgress+150&&u.progress>frontProgress-65){u.state='HOLD';u.debugReason='지원 대형 유지';return null;}
    }
    u.state='APPROACH';u.debugReason='유효 표적 접근';
    if(u.range<40){const slot=reserveSlot(s,u,target);if(slot)return slot;u.state='HOLD';u.debugReason='공격 자리 대기';u.targetId=null;return null;}
    const d=direction(target,u),r=target.radius+u.radius+u.range*.86;
    return {x:target.x+d.x*r,y:target.y+d.y*r};
  }
  let progress=u.progress+64;
  if(backline&&front.length)progress=Math.min(progress,Math.max(u.progress,frontProgress-(u.role==='support'?85:75)));
  u.state='ADVANCE';u.debugReason=backline?'전열 뒤 대형 이동':'배정 라인 전진';
  return pointOnPath(progress,u.lane,u.team,u.lateral);
}
function planUnit(s:CombatState,u:CombatUnit,index:Map<string,CombatUnit>,space:SpatialHash):void{
  if(!living(u)||u.kind==='NEXUS'||s.tick<=u.createdTick)return;
  if(u.state==='SPAWNING'&&s.tick-u.createdTick<(u.kind==='HERO'?7:1))return;
  if(hardCc(u,s.tick)){
    if(u.action){u.action.cancelled=true;u.action=null;u.actionId=null;}
    u.state='CONTROLLED';u.goal=null;u.path=[];return;
  }
  if(u.action&&s.tick>=u.action.recoveryEndTick){u.action=null;u.actionId=null;u.state='HOLD';u.nextAiTick=s.tick;}
  if(u.action){
    u.state=s.tick<u.impactTick?'WINDUP':'RECOVERY';
    if(u.heroDefinitionId==='swordsman'&&!u.action.skillId&&u.state==='RECOVERY'){
      const plan=findSkill(s,u,index,space);if(plan?.skill.id==='swordsman.parry')startAction(s,u,undefined,plan);
    }
    return;
  }
  if(hasStatus(u,'parry',s.tick)){u.state='HOLD';u.goal=null;return;}
  if(s.tick<u.nextAiTick&&u.targetId&&index.has(u.targetId)&&living(index.get(u.targetId)!))return;
  u.nextAiTick=s.tick+4;
  if(isStructure(u)){
    const target=towerTarget(s,u,index,space);u.targetId=target?.entityId??null;
    if(target&&s.tick>=u.nextBasicReadyTick)startAction(s,u,target);return;
  }
  u.progress=laneProgress(u,u.lane!,u.team);
  const target=chooseTarget(s,u,index,space),plan=findSkill(s,u,index,space);
  if(plan){startAction(s,u,target,plan);return;}
  if(target&&gap(u,target)<=u.range&&s.tick>=u.nextBasicReadyTick){startAction(s,u,target);u.slotUntilTick=s.tick+12;return;}
  const intended=tacticalGoal(s,u,target,space,index),goal=intended?nearestWalkable(s,intended,u.radius,u.lane!):null;u.goal=goal;
  if(goal){
    const changed=!u.pathGoal||distance(u.pathGoal,goal)>24;
    if(changed||!u.path.length&&s.tick-u.pathPlannedTick>=16||u.stalledTicks>=16&&s.tick-u.pathPlannedTick>=16){
      u.path=findLocalPath(s,u,goal);u.pathGoal={...goal};u.pathPlannedTick=s.tick;
    }
  }else u.path=[];
}

function skillPayload(skill:SkillDefinition,coefficient=skill.coefficients[0]??0):HitPayload{
  return {skillId:skill.id,coefficient,structureMultiplier:skill.structureMultiplier,armorIgnore:skill.armorIgnore,
    statuses:skill.statuses.filter(x=>['stun','airborne','root','slow','taunt','silence'].includes(x.type)).map(x=>({type:x.type,durationMs:x.durationMs,magnitude:x.magnitude??0})),
    knockback:skill.statuses.find(x=>x.type==='knockback')?.magnitude,mark:skill.kind==='sigil'?'sigil':skill.kind==='multi_projectile'?'rune':undefined};
}
function queueHit(s:CombatState,impacts:Impact[],source:Source,target:CombatUnit,payload:HitPayload,actionId:string,point:Point):void{
  if(!living(target)||source.team===target.team||target.protected)return;
  const p={...payload,statuses:payload.statuses?[...payload.statuses]:[]};
  // Marks are scoped to an owned instance; structure immunity applies before mark handling.
  if(p.mark&&!isStructure(target)){
    const key=`${p.mark}:${source.ownedHeroInstanceId}`,previous=target.marks[key];
    const count=p.mark==='rune'?1:((previous&&previous.untilTick>s.tick)?previous.count:0)+1;
    target.marks[key]={count,untilTick:s.tick+(p.mark==='rune'?140:120)};
    if(p.mark==='sigil'&&count>=3){delete target.marks[key];p.coefficient+=1.2;p.statuses!.push({type:'stun',durationMs:700,magnitude:0});emit(s,'MARK_BURST',source,[target.entityId],target,'sigil_burst',actionId);}
  }
  impacts.push({source,target,payload:p,actionId,point:{x:point.x,y:point.y},seq:impacts.length});
}
function spawnProjectile(s:CombatState,u:CombatUnit,a:Action,target:CombatUnit|undefined,skill?:SkillDefinition,coefficient?:number):void{
  const dir=direction(u,target??a.point),mode:Projectile['mode']=skill?.kind==='explosive_projectile'?'BURST':skill&&['projectile','piercing_projectile'].includes(skill.kind)?'LINE':'HOMING';
  const payload=skill?skillPayload(skill,coefficient):{skillId:null,coefficient:isStructure(u)&&target?.kind==='HERO'?1+u.towerStreak*.1:1,structureMultiplier:1,basic:true};
  if(skill?.radius)payload.radius=skill.radius;
  const p:Projectile={entityId:serialId(s,'projectile'),source:a.source,targetId:target?.entityId??null,lastTarget:{x:target?.x??a.point.x,y:target?.y??a.point.y},x:u.x+dir.x*(u.radius+3),y:u.y+dir.y*(u.radius+3),direction:dir,speed:skill?.projectileSpeed??u.projectileSpeed,radius:skill?.width?(skill.width/2):3,remaining:skill?.maxDistance??(skill?.range??u.range)+u.radius+(target?.radius??15)+180,createdTick:s.tick,effectId:skill?.effect??`${u.heroDefinitionId??u.kind.toLowerCase()}.basic`,actionId:a.id,mode,maxTargets:skill?.maxTargets??1,hitIds:[],payload,falloff:skill?.id==='archer.piercing_arrow'?.15:skill?.id==='crossbowman.steel_bolt'?.4:0,minFalloff:skill?.id==='archer.piercing_arrow'?.55:0};
  s.projectiles.push(p);emit(s,'PROJECTILE_SPAWN',u,target?[target.entityId]:[],p,p.effectId,a.id,{projectileId:p.entityId,speed:p.speed,targetX:p.lastTarget.x,targetY:p.lastTarget.y});
}
function addEffect(s:CombatState,u:CombatUnit,a:Action,skill:SkillDefinition):PersistentEffect{
  const ownCenter=['barrier'].includes(skill.kind),pos=ownCenter?a.origin:a.point;
  const e:PersistentEffect={entityId:serialId(s,'effect'),source:a.source,effectId:skill.effect,actionId:a.id,shape:skill.kind==='persistent_rectangle'?'rectangle':skill.kind==='segmented_line'?'segmented_line':'circle',x:pos.x,y:pos.y,radius:skill.radius??0,width:skill.width??0,depth:skill.depth??0,direction:a.direction,createdTick:s.tick,untilTick:s.tick+ticks(skill.durationMs??Math.max(250,skill.hitTimesMs[skill.hitTimesMs.length-1]!-skill.hitTimesMs[0]!+250)),hitTicks:skill.kind==='barrier'?[]:skill.hitTimesMs.map(ms=>a.startTick+ticks(ms)),processedTicks:[],coefficients:skill.coefficients,payload:skillPayload(skill),healing:skill.kind==='heal_area',maxTargets:skill.maxTargets??999,endsOnSourceDeath:skill.kind==='barrier',reduction:skill.kind==='barrier'?.25:0};
  s.effects.push(e);emit(s,'AREA_CREATED',u,a.targetIds,e,skill.effect,a.id,{effectEntityId:e.entityId,shape:e.shape,radius:e.radius,width:e.width,depth:e.depth,directionX:e.direction.x,directionY:e.direction.y,untilTick:e.untilTick});return e;
}
function actionImpacts(s:CombatState,index:Map<string,CombatUnit>,impacts:Impact[]):void{
  for(const u of allUnits(s)){
    if(!living(u)||!u.action||u.action.cancelled||hardCc(u,s.tick))continue;
    const a=u.action,skill=a.skillId?SKILLS[a.skillId]:undefined;
    for(let hit=0;hit<a.impactTicks.length;hit++){
      if(a.impactTicks[hit]!==s.tick||a.processedHits.includes(hit))continue;a.processedHits.push(hit);
      const target=index.get(a.targetIds[hit]??a.targetIds[0]??'');
      if(!skill){
        if(target&&living(target)&&gap(u,target)<=u.range+(u.projectileSpeed?8:6)){
          if(u.projectileSpeed)spawnProjectile(s,u,a,target);
          else queueHit(s,impacts,a.source,target,{skillId:null,coefficient:1,structureMultiplier:1,basic:true},a.id,target);
        }else emit(s,'MISS',u,a.targetIds,u,'miss',a.id);
        continue;
      }
      const payload=skillPayload(skill,skill.coefficients[hit]??skill.coefficients[0]);
      const enemies=allUnits(s).filter(t=>living(t)&&t.team!==u.team&&!t.protected&&inSameBattleLane(u,t));
      const allies=s.units.filter(t=>living(t)&&t.team===u.team);
      const support=(t:CombatUnit,fields:Partial<Impact>)=>impacts.push({source:a.source,target:t,payload:{skillId:skill.id,coefficient:0,structureMultiplier:0},actionId:a.id,point:t,seq:impacts.length,...fields});
      const singleTarget=index.get(a.targetIds[0]??'');
      switch(skill.kind){
        case 'single':case 'multi_hit':case 'sigil':
          if(singleTarget&&living(singleTarget)&&gap(u,singleTarget)<=(skill.hitRange??skill.range+6))queueHit(s,impacts,a.source,singleTarget,payload,a.id,singleTarget);break;
        case 'parry':
          u.statuses.push({type:'parry',sourceId:u.entityId,sourcePlayerId:u.ownerPlayerId,untilTick:s.tick+ticks(skill.durationMs!),magnitude:.6});break;
        case 'piercing_projectile':case 'projectile':case 'explosive_projectile':case 'multi_projectile':
          if(target&&living(target)&&gap(u,target)<=skill.range+8)spawnProjectile(s,u,a,target,skill,payload.coefficient);break;
        case 'persistent_area':case 'persistent_rectangle':case 'heal_area':
          if(hit===0){addEffect(s,u,a,skill);a.processedHits=a.impactTicks.map((_,i)=>i);}break;
        case 'area':
          for(const t of enemies.filter(t=>circleHits(a.point,skill.radius!,t)))queueHit(s,impacts,a.source,t,payload,a.id,t);break;
        case 'self_area':
          for(const t of enemies.filter(t=>circleHits(u,skill.radius!,t)))queueHit(s,impacts,a.source,t,payload,a.id,t);break;
        case 'cone':
          for(const t of enemies.filter(t=>coneHits(u,a.direction,skill.range,skill.angle!,t)))queueHit(s,impacts,a.source,t,payload,a.id,t);break;
        case 'heal':
          if(singleTarget&&living(singleTarget)&&gap(u,singleTarget)<=skill.range+8)support(singleTarget,{healing:skill.coefficients[0]!*u.power});break;
        case 'shield':
          if(singleTarget&&living(singleTarget)&&gap(u,singleTarget)<=skill.range+8)support(singleTarget,{shield:skill.coefficients[0]!*u.power+(skill.hpCoefficient??0)*u.maxHp,shieldDuration:skill.durationMs,removeSlow:true});break;
        case 'shield_area':case 'cleanse_area':case 'buff_area':
          for(const id of a.targetIds){const t=index.get(id);if(!t||!living(t)||!circleHits(u,skill.radius!,t))continue;
            if(skill.kind==='buff_area')support(t,{buff:{type:'attackHaste',magnitude:.15,durationMs:4000}});
            else support(t,{shield:skill.coefficients[0]!*u.power+(skill.hpCoefficient??0)*u.maxHp,shieldDuration:skill.durationMs,cleanse:skill.kind==='cleanse_area'});
          }break;
        case 'defense':
          support(u,{buff:{type:'damageReduction',magnitude:.35,durationMs:3000}});support(u,{buff:{type:'slow',magnitude:.25,durationMs:3000}});break;
        case 'taunt':
          for(const id of a.targetIds){const t=index.get(id);if(t&&living(t)&&circleHits(u,100,t))queueHit(s,impacts,a.source,t,{...payload,coefficient:0,statuses:[{type:'taunt',durationMs:1200,magnitude:0}]},a.id,t);}
          support(u,{shield:3*u.power+.05*u.maxHp,shieldDuration:3000});break;
        case 'barrier':
          addEffect(s,u,a,skill);support(u,{shield:2*u.power,shieldDuration:3500});break;
        case 'chain':
          if(hit===0&&singleTarget&&living(singleTarget)){
            queueHit(s,impacts,a.source,singleTarget,payload,a.id,singleTarget);
            emit(s,'CHAIN',u,[singleTarget.entityId],singleTarget,skill.effect,a.id,{fromX:u.x,fromY:u.y,toX:singleTarget.x,toY:singleTarget.y});
            if(!isStructure(singleTarget))s.scheduled.push({tick:s.tick+2,kind:'chain',source:a.source,targetId:singleTarget.entityId,actionId:a.id,coefficient:1.2,hitIds:[singleTarget.entityId]});
            a.processedHits=a.impactTicks.map((_,i)=>i);
          }break;
        case 'marked_area':{
          const overlaps=new Map<string,number>();
          for(const id of a.targetIds){
            const marked=index.get(id),point=marked&&living(marked)?marked:a.reservedPoints?.[id];if(!point)continue;
            if(marked)delete marked.marks[`rune:${u.ownedHeroInstanceId}`];
            emit(s,'RUNE_DETONATE',u,[id],point,skill.effect,a.id,{radius:42});
            for(const t of enemies.filter(t=>circleHits(point,42,t)))overlaps.set(t.entityId,(overlaps.get(t.entityId)??0)+1);
          }
          for(const [id,count]of overlaps){const t=index.get(id)!;queueHit(s,impacts,a.source,t,{...payload,coefficient:1.8*Math.min(1.5,1+(count-1)*.25)},a.id,t);}break;
        }
        case 'segmented_line':{
          const end=[45,95,145][hit]!,start=hit?[45,95][hit-1]!:0,p={x:a.origin.x+a.direction.x*start,y:a.origin.y+a.direction.y*start};
          emit(s,'FISSURE',u,[],p,skill.effect,a.id,{length:end-start,width:38,directionX:a.direction.x,directionY:a.direction.y,hitIndex:hit});
          for(const t of enemies.filter(t=>!a.hitIds.includes(t.entityId)&&rectangleHits(p,a.direction,end-start,38,t))){a.hitIds.push(t.entityId);queueHit(s,impacts,a.source,t,payload,a.id,t);}break;
        }
        case 'dash_line':break; // Continuous swept path is resolved in moveUnits.
        case 'leap_area':case 'charge':
          for(const t of enemies.filter(t=>circleHits(u,skill.radius!,t)))queueHit(s,impacts,a.source,t,{...payload,knockback:skill.kind==='charge'&&t.entityId!==a.targetIds[0]?undefined:payload.knockback},a.id,t);break;
        case 'leap_single':
          if(singleTarget&&living(singleTarget)&&gap(u,singleTarget)<=40)queueHit(s,impacts,a.source,singleTarget,payload,a.id,singleTarget);break;
      }
      emit(s,'SKILL_IMPACT',u,a.targetIds,skill.kind==='self_area'?u:a.point,skill.effect,a.id,{skillId:skill.id,hitIndex:hit,kind:skill.kind,radius:skill.radius??0,width:skill.width??0,angle:skill.angle??0,directionX:a.direction.x,directionY:a.direction.y,originX:u.x,originY:u.y});
    }
  }
}
function moveProjectiles(s:CombatState,index:Map<string,CombatUnit>,impacts:Impact[]):void{
  const remove=new Set<string>();
  for(const p of s.projectiles){
    if(p.createdTick>=s.tick)continue;
    const target=p.targetId?index.get(p.targetId):undefined;
    if(p.mode==='HOMING'&&target&&living(target)){p.lastTarget={x:target.x,y:target.y};p.direction=direction(p,target);}
    const step=Math.min(p.speed*.05,p.remaining),next={x:p.x+p.direction.x*step,y:p.y+p.direction.y*step};
    let candidates:CombatUnit[]=[];
    if(p.mode==='HOMING'){if(target&&living(target)&&segmentDistance(target,p,next)<=target.radius+p.radius)candidates=[target];}
    else candidates=allUnits(s).filter(t=>living(t)&&t.team!==p.source.team&&!p.hitIds.includes(t.entityId)&&segmentDistance(t,p,next)<=t.radius+p.radius).sort((a,b)=>distance(p,a)-distance(p,b));
    for(const t of candidates){
      if(p.mode==='BURST'){
        for(const e of allUnits(s))if(living(e)&&e.team!==p.source.team&&circleHits(t,p.payload.radius??52,e))queueHit(s,impacts,p.source,e,p.payload,p.actionId,t);
        emit(s,'PROJECTILE_IMPACT',p.source,[t.entityId],t,p.effectId,p.actionId,{radius:p.payload.radius??52});remove.add(p.entityId);break;
      }
      const multiplier=Math.max(p.minFalloff,1-p.hitIds.length*p.falloff);
      queueHit(s,impacts,p.source,t,{...p.payload,coefficient:p.payload.coefficient*multiplier},p.actionId,t);p.hitIds.push(t.entityId);
      if(p.hitIds.length>=p.maxTargets||isStructure(t)){remove.add(p.entityId);break;}
    }
    p.x=next.x;p.y=next.y;p.remaining-=step;
    if(p.remaining<=0||p.mode==='HOMING'&&(!target||!living(target))&&distance(p,p.lastTarget)<=step+3)remove.add(p.entityId);
    if(p.mode==='BURST'&&distance(p,p.lastTarget)<=step){
      if(!remove.has(p.entityId))for(const e of allUnits(s))if(living(e)&&e.team!==p.source.team&&circleHits(p,p.payload.radius??52,e))queueHit(s,impacts,p.source,e,p.payload,p.actionId,p);
      remove.add(p.entityId);
    }
  }
  s.projectiles=s.projectiles.filter(p=>!remove.has(p.entityId));
}
function effectImpacts(s:CombatState,index:Map<string,CombatUnit>,impacts:Impact[]):void{
  for(const e of s.effects){
    if(e.endsOnSourceDeath&&(!index.get(e.source.entityId)||!living(index.get(e.source.entityId)!)))continue;
    for(let i=0;i<e.hitTicks.length;i++){
      if(e.hitTicks[i]!==s.tick||e.processedTicks.includes(s.tick))continue;e.processedTicks.push(s.tick);
      const candidates=allUnits(s).filter(t=>living(t)&&(e.healing?t.team===e.source.team&&!isStructure(t):t.team!==e.source.team)&&
        (e.shape==='rectangle'?rectangleHits(e,e.direction,e.depth,e.width,t,true):circleHits(e,e.radius,t))).sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp).slice(0,e.maxTargets);
      for(const t of candidates){
        if(e.healing)impacts.push({source:e.source,target:t,payload:e.payload,actionId:e.actionId,point:t,seq:impacts.length,healing:e.source.power*(e.coefficients[i]??e.coefficients[0]!)});
        else queueHit(s,impacts,e.source,t,{...e.payload,coefficient:e.coefficients[i]??e.coefficients[0]!},e.actionId,t);
      }
      emit(s,'AREA_PULSE',e.source,candidates.map(t=>t.entityId),e,e.effectId,e.actionId,{radius:e.radius,width:e.width,depth:e.depth,hitIndex:i,shape:e.shape,directionX:e.direction.x,directionY:e.direction.y});
    }
  }
  const remaining:CombatState['scheduled']=[];
  for(const item of s.scheduled){
    if(item.tick>s.tick){remaining.push(item);continue;}
    const prev=index.get(item.targetId);if(!prev)continue;
    if(item.kind==='counter'){
      const source=index.get(item.source.entityId);if(source&&living(source)&&living(prev)&&gap(source,prev)<=25)queueHit(s,impacts,item.source,prev,{skillId:'swordsman.parry',coefficient:1.6,structureMultiplier:0},item.actionId,prev);
      if(source)source.statuses=source.statuses.filter(x=>x.type!=='parry');continue;
    }
    const next=s.units.filter(t=>living(t)&&t.team!==item.source.team&&!item.hitIds.includes(t.entityId)&&distance(prev,t)<=70+t.radius).sort((a,b)=>distance(prev,a)-distance(prev,b))[0];
    if(!next)continue;
    queueHit(s,impacts,item.source,next,{skillId:'stormcaller.chain_lightning',coefficient:item.coefficient,structureMultiplier:.35},item.actionId,next);
    emit(s,'CHAIN',item.source,[next.entityId],next,'chain_lightning',item.actionId,{fromX:prev.x,fromY:prev.y,toX:next.x,toY:next.y});
    const hits=[...item.hitIds,next.entityId];if(hits.length<4)remaining.push({...item,tick:s.tick+2,targetId:next.entityId,coefficient:item.coefficient*.8,hitIds:hits});
  }
  s.scheduled=remaining;
}

export function applyStatus(s:CombatState,target:CombatUnit,type:string,durationMs:number,magnitude:number,source:Source):void{
  if(isStructure(target)||!living(target))return;
  let until=s.tick+ticks(durationMs);
  if(hardTypes.has(type)){
    if(target.hardCcImmuneUntilTick>s.tick)return;
    if(s.tick-target.lastHardCcActiveTick>2)target.ccChainStartTick=s.tick;
    until=Math.min(until,target.ccChainStartTick+40);
    if(until<=s.tick)return;
    target.lastHardCcActiveTick=s.tick;
  }
  const previous=target.statuses.find(x=>x.type===type&&x.sourceId===source.entityId);
  if(type==='taunt'){
    const prior=target.statuses.find(x=>x.type==='taunt'&&x.untilTick>s.tick);if(prior&&prior.sourceId!==source.entityId)return;
  }
  const oldEnd=Math.max(s.tick,...target.statuses.filter(x=>x.type===type).map(x=>x.untilTick));
  if(previous){previous.untilTick=Math.max(previous.untilTick,until);previous.magnitude=Math.max(previous.magnitude,magnitude);}
  else target.statuses.push({type,sourceId:source.entityId,sourcePlayerId:source.playerId,untilTick:until,magnitude});
  if(source.playerId&&target.kind==='HERO'&&source.team!==target.team){
    stat(s,source.playerId)!.ccSeconds+=Math.max(0,until-oldEnd)/20;
    target.damageLedger.push({playerId:source.playerId,tick:s.tick,value:0,sourceId:source.entityId});
  }
  emit(s,'CC',source,[target.entityId],target,type,'',{durationTicks:Math.max(0,until-s.tick),magnitude});
}
function addShield(s:CombatState,impact:Impact):void{
  const t=impact.target,key=`${impact.source.ownedHeroInstanceId??impact.source.entityId}/${impact.payload.skillId}`;
  const existing=t.shields.find(x=>x.sourceId===key),others=t.shields.filter(x=>x!==existing).reduce((n,x)=>n+x.amount,0);
  const amount=Math.min(t.maxHp*.35-others,Math.max(existing?.amount??0,impact.shield??0));
  if(amount<=0)return;
  const until=s.tick+ticks(impact.shieldDuration??3000);
  if(existing){existing.amount=amount;existing.untilTick=Math.max(existing.untilTick,until);}
  else t.shields.push({sourceId:key,sourcePlayerId:impact.source.playerId,amount,untilTick:until,seq:s.eventSeq});
  t.shield=t.shields.reduce((n,x)=>n+x.amount,0);
  emit(s,'SHIELD',impact.source,[t.entityId],t,impact.payload.skillId??'shield',impact.actionId,{value:amount,untilTick:until});
}
function damageReduction(s:CombatState,t:CombatUnit):number{
  const byKind=new Map<string,number>();
  for(const status of t.statuses.filter(x=>x.type==='damageReduction'))byKind.set(status.sourceId,Math.max(byKind.get(status.sourceId)??0,status.magnitude));
  if(s.effects.some(e=>e.reduction>0&&e.source.team===t.team&&e.untilTick>s.tick&&circleHits(e,e.radius,t)))byKind.set('guardian_barrier',.25);
  let keep=1;for(const r of byKind.values())keep*=1-r;return Math.min(.6,1-keep);
}
function resolveImpacts(s:CombatState,impacts:Impact[],index:Map<string,CombatUnit>):{playerId:string;entityId:string}[]{
  const groups=new Map<string,Impact[]>();for(const hit of impacts){if(!living(hit.target))continue;const group=groups.get(hit.target.entityId)??[];group.push(hit);groups.set(hit.target.entityId,group);}
  const deaths:{playerId:string;entityId:string}[]=[];
  const fatal:{target:CombatUnit;contributions:{hit:Impact;damage:number}[]}[]=[];
  // Defensive effects and cleanse apply before any new damage / CC, independent of entity iteration order.
  for(const group of groups.values())for(const hit of group){
    if(hit.cleanse)hit.target.statuses=hit.target.statuses.filter(x=>!negativeTypes.has(x.type));
    if(hit.removeSlow){const slow=hit.target.statuses.filter(x=>x.type==='slow').sort((a,b)=>b.magnitude-a.magnitude||b.untilTick-a.untilTick)[0];if(slow)hit.target.statuses=hit.target.statuses.filter(x=>x!==slow);}
    if(hit.shield)addShield(s,hit);
    if(hit.buff)applyStatus(s,hit.target,hit.buff.type,hit.buff.durationMs,hit.buff.magnitude,hit.source);
  }
  for(const group of groups.values()){
    const target=group[0]!.target,hp0=target.hp;
    const damages:{hit:Impact;damage:number}[]=[];
    for(const hit of group){
      if(hit.source.team===target.team||target.protected||hit.payload.coefficient<=0)continue;
      const structural=isStructure(target),armor=target.armor*(1-(structural?0:hit.payload.armorIgnore??0));
      let raw=hit.source.power*hit.payload.coefficient*(structural?hit.payload.structureMultiplier:1);
      if(structural&&hit.source.kind.endsWith('MINION'))raw*=minionSiegeMultiplier(s);
      let damage=raw*100/(100+armor)*(1-damageReduction(s,target));
      const parry=target.statuses.find(x=>x.type==='parry'&&x.untilTick>s.tick);
      if(parry&&hit.payload.basic&&!hit.source.kind.endsWith('MINION')&&hit.source.kind!=='HERO'){} // towers cannot trigger parry
      else if(parry&&hit.payload.basic){
        const attacker=index.get(hit.source.entityId);
        if(attacker&&attacker.projectileSpeed===0&&!isStructure(attacker)){
          damage*=.4;target.statuses=target.statuses.filter(x=>x!==parry);
          s.scheduled.push({tick:s.tick+3,kind:'counter',source:sourceOf(target),targetId:attacker.entityId,actionId:hit.actionId,coefficient:1.6,hitIds:[]});
          emit(s,'PARRY',target,[attacker.entityId],target,'parry',hit.actionId);
        }
      }
      damages.push({hit,damage});
    }
    const totalDamage=damages.reduce((n,x)=>n+x.damage,0);let absorbed=0,remaining=totalDamage;
    target.shields.sort((a,b)=>a.untilTick-b.untilTick||a.seq-b.seq);
    for(const shield of target.shields){const used=Math.min(remaining,shield.amount);shield.amount-=used;remaining-=used;absorbed+=used;if(target.kind==='HERO'&&used>0){const stats=stat(s,shield.sourcePlayerId);if(stats)stats.shielding+=used;if(shield.sourcePlayerId)target.supportLedger.push({playerId:shield.sourcePlayerId,tick:s.tick});}if(remaining<=0)break;}
    target.shields=target.shields.filter(x=>x.amount>.001);target.shield=target.shields.reduce((n,x)=>n+x.amount,0);
    const healRequests=group.filter(x=>(x.healing??0)>0),requestedHeal=healRequests.reduce((n,x)=>n+x.healing!,0),effectiveHeal=Math.min(requestedHeal,Math.max(0,target.maxHp-hp0+remaining));
    target.hp=clamp(hp0-remaining+effectiveHeal,0,target.maxHp);
    const effectiveDamage=Math.min(remaining,hp0+effectiveHeal);
    for(const heal of healRequests){const value=requestedHeal?effectiveHeal*heal.healing!/requestedHeal:0;if(target.kind==='HERO'){const st=stat(s,heal.source.playerId);if(st)st.healing+=value;if(value>0&&heal.source.playerId)target.supportLedger.push({playerId:heal.source.playerId,tick:s.tick});}if(value>0)emit(s,'HEAL',heal.source,[target.entityId],target,heal.payload.skillId??'heal',heal.actionId,{value});}
    for(const item of damages){
      const ratio=totalDamage?item.damage/totalDamage:0,value=effectiveDamage*ratio,shieldDamage=absorbed*ratio,hit=item.hit,st=stat(s,hit.source.playerId);
      if(value>0){
        if(s.metrics.firstHitTick===null)s.metrics.firstHitTick=s.tick;
        if(st){if(target.kind==='HERO')st.heroDamage+=value;else if(isStructure(target))st.structureDamage+=value;else st.minionDamage+=value;}
        if(target.kind==='HERO'&&hit.source.kind==='HERO')stat(s,target.ownerPlayerId)!.damageTaken+=value;
        target.recentDamage.push({tick:s.tick,value,sourceId:hit.source.entityId});
        if(hit.source.playerId)target.damageLedger.push({playerId:hit.source.playerId,tick:s.tick,value,sourceId:hit.source.entityId});
      }
      item.damage=value;
      if(value+shieldDamage>0)emit(s,'HIT',hit.source,[target.entityId],hit.point,hit.payload.skillId??`${hit.source.heroDefinitionId??hit.source.kind.toLowerCase()}.basic`,hit.actionId,{value,shieldDamage,targetHp:target.hp,kind:hit.payload.basic?'basic':'skill'});
    }
    // A stun applied now cannot retroactively cancel other impacts that have already entered this batch.
    for(const hit of group){
      if(hit.source.team===target.team||target.protected||isStructure(target))continue;
      for(const status of hit.payload.statuses??[])applyStatus(s,target,status.type,status.durationMs,status.magnitude,hit.source);
      if(hit.payload.knockback&&target.hp>0){const source=index.get(hit.source.entityId),d=source?direction(source,target):{x:teamDirection(hit.source.team),y:0};target.forcedMove={direction:d,remaining:hit.payload.knockback,speed:hit.payload.knockback/.2,untilTick:s.tick+4};emit(s,'KNOCKBACK',hit.source,[target.entityId],target,hit.payload.skillId??'knockback',hit.actionId,{distance:hit.payload.knockback,directionX:d.x,directionY:d.y});}
    }
    if(target.hp<=0)fatal.push({target,contributions:damages});
  }
  for(const {target,contributions} of fatal){
    if(target.state==='DEAD')continue;
    target.state='DEAD';target.deathTick=s.tick;target.action=null;target.actionId=null;target.goal=null;target.path=[];target.statuses=[];target.shields=[];target.shield=0;target.slotUntilTick=0;target.forcedMove=null;
    const grouped=new Map<string,{source:Source;amount:number;seq:number}>();
    for(const c of contributions){const key=c.hit.source.deploymentId,prior=grouped.get(key);if(prior)prior.amount+=c.damage;else grouped.set(key,{source:c.hit.source,amount:c.damage,seq:c.hit.seq});}
    const killer=[...grouped.values()].filter(x=>x.amount>0).sort((a,b)=>b.amount-a.amount||a.seq-b.seq)[0];
    if(target.kind==='HERO'){
      stat(s,target.ownerPlayerId)!.deaths++;deaths.push({playerId:target.ownerPlayerId!,entityId:target.entityId});
      if(killer){
        s.teamKills[killer.source.team]++;if(killer.source.playerId)stat(s,killer.source.playerId)!.kills++;
        const contributors=new Set(target.damageLedger.filter(d=>s.tick-d.tick<=100).map(d=>d.playerId));
        for(const c of [...contributors]){const attacker=s.units.find(x=>x.ownerPlayerId===c);if(attacker)for(const support of attacker.supportLedger.filter(x=>s.tick-x.tick<=100))contributors.add(support.playerId);}
        contributors.delete(killer.source.playerId??'');contributors.delete(target.ownerPlayerId!);for(const id of contributors)stat(s,id)!.assists++;
      }
      emit(s,'DEATH',killer?.source??null,[target.entityId],target,'death','',{heroId:target.heroDefinitionId!,deploymentId:target.deploymentId});
    }else if(isStructure(target)){
      if(killer?.source.playerId)stat(s,killer.source.playerId)!.towerKills++;
      s.metrics.destroyed.push({id:target.entityId,tick:s.tick,kind:target.kind});
      emit(s,'STRUCTURE_DESTROYED',killer?.source??null,[target.entityId],target,target.kind.toLowerCase());
    }else emit(s,'DEATH',killer?.source??null,[target.entityId],target,'minion_death');
  }
  return deaths;
}

export function stepCombat(s:CombatState,effectiveTick=s.tick+1):{deaths:{playerId:string;entityId:string}[];winner?:Team|'DRAW'}{
  if(s.winner)return {deaths:[],winner:s.winner};
  if(effectiveTick!==s.tick+1)throw new Error(`Combat needs consecutive fixed ticks: ${s.tick} -> ${effectiveTick}`);
  s.tick=effectiveTick;s.metrics.tickCount++;
  for(const u of allUnits(s)){
    if(!living(u))continue;
    const hadHard=hardCc(u,s.tick-1);
    if(hadHard)u.lastHardCcActiveTick=s.tick-1;
    if(hadHard&&s.tick>=u.ccChainStartTick+40){u.statuses=u.statuses.filter(x=>!hardTypes.has(x.type));u.hardCcImmuneUntilTick=s.tick+40;}
    u.statuses=u.statuses.filter(x=>x.untilTick>s.tick);u.shields=u.shields.filter(x=>x.untilTick>s.tick&&x.amount>0);u.shield=u.shields.reduce((n,x)=>n+x.amount,0);
    u.recentDamage=u.recentDamage.filter(x=>s.tick-x.tick<=60);u.damageLedger=u.damageLedger.filter(x=>s.tick-x.tick<=100);u.supportLedger=u.supportLedger.filter(x=>s.tick-x.tick<=100);
    for(const [key,mark]of Object.entries(u.marks))if(mark.untilTick<=s.tick)delete u.marks[key];
    if(isStructure(u)&&s.tick-u.lastAttackTick>40)u.towerStreak=0;
  }
  if(s.tick>=s.nextWaveTick)spawnWave(s);
  updateStructureProtection(s);
  const index=new Map(allUnits(s).map(u=>[u.entityId,u])),space=new SpatialHash(s.units),impacts:Impact[]=[];
  // Intent formation does not alter HP. Both teams read the same pre-damage battlefield.
  const rank=(u:CombatUnit)=>{let n=initiativeRanks.get(u);if(n===undefined){n=hash(`${s.seed}/${u.entityId}`);initiativeRanks.set(u,n);}return n;};
  const intentOrder=allUnits(s).sort((a,b)=>(a.kind==='HERO'?0:1)-(b.kind==='HERO'?0:1)||rank(a)-rank(b));
  for(const u of intentOrder)planUnit(s,u,index,space);
  moveUnits(s,space,impacts);
  for(const u of s.units)if(living(u)&&(!Number.isFinite(u.x)||!Number.isFinite(u.y)||!Number.isFinite(u.hp)||!inLane(u,u.radius,u.lane!))){
    s.metrics.invalidPositions++;emit(s,'DIAGNOSTIC',u,[],u,'invalid_position','',{x:u.x,y:u.y,hp:u.hp});
  }
  moveProjectiles(s,index,impacts);
  actionImpacts(s,index,impacts);
  effectImpacts(s,index,impacts);
  const deaths=resolveImpacts(s,impacts,index);
  updateStructureProtection(s);
  s.effects=s.effects.filter(e=>e.untilTick>s.tick&&(!e.endsOnSourceDeath||Boolean(index.get(e.source.entityId)&&living(index.get(e.source.entityId)!))));
  s.units=s.units.filter(u=>living(u)||s.tick-(u.deathTick??s.tick)<12);
  s.events=s.events.filter(e=>s.tick-e.tick<=200);
  s.metrics.maxUnits=Math.max(s.metrics.maxUnits,s.units.filter(living).length);
  const lostA=s.structures.some(u=>u.team==='A'&&u.kind==='NEXUS'&&u.hp<=0),lostB=s.structures.some(u=>u.team==='B'&&u.kind==='NEXUS'&&u.hp<=0);
  if(lostA||lostB){s.winner=lostA&&lostB?'DRAW':lostA?'B':'A';emit(s,'MATCH_END',null,[],{x:768,y:384},'nexus_destroyed','',{winner:s.winner});}
  return {deaths,...(s.winner?{winner:s.winner}:{})};
}
function moveUnits(s:CombatState,space:SpatialHash,impacts:Impact[]):void{
  for(const u of s.units){
    if(!living(u)||s.tick<=u.createdTick)continue;
    u.previousX=u.x;u.previousY=u.y;u.vx=0;u.vy=0;
    let next:Point|undefined;
    if(u.forcedMove&&s.tick<=u.forcedMove.untilTick&&u.forcedMove.remaining>0){
      const step=Math.min(u.forcedMove.remaining,u.forcedMove.speed*.05);next={x:u.x+u.forcedMove.direction.x*step,y:u.y+u.forcedMove.direction.y*step};u.forcedMove.remaining-=step;
    }else if(u.action?.skillId){
      const skill=SKILLS[u.action.skillId]!,a=u.action;
      if(['dash_line','leap_area','leap_single','charge'].includes(skill.kind)&&s.tick>=a.startTick+ticks(skill.windupMs)&&s.tick<a.startTick+ticks(skill.windupMs+(skill.travelMs??250))){
        const speed=(skill.maxDistance??80)/((skill.travelMs??250)/1000),d=direction(u,a.point),step=Math.min(speed*.05,distance(u,a.point));
        next={x:u.x+d.x*step,y:u.y+d.y*step};
        if(skill.kind==='charge'){
          const collision=s.units.filter(v=>v!==u&&living(v)&&segmentDistance(v,u,next!)<u.radius+v.radius).sort((a,b)=>distance(u,a)-distance(u,b))[0];
          if(collision){const safeDistance=Math.max(0,distance(u,collision)-u.radius-collision.radius-1);next={x:u.x+d.x*Math.min(step,safeDistance),y:u.y+d.y*Math.min(step,safeDistance)};a.point={...next};}
        }
        if(skill.kind==='dash_line')for(const t of allUnits(s))if(t.team!==u.team&&living(t)&&!a.hitIds.includes(t.entityId)&&segmentDistance(t,u,next)<=t.radius+(skill.width??26)/2){a.hitIds.push(t.entityId);queueHit(s,impacts,a.source,t,skillPayload(skill),a.id,t);if(a.hitIds.length>=(skill.maxTargets??4))break;}
      }
    }else if(!hardCc(u,s.tick)&&!hasStatus(u,'root',s.tick)&&u.goal&&u.state!=='SPAWNING'){
      while(u.path[0]&&distance(u,u.path[0])<5)u.path.shift();const waypoint=u.path[0]??u.goal;
      if(distance(u,waypoint)<3){u.goal=null;u.state='HOLD';u.lastProgressTick=s.tick;u.stalledTicks=0;continue;}
      let d=direction(u,waypoint);const near=space.nearby(u,u.radius+30);
      let sx=0,sy=0;
      for(const other of near){if(other===u)continue;const dist=distance(u,other),desired=u.radius+other.radius+3;if(dist<desired&&dist>.1){sx+=(u.x-other.x)/dist*(desired-dist)/desired;sy+=(u.y-other.y)/dist*(desired-dist)/desired;}}
      d={x:d.x+sx*.65,y:d.y+sy*.65};const len=Math.hypot(d.x,d.y)||1;d.x/=len;d.y/=len;
      const slow=Math.min(.5,Math.max(0,...u.statuses.filter(x=>x.type==='slow').map(x=>x.magnitude)));
      const amount=Math.min(u.speed*(1-slow)*.05,distance(u,waypoint));next={x:u.x+d.x*amount,y:u.y+d.y*amount};
    }
    if(next){
      const pos=safeMove(s,u,next);u.x=pos.x;u.y=pos.y;u.vx=(u.x-u.previousX)*20;u.vy=(u.y-u.previousY)*20;
      if(Math.hypot(u.vx,u.vy)>.1&&!u.action){const d=direction({x:u.previousX,y:u.previousY},u);u.facingX=d.x;u.facingY=d.y;}
      const moved=distance(u,{x:u.lastProgressX,y:u.lastProgressY});
      if(moved>=4){u.lastProgressTick=s.tick;u.lastProgressX=u.x;u.lastProgressY=u.y;u.stalledTicks=0;}
      else if(!u.action&&!u.forcedMove){u.stalledTicks=s.tick-u.lastProgressTick;if(u.stalledTicks===16){
        const side=hash(`${s.seed}/${u.entityId}`)%2?1:-1;
        const escape={x:u.x,y:u.y+side*28};if(walkable(s,escape,u.radius,u.lane!)){u.path=[escape];u.pathGoal=null;u.tacticalUntilTick=s.tick+12;}
      }if(u.stalledTicks===40){u.targetId=null;u.path=[];}if(u.stalledTicks===100){s.metrics.stalledEvents++;(s.metrics.stalls??=[]).push({tick:s.tick,entityId:u.entityId,heroId:u.heroDefinitionId??'',kind:u.kind,x:u.x,y:u.y,goal:u.goal,reason:u.debugReason});emit(s,'DIAGNOSTIC',u,[],u,'stalled','',{durationTicks:u.stalledTicks});}}
    }else{u.lastProgressTick=s.tick;u.lastProgressX=u.x;u.lastProgressY=u.y;u.stalledTicks=0;}
    if(u.forcedMove&&(u.forcedMove.remaining<=0||u.forcedMove.untilTick<=s.tick))u.forcedMove=null;
  }
  // Each pair's correction is split symmetrically, accumulated from the same positions, and capped at three units/tick.
  const current=new SpatialHash(s.units),corrections=new Map<string,Point>();
  for(const u of s.units){if(!living(u))continue;for(const v of current.nearby(u,u.radius+20)){
    if(v.entityId<=u.entityId||!living(v))continue;const d=distance(u,v),overlap=u.radius+v.radius-d;if(overlap<=0)continue;
    const angle=d>.01?direction(v,u):{x:Math.cos(hash(`${s.seed}/${[u.entityId,v.entityId].sort().join('/')}`)),y:Math.sin(hash(`${s.seed}/${[u.entityId,v.entityId].sort().join('/')}`))};
    const resistU=u.action?.9:1,resistV=v.action?.9:1,total=resistU+resistV;
    const cu=corrections.get(u.entityId)??{x:0,y:0},cv=corrections.get(v.entityId)??{x:0,y:0};
    cu.x+=angle.x*overlap*resistU/total;cu.y+=angle.y*overlap*resistU/total;cv.x-=angle.x*overlap*resistV/total;cv.y-=angle.y*overlap*resistV/total;corrections.set(u.entityId,cu);corrections.set(v.entityId,cv);
  }}
  for(const u of s.units){const c=corrections.get(u.entityId);if(!c)continue;const length=Math.hypot(c.x,c.y),scale=Math.min(3,length)/(length||1),pos=safeMove(s,u,{x:u.x+c.x*scale,y:u.y+c.y*scale});u.x=pos.x;u.y=pos.y;}
}
