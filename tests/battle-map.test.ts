import test from 'node:test';
import assert from 'node:assert/strict';
import defaults from '../docs/specification/balance.defaults.json';
import balance from '../src/shared/balance.js';
import { BATTLE_MAP, MAP_BOUNDS } from '../src/shared/battle-map.js';
import { createCombat, deployHero, stepCombat } from '../src/server/combat.js';
import { clearSegment, findLocalPath, inLane, lanePath, pointOnPath, walkable } from '../src/server/combat-geometry.js';
import type { OwnedHero } from '../src/shared/types.js';

const paladin: OwnedHero = {ownedHeroInstanceId:'map-target',heroDefinitionId:'paladin',rarity:'COMMON',level:1,powerEnhancements:0,vitalityEnhancements:0,skillReadyAt:{},obtainedFrom:'STARTER'};

test('LOL map has three connected lanes, six lane towers per team and diagonal bases',()=>{
 assert.equal(BATTLE_MAP.width,1280);assert.equal(BATTLE_MAP.height,1280);assert.equal(balance.map,BATTLE_MAP);
 assert.deepEqual(Object.keys(BATTLE_MAP.pathsAtoB),['TOP','MID','BOTTOM']);
 for(const team of ['A','B']){assert.equal(BATTLE_MAP.structures.filter(s=>s.team===team&&s.lane).length,6);assert.equal(BATTLE_MAP.structures.filter(s=>s.team===team&&s.kind==='GUARD').length,2);}
 for(const lane of ['TOP','MID','BOTTOM'] as const){const path=lanePath(lane),total=path.slice(1).reduce((n,p,i)=>n+Math.hypot(p.x-path[i]!.x,p.y-path[i]!.y),0);
 for(let at=0;at<total;at+=8){const a=pointOnPath(at,lane,'A'),b=pointOnPath(total-at,lane,'B');assert.ok(inLane(a,12,lane));assert.ok(Math.hypot(a.x-b.x,a.y-b.y)<1e-7);}
 }
 assert.equal(inLane({x:20,y:20},12,'TOP'),false);assert.equal(inLane({x:640,y:640},12,'MID'),true);assert.equal(inLane({x:600,y:130},12,'TOP'),false);
});

test('every tower and nexus uses the declared symmetric 0.2 durability with other stats preserved',()=>{
  const durability={OUTER:7500,INNER:10000,GUARD:7500,NEXUS:10000};
  const s=createCombat('v02-structures',78);
  for(const u of s.structures){
    const kind=u.kind as keyof typeof durability;
    assert.equal(u.maxHp,durability[kind]);assert.equal(u.hp,u.maxHp);
    const old=defaults.structureStats[kind];
    assert.equal(u.armor,old.armor);assert.equal(u.power,old.power);assert.equal(u.radius,old.radius);
  }
});

test('every spawned minion uses 60% less power while attack timing and other stats stay unchanged', () => {
  const state=createCombat('weaker-minions',7002);
  for (const unit of state.units.filter(u=>u.kind.includes('MINION'))) {
    const old=unit.kind==='MELEE_MINION'?defaults.minions.melee:defaults.minions.ranged;
    assert.ok(Math.abs(unit.power-old.power*.4)<1e-12);
    for (const key of ['hp','armor','speed','range','windupMs','recoveryMs','attackIntervalMs','radius'] as const)assert.equal(unit[key],old[key]);
  }
  assert.equal(state.units.filter(u=>u.kind.includes('MINION')).length,42);
  assert.equal(state.nextWaveTick,700);
});

test('real melee strikes and ranged projectiles resolve at 40% of previous base damage', () => {
  for (const kind of ['MELEE_MINION','RANGED_MINION'] as const) {
    const state=createCombat(`weak-hit-${kind}`,7003),attacker=state.units.find(u=>u.kind===kind&&u.team==='A'&&u.lane==='TOP')!;
    state.units=[attacker];state.structures=[];state.nextWaveTick=Number.MAX_SAFE_INTEGER;state.events=[];
    const target=deployHero(state,{playerId:'target',team:'B',lane:'TOP',hero:paladin,sharedSkillReadyAt:{}});
    Object.assign(target,{x:1000,y:224,previousX:1000,previousY:224,armor:0,power:0,speed:0,nextBasicReadyTick:Number.MAX_SAFE_INTEGER,nextAiTick:Number.MAX_SAFE_INTEGER,state:'HOLD'});
    const attackX=target.x-target.radius-attacker.radius-(kind==='MELEE_MINION'?4:70);
    Object.assign(attacker,{x:attackX,y:224,previousX:attackX,previousY:224,createdTick:-10,speed:0,nextAiTick:0,nextBasicReadyTick:0,state:'HOLD'});
    const hp=target.hp;
    for(let i=0;i<20&&target.hp===hp;i++)stepCombat(state);
    const old=kind==='MELEE_MINION'?defaults.minions.melee:defaults.minions.ranged;
    assert.ok(Math.abs((hp-target.hp)-old.power*.4)<1e-9,`${kind} damage ${hp-target.hp}`);
    const start=state.events.find(e=>e.type==='ATTACK_START'&&e.sourceEntityId===attacker.entityId);
    const hit=state.events.find(e=>e.type==='HIT'&&e.sourceEntityId===attacker.entityId);
    assert.ok(start&&hit,'normal attack pipeline emits both start and hit');
    assert.ok(hit.tick>=Number(start.params.impactTick));
    assert.equal(state.metrics.invalidPositions,0);
  }
});
