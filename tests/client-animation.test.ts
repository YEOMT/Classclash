import test from 'node:test';
import assert from 'node:assert/strict';
import { createCombat, deployHero } from '../src/server/combat.js';
import { HERO_BY_ID, SKILLS } from '../src/shared/heroes.js';
import type { Action, CombatUnit } from '../src/shared/combat-types.js';
import { sampleHeroAnimation } from '../src/client/hero-animation.js';
import {heroAtlasPose,heroAtlasRect,HERO_ATLAS} from '../src/client/hero-atlas.js';

function unit(heroId: string) {
  const state = createCombat('animation-clock', 7);
  const hero = deployHero(state, { playerId: heroId, team: 'A', lane: 'TOP',
    hero: { ownedHeroInstanceId: heroId, heroDefinitionId: heroId, rarity: HERO_BY_ID[heroId]!.rarity,
      level: 5, powerEnhancements: 0, vitalityEnhancements: 0, skillReadyAt: {}, obtainedFrom: 'STARTER' },
    sharedSkillReadyAt: {} });
  hero.state = 'HOLD';
  return hero;
}
function action(hero: CombatUnit, skillId: string | null) {
  const definition = skillId ? SKILLS[skillId]! : undefined;
  const times = definition?.hitTimesMs ?? [hero.windupMs];
  const startTick = 100;
  const first = times[0]!;
  const persistent = definition && ['persistent_area', 'persistent_rectangle', 'heal_area', 'chain'].includes(definition.kind);
  const duration = definition?.totalLockMs ?? ((persistent ? first : times.at(-1)!) + (definition?.recoveryMs ?? hero.recoveryMs));
  hero.action = { startTick, skillId, impactTicks: times.map(time => startTick + Math.ceil(time / 50)),
    recoveryEndTick: startTick + Math.ceil(duration / 50) } as Action;
  return hero.action;
}

test('authored contact frame starts exactly at each authoritative basic and skill release', () => {
  for (const id of Object.keys(HERO_BY_ID)) {
    const hero = unit(id);
    for (const skillId of [null, ...HERO_BY_ID[id]!.skillIds]) {
      const timeline = action(hero, skillId), release = timeline.impactTicks[0]!, pose = skillId === HERO_BY_ID[id]!.skillIds[1] ? 3 : 2;
      assert.equal(sampleHeroAnimation(hero, release - .01).frame, pose - 1, `${id}/${skillId} windup`);
      assert.equal(sampleHeroAnimation(hero, release).frame, pose, `${id}/${skillId} release`);
      assert.ok(sampleHeroAnimation(hero, timeline.recoveryEndTick).frame >= pose, 'recovery never returns to pre-hit pose');
    }
  }
});
test('all gameplay headings resolve to a valid shared raster pose without changing release timing',()=>{
 const hero=unit('archer');const timeline=action(hero,null);
 for(let dir=0;dir<8;dir++){
  const angle=Math.PI/2-dir*Math.PI/4;hero.facingX=Math.cos(angle);hero.facingY=Math.sin(angle);
  const sample=sampleHeroAnimation(hero,timeline.impactTicks[0]!);const atlas=heroAtlasPose(sample),r=heroAtlasRect(atlas.pose);
  assert.equal(atlas.pose,8);assert.equal(atlas.mirror,dir>=5);
  assert.ok(r.x>=0&&r.y>=0&&r.x+r.w<=HERO_ATLAS.width&&r.y+r.h<=HERO_ATLAS.height);
 }
});
test('flurry alternates all three authored extended fists at its actual hit ticks', () => {
  const hero = unit('brawler'), timeline = action(hero, 'brawler.flurry');
  assert.deepEqual(timeline.impactTicks.map(tick => sampleHeroAnimation(hero, tick).frame), [2, 3, 4]);
  assert.equal(sampleHeroAnimation(hero, timeline.recoveryEndTick - .01).frame, 5);
});
test('rune projectiles and fissure segments advance only at their server impact ticks',()=>{
 for(const [id,skill] of [['rune_mage','rune_mage.triple_rune'],['ancient_one','ancient_one.primordial_fissure'],['assassin','assassin.vital_combo']]){
  const hero=unit(id!),timeline=action(hero,skill!);const first=skill===HERO_BY_ID[id!]!.skillIds[1]?3:2;
  assert.deepEqual(timeline.impactTicks.map(tick=>sampleHeroAnimation(hero,tick).frame),[first,first+1,first+2]);
  assert.equal(sampleHeroAnimation(hero,timeline.impactTicks[1]!-.01).frame,first);
 }
});
test('flame wall releases once and recovers independently of future damage pulses', () => {
  const hero = unit('pyromancer'), timeline = action(hero, 'pyromancer.flame_wall');
  assert.ok(timeline.impactTicks.at(-1)! > timeline.recoveryEndTick);
  assert.equal(sampleHeroAnimation(hero, timeline.impactTicks[0]!).frame, 3);
  assert.equal(sampleHeroAnimation(hero, timeline.recoveryEndTick).frame, 7);
});
test('moving hurt pose is visible without interrupting the clock of a committed attack', () => {
  const hero = unit('paladin');hero.state = 'ADVANCE';hero.vx = 58;
  assert.equal(sampleHeroAnimation(hero, 101, 100).state, 'hurt');
  assert.equal(sampleHeroAnimation(hero, 104, 100).state, 'walk');
  const timeline = action(hero, null);
  assert.equal(sampleHeroAnimation(hero, timeline.impactTicks[0]!, timeline.impactTicks[0]!).state, 'basicAttack');
  assert.equal(sampleHeroAnimation(hero, timeline.impactTicks[0]!, timeline.impactTicks[0]!).frame, 2);
});
test('all eight facing directions keep a stable atlas cell and death takes priority', () => {
  const hero = unit('pyromancer');
  for (let direction = 0; direction < 8; direction++) {
    const angle = Math.PI / 2 - direction * Math.PI / 4;hero.facingX = Math.cos(angle);hero.facingY = Math.sin(angle);
    const sample = sampleHeroAnimation(hero, 100);
    assert.equal(sample.direction, direction);assert.ok(sample.index >= 0 && sample.index < 288);
  }
  hero.state = 'DEAD';hero.deathTick = 100;action(hero, null);
  assert.equal(sampleHeroAnimation(hero, 100, 100).state, 'death');
  assert.equal(sampleHeroAnimation(hero, 200).frame, 4);
});
