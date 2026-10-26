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
  structureStats: {
    ...proposed.structureStats,
    OUTER: {...proposed.structureStats.OUTER, hp: 8100},
    INNER: {...proposed.structureStats.INNER, hp: 10800},
    GUARD: {...proposed.structureStats.GUARD, hp: 12600},
    NEXUS: {...proposed.structureStats.NEXUS, hp: 19800},
  },
};
export default BALANCE;
