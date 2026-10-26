/** v0.1 playtest adjustment: act on a breached lane instead of permanently
 * equalizing every enemy arrival. No private enemy data or stat bonuses. */
export const BOT_TACTICS = {
  enemyPressureWeight: 0.75,
  objectiveWeight: 3,
  populationWeight: 2,
  maxAssaultFraction: 0.72,
  outerBreachOpportunity: 2,
  innerBreachOpportunity: 5,
  damagedObjectiveWeight: 3,
};
