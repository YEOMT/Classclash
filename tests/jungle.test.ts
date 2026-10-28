import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createCombat,deployHero,stepCombat} from '../src/server/combat.js';
import {jungleIntent,lanePressure} from '../src/server/jungle.js';
import {JUNGLE_CAMPS,LANES} from '../src/shared/battle-map.js';
import {JUNGLE_BALANCE} from '../src/shared/jungle-balance.js';
import {findLocalPath,clearSegment} from '../src/server/combat-geometry.js';
import {CHAMPION_ART,sampleChampion} from '../src/client/champion-animation.js';
import type {OwnedHero,Team,Position} from '../src/shared/types.js';
import {setupBots,progressToBattle} from '../scripts/simulate.js';
import {createRoom,addPlayer,tickRoom,directCommand} from '../src/server/room.js';

const owned:OwnedHero={ownedHeroInstanceId:'j-hero',heroDefinitionId:'paladin',rarity:'COMMON',level:1,powerEnhancements:0,vitalityEnhancements:0,skillReadyAt:{},obtainedFrom:'STARTER'};
const deploy=(s:ReturnType<typeof createCombat>,team:Team='A',lane:Position='JUNGLE',id='jungler')=>deployHero(s,{team,lane,playerId:id,hero:{...owned,ownedHeroInstanceId:id},sharedSkillReadyAt:{}});
test('30 ordinary bots reserve all four positions; living players cannot change position',()=>{
 const r=setupBots(72);progressToBattle(r);
 for(const team of ['A','B']){const players=r.players.filter(p=>p.team===team);for(const pos of ['TOP','MID','BOTTOM','JUNGLE'])assert.ok(players.some(p=>p.selectedLane===pos),team+pos);assert.ok(players.filter(p=>p.selectedLane==='JUNGLE').length<=3);}
 const p=r.players[0]!;const old=p.selectedLane;
 assert.equal(directCommand(r,p.playerId,'SELECT_HERO_AND_LANE',{ownedHeroInstanceId:p.selectedOwnedHeroId,lane:old==='MID'?'JUNGLE':'MID'}).status,'REJECTED');assert.equal(p.selectedLane,old);
});
test('AI preparation tolerates a human who has not chosen a starter yet',()=>{
 const r=createRoom('JWAIT','host',1,true);directCommand(r,'host','ADD_BOTS',{count:29,profile:'STANDARD'});addPlayer(r,'아직 고르는 학생','human');directCommand(r,'host','START_OPENING_QUIZ');directCommand(r,'host','CLOSE_OPENING_QUIZ');
 for(let i=0;i<400;i++)tickRoom(r);assert.ok(r.players.filter(p=>p.isBot).every(p=>p.state==='READY'));assert.equal(r.players.find(p=>!p.isBot)!.inventory.length,0);
});
test('large heroes behind the northeast nexus have a complete escape route',()=>{
 const s=createCombat('behind-nexus',72),u=deploy(s,'B');u.radius=18;Object.assign(u,{x:1194,y:114});
 const goal={x:780,y:330},route=findLocalPath(s,u,goal);assert.deepEqual(route.at(-1),goal);let at={x:u.x,y:u.y};for(const p of route){assert.ok(clearSegment(s,at,p,u.radius,'MID'));at=p;}
});
test('every camp has a collision-safe route from both bases',()=>{
 for(const team of ['A','B'] as const){const s=createCombat('routes-'+team,42),u=deploy(s,team);
  for(const camp of JUNGLE_CAMPS){const route=findLocalPath(s,u,camp);assert.ok(route.length,camp.id);assert.ok(Math.hypot(route.at(-1)!.x-camp.x,route.at(-1)!.y-camp.y)<2,camp.id);let at={x:u.x,y:u.y};for(const p of route){assert.ok(clearSegment(s,at,p,u.radius,'MID'));at=p;}}
 }
});
test('jungler clears its own camps before considering enemy camps or an empty lane',()=>{
 const s=createCombat('policy',9),u=deploy(s);s.units=s.units.filter(v=>v.kind==='MONSTER'||v===u);
 for(let i=0;i<3;i++){jungleIntent(s,u);const c=s.camps!.find(c=>c.id===u.jungle!.campId)!;assert.equal(c.homeTeam,'A');s.units.find(m=>m.entityId===c.entityId)!.hp=0;c.entityId=null;s.tick+=21;}
 jungleIntent(s,u);assert.equal(u.jungle!.stage,'GANK');assert.ok(u.jungle!.assistLane);assert.equal(u.jungle!.visited.length,3);
});
test('balanced lanes permit invasion; respawned home camps start a new route',()=>{
 const s=createCombat('invade',9),u=deploy(s);u.jungle!.visited=JUNGLE_CAMPS.filter(c=>c.homeTeam==='A').map(c=>c.id);
 for(const lane of LANES){deploy(s,'A',lane,'a'+lane);deploy(s,'B',lane,'b'+lane);}
 jungleIntent(s,u);assert.equal(lanePressure(s,'A',u.entityId)[0]!.need,0);assert.equal(u.jungle!.stage,'INVADE');assert.ok(u.jungle!.campId?.startsWith('B-'));
 s.tick=u.jungle!.commitUntilTick+1;jungleIntent(s,u);assert.equal(u.jungle!.stage,'HOME');assert.ok(u.jungle!.campId?.startsWith('A-'));
});
test('junglers clearing camps do not count as defenders of the middle lane',()=>{
 const s=createCombat('pressure',12),u=deploy(s);deploy(s,'A','JUNGLE','other-jungler');
 deploy(s,'B','MID','enemy-one');deploy(s,'B','MID','enemy-two');
 const pressure=lanePressure(s,'A',u.entityId);assert.equal(pressure[0]!.lane,'MID');assert.equal(pressure[0]!.friends,0);
});
test('low health chooses recovery, and a recovered jungler resumes home clearing',()=>{
 const s=createCombat('recover',9),u=deploy(s);u.hp=u.maxHp*.2;const intent=jungleIntent(s,u);assert.equal(u.jungle!.stage,'RECOVER');assert.equal(intent.targetId,null);assert.ok(intent.goal);
 u.hp=u.maxHp*.9;s.tick+=60;jungleIntent(s,u);assert.equal(u.jungle!.stage,'HOME');
});
test('ordinary level-1 jungler walks to a camp and earns a real kill without quiz currency',()=>{
 const s=createCombat('real-camp',87),u=deploy(s);s.units=s.units.filter(v=>v.kind==='MONSTER'||v===u);s.nextWaveTick=1e9;
 let cleared=false;for(let i=0;i<2400&&!cleared;i++){stepCombat(s);cleared=s.events.some(e=>e.type==='CAMP_CLEARED');}
 assert.ok(cleared,JSON.stringify({x:u.x,y:u.y,reason:u.debugReason,jungle:u.jungle,hp:u.hp}));assert.ok(u.hp>0);assert.equal(s.teamKills.A,0);assert.equal(s.stats.jungler!.kills,0);assert.ok(u.statuses.some(x=>x.type==='jungleHaste'));assert.equal(s.metrics.invalidPositions,0);
 const camp=s.camps!.find(c=>!c.entityId)!;assert.equal(camp.respawnTick,s.tick+JUNGLE_BALANCE.respawnTicks);
});
test('all 18 attached atlases have valid clips, pixels and server-timed attack release',()=>{
 assert.equal(Object.keys(CHAMPION_ART).length,18);
 for(const [id,spec]of Object.entries(CHAMPION_ART)){const png=fs.readFileSync('public'+spec.sheet);assert.equal(png.readUInt32BE(16),spec.width);assert.equal(png.readUInt32BE(20),spec.height);
  for(const name of Object.values(spec.clips)){assert.ok(spec.anims[name]!.frames.length>=1);for(const f of spec.anims[name]!.frames){const r=f.data;assert.ok(f.duration>0&&r.x>=0&&r.y>=0&&r.x+r.w<=spec.width&&r.y+r.h<=spec.height,id+name);}}
  const s=createCombat(id,7),u=deploy(s);u.heroDefinitionId=id;u.action={id:'a',origin:{x:0,y:0},processedHits:[],hitIds:[],source:{entityId:u.entityId,deploymentId:u.deploymentId,team:u.team,kind:u.kind,power:u.power,maxHp:u.maxHp},skillId:null,startTick:10,impactTicks:[16],processedImpacts:[],recoveryEndTick:22,targetIds:[],point:{x:0,y:0},direction:{x:1,y:0},cancelled:false} as NonNullable<typeof u.action>;
  assert.equal(sampleChampion(u,16).clip,spec.clips.attack);assert.ok(sampleChampion(u,15.99).index<sampleChampion(u,16).index);
 }
});
