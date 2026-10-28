import test from 'node:test';
import assert from 'node:assert/strict';
import {displayUnitNumbers,snapshotEncoder} from '../src/server/wire-projection.js';
import {createRoom,addPlayer,snapshot} from '../src/server/room.js';
import {createCombat} from '../src/server/combat.js';
import type {CombatEvent} from '../src/shared/combat-types.js';
test('display precision bounds wire error without changing authoritative values or event/action timing',()=>{
  const action={startTick:123,impactTicks:[128,134],point:{x:123.123456789,y:234.234567891}},statuses=[{remaining:42.123456789}];
  const unit=Object.freeze({x:123.123456789,y:-234.234567891,previousX:120.99999,previousY:234.00001,vx:13.123456789,vy:-20.234567891,hp:123.123456789,maxHp:1000,shield:.0001,facingX:.70710678118,facingY:-.70710678118,action,statuses,actionStartTick:123,impactTick:128,recoveryEndTick:139,damage:88.888888888,range:432.123456789});
  const before=structuredClone(unit),wire=displayUnitNumbers(unit);
  assert.deepEqual(unit,before);assert.notEqual(wire,unit);
  for(const key of ['x','y','previousX','previousY','vx','vy','hp'])assert.ok(Math.abs(Number(wire[key])-Number(unit[key as keyof typeof unit]))<=.005000001);
  assert.ok(Math.abs(Number(wire.facingX)-unit.facingX)<=.00005);assert.ok(Math.abs(Number(wire.facingY)-unit.facingY)<=.00005);
  assert.equal(wire.shield,.01);assert.equal(wire.action,action);assert.equal(wire.statuses,statuses);
  assert.equal(wire.impactTick,unit.impactTick);assert.equal(wire.damage,unit.damage);assert.equal(wire.range,unit.range);
  assert.ok(JSON.stringify(wire).length<JSON.stringify(unit).length);
});
test('positive sub-hundredth health remains visibly alive while zero and dead health stay zero',()=>{
  assert.equal(displayUnitNumbers({hp:.00001}).hp,.01);assert.equal(displayUnitNumbers({hp:0}).hp,0);
  assert.deepEqual(displayUnitNumbers({entityId:'only-id'}),{entityId:'only-id'});
});
test('shared battle serialization equals ordinary JSON for each cursor and preserves distinct private snapshots',()=>{
  const room=createRoom('WIREJS','host'),a=addPlayer(room,'student A','hash-a'),b=addPlayer(room,'student B','hash-b');
  a.gold=7;b.gold=19;room.matchId='wire-match';room.tick=400;room.combat=createCombat(room.matchId,123,room.tick);
  room.combat.events=[1,2,3].map((eventSeq):CombatEvent=>({eventId:'event-'+eventSeq,eventSeq,matchId:room.matchId!,tick:eventSeq===1?100:399,type:'HIT',x:123.123456789,y:42,sourceEntityId:'source',targetEntityIds:['target'],actionId:'attack',effectId:'arrow',params:{damage:12.3456789}}));
  const battle=snapshot(room,'host').battle!,encode=snapshotEncoder(battle,room.tick),before=structuredClone(battle);
  for(const [player,cursor,seq] of [[a,0,10],[b,2,11],[a,2,12],[b,0,13]] as const){
    const privateState=snapshot(room,player.playerId,seq,false),actual=JSON.parse(encode(privateState,cursor));
    const expected={type:'SNAPSHOT',snapshot:{...privateState,battle:{...battle,events:battle.events.filter(e=>e.eventSeq>cursor&&e.tick>=room.tick-200)}}};
    assert.deepEqual(actual,JSON.parse(JSON.stringify(expected)));assert.equal(actual.snapshot.self.gold,player.gold);assert.equal(actual.snapshot.self.playerId,player.playerId);assert.equal(actual.snapshot.snapshotSeq,privateState.snapshotSeq);
  }
  assert.deepEqual(battle,before);
  const next=snapshotEncoder(null,room.tick+1),decoded=JSON.parse(next(snapshot(room,a.playerId,14,false),0));assert.equal(decoded.snapshot.battle,null);
});
