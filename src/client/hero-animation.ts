import type { CombatUnit } from '../shared/combat-types.js';
import { HERO_BY_ID } from '../shared/heroes.js';

export type HeroAnimation = 'idle' | 'walk' | 'basicAttack' | 'skill1' | 'skill2' | 'hurt' | 'death' | 'spawn';
/** Logical timeline slots. hero-atlas maps the eight gameplay headings to the
 * acquired side-facing raster poses; gameplay directions remain unchanged. */
export const HERO_ANIMATIONS: Record<HeroAnimation, { start: number; count: number }> = {
  idle: { start: 0, count: 2 }, walk: { start: 2, count: 4 },
  basicAttack: { start: 6, count: 6 }, skill1: { start: 12, count: 6 },
  skill2: { start: 18, count: 8 }, hurt: { start: 26, count: 2 },
  death: { start: 28, count: 5 }, spawn: { start: 33, count: 3 },
};

/** Samples the server action clock; it never schedules or changes a gameplay hit. */
export function sampleHeroAnimation(unit: CombatUnit, tick: number, hurtTick = -Infinity) {
  let state: HeroAnimation = 'idle';
  let frame = 0;
  if (unit.state === 'DEAD') {
    state = 'death';
    frame = Math.min(4, Math.floor(Math.max(0, tick - (unit.deathTick ?? tick)) / 2.5));
  } else if (unit.state === 'SPAWNING') {
    state = 'spawn';
    frame = Math.min(2, Math.floor(Math.max(0, tick - unit.createdTick) / 2));
  } else if (unit.action && !unit.action.cancelled) {
    const action = unit.action;
    state = action.skillId
      ? HERO_BY_ID[unit.heroDefinitionId ?? '']?.skillIds[1] === action.skillId ? 'skill2' : 'skill1'
      : 'basicAttack';
    const impactPose = state === 'skill2' ? 3 : 2;
    const impactTick = action.impactTicks[0] ?? unit.impactTick;
    const count = HERO_ANIMATIONS[state].count;
    if (tick < impactTick) {
      const windup = Math.max(1, impactTick - action.startTick);
      frame = Math.min(impactPose - 1, Math.floor(Math.max(0, tick - action.startTick) / windup * impactPose));
    } else if (['brawler.flurry','assassin.vital_combo','rune_mage.triple_rune','ancient_one.primordial_fissure'].includes(action.skillId??'') && action.impactTicks.length >= 3) {
      // Authored strike/release poses coincide with each committed server hit.
      // Persistent fields (e.g. flame wall) deliberately use only their release tick.
      const lastImpact = action.impactTicks[2]!;
      frame = tick < action.impactTicks[1]! ? impactPose : tick < lastImpact ? impactPose+1 :
        tick < lastImpact + Math.max(1, action.recoveryEndTick - lastImpact) * .5 ? impactPose+2 : count-1;
    } else {
      const recovery = Math.max(1, action.recoveryEndTick - impactTick);
      frame = Math.min(count - 1, impactPose + Math.floor((tick - impactTick) / recovery * (count - impactPose)));
    }
  } else if (tick >= hurtTick && tick - hurtTick < 3) {
    // A moving victim must still show the authored body recoil. Actions retain their
    // release clock; their hit response is a separate render-only sprite offset.
    state = 'hurt';
    frame = Math.min(1, Math.floor((tick - hurtTick) / 1.5));
  } else if (Math.hypot(unit.vx, unit.vy) > 1 || /ADVANCE|APPROACH|REPOSITION|RETREAT/.test(unit.state)) {
    state = 'walk';
    frame = Math.floor(tick / 3) % 4;
  } else {
    frame = Math.floor(tick / 12) % 2;
  }
  const angle = Math.atan2(unit.facingY, unit.facingX);
  const direction = (Math.round((Math.PI / 2 - angle) / (Math.PI / 4)) + 8) % 8;
  return { state, frame, direction, index: (HERO_ANIMATIONS[state].start + frame) * 8 + direction };
}
