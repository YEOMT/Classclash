import {createCombat, deployHero, spawnWave, stepCombat} from '../server/combat.js';
import {LANES} from '../shared/battle-map.js';
import {lanePath,pointOnPath,nearestWalkable} from '../server/combat-geometry.js';
import type {CombatState} from '../shared/combat-types.js';
import type {Lane, Team} from '../shared/types.js';
import {HERO_BY_ID} from '../shared/heroes.js';

export const ART_HEROES = ['paladin','archer','pyromancer'] as const;
const fullRoster=[...ART_HEROES,...Object.keys(HERO_BY_ID).filter(id=>!(ART_HEROES as readonly string[]).includes(id))];
const names = ['서윤','지호','하린','민준','수아','도윤','지안','유진','시우','예린'];
/** Isolated QA fixture. Uses the production combat engine with ordinary level-5 stats.
 * Only initial placement and wave count are staged; damage, AI and skill triggers
 * are all stepCombat. No fixture state or commands enter a classroom room. */
export function createArtFixture(stress=false, sequence=0) {
 const state=createCombat(`art-lab-${sequence}`,84521+sequence);
 const players:{playerId:string;name:string}[]=[];
 if(stress){spawnWave(state);spawnWave(state);spawnWave(state);}
 for(const team of ['A','B'] as Team[])for(let i=0;i<(stress?15:3);i++){
  const heroId=stress?fullRoster[(i+(team==='B'?9:0))%fullRoster.length]!:ART_HEROES[i%3]!,playerId=`${team}-${i}`,lane:Lane=stress?LANES[i%3]!:'TOP';
  const u=deployHero(state,{playerId,team,lane,hero:{ownedHeroInstanceId:`owned-${playerId}`,heroDefinitionId:heroId,rarity:HERO_BY_ID[heroId]!.rarity,level:5,powerEnhancements:0,vitalityEnhancements:0,skillReadyAt:{},obtainedFrom:'STARTER'},sharedSkillReadyAt:{}});
  const row=stress?Math.floor((i%8)/3):0;
  const points=lanePath(lane),total=points.slice(1).reduce((n,p,i)=>n+Math.hypot(p.x-points[i]!.x,p.y-points[i]!.y),0),offset=stress?100+row*60:heroId==='pyromancer'?110:heroId==='archer'?54:22,
   staged=nearestWalkable(state,pointOnPath(total/2-offset,lane,team,((i%3)-1)*25),u.radius,lane)!;
  Object.assign(u,{...staged,previousX:staged.x,previousY:staged.y,lastProgressX:staged.x,lastProgressY:staged.y,engageX:staged.x,createdTick:-10,nextAiTick:1,state:'HOLD'});
  players.push({playerId,name:`${names[(i+(team==='B'?3:0))%names.length]}${stress?` ${i+1}`:''}`});
 }
 if(stress){
  const counters=new Map<string,number>();
  for(const u of state.units.filter(u=>u.kind.endsWith('MINION'))){
   const key=`${u.team}-${u.lane}`,i=counters.get(key)??0;counters.set(key,i+1);
   const points=lanePath(u.lane!),total=points.slice(1).reduce((n,p,i)=>n+Math.hypot(p.x-points[i]!.x,p.y-points[i]!.y),0),staged=nearestWalkable(state,pointOnPath(total/2-220-Math.floor(i/5)*42,u.lane!,u.team,((i%5)-2)*20),u.radius,u.lane!)!;
   Object.assign(u,{...staged,previousX:staged.x,previousY:staged.y,lastProgressX:staged.x,lastProgressY:staged.y,createdTick:-10});
  }
 }
 return {state,players};
}
export function advanceArtFixture(state:CombatState){return stepCombat(state);}
