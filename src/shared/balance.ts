import proposed from '../../docs/specification/balance.defaults.json';
import { BATTLE_MAP } from './battle-map.js';

/** Runtime balance. Original design defaults remain untouched in docs/specification.
 * The initial five-second preparation period and reactive bot lane policy
 * erased siege openings. Twenty seconds gives both teams meaningful push
 * windows, with an explicit deployment still required after the delay. Structure
 * durability is tuned against complete STANDARD matches; damage comes only from
 * actual attacks and the declared symmetric minion siege phases.
 */
export const BALANCE = {
  ...proposed,
  map: BATTLE_MAP,
  deployment: {...proposed.deployment, minimumDeadWaitSeconds: 20},
  minions: {...proposed.minions,
    waveIntervalSeconds: 35,
    formation: {melee: [-28, 0, 28], ranged: [-42, -14, 14, 42]},
    // All melee and ranged hits deal 40% of their previous base damage.
    melee: {...proposed.minions.melee, power: proposed.minions.melee.power * .4},
    ranged: {...proposed.minions.ranged, power: Number((proposed.minions.ranged.power * .4).toFixed(2))},
    // Stronger late waves can escort heroes through the longer three-lane map.
    powerPhases: [{fromBattleSecond:0,multiplier:1},{fromBattleSecond:480,multiplier:2},{fromBattleSecond:600,multiplier:4},{fromBattleSecond:720,multiplier:6}],
    healthPhases: [{fromBattleSecond:0,multiplier:1},{fromBattleSecond:480,multiplier:3},{fromBattleSecond:600,multiplier:8},{fromBattleSecond:720,multiplier:12}],
    structureDamagePhases: [
    {fromBattleSecond:0,multiplier:1},
    {fromBattleSecond:480,multiplier:2},
    {fromBattleSecond:600,multiplier:8},
    {fromBattleSecond:720,multiplier:16},
  ]},
  structureStats: {
    ...proposed.structureStats,
    OUTER: {...proposed.structureStats.OUTER, hp: 7500},
    INNER: {...proposed.structureStats.INNER, hp: 10000},
    GUARD: {...proposed.structureStats.GUARD, hp: 7500},
    NEXUS: {...proposed.structureStats.NEXUS, hp: 10000},
  },
};
export default BALANCE;
