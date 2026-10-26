import test from 'node:test';
import assert from 'node:assert/strict';
import { createCombat, deployHero, stepCombat, ticks, gap, inLane, updateStructureProtection, minionSiegeMultiplier, applyStatus } from '../src/server/combat.js';
import type { CombatState, CombatUnit, Source } from '../src/shared/combat-types.js';
import type { OwnedHero } from '../src/shared/types.js';
import { HERO_BY_ID } from '../src/shared/heroes.js';
import { circleHits, rectangleHits, coneHits, walkable, findLocalPath, clearSegment } from '../src/server/combat-geometry.js';

function owned(id:string,heroId:string,level=1):OwnedHero{return {ownedHeroInstanceId:id,heroDefinitionId:heroId,rarity:HERO_BY_ID[heroId]!.rarity,level,powerEnhancements:0,vitalityEnhancements:0,skillReadyAt:{},obtainedFrom:'STARTER'};}
function fixture():CombatState{const s=createCombat('fixture',123);s.units=[];s.structures=[];s.events=[];s.nextWaveTick=1e9;return s;}
function hero(s:CombatState,id:string,heroId:string,team:'A'|'B',x:number,y=224,level=1){
 const u=deployHero(s,{playerId:id,team,lane:'TOP',hero:owned(`${id}-owned`,heroId,level),sharedSkillReadyAt:{}});
 Object.assign(u,{x,y,previousX:x,previousY:y,createdTick:-10,nextAiTick:0,state:'HOLD'});return u;
}
function source(u:CombatUnit):Source{return {entityId:u.entityId,deploymentId:u.deploymentId,playerId:u.ownerPlayerId,ownedHeroInstanceId:u.ownedHeroInstanceId,heroDefinitionId:u.heroDefinitionId,team:u.team,kind:u.kind,power:u.power,maxHp:u.maxHp};}
function run(s:CombatState,n:number){for(let i=0;i<n;i++)stepCombat(s);}

test('COM-001/002/047: exact opening and 20-second waves with a monotonic match clock',()=>{
 const s=createCombat('waves',42,6000);assert.equal(s.units.length,28);assert.equal(s.battleStartTick,6000);
 for(const team of ['A','B'])for(const lane of ['TOP','BOTTOM']){assert.equal(s.units.filter(u=>u.team===team&&u.lane===lane&&u.kind==='MELEE_MINION').length,3);assert.equal(s.units.filter(u=>u.team===team&&u.lane===lane&&u.kind==='RANGED_MINION').length,4);}
 run(s,399);assert.equal(s.wave,1);run(s,1);assert.equal(s.wave,2);assert.equal(s.metrics.spawnedMinions,56);run(s,1);assert.equal(s.wave,2);
});
test('COM-045: millisecond timelines ceil to exact integer ticks',()=>{
 assert.equal(ticks(230),5);assert.equal(ticks(300),6);assert.equal(ticks(150),3);
 const s=fixture(),a=hero(s,'a','swordsman','A',700),b=hero(s,'b','paladin','B',730);b.power=0;b.speed=0;
 const hp=b.hp;run(s,4);assert.equal(b.hp,hp);assert.equal(a.actionStartTick,1);assert.equal(a.impactTick,5);run(s,1);assert.ok(b.hp<hp);
});
test('COM-011: melee windup misses when the locked target escapes the hit range',()=>{
 const s=fixture(),a=hero(s,'a','swordsman','A',700),b=hero(s,'b','paladin','B',730);b.speed=0;b.power=0;
 run(s,1);const hp=b.hp;b.x=950;run(s,4);assert.equal(b.hp,hp);assert.ok(s.events.some(e=>e.type==='MISS'&&e.sourceEntityId===a.entityId));
});
test('COM-012/014: arrows do no pre-release damage and persist after the archer dies',()=>{
 const s=fixture(),a=hero(s,'a','archer','A',650),b=hero(s,'b','paladin','B',800);b.power=0;b.speed=0;
 const hp=b.hp;run(s,6);assert.equal(s.projectiles.length,0);assert.equal(b.hp,hp);run(s,1);assert.equal(s.projectiles.length,1);assert.equal(b.hp,hp);
 a.hp=0;a.state='DEAD';a.deathTick=s.tick;run(s,15);assert.ok(b.hp<hp);assert.ok(s.stats.a!.heroDamage>0);
});
test('COM-015: homing projectiles never reassign after target death',()=>{
 const s=fixture(),a=hero(s,'a','archer','A',650),b=hero(s,'b','paladin','B',800),c=hero(s,'c','paladin','B',805,240);b.power=0;c.power=0;b.speed=0;c.speed=0;
 a.targetId=b.entityId;a.targetChosenTick=0;run(s,7);const p=s.projectiles.find(p=>p.source.entityId===a.entityId)!;assert.ok(p);const actual=p.targetId===b.entityId?b:c,other=actual===b?c:b;
 actual.hp=0;actual.state='DEAD';actual.deathTick=s.tick;a.hp=0;a.state='DEAD';a.deathTick=s.tick;const hp=other.hp;run(s,20);assert.equal(other.hp,hp);
});
test('COM-016: both already-started impacts resolve despite same-tick lethal damage',()=>{
 const s=fixture(),a=hero(s,'a','swordsman','A',700),b=hero(s,'b','swordsman','B',730);a.hp=1;b.hp=1;
 run(s,5);assert.equal(a.state,'DEAD');assert.equal(b.state,'DEAD');assert.equal(s.teamKills.A,1);assert.equal(s.teamKills.B,1);assert.equal(s.stats.a!.kills,1);assert.equal(s.stats.b!.kills,1);
});
test('COM-017: concurrent damage and healing are batched from tick-start HP',()=>{
 const s=fixture(),victim=hero(s,'victim','paladin','A',700),healer=hero(s,'healer','priest','A',690),attacker=hero(s,'attacker','archer','B',800);
 victim.hp=50;victim.armor=0;victim.nextAiTick=1e9;victim.targetId=attacker.entityId;victim.power=0;healer.power=0;healer.nextAiTick=1e9;healer.targetId=attacker.entityId;attacker.power=0;attacker.nextAiTick=1e9;attacker.targetId=victim.entityId;
 s.projectiles.push({entityId:'batch-arrow',source:{...source(attacker),power:70},targetId:victim.entityId,lastTarget:victim,direction:{x:-1,y:0},x:720,y:224,speed:400,radius:3,remaining:200,createdTick:0,effectId:'arrow',actionId:'test-arrow',mode:'HOMING',maxTargets:1,hitIds:[],payload:{skillId:null,coefficient:1,structureMultiplier:1},falloff:0,minFalloff:0});
 s.effects.push({entityId:'batch-heal',source:{...source(healer),power:30},effectId:'healing_prayer',actionId:'test-heal',shape:'circle',x:700,y:224,radius:20,width:0,depth:0,direction:{x:1,y:0},createdTick:0,untilTick:10,hitTicks:[1],processedTicks:[],coefficients:[1],payload:{skillId:'priest.healing_prayer',coefficient:0,structureMultiplier:0},healing:true,maxTargets:1,endsOnSourceDeath:false,reduction:0});
 stepCombat(s);assert.equal(victim.hp,10);assert.equal(s.stats.healer!.healing,30);assert.equal(s.stats.attacker!.heroDamage,70);
});
test('COM-027/028/029: lane-specific siege dependency graph and nexus lock',()=>{
 const s=createCombat('siege',4);const get=(id:string)=>s.structures.find(x=>x.entityId.endsWith(id))!;
 assert.equal(get('B_TOP_OUTER').protected,false);assert.equal(get('B_TOP_INNER').protected,true);assert.equal(get('B_GUARD_1').protected,true);assert.equal(get('B_NEXUS').protected,true);
 get('B_TOP_OUTER').hp=0;updateStructureProtection(s);assert.equal(get('B_TOP_INNER').protected,false);assert.equal(get('B_GUARD_1').protected,true);
 get('B_TOP_INNER').hp=0;updateStructureProtection(s);assert.equal(get('B_GUARD_1').protected,false);assert.equal(get('B_GUARD_2').protected,false);assert.ok(get('B_BOTTOM_OUTER').hp>0);
 get('B_GUARD_1').hp=0;updateStructureProtection(s);assert.equal(get('B_NEXUS').protected,true);get('B_GUARD_2').hp=0;updateStructureProtection(s);assert.equal(get('B_NEXUS').protected,false);
});
test('COM-018: hard CC caps at two seconds and supplies only cap immunity',()=>{
 const s=fixture(),a=hero(s,'a','paladin','A',700),b=hero(s,'b','paladin','B',900);a.power=b.power=0;a.speed=b.speed=0;
 for(let i=0;i<40;i++){applyStatus(s,a,'stun',600,0,source(b));stepCombat(s);}assert.equal(a.statuses.some(x=>x.type==='stun'),false);assert.ok(a.hardCcImmuneUntilTick>s.tick);
 const until=a.hardCcImmuneUntilTick;applyStatus(s,a,'stun',600,0,source(b));assert.equal(a.statuses.some(x=>x.type==='stun'),false);assert.equal(a.hardCcImmuneUntilTick,until);
 const c=hero(s,'c','archer','A',720);applyStatus(s,c,'stun',100,0,source(b));run(s,3);assert.equal(c.hardCcImmuneUntilTick,0);
});
test('COM-043: late siege multipliers affect only the declared time intervals',()=>{
 const s=createCombat('late',3,10000);for(const [elapsed,expected]of [[479.95,1],[480,2],[599.95,2],[600,8],[719.95,8],[720,16]]){s.tick=s.battleStartTick+Math.round(elapsed!*20);assert.equal(minionSiegeMultiplier(s),expected);}
});
test('COM-043: late minion siege scales real structure hits without scaling hero or minion damage',()=>{
 const s=fixture();s.tick=12000;
 const tower=hero(s,'tower-fixture','paladin','B',700),enemyHero=hero(s,'enemy-hero','paladin','B',850),enemyMinion=hero(s,'minion-fixture','paladin','B',1000);
 tower.kind='OUTER';enemyMinion.kind='MELEE_MINION';s.units=s.units.filter(u=>u!==tower);s.structures=[tower];
 for(const target of [tower,enemyHero,enemyMinion]){
  target.hp=target.maxHp=1000;target.armor=0;target.power=0;target.speed=0;target.nextBasicReadyTick=1e9;
  s.projectiles.push({entityId:`hit-${target.entityId}`,source:{entityId:'old-minion',deploymentId:'old-minion-life',team:'A',kind:'RANGED_MINION',power:100,maxHp:95},targetId:target.entityId,lastTarget:{x:target.x,y:target.y},x:target.x-10,y:target.y,direction:{x:1,y:0},speed:400,radius:3,remaining:200,createdTick:s.tick-1,effectId:'test',actionId:'siege-hit',mode:'HOMING',maxTargets:1,hitIds:[],payload:{skillId:null,coefficient:1,structureMultiplier:1,basic:true},falloff:0,minFalloff:0});
 }
 stepCombat(s);assert.equal(tower.hp,200);assert.equal(enemyHero.hp,900);assert.equal(enemyMinion.hp,900);
});
test('COM-044: melee surface-gap ring can actually hit a large structure',()=>{
 const s=createCombat('ring',4);s.units=[];s.nextWaveTick=1e9;const t=s.structures.find(t=>t.entityId.endsWith('B_TOP_OUTER'))!;
 const a=hero(s,'a','swordsman','A',t.x-t.radius-11-10,t.y);a.power=100;t.power=0;const hp=t.hp;run(s,30);assert.ok(t.hp<hp);assert.ok(gap(a,t)<=a.range+6);
});
test('COM-003/020: corridor and ability shapes include collision radii',()=>{
 assert.equal(inLane({x:768,y:224},12,'TOP'),true);assert.equal(inLane({x:768,y:384},12,'TOP'),false);assert.equal(inLane({x:300,y:384},12,'TOP'),true);
 const s=fixture(),u=hero(s,'a','paladin','A',700,224);assert.equal(circleHits({x:680,y:224},8,u),true);assert.equal(rectangleHits({x:660,y:224},{x:1,y:0},30,10,u),true);assert.equal(coneHits({x:660,y:224},{x:1,y:0},30,90,u),true);
 const full=createCombat('walkable',1);assert.equal(walkable(full,{x:520,y:224},12,'TOP'),false);
});
test('COM-033: dead human units remain dead without an explicit deployment command',()=>{
 const s=fixture(),a=hero(s,'a','archer','A',650);a.hp=0;a.state='DEAD';a.deathTick=0;run(s,400);assert.equal(s.units.filter(u=>u.ownerPlayerId==='a'&&u.hp>0).length,0);
});
test('COM-037: identical seed and input reproduce every event and final unit state',()=>{
 const play=()=>{const s=createCombat('deterministic',998);for(const [i,id]of ['paladin','archer','priest','barbarian'].entries())for(const team of ['A','B']as const)deployHero(s,{playerId:`${team}${i}`,team,lane:i%2?'BOTTOM':'TOP',hero:owned(`${team}${i}hero`,id,5),sharedSkillReadyAt:{}});run(s,700);return s;};
 assert.deepEqual(play(),play());
});
test('COM-039/040: double nexus destruction is a draw and further steps freeze',()=>{
 const s=createCombat('draw',1);for(const n of s.structures.filter(u=>u.kind==='NEXUS'))n.hp=0;stepCombat(s);assert.equal(s.winner,'DRAW');const previous=JSON.stringify(s);stepCombat(s);assert.equal(JSON.stringify(s),previous);
});
test('COM-049: concurrent 90 and 60 damage is credited 60 and 40 on a 100 HP victim',()=>{
 const s=fixture(),victim=hero(s,'victim','paladin','B',700),a=hero(s,'a','archer','A',600),b=hero(s,'b','archer','A',620);
 victim.hp=100;victim.armor=0;victim.power=0;victim.nextAiTick=1e9;victim.targetId=a.entityId;
 for(const [u,power]of [[a,90],[b,60]]as const){u.nextAiTick=1e9;u.targetId=victim.entityId;s.projectiles.push({entityId:`${u.entityId}-arrow`,source:{...source(u),power},targetId:victim.entityId,lastTarget:victim,direction:{x:1,y:0},x:680,y:224,speed:400,radius:3,remaining:200,createdTick:0,effectId:'arrow',actionId:`${u.entityId}-hit`,mode:'HOMING',maxTargets:1,hitIds:[],payload:{skillId:null,coefficient:1,structureMultiplier:1},falloff:0,minFalloff:0});}
 const result=stepCombat(s);assert.equal(victim.hp,0);assert.equal(s.stats.a!.heroDamage,60);assert.equal(s.stats.b!.heroDamage,40);assert.equal(s.stats.a!.kills,1);assert.equal(s.stats.b!.assists,1);assert.equal(s.teamKills.A,1);assert.equal(result.deaths.length,1);
});
test('COM-006: eight melee attackers reserve distinct ring positions instead of the target center',()=>{
 const s=fixture(),target=hero(s,'target','guardian_golem','B',768);target.hp=target.maxHp=100000;target.speed=0;target.power=0;
 const attackers=Array.from({length:8},(_,i)=>hero(s,`attacker-${i}`,'swordsman','A',650,174+i*14));run(s,240);
 assert.ok(s.stats['attacker-0']!.heroDamage>0);assert.ok(attackers.every(a=>distanceSafe(a,target)>=a.radius+target.radius-3));
 const attacking=attackers.filter(a=>a.action&&a.targetId===target.entityId);assert.equal(new Set(attacking.map(a=>a.slotIndex)).size,attacking.length);
 assert.equal(s.metrics.stalledEvents,0);
});
function distanceSafe(a:{x:number;y:number},b:{x:number;y:number}){return Math.hypot(a.x-b.x,a.y-b.y);}
test('COM-007: a tank adjacent to its own tower navigates around the solid obstacle',()=>{
 const s=createCombat('own-tower',1002);s.units=[];s.nextWaveTick=1e9;
 const u=deployHero(s,{playerId:'tank',team:'A',lane:'BOTTOM',hero:owned('tank-owned','paladin'),sharedSkillReadyAt:{}});
 Object.assign(u,{x:516.5280411617823,y:502.80858350223946,state:'HOLD',createdTick:-10,nextAiTick:0,lateral:-28});
 run(s,200);assert.ok(u.x>600,`tank remained at ${u.x},${u.y} (${u.debugReason})`);assert.equal(s.metrics.stalledEvents,0);assert.equal(s.metrics.invalidPositions,0);
});
test('COM-007: a mage at the inner tower and corridor corner finds a valid departure edge',()=>{
 const s=createCombat('inner-corner',1003);s.units=[];s.nextWaveTick=1e9;
 const u=deployHero(s,{playerId:'mage',team:'B',lane:'TOP',hero:owned('mage-owned','pyromancer'),sharedSkillReadyAt:{}});
 Object.assign(u,{x:1214.9746788405403,y:205.58672775991658,state:'HOLD',createdTick:-10,nextAiTick:0,lateral:42});
 run(s,200);assert.ok(u.x<1100,`mage remained at ${u.x},${u.y} (${u.debugReason})`);assert.equal(s.metrics.stalledEvents,0);assert.equal(s.metrics.invalidPositions,0);
});

test('COM-007: a nearby ranged-minion goal cannot shortcut the tower tangent from its grid center',()=>{
 const s=createCombat('minion-tangent-1010',1010);const u=s.units.find(u=>u.kind==='RANGED_MINION'&&u.team==='A'&&u.lane==='TOP')!;
 s.units=[u];s.nextWaveTick=1e9;const goal={x:534.5924068296854,y:259.8812588496486};
 Object.assign(u,{x:515.3242810526128,y:258.9889647221098,previousX:515.3242810526128,previousY:258.9889647221098,state:'APPROACH',createdTick:-10,nextAiTick:1e9,targetId:s.structures.find(t=>t.entityId.endsWith('B_TOP_OUTER'))!.entityId,goal,lastProgressX:515.3242810526128,lastProgressY:258.9889647221098,lastProgressTick:0});
 assert.equal(walkable(s,u,u.radius,'TOP'),true);assert.equal(walkable(s,goal,u.radius,'TOP'),true);
 assert.equal(clearSegment(s,u,goal,u.radius,'TOP'),false,'direct tangent crosses the solid tower');
 u.path=findLocalPath(s,u,goal);assert.ok(u.path.length>0,'legal short detour must not be discarded by virtual start-cell termination');
 const plannedPath=structuredClone(u.path);let previous={x:u.x,y:u.y};for(const point of u.path){assert.equal(clearSegment(s,previous,point,u.radius,'TOP'),true);previous=point;}
 run(s,200);assert.ok(distanceSafe(u,goal)<3,'actual engine movement must reach the close goal: '+JSON.stringify({x:u.x,y:u.y,path:u.path,plannedPath,goal:u.goal,stalls:s.metrics.stalls}));assert.equal(s.metrics.stalledEvents,0);assert.equal(s.metrics.invalidPositions,0);
});
