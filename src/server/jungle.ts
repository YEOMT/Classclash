import type {CombatState,CombatUnit,Point} from '../shared/combat-types.js';
import {LANES} from '../shared/battle-map.js';
import type {Lane,Team} from '../shared/types.js';
import {distance,living,laneProgress,pointOnPath} from './combat-geometry.js';
import {JUNGLE_BALANCE} from '../shared/jungle-balance.js';

export function lanePressure(s:CombatState,team:Team,excludeId?:string){
 return LANES.map(lane=>{
  const heroes=s.units.filter(u=>u.kind==='HERO'&&living(u)&&u.entityId!==excludeId&&u.lane===lane&&(!u.jungle||u.jungle.stage==='GANK'));
  const friends=heroes.filter(u=>u.team===team).length,enemies=heroes.filter(u=>u.team!==team).length;
  return {lane,friends,enemies,need:enemies-friends+(friends===0?2:0)};
 }).sort((a,b)=>b.need-a.need||a.friends-b.friends||LANES.indexOf(a.lane)-LANES.indexOf(b.lane));
}
export function initializeJungler(u:CombatUnit,tick:number){
 u.jungle={stage:'HOME',campId:null,visited:[],nextDecisionTick:tick,commitUntilTick:tick,assistLane:null,reason:'아군 정글부터 사냥'};
}
/** Decisions are server-owned and committed for a short interval. The player
 * selects only the deployment position; no live movement commands are accepted. */
export function jungleIntent(s:CombatState,u:CombatUnit):{targetId:string|null;goal:Point|null;laneCombat:boolean}{
 const j=u.jungle!,team=u.team as Team,camps=s.camps??[];
 const aliveCamp=(id:string|null)=>camps.find(c=>c.id===id&&c.entityId&&s.units.some(m=>m.entityId===c.entityId&&living(m)));
 const own=camps.filter(c=>c.homeTeam===team);
 for(const camp of own)if(!aliveCamp(camp.id)&&!j.visited.includes(camp.id))j.visited.push(camp.id);
 if(u.hp/u.maxHp<JUNGLE_BALANCE.retreatHpRatio){j.stage='RECOVER';j.campId=null;j.commitUntilTick=s.tick+40;j.reason='체력이 낮아 본진에서 회복';}
 if(j.stage==='RECOVER'&&u.hp/u.maxHp>=.85){j.stage='HOME';j.visited=[];j.nextDecisionTick=s.tick;}
 if(j.stage==='RECOVER'){const base=team==='A'?{x:215,y:1080}:{x:1065,y:160};return {targetId:null,goal:distance(u,base)<12?null:base,laneCombat:false};}
 const reserved=(id:string)=>s.units.filter(v=>v!==u&&living(v)&&v.team===team&&v.jungle?.campId===id).length;
 const choose=(list:typeof camps)=>[...list].sort((a,b)=>distance(u,a)+reserved(a.id)*300-distance(u,b)-reserved(b.id)*300||a.id.localeCompare(b.id))[0];
 const current=aliveCamp(j.campId);
 const completed=current===undefined&&j.campId!==null;
 if(completed){if(!j.visited.includes(j.campId!))j.visited.push(j.campId!);j.campId=null;j.nextDecisionTick=s.tick;}
 if(s.tick>=j.nextDecisionTick||completed){
  j.nextDecisionTick=s.tick+20;
  if(j.stage!=='HOME'&&s.tick>=j.commitUntilTick&&j.visited.length>=own.length&&own.some(c=>aliveCamp(c.id))){j.stage='HOME';j.visited=[];j.campId=null;}
  const home=own.filter(c=>!j.visited.includes(c.id)&&aliveCamp(c.id));
  if(home.length&&j.stage==='HOME'){
   const camp=current?.homeTeam===team?current:choose(home)!;j.campId=camp.id;j.reason='아군 '+camp.name+' 사냥';
  }else if(j.stage==='GANK'&&s.tick<j.commitUntilTick){
   // Continue an already committed assist instead of oscillating at entrances.
  }else if(j.stage==='INVADE'&&current&&s.tick<j.commitUntilTick){
   j.reason='적 정글 '+current.name+' 침투';
  }else{
   const pressure=lanePressure(s,team,u.entityId)[0]!;
   const enemyCamps=camps.filter(c=>c.homeTeam!==team&&aliveCamp(c.id));
   const danger=s.units.filter(v=>v.kind==='HERO'&&v.team!==team&&living(v)&&distance(u,v)<240).length;
   const support=s.units.filter(v=>v!==u&&v.kind==='HERO'&&v.team===team&&living(v)&&distance(u,v)<240).length;
   if(pressure.need>0||u.hp/u.maxHp<JUNGLE_BALANCE.invadeHpRatio||danger>support+1||!enemyCamps.length){
    j.stage='GANK';j.campId=null;j.assistLane=pressure.lane;u.lane=pressure.lane;j.commitUntilTick=s.tick+JUNGLE_BALANCE.assistCommitTicks;
    j.reason=pressure.friends===0?pressure.lane+' 빈 전선 지원':pressure.lane+' 아군 '+pressure.friends+' / 적 '+pressure.enemies+' 지원';
   }else{
    const camp=choose(enemyCamps)!;j.stage='INVADE';j.campId=camp.id;j.assistLane=null;j.commitUntilTick=s.tick+JUNGLE_BALANCE.invadeCommitTicks;j.reason='적 정글 '+camp.name+' 침투';
   }
  }
 }
 if(j.stage==='GANK'){
  const lane=j.assistLane??'MID';u.lane=lane;
  const front=s.units.filter(v=>v.team===team&&living(v)&&v.lane===lane&&!v.jungle).sort((a,b)=>laneProgress(b,lane,team)-laneProgress(a,lane,team))[0];
  const progress=front?laneProgress(front,lane,team):laneProgress({x:640,y:640},lane,team);
  return {targetId:null,goal:pointOnPath(progress,lane,team,u.lateral*.4),laneCombat:true};
 }
 const camp=aliveCamp(j.campId);
 return {targetId:camp?.entityId??null,goal:camp?{x:camp.x,y:camp.y}:null,laneCombat:false};
}
