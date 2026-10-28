import test from 'node:test';
import assert from 'node:assert/strict';
import {createCombat,deployHero,stepCombat,updateStructureProtection,applyStatus} from '../src/server/combat.js';
import {clearSegment,distance,gap,inLane,walkable,safeMove,circleHits,rectangleHits,coneHits} from '../src/server/combat-geometry.js';
import {HERO_BY_ID} from '../src/shared/heroes.js';
import type {CombatState,CombatUnit,Source} from '../src/shared/combat-types.js';
import type {Team} from '../src/shared/types.js';

function scene(seed=902){const s=createCombat('v02-fixed-'+seed,seed);s.units=[];s.structures=[];s.camps=[];s.events=[];s.nextWaveTick=Infinity;return s;}
function hero(s:CombatState,id:string,definition:string,team:Team,x:number,y=210,level=1){
 const u=deployHero(s,{playerId:id,team,lane:'TOP',hero:{ownedHeroInstanceId:id+'-instance',heroDefinitionId:definition,rarity:HERO_BY_ID[definition]!.rarity,level,powerEnhancements:0,vitalityEnhancements:0,skillReadyAt:{},obtainedFrom:'STARTER'},sharedSkillReadyAt:{}});
 Object.assign(u,{x,y,previousX:x,previousY:y,lastProgressX:x,lastProgressY:y,state:'HOLD',createdTick:-10,nextAiTick:0});return u;
}
function run(s:CombatState,n:number){for(let i=0;i<n&&!s.winner;i++)stepCombat(s);}
function source(u:CombatUnit):Source{return{entityId:u.entityId,deploymentId:u.deploymentId,team:u.team,kind:u.kind,power:u.power,maxHp:u.maxHp,playerId:u.ownerPlayerId};}
function tower(s:CombatState,x=650){const original=createCombat('fixture-towers',902).structures.find(t=>t.team==='B'&&t.kind==='OUTER'&&t.lane==='TOP')!;const t={...original,entityId:s.matchId+':B_OUTER',x,y:210,previousX:x,previousY:210,protected:false};s.structures=[t];return t;}

test('SC01: committed melee attacks survive small target-score changes and preserve surface separation',()=>{
 const s=scene(),a=hero(s,'front','swordsman','A',500),b=hero(s,'enemy','paladin','B',533);b.speed=0;b.power=0;b.hp=b.maxHp=10000;
 run(s,1);const action=a.action!;assert.ok(action);b.y+=2;run(s,3);assert.equal(a.action?.id,action.id);
 run(s,120);assert.ok(s.stats.front!.heroDamage>0);assert.ok(distance(a,b)>=a.radius+b.radius-3);assert.equal(s.metrics.invalidPositions,0);
});

test('SC02: six attackers use physical approach positions, then release reservations after target death',()=>{
 const s=scene(903),victim=hero(s,'victim','archer','B',600);victim.hp=victim.maxHp=100000;victim.power=0;victim.speed=0;
 const attackers=Array.from({length:6},(_,i)=>hero(s,'s'+i,'swordsman','A',490,175+i*14));run(s,220);
 assert.ok(attackers.filter(a=>s.stats[a.ownerPlayerId!]!.heroDamage>0).length>=4);
 assert.ok(attackers.every(a=>distance(a,victim)>=a.radius+victim.radius-3));assert.equal(s.metrics.stalledEvents,0);
 victim.hp=0;victim.state='DEAD';victim.deathTick=s.tick;run(s,30);assert.ok(attackers.every(a=>a.targetId!==victim.entityId&&a.slotUntilTick<=s.tick));
});

test('SC03: ranged pressure never causes pre-release damage or endless attack cancellation',()=>{
 const s=scene(904),a=hero(s,'archer','archer','A',470),b=hero(s,'fighter','brawler','B',610);b.power=2;b.hp=b.maxHp=10000;
 const hp=b.hp;run(s,5);assert.equal(b.hp,hp);run(s,155);assert.ok(s.stats.archer!.heroDamage>0);
 assert.ok(s.events.some(e=>e.type==='PROJECTILE_SPAWN'&&e.sourceEntityId===a.entityId));assert.equal(s.metrics.invalidPositions,0);
});

test('SC04: a mixed 5v5 engages with damage, role skills and bounded decision traces',()=>{
 const s=scene(905);const ids=['paladin','swordsman','archer','pyromancer','priest'];
 for(const team of ['A','B'] as const)for(let i=0;i<5;i++)hero(s,team+i,ids[i]!,team,team==='A'?470:640,178+i*15,i<2?2:5);
 const wave=createCombat('mixed-wave',905).units.filter(u=>u.kind.includes('MINION')&&u.lane==='TOP');
 for(const [i,u]of wave.entries()){u.x=u.team==='A'?520:590;u.y=174+(i%7)*12;u.previousX=u.x;u.previousY=u.y;u.createdTick=-10;}s.units.push(...wave);
 run(s,220);assert.ok(s.events.some(e=>e.type==='HIT'));assert.ok(s.events.some(e=>e.type==='SKILL_CAST'));assert.equal(s.metrics.invalidPositions,0);
 assert.ok((s.decisions?.length??0)>0&&s.decisions!.length<=256);assert.equal(s.metrics.stalledEvents,0);
});

test('SC05: assassin leap cannot cross a live tower even when the healer is a tempting target',()=>{
 const s=scene(906),a=hero(s,'assassin','assassin','A',515,210,2),b=hero(s,'healer','priest','B',625);b.hp=b.maxHp=10000;b.power=0;b.speed=0;
 const t=tower(s,568);t.power=0;t.protected=true;assert.equal(clearSegment(s,a,b,a.radius,'TOP'),false);
 run(s,16);assert.ok(!s.events.some(e=>e.type==='SKILL_CAST'&&e.params.skillId==='assassin.shadow_leap'));assert.ok(walkable(s,a,a.radius,'TOP'));
});

test('SC07: two priests heal only missing HP and never inflate effective-healing contribution',()=>{
 const s=scene(907),patient=hero(s,'patient','paladin','A',565);patient.hp-=50;patient.speed=0;
 for(let i=0;i<2;i++){const p=hero(s,'priest'+i,'priest','A',500,195+i*30,2);p.power=100;p.speed=0;}
 run(s,50);assert.ok(patient.hp<=patient.maxHp);const credited=(s.stats.priest0?.healing??0)+(s.stats.priest1?.healing??0);assert.ok(credited<=50+1e-8);
});

test('SC08/09: a ranged hero waits outside a tower without escort, joins a real minion tank',()=>{
 const s=scene(908),a=hero(s,'archer','archer','A',410),t=tower(s,650);t.hp=t.maxHp=100000;
 run(s,80);assert.ok(gap(a,t)>t.range-2);assert.equal(s.stats.archer!.structureDamage,0);
 const minion=hero(s,'escort','paladin','A',605);minion.kind='MELEE_MINION';minion.heroDefinitionId=undefined;minion.role='melee';minion.hp=minion.maxHp=100000;minion.power=1;minion.speed=0;
 run(s,160);assert.ok(s.stats.archer!.structureDamage>0);assert.equal(s.metrics.invalidPositions,0);
});

test('SC10/12: any open lane unlocks guards; a low nexus beats pursuit behind the objective',()=>{
 const s=createCombat('open-finish',909);s.units=[];s.camps=[];s.nextWaveTick=Infinity;
 for(const t of s.structures)if(t.team==='B'&&(t.lane==='TOP'||t.kind==='GUARD')){t.hp=0;t.state='DEAD';}
 updateStructureProtection(s);const nexus=s.structures.find(t=>t.team==='B'&&t.kind==='NEXUS')!;assert.equal(nexus.protected,false);assert.ok(s.structures.some(t=>t.team==='B'&&t.lane==='BOTTOM'&&t.hp>0));
 const a=hero(s,'finisher','archer','A',1060,215);nexus.hp=20;
 const fleeing=hero(s,'fleeing','priest','B',1175,170);fleeing.hp=1;fleeing.power=0;fleeing.speed=0;
 run(s,120);assert.equal(s.winner,'A');assert.equal(nexus.hp,0);assert.ok(s.stats.finisher!.structureDamage>=20);
});

test('SC11/16: both spawn courtyards preserve all heroes with valid radius-aware positions',()=>{
 const s=createCombat('crowded-spawn',910);s.nextWaveTick=Infinity;
 for(const team of ['A','B']as const)for(let i=0;i<15;i++){const u=deployHero(s,{playerId:team+i,team,lane:i%2?'TOP':'BOTTOM',hero:{ownedHeroInstanceId:team+i,heroDefinitionId:i%3?'paladin':'guardian_golem',rarity:i%3?'COMMON':'ADVANCED',level:1,powerEnhancements:0,vitalityEnhancements:0,skillReadyAt:{},obtainedFrom:'STARTER'},sharedSkillReadyAt:{}});assert.ok(inLane(u,u.radius,u.lane!));}
 run(s,120);assert.equal(s.units.filter(u=>u.kind==='HERO').length,30);assert.equal(s.metrics.invalidPositions,0);assert.equal(s.metrics.stalledEvents,0);
});

test('SC14: root stops movement while a committed ranged attack still releases',()=>{
 const s=scene(911),a=hero(s,'rooted','archer','A',500),b=hero(s,'enemy','paladin','B',630);b.power=0;b.speed=0;run(s,1);
 applyStatus(s,a,'root',1000,0,source(b));const at={x:a.x,y:a.y};run(s,20);assert.ok(distance(a,at)<.01);assert.ok(s.stats.rooted!.heroDamage>0);assert.equal(a.hardCcImmuneUntilTick,0);
});

test('SC16: sub-pixel corridor gaps are never smoothed into an impassable direct route',()=>{
 const s=scene(912),a=hero(s,'edge-archer','archer','B',265.56035137695005,354.5857587268748);a.lateral=42;
 const destination={x:167.5926374748567,y:425.03931267465964};
 assert.equal(clearSegment(s,a,destination,a.radius,'TOP'),false);
 run(s,100);assert.ok(a.y>500,`No progress from formerly stuck corner: ${a.x},${a.y}`);assert.equal(s.metrics.invalidPositions,0);assert.equal(s.metrics.stalledEvents,0);
});

test('SC16: repeated microscopic crowd corrections cannot leave the exact corridor boundary',()=>{
 const s=scene(1021),u=hero(s,'edge-monk','monk','A',616.0908646280958,744.5650659951712);
 u.lane='MID';assert.equal(inLane(u,u.radius,'MID'),true);
 const outside={x:u.x,y:744.5650669885291};assert.equal(inLane(outside,u.radius,'MID'),false);
 assert.equal(clearSegment(s,u,outside,u.radius,'MID'),false);
 for(let i=0;i<200;i++){const p=safeMove(s,u,{x:u.x,y:u.y+.000001});u.x=p.x;u.y=p.y;assert.ok(inLane(u,u.radius,'MID'));}
});

test('COM02/03: a swept fast piercing projectile hits the first two small targets once each',()=>{
 const s=scene(1022),a=hero(s,'source','archer','A',400),targets=[500,550,600].map((x,i)=>hero(s,'small'+i,'archer','B',x));
 for(const u of [a,...targets]){u.speed=0;u.nextAiTick=1e9;u.nextBasicReadyTick=1e9;u.targetId=u===a?targets[0]!.entityId:a.entityId;u.armor=0;u.hp=u.maxHp=1000;}
 s.projectiles.push({entityId:'swept-pierce',source:{...source(a),power:100},targetId:targets[0]!.entityId,lastTarget:{x:600,y:210},direction:{x:1,y:0},x:450,y:210,speed:10000,radius:2,remaining:700,createdTick:0,effectId:'test-pierce',actionId:'swept-action',mode:'LINE',maxTargets:2,hitIds:[],payload:{skillId:null,coefficient:1,structureMultiplier:1},falloff:0,minFalloff:0});
 run(s,3);assert.deepEqual(targets.map(u=>u.hp),[900,900,1000]);const hits=s.events.filter(e=>e.type==='HIT'&&e.actionId==='swept-action');assert.deepEqual(hits.map(e=>e.targetEntityIds[0]),targets.slice(0,2).map(u=>u.entityId));
});

test('COM04: circle, rectangle and cone have positive and negative collision-radius boundaries',()=>{
 const s=scene(1023),u=hero(s,'edge','archer','B',530);u.radius=10;
 assert.equal(circleHits({x:500,y:210},20,u),true);u.x+=.01;assert.equal(circleHits({x:500,y:210},20,u),false);
 Object.assign(u,{x:550,y:230});assert.equal(rectangleHits({x:500,y:210},{x:1,y:0},50,20,u),true);u.y+=.01;assert.equal(rectangleHits({x:500,y:210},{x:1,y:0},50,20,u),false);
 Object.assign(u,{x:550,y:210});assert.equal(coneHits({x:500,y:210},{x:1,y:0},40,60,u),true);u.x+=.01;assert.equal(coneHits({x:500,y:210},{x:1,y:0},40,60,u),false);Object.assign(u,{x:500,y:250});assert.equal(coneHits({x:500,y:210},{x:1,y:0},80,60,u),false);
});

test('COM05: a flurry target leaving after its first hit receives no remaining out-of-range hits',()=>{
 const s=scene(1024),a=hero(s,'brawler','brawler','A',500,210,2),b=hero(s,'moving','paladin','B',535);b.speed=0;b.power=0;b.hp=b.maxHp=10000;a.speed=0;a.nextBasicReadyTick=1e9;
 while(s.tick<40&&!s.events.some(e=>e.type==='HIT'&&e.effectId==='brawler.flurry'))stepCombat(s);
 assert.ok(s.events.some(e=>e.type==='HIT'&&e.effectId==='brawler.flurry'));const hp=b.hp;b.x=900;run(s,40);assert.equal(b.hp,hp);
});

test('COM07/08: structures reject control effects and forced movement cannot cross a live tower',()=>{
 const s=scene(1025),a=hero(s,'pushed','paladin','A',580),t=tower(s,650);t.power=0;
 for(const type of ['stun','airborne','root','slow','taunt','silence'])applyStatus(s,t,type,1000,.5,source(a));assert.equal(t.statuses.length,0);
 a.forcedMove={direction:{x:1,y:0},remaining:200,speed:1000,untilTick:20};
 for(let i=0;i<20;i++){stepCombat(s);assert.ok(walkable(s,a,a.radius,'TOP'));assert.ok(distance(a,t)>=a.radius+t.radius);}
 assert.equal(s.metrics.invalidPositions,0);
});

test('SC15: actual same-tick lethal projectiles destroy both nexuses once and freeze further results',()=>{
 const s=scene(1026),original=createCombat('draw-towers',1026);s.structures=original.structures.filter(u=>u.kind==='NEXUS');
 for(const n of s.structures){n.hp=1;n.armor=0;n.protected=false;const team=n.team==='A'?'B':'A';s.projectiles.push({entityId:'lethal-'+n.team,source:{entityId:'dead-'+team,deploymentId:'life-'+team,team,kind:'HERO',power:100,maxHp:100},targetId:n.entityId,lastTarget:{x:n.x,y:n.y},direction:{x:1,y:0},x:n.x-10,y:n.y,speed:400,radius:3,remaining:100,createdTick:0,effectId:'lethal',actionId:'lethal-'+team,mode:'HOMING',maxTargets:1,hitIds:[],payload:{skillId:null,coefficient:1,structureMultiplier:1},falloff:0,minFalloff:0});}
 run(s,1);assert.equal(s.winner,'DRAW');assert.equal(s.structures.filter(u=>u.hp===0).length,2);const state=JSON.stringify(s);stepCombat(s);assert.equal(JSON.stringify(s),state);
});

test('AI06/08: small score crossings do not churn an in-range committed target or move the archer',()=>{
 const s=scene(1027),a=hero(s,'archer','archer','A',500),b=hero(s,'near','paladin','B',620),c=hero(s,'other','paladin','B',625);
 for(const u of [b,c]){u.speed=0;u.power=0;u.hp=u.maxHp=10000;u.nextAiTick=1e9;u.targetId=a.entityId;}
 a.nextBasicReadyTick=1e9;run(s,1);const chosen=a.targetId,at={x:a.x,y:a.y};assert.ok(chosen);
 for(let i=0;i<60;i++){b.x=620+(i%2?2:0);c.x=620+(i%2?0:2);stepCombat(s);assert.equal(a.targetId,chosen);assert.ok(distance(a,at)<.01);}
});

test('AI10: an archer with no legal retreat still attacks without crossing the road edge',()=>{
 const s=scene(1028),a=hero(s,'corner','archer','A',600,162),b=hero(s,'threat','brawler','B',620,192);assert.ok(inLane(a,a.radius,'TOP'));b.speed=0;b.power=0;b.hp=b.maxHp=10000;
 run(s,160);assert.ok(s.stats.corner!.heroDamage>0);assert.equal(s.metrics.invalidPositions,0);assert.equal(s.metrics.stalledEvents,0);
});

test('COM16: shielding credits only actually absorbed damage across overlapping sources',()=>{
 const s=scene(1029),victim=hero(s,'victim','paladin','A',600),first=hero(s,'first','guardian_spirit','A',500),second=hero(s,'second','paladin','A',520),enemy=hero(s,'enemy','archer','B',700);
 for(const u of [victim,first,second,enemy]){u.speed=0;u.nextAiTick=1e9;u.nextBasicReadyTick=1e9;u.targetId=u.team==='A'?enemy.entityId:victim.entityId;}victim.armor=0;
 victim.shields=[{sourceId:'one',sourcePlayerId:'first',amount:100,untilTick:200,seq:1},{sourceId:'two',sourcePlayerId:'second',amount:100,untilTick:200,seq:2}];victim.shield=200;
 s.projectiles.push({entityId:'shield-hit',source:{...source(enemy),power:30},targetId:victim.entityId,lastTarget:{x:victim.x,y:victim.y},direction:{x:-1,y:0},x:610,y:210,speed:400,radius:3,remaining:100,createdTick:0,effectId:'test',actionId:'shield-hit',mode:'HOMING',maxTargets:1,hitIds:[],payload:{skillId:null,coefficient:1,structureMultiplier:1},falloff:0,minFalloff:0});
 run(s,2);assert.equal(s.stats.first!.shielding,30);assert.equal(s.stats.second!.shielding,0);assert.equal(victim.shield,170);assert.equal(victim.hp,victim.maxHp);assert.equal(s.stats.enemy!.heroDamage,0);
});

test('SC06: multiple cryomancers and golems apply real control, with cleanse and no hard-CC chain above two seconds',()=>{
 const s=scene(1030),casters=[hero(s,'ice1','cryomancer','B',490,190,5),hero(s,'ice2','cryomancer','B',490,230,5),hero(s,'golem1','guardian_golem','B',550,190,5),hero(s,'golem2','guardian_golem','B',550,230,5)];
 const allies=[hero(s,'patient1','paladin','A',590,185,1),hero(s,'patient2','archer','A',610,235,1),hero(s,'cleanser','monk','A',630,210,5)];
 for(const u of [...casters,...allies]){u.hp=u.maxHp=100000;u.speed=0;}
 const chain=new Map<string,number>(),casts=new Set<string>();let longest=0,sawCC=false;
 for(let i=0;i<300;i++){stepCombat(s);for(const e of s.events){if(e.type==='SKILL_CAST')casts.add(String(e.params.skillId));if(e.type==='CC')sawCC=true;}for(const u of allies){const value=u.statuses.some(x=>['stun','airborne'].includes(x.type)&&x.untilTick>s.tick)?(chain.get(u.entityId)??0)+1:0;chain.set(u.entityId,value);longest=Math.max(longest,value);}}
 assert.ok(sawCC);assert.ok(casts.has('monk.cleansing_bell'));assert.ok([...casts].some(id=>id.startsWith('cryomancer.')));assert.ok([...casts].some(id=>id.startsWith('guardian_golem.')));assert.ok(longest<=40);assert.equal(s.metrics.invalidPositions,0);
});

test('SC11/AI17: units from both outer lanes fight together inside a base with real volleys and persistent areas',()=>{
 const s=scene(1031),allies=[hero(s,'top-front','paladin','A',1035,220,5),hero(s,'bottom-front','swordsman','A',1050,255,5),hero(s,'top-range','archer','A',1010,240,5),hero(s,'bottom-mage','pyromancer','A',1030,275,5)];
 allies[1]!.lane=allies[3]!.lane='BOTTOM';
 for(let i=0;i<4;i++){const enemy=hero(s,'defender'+i,i%2?'priest':'paladin','B',1100+(i%2)*25,220+Math.floor(i/2)*30,5);enemy.lane=i%2?'BOTTOM':'TOP';enemy.hp=enemy.maxHp=10000;}
 let volley=false,area=false;for(let i=0;i<240;i++){stepCombat(s);volley ||= s.events.some(e=>e.type==='PROJECTILE_SPAWN');area ||= s.events.some(e=>e.type==='AREA_CREATED');}assert.ok(allies.filter(u=>u.lane==='TOP').some(u=>s.stats[u.ownerPlayerId!]!.heroDamage>0));assert.ok(allies.filter(u=>u.lane==='BOTTOM').some(u=>s.stats[u.ownerPlayerId!]!.heroDamage>0));assert.ok(volley);assert.ok(area);assert.equal(s.metrics.invalidPositions,0);assert.equal(s.metrics.stalledEvents,0);
});

test('SC14: silence blocks new active skills while basic attacks remain available',()=>{
 const s=scene(1032),a=hero(s,'silenced','pyromancer','A',500,210,5),b=hero(s,'enemy1','paladin','B',610),c=hero(s,'enemy2','paladin','B',635,230);for(const u of[b,c]){u.hp=u.maxHp=10000;u.speed=0;u.power=0;}
 applyStatus(s,a,'silence',5000,0,source(b));run(s,80);assert.equal(s.events.filter(e=>e.type==='SKILL_CAST'&&e.sourceEntityId===a.entityId).length,0);assert.ok(s.stats.silenced!.heroDamage>0);assert.ok(s.events.some(e=>e.type==='ATTACK_START'&&e.sourceEntityId===a.entityId));
});

test('SC05: a legal assassin leap reaches the backline and triggers nearby monk protection',()=>{
 const s=scene(1033),a=hero(s,'diver','assassin','A',500,210,5),priest=hero(s,'priest','priest','B',615,210,5),monk=hero(s,'monk','monk','B',610,245,5),tank=hero(s,'tank','paladin','B',585,180,5);
 for(const u of [a,priest,monk,tank])u.hp=u.maxHp=10000;
 run(s,160);assert.ok(s.events.some(e=>e.type==='SKILL_CAST'&&e.params.skillId==='assassin.shadow_leap'));assert.ok(a.x>550);assert.ok(s.events.some(e=>e.type==='SKILL_CAST'&&e.params.skillId==='monk.repelling_staff'));assert.equal(s.metrics.invalidPositions,0);
});

test('SC09: after an escort dies the surviving ranged hero leaves unsafe tower range',()=>{
 const s=scene(1034),a=hero(s,'archer','archer','A',410),t=tower(s,650),escort=hero(s,'escort','paladin','A',605);a.hp=a.maxHp=10000;t.hp=t.maxHp=100000;
 escort.kind='MELEE_MINION';escort.heroDefinitionId=undefined;escort.role='melee';escort.hp=escort.maxHp=100000;escort.power=0;escort.speed=0;
 run(s,160);assert.ok(s.stats.archer!.structureDamage>0);escort.hp=0;escort.state='DEAD';escort.deathTick=s.tick;run(s,200);
 assert.ok(a.hp>0);assert.ok(gap(a,t)>=t.range,`unsafe gap ${gap(a,t)}`);assert.equal(s.metrics.invalidPositions,0);assert.equal(s.metrics.stalledEvents,0);
});

test('COM10/11: a tower switches from minion to the hero damaging its defender and releases committed shots',()=>{
 const s=scene(1035),a=hero(s,'attacker','archer','A',475),defender=hero(s,'defender','paladin','B',600,190),escort=hero(s,'escort','paladin','A',605,230),t=tower(s,650);
 for(const u of [a,defender,escort]){u.hp=u.maxHp=10000;u.speed=0;}defender.power=0;escort.power=0;escort.kind='MELEE_MINION';escort.heroDefinitionId=undefined;
 run(s,100);const starts=s.events.filter(e=>e.type==='ATTACK_START'&&e.sourceEntityId===t.entityId),shots=s.events.filter(e=>e.type==='PROJECTILE_SPAWN'&&e.sourceEntityId===t.entityId);
 assert.equal(starts[0]?.targetEntityIds[0],escort.entityId);assert.ok(s.stats.attacker!.heroDamage>0);assert.ok(starts.slice(1).some(e=>e.targetEntityIds[0]===a.entityId));assert.ok(shots.length>=3);assert.ok(shots.every(e=>starts.some(start=>start.actionId===e.actionId)));assert.equal(s.metrics.invalidPositions,0);
});
