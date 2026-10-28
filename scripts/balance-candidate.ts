/** Candidate-only symmetric structure/optional late-wave HP override. Never edits runtime source files. */
import fs from 'node:fs';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {setupBots,runMatch} from './simulate.js';
import BALANCE from '../src/shared/balance.js';

const label=process.argv[2]??'current-engine-hp13500',outer=Number(process.argv[3]??13500),inner=Number(process.argv[4]??18000),seeds=(process.argv[5]??'1001,1002,1003,1021').split(',').map(Number),healthPreset=process.argv[6]??'keep',guard=Number(process.argv[7]??outer),nexus=Number(process.argv[8]??inner);
if(!/^[a-zA-Z0-9_-]+$/.test(label)||![outer,inner,guard,nexus,...seeds].every(n=>Number.isInteger(n)&&n>0)||seeds.length>40||!['keep','234'].includes(healthPreset))throw new Error('Invalid candidate options');
const files=['src/server/combat.ts','src/server/combat-geometry.ts','src/server/room.ts','src/server/jungle.ts','src/shared/balance.ts','src/shared/engine-tactics.ts','src/shared/heroes.ts','src/shared/battle-map.ts','src/shared/jungle-balance.ts','src/shared/bot-balance.ts'];
const sourceHashes=Object.fromEntries(files.map(p=>[p,crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')])),originalStructureStats=structuredClone(BALANCE.structureStats),originalHealthPhases=structuredClone(BALANCE.minions.healthPhases);
BALANCE.structureStats.OUTER.hp=outer;BALANCE.structureStats.GUARD.hp=guard;
BALANCE.structureStats.INNER.hp=inner;BALANCE.structureStats.NEXUS.hp=nexus;
if(healthPreset==='234')BALANCE.minions.healthPhases=[{fromBattleSecond:0,multiplier:1},{fromBattleSecond:480,multiplier:2},{fromBattleSecond:600,multiplier:3},{fromBattleSecond:720,multiplier:4}];
const results:ReturnType<typeof runMatch>[]=[];
const evidence={label,started:new Date().toISOString(),commitSha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceHashes,candidateRunnerSha256:crypto.createHash('sha256').update(fs.readFileSync(new URL(import.meta.url))).digest('hex'),mode:'Candidate process memory only: same standard30 AI, quiz, resources, attack engine and nexus-only victory; both teams use the same structure/wave HP',originalStructureStats,candidateStructureStats:BALANCE.structureStats,healthPreset,originalHealthPhases,candidateHealthPhases:BALANCE.minions.healthPhases,unchangedPowerPhases:BALANCE.minions.powerPhases,unchangedStructureDamagePhases:BALANCE.minions.structureDamagePhases,observationCapSeconds:900,seeds,results};
fs.mkdirSync('artifacts/v02',{recursive:true});const file=`artifacts/v02/${label}.json`;
for(const seed of seeds){const result=runMatch(setupBots(seed),900);results.push(result);console.log(JSON.stringify({seed,phase:result.phase,seconds:result.battleSeconds,winner:result.winner,invalid:result.metrics?.invalidPositions,stalls:result.metrics?.stalledEvents,wall:result.wallSeconds}));fs.writeFileSync(file,JSON.stringify({...evidence,status:'RUNNING'},null,2)+'\n');}
const unchanged=files.every(p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')===sourceHashes[p]);
const completed=results.filter(r=>r.phase==='RESULT').length,inWindow=results.filter(r=>r.phase==='RESULT'&&r.battleSeconds>=600&&r.battleSeconds<=780).length;
const pass=completed===seeds.length&&inWindow>=Math.ceil(seeds.length*.75)&&results.every(r=>!r.metrics?.invalidPositions&&!r.negativeGold&&!r.activeHeroDuplicates)&&unchanged;
const summary={status:pass?'PROMISING_CANDIDATE':'REJECTED_CANDIDATE',completed,inWindow,sourceUnchangedDuringRun:unchanged,finished:new Date().toISOString()};
fs.writeFileSync(file,JSON.stringify({...evidence,...summary},null,2)+'\n');console.log(JSON.stringify(summary));if(!pass)process.exitCode=1;
