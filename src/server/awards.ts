import type { Award, MatchResult, PlayerStats, Team } from '../shared/types.js';
export function makeResult(matchId: string, winner: Team | 'DRAW' | null, battleSeconds: number, players: MatchResult['players'], cancelled=false): MatchResult {
  const humans = players.filter(p => !p.isBot), candidates = humans.length ? humans : players;
  const aiOnly = !humans.length;
  const fields = ['heroDamage','structureDamage','healing','shielding','damageTaken','ccSeconds','correct'] as const;
  const maxima = Object.fromEntries(fields.map(k => [k, Math.max(0,...candidates.map(p=>p.stats[k]))]));
  const norm = (v:number,max:number)=>max>0?v/max:0;
  const supportMax = Math.max(0,...candidates.map(p=>p.stats.healing+p.stats.shielding));
  const defenseMax = Math.max(0,...candidates.map(p=>p.stats.damageTaken+p.stats.shielding));
  const scorers: [string,string,(s:PlayerStats)=>number][] = [
    ['learning','학습왕',s=>s.correct],['siege','공성왕',s=>s.structureDamage],['sword','전장의 검',s=>s.heroDamage],['wall','수호의 벽',s=>s.damageTaken+s.shielding],['healing','구원의 손',s=>s.healing+s.shielding],['control','전술 지원',s=>s.ccSeconds],
    ['mvp','팀 기여 MVP',s=>0.4*Math.max(norm(s.heroDamage,maxima.heroDamage),norm(s.healing+s.shielding,supportMax),norm(s.damageTaken+s.shielding,defenseMax))+0.25*norm(s.structureDamage,maxima.structureDamage)+0.15*norm(s.ccSeconds,maxima.ccSeconds)+0.2*norm(s.correct,maxima.correct)]
  ];
  const awards: Award[] = scorers.map(([id,name,score])=>{
    const value=Math.max(0,...candidates.map(p=>score(p.stats)));
    let winners = candidates.filter(p=>value>0 && Math.abs(score(p.stats)-value)<1e-8);
    if(id==='learning' && winners.length) { const accuracy = Math.max(...winners.map(p=>p.stats.correct/Math.max(1,p.stats.answered))); winners=winners.filter(p=>p.stats.correct/Math.max(1,p.stats.answered)===accuracy); }
    return {id,name,playerIds:winners.map(p=>p.playerId),value,aiOnly};
  });
  return {matchId,winner,cancelled,battleSeconds,players:structuredClone(players),awards:cancelled?[]:awards};
}
