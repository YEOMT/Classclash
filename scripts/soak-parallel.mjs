// Independent same-engine fixed-step matches. This measures outcomes, not live
// server throughput: concurrent worker timing is deliberately labelled below.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn,execFileSync} from 'node:child_process';
const count=Number(process.env.SEEDS||40),workers=Math.min(count,Number(process.env.SOAK_WORKERS||2)),startSeed=Number(process.env.SEED_START||1001),limit=Number(process.env.MATCH_LIMIT||900),prefix=process.env.SOAK_PREFIX||'v02-final';
if(!Number.isInteger(count)||count<1||count>200||!Number.isInteger(workers)||workers<1||workers>8||!Number.isFinite(limit)||limit<1||!/^[a-zA-Z0-9_-]+$/.test(prefix))throw new Error('Invalid soak runner options');
fs.mkdirSync('artifacts',{recursive:true});
const engineFiles=['src/server/combat.ts','src/server/combat-geometry.ts','src/server/room.ts','src/server/jungle.ts','src/shared/balance.ts','src/shared/engine-tactics.ts','src/shared/heroes.ts','src/shared/battle-map.ts','src/shared/jungle-balance.ts','src/shared/bot-balance.ts'];
const hashes=Object.fromEntries(engineFiles.map(p=>[p,crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')]));
const commitSha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const started=new Date().toISOString();
let nextSeed=startSeed;
const jobs=Array.from({length:workers},(_,i)=>{const n=Math.floor(count/workers)+(i<count%workers?1:0),job={index:i,count:n,start:nextSeed,prefix:`${prefix}-worker-${i}`};nextSeed+=n;return job;});
await Promise.all(jobs.map(job=>new Promise(resolve=>{
 const stream=fs.createWriteStream(path.join('artifacts',job.prefix+'.log'));
 const child=spawn(process.execPath,['--import','tsx','scripts/soak-test.ts'],{cwd:process.cwd(),env:{...process.env,SEEDS:String(job.count),SEED_START:String(job.start),MATCH_LIMIT:String(limit),SOAK_PREFIX:job.prefix,SIM_PROGRESS:'0'},windowsHide:true,stdio:['ignore','pipe','pipe']});
 let pending='';child.stdout.on('data',chunk=>{stream.write(chunk);pending+=chunk.toString();let at;while((at=pending.indexOf('\n'))>=0){const line=pending.slice(0,at);pending=pending.slice(at+1);try{const r=JSON.parse(line);if(r.seed&&r.phase)console.log(JSON.stringify({seed:r.seed,phase:r.phase,seconds:r.battleSeconds,stalls:r.metrics?.stalledEvents,invalid:r.metrics?.invalidPositions}));}catch{}}});
 child.stderr.on('data',chunk=>stream.write(chunk));child.on('error',error=>{stream.write(String(error));job.error=String(error);stream.end();resolve();});child.on('exit',code=>{job.exitCode=code;stream.end();resolve();});
})));
const results=jobs.flatMap(job=>{const file=path.join('artifacts',job.prefix+'-results.json');return fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')).results:[];}).sort((a,b)=>a.seed-b.seed);
const durations=results.filter(r=>r.phase==='RESULT').map(r=>r.battleSeconds).sort((a,b)=>a-b),median=durations.length?durations.length%2?durations[(durations.length-1)/2]:(durations[durations.length/2-1]+durations[durations.length/2])/2:null;
const unchanged=engineFiles.every(p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')===hashes[p]);
const summary={requested:count,recorded:results.length,completed:durations.length,unfinished:count-durations.length,inTarget:durations.filter(n=>n>=600&&n<=780).length,median,min:durations[0]??null,max:durations.at(-1)??null,invalidPositions:results.reduce((n,r)=>n+(r.metrics?.invalidPositions??0),0),stalls:results.reduce((n,r)=>n+(r.metrics?.stalledEvents??0),0),negativeGold:results.some(r=>r.negativeGold),duplicateHeroes:results.some(r=>r.activeHeroDuplicates),sourceUnchangedDuringRun:unchanged};
const pass=summary.recorded===count&&summary.completed===count&&summary.inTarget>=Math.ceil(count*.7)&&median>=600&&median<=780&&!summary.invalidPositions&&!summary.negativeGold&&!summary.duplicateHeroes&&unchanged;
const evidence={status:pass?'PASS':'FAIL',mode:'fixed-step same production engine, deterministic STANDARD30, no resource/stat cheats',performanceCaveat:'Worker tick times include contention; not live 1x DB/broadcast benchmark.',commitSha,uncommittedEngineSourceHashes:hashes,started,finished:new Date().toISOString(),workers,startSeed,matchLimitSeconds:limit,summary,jobs,results};
fs.writeFileSync(path.join('artifacts',prefix+'-results.json'),JSON.stringify(evidence,null,2)+'\n');
fs.writeFileSync(path.join('artifacts',prefix+'-summary.json'),JSON.stringify({status:evidence.status,...summary},null,2)+'\n');
console.log(JSON.stringify({status:evidence.status,...summary}));if(!pass)process.exitCode=1;
