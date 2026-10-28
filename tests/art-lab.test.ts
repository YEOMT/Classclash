import test from 'node:test';
import assert from 'node:assert/strict';
import {createArtFixture,advanceArtFixture,ART_HEROES} from '../src/client/art-lab-fixture.js';
import {HERO_BY_ID,heroStats} from '../src/shared/heroes.js';

test('art QA fixture exercises all six real skills, movement, hits, projectiles and deaths',()=>{
 const {state}=createArtFixture(),skills=new Set<string>(),types=new Set<string>();let lastSeq=0,moved=false;
 for(const u of state.units.filter(u=>u.kind==='HERO')){const expected=heroStats(u.heroDefinitionId!,5);assert.equal(u.power,expected.power);assert.equal(u.maxHp,expected.hp);}
 for(let i=0;i<900;i++){
  advanceArtFixture(state);
  moved ||=state.units.some(u=>u.kind==='HERO'&&Math.hypot(u.vx,u.vy)>1);
  for(const e of state.events){if(e.eventSeq<=lastSeq)continue;lastSeq=e.eventSeq;types.add(e.type);if(e.type==='SKILL_CAST')skills.add(String(e.params.skillId));}
 }
 for(const id of ART_HEROES)for(const skillId of HERO_BY_ID[id]!.skillIds)assert.ok(skills.has(skillId),skillId);
 for(const type of ['HIT','DEATH','ATTACK_START','PROJECTILE_SPAWN','SHIELD','CC'])assert.ok(types.has(type),type);
 assert.ok(moved);assert.equal(state.metrics.invalidPositions,0);
});

test('stress fixture starts with 30 ordinary heroes and 168 minions and keeps server geometry valid',()=>{
 const {state,players}=createArtFixture(true);assert.equal(players.length,30);
 assert.equal(state.units.filter(u=>u.kind==='HERO').length,30);
 assert.equal(state.units.filter(u=>u.kind.endsWith('MINION')).length,168);
 assert.equal(new Set(state.units.filter(u=>u.kind==='HERO').map(u=>u.heroDefinitionId)).size,18);
 for(let i=0;i<600;i++)advanceArtFixture(state);
 assert.equal(state.metrics.invalidPositions,0);
 assert.ok(state.eventSeq>100);
});
