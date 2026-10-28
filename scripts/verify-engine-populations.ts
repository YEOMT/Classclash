import fs from 'node:fs';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createRoom} from '../src/server/room.js';
import {apply,runMatch} from './simulate.js';

const files=['src/server/combat.ts','src/server/combat-geometry.ts','src/server/room.ts','src/server/jungle.ts','src/shared/balance.ts','src/shared/engine-tactics.ts','src/shared/heroes.ts','src/shared/battle-map.ts','src/shared/jungle-balance.ts','src/shared/bot-balance.ts'];
const hashes=Object.fromEntries(files.map(p=>[p,crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')]));
const cases=[{seed:2301,count:5,reverse:false},{seed:2302,count:10,reverse:false},{seed:2303,count:20,reverse:false},{seed:2304,count:30,reverse:false},{seed:2304,count:30,reverse:true}];
const results:(ReturnType<typeof runMatch>&{count:number;reverse:boolean;initialTeams:{id:string;team:'A'|'B'}[]})[]=[];
const evidence={started:new Date().toISOString(),commitSha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),engineSourceHashes:hashes,mode:'Real standard AI through public host commands; same production engine/quiz/economy; no injected resources or stats',performanceCaveat:'Fixed-step simulation while other tests may run; not live1x performance evidence',observationCapSeconds:900,results};
fs.mkdirSync('artifacts/v02',{recursive:true});
for(const c of cases){
 const room=createRoom('SIM001','test',c.seed,true);
 for(let i=0;i<c.count;i++)apply(room,'host','ADD_BOTS',{count:1,profile:'STANDARD',team:(i%2===0)!==c.reverse?'A':'B'});
 const initialTeams=room.players.map(p=>({id:p.playerId,team:p.team}));
 apply(room,'host','START_OPENING_QUIZ',{seed:c.seed});
 const result={...c,initialTeams,...runMatch(room,900)};results.push(result);
 console.log(JSON.stringify({seed:c.seed,count:c.count,reverse:c.reverse,phase:result.phase,seconds:result.battleSeconds,winner:result.winner,invalid:result.metrics?.invalidPositions,stalls:result.metrics?.stalledEvents}));
 fs.writeFileSync('artifacts/v02/population-mirror-results.json',JSON.stringify({...evidence,status:'RUNNING'},null,2)+'\n');
}
const pair=results.filter(r=>r.count===30),ordinary=pair[0]!,reversed=pair[1]!;
const unchanged=files.every(p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')===hashes[p]);
const status=results.every(r=>r.phase==='RESULT'&&!r.negativeGold&&!r.activeHeroDuplicates&&!r.metrics?.invalidPositions)&&unchanged?'PASS':'FAIL';
const mirror={pairedSeeds:1,ordinaryWinner:ordinary.winner,reversedWinner:reversed.winner,sameParticipantGroupWon:ordinary.winner==='DRAW'?reversed.winner==='DRAW':ordinary.winner!==reversed.winner,durationDifferenceSeconds:reversed.battleSeconds-ordinary.battleSeconds,note:'One pair is descriptive, not a statistical fairness claim. The supplied LOL lane geometry is not perfectly mirrored.'};
fs.writeFileSync('artifacts/v02/population-mirror-results.json',JSON.stringify({...evidence,status,sourceUnchangedDuringRun:unchanged,finished:new Date().toISOString(),mirror},null,2)+'\n');
console.log(JSON.stringify({status,mirror,sourceUnchangedDuringRun:unchanged}));if(status==='FAIL')process.exitCode=1;
