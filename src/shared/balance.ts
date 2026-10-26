import proposed from '../../docs/specification/balance.defaults.json';

/** Runtime balance. Original design defaults remain untouched in docs/specification.
 * The initial five-second preparation period and reactive bot lane policy
 * erased siege openings. Twenty seconds gives both teams meaningful push
 * windows, with an explicit deployment still required after the delay. Structure
 * durability is tuned against complete STANDARD matches; damage comes only from
 * actual attacks and the declared symmetric minion siege phases.
 */
export const BALANCE = {
  ...proposed,
  deployment: {...proposed.deployment, minimumDeadWaitSeconds: 20},
  minions: {...proposed.minions, structureDamagePhases: [
    {fromBattleSecond:0,multiplier:1},
    {fromBattleSecond:480,multiplier:2},
    {fromBattleSecond:600,multiplier:8},
    {fromBattleSecond:720,multiplier:16},
  ]},
  structureStats: {
    ...proposed.structureStats,
    OUTER: {...proposed.structureStats.OUTER, hp: 9000},
    INNER: {...proposed.structureStats.INNER, hp: 12000},
    GUARD: {...proposed.structureStats.GUARD, hp: 9000},
    NEXUS: {...proposed.structureStats.NEXUS, hp: 12000},
  },
};
export default BALANCE;
