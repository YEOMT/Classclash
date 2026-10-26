import { writeFileSync, mkdirSync } from 'node:fs';
import { setupBots, runMatch, apply } from './simulate.js';
import BALANCE from '../src/shared/balance.js';
const count=Number(process.env.SEEDS||40),startSeed=Number(process.env.SEED_START||1001),limit=Number(process.env.MATCH_LIMIT||900),results=[];
const outputPrefix=process.env.SOAK_PREFIX||'soak';
if(!/^[a-zA-Z0-9_-]+$/.test(outputPrefix))throw new Error('SOAK_PREFIX must be a plain filename prefix');
const evidence={mode:'same-engine fixed-tick acceleration; no stat/resource cheats',balance:{structureStats:BALANCE.structureStats,minimumDeadWaitSeconds:BALANCE.deployment.minimumDeadWaitSeconds},startSeed,matchLimitSeconds:limit};
mkdirSync('artifacts',{recursive:true});
for(let i=0;i<count;i++){
  const room=setupBots(startSeed+i);const result=runMatch(room,limit);results.push(result);console.log(JSON.stringify(result));writeFileSync(`artifacts/${outputPrefix}-results.json`,JSON.stringify({...evidence,results},null,2));
}
const durations=results.filter(r=>r.phase==='RESULT').map(r=>r.battleSeconds).sort((a,b)=>a-b),pct=(p:number)=>durations[Math.floor((durations.length-1)*p)]||null;
const summary={matches:count,completed:durations.length,inTarget:durations.filter(s=>s>=600&&s<=780).length,p10:pct(.1),p25:pct(.25),median:pct(.5),p75:pct(.75),p90:pct(.9),after13:durations.filter(s=>s>780).length,unfinished:count-durations.length};
writeFileSync(`artifacts/${outputPrefix}-summary.json`,JSON.stringify(summary,null,2));console.log(summary);
if(results.some(r=>r.phase!=='RESULT'||r.negativeGold||r.activeHeroDuplicates)||summary.inTarget<Math.ceil(count*.7))process.exitCode=1;
